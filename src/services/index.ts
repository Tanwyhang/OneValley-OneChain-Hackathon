/**
 * Services Index
 *
 * Central export point for all OneChain integration services.
 * Includes setup utilities and singleton management.
 */

import { SuiClient } from '@onelabs/sui/dist/esm/client';
import { OneChainTransactionService } from './OneChainTransactionService';
import { ItemWalletService } from './ItemWalletService';
import { ItemLockingService } from './ItemLockingService';
import { NPCTradingService } from './NPCTradingService';
import { P2PTradingService } from './P2PTradingService';
import { TradeEventService } from './TradeEventService';

// Configuration
export const ONECHAIN_CONFIG = {
  NETWORK: process.env.NEXT_PUBLIC_ONECHAIN_NETWORK || 'devnet',
  RPC_URL: process.env.NEXT_PUBLIC_ONECHAIN_RPC_URL || 'https://fullnode.devnet.sui.io:443',
  PACKAGE_ID: process.env.NEXT_PUBLIC_ONEVALLEY_PACKAGE_ID || '0x...', // Replace with actual package ID
  CUSTODIAN_ID: process.env.NEXT_PUBLIC_ONEVALLEY_CUSTODIAN_ID || '0x...', // Replace with actual custodian ID
  FORGE_ID: process.env.NEXT_PUBLIC_ONEVALLEY_FORGE_ID || '0x...', // Replace with actual forge ID
  GAS_BUDGET: parseInt(process.env.NEXT_PUBLIC_GAS_BUDGET || '10000000'), // 0.01 SUI
};

// Service instances
let suiClient: SuiClient | null = null;
let transactionService: OneChainTransactionService | null = null;
let itemWalletService: ItemWalletService | null = null;
let itemLockingService: ItemLockingService | null = null;
let npcTradingService: NPCTradingService | null = null;
let p2pTradingService: P2PTradingService | null = null;
let tradeEventService: TradeEventService | null = null;

/**
 * Initialize OneChain services
 */
export function initializeOneChainServices(): {
  suiClient: SuiClient;
  transactionService: OneChainTransactionService;
  itemWalletService: ItemWalletService;
  itemLockingService: ItemLockingService;
  npcTradingService: NPCTradingService;
  p2pTradingService: P2PTradingService;
  tradeEventService: TradeEventService;
} {
  // Initialize SuiClient if not already done
  if (!suiClient) {
    suiClient = new SuiClient({
      url: ONECHAIN_CONFIG.RPC_URL,
    });
  }

  // Initialize services if not already done
  if (!transactionService) {
    transactionService = new OneChainTransactionService(suiClient);
  }

  if (!itemWalletService) {
    itemWalletService = new ItemWalletService(suiClient);
  }

  if (!itemLockingService) {
    itemLockingService = new ItemLockingService(suiClient);
  }

  if (!npcTradingService) {
    npcTradingService = new NPCTradingService(
      transactionService,
      itemWalletService,
      itemLockingService
    );
  }

  if (!p2pTradingService) {
    p2pTradingService = new P2PTradingService(
      transactionService,
      itemWalletService,
      itemLockingService
    );
  }

  if (!tradeEventService) {
    tradeEventService = new TradeEventService();
  }

  return {
    suiClient,
    transactionService,
    itemWalletService,
    itemLockingService,
    npcTradingService,
    p2pTradingService,
    tradeEventService
  };
}

/**
 * Get initialized services
 */
export function getOneChainServices() {
  if (!suiClient || !transactionService || !itemWalletService || !itemLockingService || !npcTradingService || !p2pTradingService || !tradeEventService) {
    throw new Error('OneChain services not initialized. Call initializeOneChainServices() first.');
  }

  return {
    suiClient,
    transactionService,
    itemWalletService,
    itemLockingService,
    npcTradingService,
    p2pTradingService,
    tradeEventService
  };
}

/**
 * Set wallet address for all services
 */
export function setWalletAddress(address: string) {
  const services = getOneChainServices();

  services.transactionService.setCurrentAddress(address);
  services.itemWalletService.setCurrentAddress(address);
  services.itemLockingService.setCurrentAddress(address);
  services.npcTradingService.setCurrentAddress(address);
  services.p2pTradingService.setCurrentAddress(address);
}

/**
 * Set wallet signer for transaction services (OneChain SDK pattern)
 */
export function setWalletSigner(signer: any) {
  const services = getOneChainServices();
  services.transactionService.setSigner(signer);
}

/**
 * Clear all service caches
 */
export function clearServiceCaches() {
  const services = getOneChainServices();

  services.itemWalletService.clearCache();
  services.itemLockingService.clearCache();
}

/**
 * Service health check
 */
export async function checkServiceHealth(): Promise<{
  healthy: boolean;
  services: Record<string, boolean>;
  errors: string[];
}> {
  const services = getOneChainServices();
  const results: Record<string, boolean> = {};
  const errors: string[] = [];

  try {
    // Test SuiClient connection
    await services.suiClient.getLatestCheckpointSequenceNumber();
    results.suiClient = true;
  } catch (error) {
    results.suiClient = false;
    errors.push(`SuiClient connection failed: ${error}`);
  }

  try {
    // Test item wallet service
    if (services.transactionService.getCurrentAddress()) {
      await services.itemWalletService.getPlayerInventory();
      results.itemWalletService = true;
    } else {
      results.itemWalletService = false;
      errors.push('No wallet address set');
    }
  } catch (error) {
    results.itemWalletService = false;
    errors.push(`ItemWalletService failed: ${error}`);
  }

  results.itemLockingService = true; // Stateless service
  results.npcTradingService = true; // Stateless service
  results.transactionService = true; // Stateless service

  const healthy = Object.values(results).every(result => result);

  return {
    healthy,
    services: results,
    errors
  };
}

/**
 * Get service statistics
 */
export async function getServiceStats(): Promise<{
  inventoryStats: any;
  lockingStats: any;
  npcReputation: any;
}> {
  const services = getOneChainServices();

  const [inventoryStats, lockingStats, npcReputation] = await Promise.all([
    services.itemWalletService.getInventoryStats(),
    services.itemLockingService.getLockingStats(),
    services.npcTradingService.getPlayerReputation()
  ]);

  return {
    inventoryStats,
    lockingStats,
    npcReputation
  };
}

/**
 * Setup service monitoring
 */
export function setupServiceMonitoring() {
  const services = getOneChainServices();

  // Start lock expiration monitoring
  services.itemLockingService.startExpirationMonitor(60000); // Check every minute

  // Setup error handling for services
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection in OneChain services:', event.reason);
    });
  }
}

/**
 * Cleanup services
 */
export function cleanupServices() {
  clearServiceCaches();

  // Cleanup trade event service first
  if (tradeEventService) {
    tradeEventService.cleanup();
  }

  // Reset service instances
  suiClient = null;
  transactionService = null;
  itemWalletService = null;
  itemLockingService = null;
  npcTradingService = null;
  p2pTradingService = null;
  tradeEventService = null;
}

// Export individual services for direct access
export {
  OneChainTransactionService,
  ItemWalletService,
  ItemLockingService,
  NPCTradingService,
  P2PTradingService
};

// Export additional services
export { TradeEventService } from './TradeEventService';

// Export types
export * from '../types/onechain';