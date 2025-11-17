/**
 * Trading Demo Component
 *
 * A comprehensive demo that showcases the complete P2P trading functionality
 * including NPC trading, P2P proposals, and real-time events.
 */

import React, { useState, useEffect } from 'react';
import {
  initializeOneChainServices,
  getOneChainServices,
  OneChainTransactionService,
  ItemWalletService,
  ItemLockingService,
  NPCTradingService,
  P2PTradingService,
  TradeEventService
} from '../services';
import { NPCTradingManager } from './NPCTradingManager';
import { TradeNotificationCenter } from './TradeNotificationCenter';
import { FrontendItem, TradeProposalFrontend, ITEM_TYPES, RARITY_LEVELS } from '../types/onechain';

interface TradingDemoProps {
  currentAddress: string | null;
  onWalletConnect: () => void;
}

export const TradingDemo: React.FC<TradingDemoProps> = ({
  currentAddress,
  onWalletConnect
}) => {
  const [services, setServices] = useState<{
    oneChainService: OneChainTransactionService;
    itemWalletService: ItemWalletService;
    itemLockingService: ItemLockingService;
    npcTradingService: NPCTradingService;
    p2pTradingService: P2PTradingService;
    tradeEventService: TradeEventService;
  } | null>(null);

  const [demoState, setDemoState] = useState({
    activeTab: 'npc' as 'npc' | 'p2p' | 'inventory' | 'activities',
    playerInventory: [] as FrontendItem[],
    npcItems: [] as FrontendItem[],
    selectedPlayerItems: [] as string[],
    selectedNPCItems: [] as string[],
    tradeProposals: [] as TradeProposalFrontend[],
    isLoading: false,
    error: null as string | null
  });

  const [npcTradeState, setNpcTradeState] = useState({
    isNPCOpen: false,
    validation: null as any,
    tradeSuggestions: []
  });

  // Initialize services
  useEffect(() => {
    try {
      const servicesData = initializeOneChainServices();
      const servicesMapped = {
        oneChainService: servicesData.transactionService,
        itemWalletService: servicesData.itemWalletService,
        itemLockingService: servicesData.itemLockingService,
        npcTradingService: servicesData.npcTradingService,
        p2pTradingService: servicesData.p2pTradingService,
        tradeEventService: servicesData.tradeEventService
      };
      setServices(servicesMapped);
      console.log('OneChain services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize services:', error);
      setDemoState(prev => ({
        ...prev,
        error: 'Failed to initialize trading services'
      }));
    }
  }, []);

  // Update services when wallet connects
  useEffect(() => {
    if (services && currentAddress) {
      services.oneChainService.setCurrentAddress(currentAddress);
      services.itemWalletService.setCurrentAddress(currentAddress);
      services.itemLockingService.setCurrentAddress(currentAddress);
      services.npcTradingService.setCurrentAddress(currentAddress);
      services.p2pTradingService.setCurrentAddress(currentAddress);

      // Load initial data
      loadDemoData();
    }
  }, [services, currentAddress]);

  const loadDemoData = async () => {
    if (!services || !currentAddress) return;

    setDemoState(prev => ({ ...prev, isLoading: true }));

    try {
      // Load player inventory
      const playerInventory = await services.itemWalletService.getPlayerInventory();

      // For demo purposes, add some mock items if inventory is empty
      if (playerInventory.length === 0) {
        const mockItems = createMockPlayerItems(10);
        playerInventory.push(...mockItems);
      }

      // Load NPC items
      const npcItems = services.npcTradingService.getNPCItems();

      // Load P2P proposals
      const tradeProposals = await services.p2pTradingService.getTradeProposals();

      // Load trade suggestions
      const suggestions = await services.p2pTradingService.getTradeSuggestions();

      setDemoState(prev => ({
        ...prev,
        playerInventory,
        npcItems,
        tradeProposals,
        isLoading: false
      }));

      setNpcTradeState(prev => ({
        ...prev,
        tradeSuggestions: suggestions
      }));

    } catch (error) {
      console.error('Error loading demo data:', error);
      setDemoState(prev => ({
        ...prev,
        error: 'Failed to load demo data',
        isLoading: false
      }));
    }
  };

  const createMockPlayerItems = (count: number): FrontendItem[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `demo_item_${i}`,
      item_id: i,
      item_type: i % 4 === 0 ? ITEM_TYPES.WEAPON :
                   i % 4 === 1 ? ITEM_TYPES.ARMOR :
                   i % 4 === 2 ? ITEM_TYPES.CONSUMABLE : ITEM_TYPES.RESOURCE,
      rarity: i % 2 === 0 ? RARITY_LEVELS.COMMON :
                i % 3 === 0 ? RARITY_LEVELS.RARE :
                i % 4 === 0 ? RARITY_LEVELS.EPIC : RARITY_LEVELS.LEGENDARY,
      name: `Demo Item ${i}`,
      description: `A demo item for testing purposes`,
      stats: [10 + i, 20 + i],
      minted_by: currentAddress || 'demo_minter',
      mint_timestamp: Date.now() - (i * 1000000),
      owner_history: [currentAddress || 'demo_owner'],
      sprite_key: `item_${i % 10}`,
      stack_size: 1,
      equipped: false,
      locked: false
    }));
  };

  const handleNPCTrade = async () => {
    if (!services) return;

    setDemoState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await services.npcTradingService.executeTrade(
        demoState.selectedPlayerItems,
        demoState.selectedNPCItems
      );

      if (result.success) {
        alert('NPC Trade completed successfully!');
        setDemoState(prev => ({
          ...prev,
          selectedPlayerItems: [],
          selectedNPCItems: []
        }));
        await loadDemoData();
      } else {
        alert(`Trade failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Trade error: ${error}`);
    } finally {
      setDemoState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const createP2PProposal = async () => {
    if (!services || demoState.selectedPlayerItems.length === 0) {
      alert('Please select items to offer');
      return;
    }

    setDemoState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await services.p2pTradingService.createTradeProposal({
        proposer_items: demoState.selectedPlayerItems,
        desired_items: ['desired_item_example'], // Would be selected from UI
        message: 'Looking to trade my items!',
        expiry_hours: 24
      });

      if (result.success) {
        alert('Trade proposal created successfully!');
        setDemoState(prev => ({
          ...prev,
          selectedPlayerItems: []
        }));
        await loadDemoData();
      } else {
        alert(`Failed to create proposal: ${result.error}`);
      }
    } catch (error) {
      alert(`Proposal error: ${error}`);
    } finally {
      setDemoState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const acceptP2PProposal = async (proposalId: string) => {
    if (!services) return;

    setDemoState(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await services.p2pTradingService.acceptTradeProposal(proposalId);

      if (result.success) {
        alert('Trade proposal accepted and executed!');
        await loadDemoData();
      } else {
        alert(`Failed to accept proposal: ${result.error}`);
      }
    } catch (error) {
      alert(`Accept error: ${error}`);
    } finally {
      setDemoState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const togglePlayerItemSelection = (itemId: string) => {
    setDemoState(prev => ({
      ...prev,
      selectedPlayerItems: prev.selectedPlayerItems.includes(itemId)
        ? prev.selectedPlayerItems.filter(id => id !== itemId)
        : [...prev.selectedPlayerItems, itemId]
    }));
  };

  const toggleNPCItemSelection = (itemId: string) => {
    setDemoState(prev => ({
      ...prev,
      selectedNPCItems: prev.selectedNPCItems.includes(itemId)
        ? prev.selectedNPCItems.filter(id => id !== itemId)
        : [...prev.selectedNPCItems, itemId]
    }));
  };

  const getItemTypeColor = (itemType: number) => {
    const colors: Record<number, string> = {
      [ITEM_TYPES.WEAPON]: '#ef4444',
      [ITEM_TYPES.ARMOR]: '#3b82f6',
      [ITEM_TYPES.CONSUMABLE]: '#10b981',
      [ITEM_TYPES.RESOURCE]: '#f59e0b'
    };
    return colors[itemType] || '#6b7280';
  };

  const getRarityColor = (rarity: number) => {
    const colors: Record<number, string> = {
      [RARITY_LEVELS.COMMON]: '#9ca3af',
      [RARITY_LEVELS.RARE]: '#3b82f6',
      [RARITY_LEVELS.EPIC]: '#8b5cf6',
      [RARITY_LEVELS.LEGENDARY]: '#f59e0b'
    };
    return colors[rarity] || '#6b7280';
  };

  if (!currentAddress) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        background: '#1f2937',
        color: 'white',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
          OneValley P2P Trading Demo
        </h1>
        <p style={{ marginBottom: '2rem', color: '#9ca3af' }}>
          Connect your wallet to experience the complete trading system
        </p>
        <button
          onClick={onWalletConnect}
          style={{
            padding: '12px 24px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (!services) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: 'white'
      }}>
        <p>Loading trading services...</p>
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      background: '#111827',
      color: 'white',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '16px',
        background: '#1f2937',
        borderRadius: '8px'
      }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>
          OneValley Trading Demo
        </h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#9ca3af' }}>
            Connected: {currentAddress?.substring(0, 6)}...{currentAddress?.substring(currentAddress.length - 4)}
          </span>
          {services && (
            <TradeNotificationCenter
              tradeEventService={services.tradeEventService}
            />
          )}
        </div>
      </div>

      {/* Error Display */}
      {demoState.error && (
        <div style={{
          padding: '12px',
          background: '#dc2626',
          color: 'white',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {demoState.error}
        </div>
      )}

      {/* Loading Indicator */}
      {demoState.isLoading && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: '#1f2937',
          padding: '12px',
          borderRadius: '8px',
          zIndex: 1000
        }}>
          Processing...
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        marginBottom: '20px',
        borderBottom: '1px solid #374151'
      }}>
        {['npc', 'p2p', 'inventory', 'activities'].map((tab) => (
          <button
            key={tab}
            onClick={() => setDemoState(prev => ({ ...prev, activeTab: tab }))}
            style={{
              padding: '12px 24px',
              background: demoState.activeTab === tab ? '#374151' : 'transparent',
              color: 'white',
              border: 'none',
              borderBottom: demoState.activeTab === tab ? '2px solid #3b82f6' : 'none',
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {tab === 'p2p' ? 'P2P Trading' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* NPC Trading Tab */}
      {demoState.activeTab === 'npc' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Player Items */}
          <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0 }}>Your Items</h3>
            <div style={{ display: 'grid', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {demoState.playerInventory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => togglePlayerItemSelection(item.id)}
                  style={{
                    padding: '12px',
                    background: demoState.selectedPlayerItems.includes(item.id) ? '#374151' : '#111827',
                    border: `1px solid ${getRarityColor(item.rarity)}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{item.description}</div>
                    <div style={{ fontSize: '11px', color: getRarityColor(item.rarity) }}>
                      Rarity: {['Common', 'Rare', 'Epic', 'Legendary'][item.rarity - 1]}
                    </div>
                  </div>
                  <div style={{ fontSize: '18px' }}>
                    {demoState.selectedPlayerItems.includes(item.id) ? '✓' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* NPC Items */}
          <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0 }}>Herman's Items</h3>
            <div style={{ display: 'grid', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {demoState.npcItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => toggleNPCItemSelection(item.id)}
                  style={{
                    padding: '12px',
                    background: demoState.selectedNPCItems.includes(item.id) ? '#374151' : '#111827',
                    border: `1px solid ${getRarityColor(item.rarity)}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{item.description}</div>
                    <div style={{ fontSize: '11px', color: getRarityColor(item.rarity) }}>
                      Rarity: {['Common', 'Rare', 'Epic', 'Legendary'][item.rarity - 1]}
                    </div>
                  </div>
                  <div style={{ fontSize: '18px' }}>
                    {demoState.selectedNPCItems.includes(item.id) ? '✓' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* P2P Trading Tab */}
      {demoState.activeTab === 'p2p' && (
        <div>
          {/* Create Proposal Section */}
          <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3 style={{ marginTop: 0 }}>Create Trade Proposal</h3>
            <div style={{ marginBottom: '16px' }}>
              <p>Selected Items: {demoState.selectedPlayerItems.length}</p>
            </div>
            <button
              onClick={createP2PProposal}
              disabled={demoState.selectedPlayerItems.length === 0 || demoState.isLoading}
              style={{
                padding: '12px 24px',
                background: demoState.selectedPlayerItems.length > 0 ? '#10b981' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: demoState.selectedPlayerItems.length > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              Create Proposal
            </button>
          </div>

          {/* Active Proposals */}
          <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0 }}>Active Trade Proposals</h3>
            {demoState.tradeProposals.length === 0 ? (
              <p style={{ color: '#9ca3af' }}>No active proposals</p>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {demoState.tradeProposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    style={{
                      padding: '16px',
                      background: '#111827',
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>
                          From: {proposal.proposer.substring(0, 6)}...{proposal.proposer.substring(proposal.proposer.length - 4)}
                        </div>
                        <div style={{ fontSize: '14px', color: '#9ca3af', marginTop: '4px' }}>
                          Offering: {proposal.proposer_items.length} items |
                          Requesting: {proposal.requested_items.length} items
                        </div>
                        {proposal.message && (
                          <div style={{ fontSize: '13px', marginTop: '4px' }}>
                            "{proposal.message}"
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => acceptP2PProposal(proposal.id)}
                        disabled={proposal.proposer === currentAddress}
                        style={{
                          padding: '8px 16px',
                          background: proposal.proposer !== currentAddress ? '#3b82f6' : '#374151',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: proposal.proposer !== currentAddress ? 'pointer' : 'not-allowed',
                          fontSize: '12px'
                        }}
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {demoState.activeTab === 'inventory' && (
        <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0 }}>Complete Inventory</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {demoState.playerInventory.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '12px',
                  background: '#111827',
                  border: `1px solid ${getRarityColor(item.rarity)}`,
                  borderRadius: '8px'
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{item.name}</div>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>
                  {item.description}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: getItemTypeColor(item.item_type) }}>
                    {['Weapon', 'Armor', 'Consumable', 'Resource'][item.item_type - 1]}
                  </span>
                  <span style={{ color: getRarityColor(item.rarity) }}>
                    {['Common', 'Rare', 'Epic', 'Legendary'][item.rarity - 1]}
                  </span>
                </div>
                {item.locked && (
                  <div style={{ marginTop: '8px', color: '#ef4444', fontSize: '11px' }}>
                    🔒 Locked in trade
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activities Tab */}
      {demoState.activeTab === 'activities' && (
        <div style={{ background: '#1f2937', padding: '16px', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0 }}>Trading Activities</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {services.tradeEventService.getActivityLog().map((activity) => (
              <div
                key={activity.id}
                style={{
                  padding: '12px',
                  background: '#111827',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <span style={{ fontSize: '16px' }}>
                  {activity.type === 'trade_completed' ? '✅' :
                   activity.type === 'trade_proposal' ? '📋' :
                   activity.type === 'item_locked' ? '🔒' : '📄'}
                </span>
                <div style={{ flex: 1 }}>
                  <div>{activity.details}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                    {new Date(activity.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        gap: '12px'
      }}>
        {demoState.activeTab === 'npc' && (
          <button
            onClick={handleNPCTrade}
            disabled={demoState.selectedPlayerItems.length === 0 || demoState.selectedNPCItems.length === 0}
            style={{
              padding: '12px 24px',
              background: demoState.selectedPlayerItems.length > 0 && demoState.selectedNPCItems.length > 0 ? '#10b981' : '#374151',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Execute NPC Trade
          </button>
        )}
        <button
          onClick={loadDemoData}
          style={{
            padding: '12px 24px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Refresh Data
        </button>
      </div>
    </div>
  );
};