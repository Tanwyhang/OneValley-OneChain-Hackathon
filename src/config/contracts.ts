/**
 * OneChain Contract Configuration
 *
 * Contract addresses and configuration for deployed OneChain Move contracts
 * Used by marketplace and trading services for blockchain integration
 */

// OneValley Move contract addresses (deployed on testnet)
export const ONECHAIN_CONTRACTS = {
  PACKAGE_ID: '0x525e26fd3ff5142603b76fa2eafdf021af6e3f43dd5758ef02288ad96c6e5636',
  GAME_CUSTODIAN: '0xc9d37f75e935f7239fbbba53e3d05ae8114d0bb5b04b8b2063678f8a7fe952a5',
  ITEM_FORGE: '0xee37342c10bcffda4ffb89e6b148e026a7987c3d69bc6f41c91fbec0dcb32ef3',
  // MARKETPLACE: Will be deployed separately as part of the marketplace module
  MARKETPLACE: '0x7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c', // Placeholder
} as const;

// Move module targets
export const ONECHAIN_MODULES = {
  LOCK: `${ONECHAIN_CONTRACTS.PACKAGE_ID}::lock`,
  ITEMS: `${ONECHAIN_CONTRACTS.PACKAGE_ID}::items`,
  TRADING: `${ONECHAIN_CONTRACTS.PACKAGE_ID}::trading`,
  MARKETPLACE: `${ONECHAIN_CONTRACTS.PACKAGE_ID}::marketplace`,
  FORGE: `${ONECHAIN_CONTRACTS.PACKAGE_ID}::forge`,
} as const;

// OneChain network configuration
export const ONECHAIN_NETWORK = {
  NETWORK: 'testnet',
  RPC_URL: 'https://rpc-testnet.onelabs.cc:443',
  WEBSOCKET_URL: 'wss://rpc-testnet.onelabs.cc:443',
  EXPLORER_URL: 'https://explorer.testnet.sui.io',
  ONESCAN_URL: 'https://onescan.cc/testnet/transactionBlocksDetail',
} as const;

// Gas configuration
export const GAS_CONFIG = {
  DEFAULT_GAS_BUDGET: 10000000, // 0.01 SUI
  MARKETPLACE_LISTING_GAS: 10000000, // 0.01 SUI
  PURCHASE_GAS: 10000000, // 0.01 SUI
  CANCEL_LISTING_GAS: 10000000, // 0.01 SUI
} as const;

// Marketplace configuration
export const MARKETPLACE_CONFIG = {
  FEE_RATE: 0.025, // 2.5% marketplace fee
  MIN_LISTING_PRICE: 10, // Minimum price in smallest currency unit
  MAX_LISTING_PRICE: 1000000, // Maximum price
  LISTING_DURATION: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
} as const;

// Event types to listen for
export const EVENT_TYPES = {
  ITEM_LISTED: `${ONECHAIN_MODULES.MARKETPLACE}::ItemListed`,
  ITEM_SOLD: `${ONECHAIN_MODULES.MARKETPLACE}::ItemSold`,
  LISTING_CANCELLED: `${ONECHAIN_MODULES.MARKETPLACE}::ListingCancelled`,
  ESCROW_CREATED: `${ONECHAIN_MODULES.TRADING}::EscrowCreated`,
  TRADE_COMPLETED: `${ONECHAIN_MODULES.TRADING}::TradeCompleted`,
  ITEM_LOCKED: `${ONECHAIN_MODULES.LOCK}::ItemLocked`,
  ITEM_UNLOCKED: `${ONECHAIN_MODULES.LOCK}::ItemUnlocked`,
} as const;

// Object types for filtering
export const OBJECT_TYPES = {
  GAME_ITEM: `${ONECHAIN_MODULES.ITEMS}::GameItem`,
  LOCKED_ITEM: `${ONECHAIN_MODULES.LOCK}::LockedItem`,
  LISTING: `${ONECHAIN_MODULES.MARKETPLACE}::Listing`,
  ESCROW: `${ONECHAIN_MODULES.TRADING}::TradeEscrow`,
  KIOSK: `${ONECHAIN_MODULES.MARKETPLACE}::PlayerKiosk`,
} as const;

// Contract function names
export const CONTRACT_FUNCTIONS = {
  // Lock module
  LOCK_ITEM: 'lock',
  UNLOCK_ITEM: 'unlock',

  // Trading module
  INITIATE_TRADE: 'initiate_trade',
  EXECUTE_SWAP: 'execute_swap',
  CANCEL_ESCROW: 'cancel_escrow',

  // Marketplace module
  LIST_ITEM: 'list_item',
  PURCHASE_ITEM: 'purchase_item',
  CANCEL_LISTING: 'cancel_listing',
  UPDATE_PRICE: 'update_price',

  // Items module
  MINT_ITEM: 'mint_item',
  TRANSFER_ITEM: 'transfer_item',
} as const;

// Error codes for better error handling
export const ERROR_CODES = {
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  NOT_OWNER: 'NOT_OWNER',
  ITEM_LOCKED: 'ITEM_LOCKED',
  LISTING_NOT_FOUND: 'LISTING_NOT_FOUND',
  LISTING_INACTIVE: 'LISTING_INACTIVE',
  INVALID_PRICE: 'INVALID_PRICE',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

// Helper functions
export function getTransactionUrl(digest: string): string {
  return `${ONECHAIN_NETWORK.ONESCAN_URL}?digest=${digest}`;
}

export function getAddressUrl(address: string): string {
  return `${ONECHAIN_NETWORK.EXPLORER_URL}/address/${address}`;
}

export function getObjectUrl(objectId: string): string {
  return `${ONECHAIN_NETWORK.EXPLORER_URL}/object/${objectId}`;
}

export function formatSuiAmount(amount: number): string {
  return (amount / 1000000000).toFixed(9);
}

export function parseSuiAmount(suiAmount: string): number {
  return Math.floor(parseFloat(suiAmount) * 1000000000);
}

// Test function to verify URL generation
export function testTransactionUrl() {
  const testHash = 'SVCtuZctTDzSKU2Q2LTVKjQ9avcMSNE8x1paJkYmeff';
  const url = getTransactionUrl(testHash);
  console.log('Test transaction URL:', url);
  return url;
}