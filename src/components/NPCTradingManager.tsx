/**
 * NPC Trading Manager React Component
 *
 * Manages NPC trading with blockchain-backed escrow functionality.
 * Integrates with the Phaser UIScene for the trading interface.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { NPCTradingService } from '../services/NPCTradingService';
import { ItemWalletService } from '../services/ItemWalletService';
import { OneChainTransactionService } from '../services/OneChainTransactionService';
import { ItemLockingService } from '../services/ItemLockingService';
import { FrontendItem } from '../types/onechain';
import { NPCTradeState } from '../services/NPCTradingService';

interface NPCTradingManagerProps {
  // OneChain services
  oneChainService: OneChainTransactionService;
  itemWalletService: ItemWalletService;
  itemLockingService: ItemLockingService;

  // Game state
  currentAddress: string | null;
  walletConnected: boolean;

  // UI state
  isNPCTradeOpen: boolean;
  selectedPlayerItems: string[];
  selectedNPCItems: string[];

  // Event callbacks
  onTradeStart?: () => void;
  onTradeComplete?: (playerItems: FrontendItem[], npcItems: FrontendItem[]) => void;
  onTradeCancel?: () => void;
  onError?: (error: string) => void;

  // Phaser scene integration
  uiScene?: any; // Phaser.Scene reference
}

interface TradeValidation {
  valid: boolean;
  error?: string;
  balance?: {
    playerValue: number;
    npcValue: number;
    isBalanced: boolean;
    difference: number;
  };
}

export const NPCTradingManager: React.FC<NPCTradingManagerProps> = ({
  oneChainService,
  itemWalletService,
  itemLockingService,
  currentAddress,
  walletConnected,
  isNPCTradeOpen,
  selectedPlayerItems,
  selectedNPCItems,
  onTradeStart,
  onTradeComplete,
  onTradeCancel,
  onError,
  uiScene
}) => {
  // State management
  const [npcTradingService, setNpcTradingService] = useState<NPCTradingService | null>(null);
  const [tradeState, setTradeState] = useState<NPCTradeState>({
    npc_name: 'Herman',
    npc_items: [],
    selected_npc_items: [],
    selected_player_items: [],
    trade_confirmation_visible: false,
    current_trade: null,
    trade_history: []
  });
  const [playerInventory, setPlayerInventory] = useState<FrontendItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [validation, setValidation] = useState<TradeValidation | null>(null);
  const [tradeSuggestions, setTradeSuggestions] = useState<Array<{
    player_items: string[];
    npc_items: string[];
    value_difference: number;
  }>>([]);

  // Initialize NPC trading service
  useEffect(() => {
    if (oneChainService && itemWalletService && itemLockingService) {
      const service = new NPCTradingService(
        oneChainService,
        itemWalletService,
        itemLockingService
      );
      setNpcTradingService(service);

      // Load NPC items
      const npcItems = service.getNPCItems();
      setTradeState((prev: NPCTradeState) => ({
        ...prev,
        npc_items: npcItems
      }));
    }
  }, [oneChainService, itemWalletService, itemLockingService]);

  // Update services when wallet address changes
  useEffect(() => {
    if (npcTradingService && currentAddress) {
      npcTradingService.setCurrentAddress(currentAddress);
    }
  }, [npcTradingService, currentAddress]);

  // Load player inventory
  const loadPlayerInventory = useCallback(async () => {
    if (!itemWalletService || !currentAddress) return;

    try {
      const inventory = await itemWalletService.getPlayerInventory();
      setPlayerInventory(inventory);
    } catch (error) {
      console.error('Error loading player inventory:', error);
      onError?.('Failed to load inventory');
    }
  }, [itemWalletService, currentAddress, onError]);

  useEffect(() => {
    if (isNPCTradeOpen && walletConnected) {
      loadPlayerInventory();
    }
  }, [isNPCTradeOpen, walletConnected, loadPlayerInventory]);

  // Validate trade when selections change
  useEffect(() => {
    if (!npcTradingService || selectedPlayerItems.length === 0) {
      setValidation(null);
      return;
    }

    const validateTrade = async () => {
      try {
        const result = await npcTradingService.validateTrade(
          selectedPlayerItems,
          selectedNPCItems
        );
        setValidation(result);
      } catch (error) {
        console.error('Error validating trade:', error);
        setValidation({ valid: false, error: 'Trade validation failed' });
      }
    };

    validateTrade();
  }, [selectedPlayerItems, selectedNPCItems, npcTradingService]);

  // Generate trade suggestions
  useEffect(() => {
    if (!npcTradingService || playerInventory.length === 0) {
      setTradeSuggestions([]);
      return;
    }

    const suggestions = npcTradingService.getTradeSuggestions(playerInventory);
    setTradeSuggestions(suggestions);
  }, [npcTradingService, playerInventory]);

  // Execute trade
  const executeTrade = useCallback(async () => {
    if (!npcTradingService || !validation?.valid) {
      onError?.('Trade is not valid');
      return;
    }

    setIsLoading(true);
    onTradeStart?.();

    try {
      const result = await npcTradingService.executeTrade(
        selectedPlayerItems,
        selectedNPCItems
      );

      if (result.success) {
        // Update UI scene
        if (uiScene && uiScene.completeNPCTrade) {
          await uiScene.completeNPCTrade(result.tradeItems?.player_items || [], result.tradeItems?.npc_items || []);
        }

        // Refresh inventory
        await loadPlayerInventory();

        // Update trade state
        setTradeState((prev: NPCTradeState) => ({
          ...prev,
          current_trade: {
            player_items: result.tradeItems?.player_items || [],
            npc_items: result.tradeItems?.npc_items || [],
            status: 'completed',
            transaction_digest: result.transactionDigest
          }
        }));

        onTradeComplete?.(
          result.tradeItems?.player_items || [],
          result.tradeItems?.npc_items || []
        );

        // Show success message
        if (uiScene && uiScene.showSuccessMessage) {
          uiScene.showSuccessMessage('Trade completed successfully!');
        }
      } else {
        throw new Error(result.error || 'Trade failed');
      }
    } catch (error) {
      console.error('Error executing trade:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onError?.(errorMessage);

      // Update trade state
      setTradeState((prev: NPCTradeState) => ({
        ...prev,
        current_trade: prev.current_trade ? {
          ...prev.current_trade,
          status: 'cancelled'
        } : null
      }));
    } finally {
      setIsLoading(false);
    }
  }, [
    npcTradingService,
    validation,
    selectedPlayerItems,
    selectedNPCItems,
    onTradeStart,
    onTradeComplete,
    onError,
    uiScene,
    loadPlayerInventory
  ]);

  // Cancel trade
  const cancelTrade = useCallback(async () => {
    if (!npcTradingService || selectedPlayerItems.length === 0) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await npcTradingService.cancelTrade(selectedPlayerItems);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Update UI scene
      if (uiScene && uiScene.cancelNPCTrade) {
        await uiScene.cancelNPCTrade();
      }

      // Update trade state
      setTradeState((prev: NPCTradeState) => ({
        ...prev,
        current_trade: prev.current_trade ? {
          ...prev.current_trade,
          status: 'cancelled'
        } : null
      }));

      onTradeCancel?.();

      // Refresh inventory
      await loadPlayerInventory();
    } catch (error) {
      console.error('Error cancelling trade:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [npcTradingService, selectedPlayerItems, onTradeCancel, onError, uiScene, loadPlayerInventory]);

  // Apply trade suggestion
  const applySuggestion = useCallback((suggestion: typeof tradeSuggestions[0]) => {
    if (uiScene && uiScene.applyTradeSuggestion) {
      uiScene.applyTradeSuggestion(suggestion.player_items, suggestion.npc_items);
    }

    setTradeState(prev => ({
      ...prev,
      selected_player_items: suggestion.player_items,
      selected_npc_items: suggestion.npc_items
    }));
  }, [uiScene]);

  // This component doesn't render anything directly - it manages the state and logic
  // The actual UI is rendered by the Phaser scene
  useEffect(() => {
    // Update UI scene with current state
    if (uiScene) {
      uiScene.setNPCTradingState?.({
        isLoading,
        validation,
        tradeSuggestions,
        playerInventory,
        npcItems: tradeState.npc_items,
        onExecuteTrade: executeTrade,
        onCancelTrade: cancelTrade,
        onApplySuggestion: applySuggestion
      });
    }
  }, [
    uiScene,
    isLoading,
    validation,
    tradeSuggestions,
    playerInventory,
    tradeState.npc_items,
    executeTrade,
    cancelTrade,
    applySuggestion
  ]);

  return null; // This is a logic-only component
};

// Hook for using NPC trading manager
export const useNPCTradingManager = (
  oneChainService: OneChainTransactionService,
  itemWalletService: ItemWalletService,
  itemLockingService: ItemLockingService,
  currentAddress: string | null
) => {
  const [npcTradingService, setNpcTradingService] = useState<NPCTradingService | null>(null);

  useEffect(() => {
    if (oneChainService && itemWalletService && itemLockingService) {
      const service = new NPCTradingService(
        oneChainService,
        itemWalletService,
        itemLockingService
      );
      setNpcTradingService(service);

      if (currentAddress) {
        service.setCurrentAddress(currentAddress);
      }
    }
  }, [oneChainService, itemWalletService, itemLockingService, currentAddress]);

  return npcTradingService;
};