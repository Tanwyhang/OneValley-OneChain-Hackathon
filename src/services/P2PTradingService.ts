/**
 * P2P Trading Service
 *
 * Manages player-to-player trading proposals, matching, and execution
 * using OneChain escrow system for secure trades.
 */

import {
  FrontendItem,
  TradeProposalFrontend,
  EscrowedItemFrontend,
  TradeProposal,
  Address,
  ID,
  ItemType,
  RarityLevel,
  ITEM_TYPES,
  RARITY_LEVELS
} from '../types/onechain';
import { OneChainTransactionService } from './OneChainTransactionService';
import { ItemWalletService } from './ItemWalletService';
import { ItemLockingService } from './ItemLockingService';

export interface TradeProposalCreateParams {
  proposer_items: string[];
  desired_items: string[];
  target_player?: Address; // undefined = open to anyone
  message?: string;
  expiry_hours?: number;
}

export interface TradeMatch {
  proposal1: TradeProposalFrontend;
  proposal2: TradeProposalFrontend;
  compatibility_score: number;
}

export interface TradeFilter {
  item_type?: ItemType;
  rarity?: RarityLevel;
  min_value?: number;
  max_value?: number;
  open_only?: boolean;
  proposer_address?: Address;
  search?: string;
}

export interface P2PTradingStats {
  total_proposals: number;
  active_proposals: number;
  completed_trades: number;
  average_trade_value: number;
  most_traded_items: Array<{
    item_id: string;
    name: string;
    trade_count: number;
  }>;
}

export class P2PTradingService {
  private oneChainService: OneChainTransactionService;
  private itemWalletService: ItemWalletService;
  private itemLockingService: ItemLockingService;
  private currentAddress: string | null = null;

  // In-memory storage (in production, this would be a backend/database)
  private tradeProposals: Map<string, TradeProposalFrontend> = new Map();
  private activeEscrows: Map<string, EscrowedItemFrontend> = new Map();
  private tradeHistory: Map<Address, TradeProposalFrontend[]> = new Map();

  // Configuration
  private readonly DEFAULT_EXPIRY_HOURS = 24;
  private readonly MAX_PROPOSALS_PER_PLAYER = 10;
  private readonly TRADE_FEE_RATE = 0.01; // 1% fee

  constructor(
    oneChainService: OneChainTransactionService,
    itemWalletService: ItemWalletService,
    itemLockingService: ItemLockingService
  ) {
    this.oneChainService = oneChainService;
    this.itemWalletService = itemWalletService;
    this.itemLockingService = itemLockingService;
  }

  /**
   * Set the current wallet address
   */
  setCurrentAddress(address: string) {
    this.currentAddress = address;
  }

  /**
   * Create a new trade proposal
   */
  async createTradeProposal(params: TradeProposalCreateParams): Promise<{
    success: boolean;
    proposalId?: string;
    error?: string;
  }> {
    if (!this.currentAddress) {
      return { success: false, error: 'No wallet connected' };
    }

    try {
      // Validate parameters
      const validation = await this.validateProposalCreation(params);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Get item details
      const proposerItems = await this.getItemsByIds(params.proposer_items);
      const desiredItems = await this.getItemsByIds(params.desired_items);

      // Calculate trade values
      const proposerValue = this.calculateTotalValue(proposerItems);
      const desiredValue = this.calculateTotalValue(desiredItems);

      // Create proposal
      const proposal: TradeProposalFrontend = {
        id: `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        proposer: this.currentAddress,
        proposer_items: proposerItems.map(item => ({ ...item, selected: false })),
        requested_items: desiredItems.map(item => ({ ...item, selected: false })),
        status: 'pending',
        created_at: Date.now(),
        expires_at: Date.now() + (params.expiry_hours || this.DEFAULT_EXPIRY_HOURS) * 60 * 60 * 1000,
        message: params.message || '',
        target_player: params.target_player
      };

      // Store proposal
      this.tradeProposals.set(proposal.id, proposal);

      // Add to proposer's history
      const proposerHistory = this.tradeHistory.get(this.currentAddress) || [];
      proposerHistory.push(proposal);
      this.tradeHistory.set(this.currentAddress, proposerHistory);

      // Emit event (for real-time updates)
      this.emitTradeEvent('proposal_created', proposal);

      return { success: true, proposalId: proposal.id };
    } catch (error) {
      console.error('Error creating trade proposal:', error);
      return { success: false, error: 'Failed to create trade proposal' };
    }
  }

  /**
   * Validate trade proposal creation
   */
  private async validateProposalCreation(params: TradeProposalCreateParams): Promise<{
    valid: boolean;
    error?: string;
  }> {
    if (!this.currentAddress) {
      return { valid: false, error: 'No wallet connected' };
    }

    if (params.proposer_items.length === 0) {
      return { valid: false, error: 'Must offer at least one item' };
    }

    if (params.desired_items.length === 0) {
      return { valid: false, error: 'Must request at least one item' };
    }

    // Check player owns the offered items
    try {
      const playerInventory = await this.itemWalletService.getPlayerInventory();
      const ownedItemIds = playerInventory.map(item => item.id);

      for (const itemId of params.proposer_items) {
        if (!ownedItemIds.includes(itemId)) {
          return { valid: false, error: `You don't own item: ${itemId}` };
        }

        if (this.itemLockingService.isItemLocked(itemId)) {
          return { valid: false, error: `Item is locked in another trade: ${itemId}` };
        }
      }
    } catch (error) {
      return { valid: false, error: 'Failed to verify player inventory' };
    }

    // Check proposal limit
    const playerProposals = await this.getPlayerProposals(this.currentAddress);
    const activeProposals = playerProposals.filter(p =>
      p.status === 'pending' && p.expires_at > Date.now()
    );

    if (activeProposals.length >= this.MAX_PROPOSALS_PER_PLAYER) {
      return { valid: false, error: 'Maximum active proposals reached' };
    }

    return { valid: true };
  }

  /**
   * Get trade proposals by filter
   */
  async getTradeProposals(filter?: TradeFilter): Promise<TradeProposalFrontend[]> {
    const allProposals = Array.from(this.tradeProposals.values());

    return allProposals.filter(proposal => {
      // Filter by status and expiry
      if (proposal.status !== 'pending' || proposal.expires_at <= Date.now()) {
        return false;
      }

      // Skip own proposals unless specifically requested
      if (filter?.proposer_address && proposal.proposer !== filter.proposer_address) {
        return false;
      }

      if (!filter?.proposer_address && proposal.proposer === this.currentAddress) {
        return false; // Don't show own proposals in general list
      }

      // Open only filter
      if (filter?.open_only && proposal.target_player) {
        return false;
      }

      // Specific proposer filter
      if (filter?.proposer_address && proposal.proposer !== filter.proposer_address) {
        return false;
      }

      // Item type filter
      if (filter?.item_type) {
        const hasRequestedType = proposal.requested_items.some(item =>
          item.item_type === filter.item_type
        );
        const hasOfferedType = proposal.proposer_items.some(item =>
          item.item_type === filter.item_type
        );
        if (!hasRequestedType && !hasOfferedType) {
          return false;
        }
      }

      // Rarity filter
      if (filter?.rarity) {
        const hasRequestedRarity = proposal.requested_items.some(item =>
          item.rarity === filter.rarity
        );
        const hasOfferedRarity = proposal.proposer_items.some(item =>
          item.rarity === filter.rarity
        );
        if (!hasRequestedRarity && !hasOfferedRarity) {
          return false;
        }
      }

      // Value range filter
      const proposerValue = this.calculateTotalValue(proposal.proposer_items);
      const requestedValue = this.calculateTotalValue(proposal.requested_items);

      if (filter?.min_value && proposerValue < filter.min_value) {
        return false;
      }

      if (filter?.max_value && proposerValue > filter.max_value) {
        return false;
      }

      // Search filter
      if (filter?.search) {
        const searchLower = filter.search.toLowerCase();
        const hasMatch = [
          ...proposal.proposer_items,
          ...proposal.requested_items
        ].some(item =>
          item.name.toLowerCase().includes(searchLower) ||
          item.description.toLowerCase().includes(searchLower)
        );
        if (!hasMatch && !proposal.message?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get proposals created by a specific player
   */
  async getPlayerProposals(address?: string): Promise<TradeProposalFrontend[]> {
    const playerAddress = address || this.currentAddress;
    if (!playerAddress) {
      return [];
    }

    const history = this.tradeHistory.get(playerAddress) || [];
    return history.filter(proposal => proposal.proposer === playerAddress);
  }

  /**
   * Accept a trade proposal
   */
  async acceptTradeProposal(proposalId: string): Promise<{
    success: boolean;
    tradeId?: string;
    error?: string;
  }> {
    if (!this.currentAddress) {
      return { success: false, error: 'No wallet connected' };
    }

    const proposal = this.tradeProposals.get(proposalId);
    if (!proposal) {
      return { success: false, error: 'Trade proposal not found' };
    }

    if (proposal.proposer === this.currentAddress) {
      return { success: false, error: 'Cannot accept your own proposal' };
    }

    if (proposal.status !== 'pending') {
      return { success: false, error: 'Proposal is no longer active' };
    }

    if (proposal.expires_at <= Date.now()) {
      return { success: false, error: 'Proposal has expired' };
    }

    if (proposal.target_player && proposal.target_player !== this.currentAddress) {
      return { success: false, error: 'This proposal is not available to you' };
    }

    try {
      // Check if player has the requested items
      const playerInventory = await this.itemWalletService.getPlayerInventory();
      const ownedItemIds = playerInventory.map(item => item.id);

      for (const item of proposal.requested_items) {
        if (!ownedItemIds.includes(item.id)) {
          return { success: false, error: `You don't have the required item: ${item.name}` };
        }

        if (this.itemLockingService.isItemLocked(item.id)) {
          return { success: false, error: `Item is locked: ${item.name}` };
        }
      }

      // Execute trade using escrow system
      const result = await this.executeP2PTrade(proposal);

      if (result.success) {
        // Update proposal status
        proposal.status = 'completed';
        this.tradeProposals.set(proposalId, proposal);

        // Update both players' trade history
        const proposerHistory = this.tradeHistory.get(proposal.proposer) || [];
        proposerHistory.push(proposal);
        this.tradeHistory.set(proposal.proposer, proposerHistory);

        const acceptorHistory = this.tradeHistory.get(this.currentAddress) || [];
        acceptorHistory.push(proposal);
        this.tradeHistory.set(this.currentAddress, acceptorHistory);

        // Emit events
        this.emitTradeEvent('trade_completed', proposal);

        return { success: true, tradeId: result.tradeId };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error accepting trade proposal:', error);
      return { success: false, error: 'Failed to accept trade proposal' };
    }
  }

  /**
   * Execute P2P trade using escrow
   */
  private async executeP2PTrade(proposal: TradeProposalFrontend): Promise<{
    success: boolean;
    tradeId?: string;
    error?: string;
  }> {
    try {
      // Step 1: Lock proposer's items (these should already be locked when proposal was made)
      // In a real implementation, items would be locked when creating the proposal

      // Step 2: Lock acceptor's items
      const acceptorLocks = await Promise.all(
        proposal.requested_items.map(item =>
          this.itemLockingService.lockItem(item.id, item)
        )
      );

      // Step 3: Create escrows for both sides
      const proposerEscrow = await this.oneChainService.initiateTrade(
        acceptorLocks[0].keyId, // Use acceptor's key to lock proposer's items
        'locked_proposer_items', // Would be actual locked object ID
        acceptorLocks[0].keyId, // Exchange key
        this.currentAddress!, // Recipient is the acceptor
        '0x...' // Custodian address
      );

      // Step 4: Execute swap through custodian
      const swapResult = await this.oneChainService.executeSwap(
        'proposer_escrow_id',
        'acceptor_escrow_id'
      );

      return {
        success: true,
        tradeId: swapResult.transactionDigest
      };
    } catch (error) {
      console.error('Error executing P2P trade:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Trade execution failed'
      };
    }
  }

  /**
   * Cancel a trade proposal
   */
  async cancelTradeProposal(proposalId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!this.currentAddress) {
      return { success: false, error: 'No wallet connected' };
    }

    const proposal = this.tradeProposals.get(proposalId);
    if (!proposal) {
      return { success: false, error: 'Trade proposal not found' };
    }

    if (proposal.proposer !== this.currentAddress) {
      return { success: false, error: 'Can only cancel your own proposals' };
    }

    if (proposal.status !== 'pending') {
      return { success: false, error: 'Proposal is no longer active' };
    }

    // Update status
    proposal.status = 'cancelled';
    this.tradeProposals.set(proposalId, proposal);

    // Unlock any locked items
    for (const item of proposal.proposer_items) {
      try {
        const lockInfo = this.itemLockingService.getLockInfo(item.id);
        if (lockInfo) {
          await this.itemLockingService.unlockItem(lockInfo.id, lockInfo.key_id);
        }
      } catch (error) {
        console.error('Failed to unlock item:', item.id, error);
      }
    }

    this.emitTradeEvent('proposal_cancelled', proposal);

    return { success: true };
  }

  /**
   * Find compatible trade proposals for matching
   */
  async findCompatibleProposals(
    playerItems: FrontendItem[],
    maxResults: number = 10
  ): Promise<TradeMatch[]> {
    const allProposals = await this.getTradeProposals({ open_only: true });
    const matches: TradeMatch[] = [];

    const playerValue = this.calculateTotalValue(playerItems);

    for (const proposal of allProposals) {
      if (proposal.proposer === this.currentAddress) continue;

      const proposalValue = this.calculateTotalValue(proposal.proposer_items);
      const desiredValue = this.calculateTotalValue(proposal.requested_items);

      // Simple compatibility scoring
      let score = 0;

      // Value compatibility
      const valueDiff = Math.abs(playerValue - proposalValue);
      if (valueDiff < 10) score += 50;
      else if (valueDiff < 20) score += 30;
      else if (valueDiff < 50) score += 10;

      // Item type compatibility
      const playerTypes = new Set(playerItems.map(item => item.item_type));
      const requestedTypes = new Set(proposal.requested_items.map(item => item.item_type));
      const proposerTypes = new Set(proposal.proposer_items.map(item => item.item_type));

      const typeMatch = [...playerTypes].filter(type => requestedTypes.has(type)).length +
                      [...proposerTypes].filter(type => playerTypes.some(item => item.item_type === type)).length;

      score += typeMatch * 10;

      if (score > 20) { // Minimum threshold
        matches.push({
          proposal1: {
            id: 'current_player',
            proposer: this.currentAddress!,
            proposer_items: playerItems.map(item => ({ ...item, selected: false })),
            requested_items: proposal.proposer_items.map(item => ({ ...item, selected: false })),
            status: 'pending',
            created_at: Date.now(),
            expires_at: Date.now() + 24 * 60 * 60 * 1000,
          },
          proposal2: proposal,
          compatibility_score: score
        });
      }
    }

    return matches
      .sort((a, b) => b.compatibility_score - a.compatibility_score)
      .slice(0, maxResults);
  }

  /**
   * Get P2P trading statistics
   */
  async getTradingStats(): Promise<P2PTradingStats> {
    const allProposals = Array.from(this.tradeProposals.values());
    const activeProposals = allProposals.filter(p => p.status === 'pending');
    const completedTrades = allProposals.filter(p => p.status === 'completed');

    // Calculate average trade value
    const tradeValues = completedTrades.map(trade =>
      this.calculateTotalValue(trade.proposer_items)
    );
    const averageTradeValue = tradeValues.length > 0
      ? tradeValues.reduce((sum, value) => sum + value, 0) / tradeValues.length
      : 0;

    // Find most traded items
    const itemTradeCounts: Map<string, { name: string; count: number }> = new Map();
    completedTrades.forEach(trade => {
      [...trade.proposer_items, ...trade.requested_items].forEach(item => {
        const current = itemTradeCounts.get(item.id) || { name: item.name, count: 0 };
        current.count++;
        itemTradeCounts.set(item.id, current);
      });
    });

    const mostTradedItems = Array.from(itemTradeCounts.entries())
      .map(([itemId, data]) => ({ item_id: itemId, ...data }))
      .sort((a, b) => b.trade_count - a.trade_count)
      .slice(0, 10);

    return {
      total_proposals: allProposals.length,
      active_proposals: activeProposals.length,
      completed_trades: completedTrades.length,
      average_trade_value,
      most_traded_items
    };
  }

  /**
   * Helper methods
   */

  private async getItemsByIds(itemIds: string[]): Promise<FrontendItem[]> {
    const items: FrontendItem[] = [];

    for (const itemId of itemIds) {
      const item = await this.itemWalletService.getItemById(itemId);
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  private calculateTotalValue(items: FrontendItem[]): number {
    return items.reduce((total, item) => {
      let value = 1;

      // Rarity value
      const rarityValues = {
        [RARITY_LEVELS.COMMON]: 1,
        [RARITY_LEVELS.RARE]: 5,
        [RARITY_LEVELS.EPIC]: 20,
        [RARITY_LEVELS.LEGENDARY]: 100
      };
      value *= rarityValues[item.rarity];

      // Stats contribution
      value += item.stats.reduce((sum, stat) => sum + stat, 0) / 10;

      return total + value;
    }, 0);
  }

  private emitTradeEvent(eventType: string, data: any) {
    // This would emit events to a real-time system
    // For now, we'll just log them
    console.log(`Trade event: ${eventType}`, data);

    // Could integrate with WebSocket or event bus
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('trade_event', {
        detail: { type: eventType, data }
      }));
    }
  }

  /**
   * Cleanup expired proposals
   */
  cleanupExpiredProposals(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [id, proposal] of this.tradeProposals.entries()) {
      if (proposal.expires_at <= now && proposal.status === 'pending') {
        proposal.status = 'expired';
        this.tradeProposals.set(id, proposal);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get trade suggestions for player
   */
  async getTradeSuggestions(maxSuggestions: number = 5): Promise<Array<{
    proposed_items: FrontendItem[];
    suggested_partners: Array<{
      proposal: TradeProposalFrontend;
      compatibility_score: number;
    }>;
  }>> {
    const playerInventory = await this.itemWalletService.getPlayerInventory();
    const tradeableItems = playerInventory.filter(item =>
      !this.itemLockingService.isItemLocked(item.id)
    );

    if (tradeableItems.length === 0) {
      return [];
    }

    const suggestions = await this.findCompatibleProposals(tradeableItems, maxSuggestions);

    return suggestions.map(match => ({
      proposed_items: match.proposal1.proposer_items,
      suggested_partners: [{
        proposal: match.proposal2,
        compatibility_score: match.compatibility_score
      }]
    }));
  }
}