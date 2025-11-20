/**
 * OneChain Move Contract Type Definitions
 *
 * TypeScript interfaces for OneValley Move smart contracts
 * including items, trading, and lock modules.
 */

// === Core Types ===

export type Address = string;
export type ID = string;
export type UID = {
  id: ID;
};

// === Item Types (from items.move) ===

export const ITEM_TYPES = {
  WEAPON: 1,
  ARMOR: 2,
  CONSUMABLE: 3,
  RESOURCE: 4
} as const;

export type ItemType = typeof ITEM_TYPES[keyof typeof ITEM_TYPES];

export const RARITY_LEVELS = {
  COMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4
} as const;

export type RarityLevel = typeof RARITY_LEVELS[keyof typeof RARITY_LEVELS];

export interface GameItem {
  id: UID;
  item_id: number;
  item_type: ItemType;
  rarity: RarityLevel;
  name: string;
  description: string;
  stats: number[];
  minted_by: Address;
  mint_timestamp: number;
  owner_history: Address[];
}

export interface Weapon {
  id: UID;
  base: GameItem;
  damage: number;
  durability: number;
  max_durability: number;
}

export interface Armor {
  id: UID;
  base: GameItem;
  defense: number;
  durability: number;
  max_durability: number;
}

export interface ItemForge {
  id: UID;
  next_item_id: number;
  total_items_created: number;
}

// === Lock Types (from lock.move) ===

export interface Locked<T> {
  id: UID;
  key: ID;
  obj: T;
}

export interface Key {
  id: UID;
}

// === Trading Types (from trading.move) ===

export interface TradeEscrow<T> {
  id: UID;
  sender: Address;
  recipient: Address;
  exchange_key: ID;
  escrowed_key: ID;
  escrowed: T;
  created_at: number;
}

export interface GameCustodian {
  id: UID;
  total_trades: number;
  active_escrows: number;
  owner: Address;
}

export interface TradeProposal {
  proposer: Address;
  proposed_item: ID;
  desired_item: ID;
  expiry_timestamp: number;
}

// === Event Types ===

export interface ItemMintedEvent {
  item_id: number;
  owner: Address;
  item_type: ItemType;
  rarity: RarityLevel;
  name: string;
}

export interface ItemTradedEvent {
  from: Address;
  to: Address;
  item_id: number;
  item_type: ItemType;
  trade_timestamp: number;
}

export interface EscrowCreatedEvent {
  escrow_id: ID;
  sender: Address;
  recipient: Address;
  item_type: ItemType;
  created_at: number;
}

export interface TradeCompletedEvent {
  escrow_id_1: ID;
  escrow_id_2: ID;
  trader_1: Address;
  trader_2: Address;
  completed_at: number;
}

export interface EscrowCancelledEvent {
  escrow_id: ID;
  sender: Address;
  reason: string;
  cancelled_at: number;
}

// === Transaction Builder Types ===

export interface LockItemParams {
  itemId: string;
  itemType?: string;
}

export interface InitiateTradeParams {
  keyId: string;
  lockedItemId: string;
  exchangeKeyId: string;
  recipientAddress: Address;
  custodianAddress: Address;
}

export interface ExecuteSwapParams {
  custodianId: string;
  escrow1Id: string;
  escrow2Id: string;
}

export interface CancelEscrowParams {
  escrowId: string;
}

export interface CreateItemParams {
  forgeId: string;
  item_type: ItemType;
  rarity: RarityLevel;
  name: string;
  description: string;
  stats: number[];
}

export interface CreateWeaponParams {
  forgeId: string;
  rarity: RarityLevel;
  name: string;
  description: string;
  damage: number;
  max_durability: number;
}

export interface CreateArmorParams {
  forgeId: string;
  rarity: RarityLevel;
  name: string;
  description: string;
  defense: number;
  max_durability: number;
}

// === Frontend Item Types ===

export interface FrontendItem {
  id: string;
  item_id: number;
  item_type: ItemType;
  rarity: RarityLevel;
  name: string;
  description: string;
  stats: number[];
  minted_by: string;
  mint_timestamp: number;
  owner_history: string[];
  // Additional frontend fields
  sprite_key?: string;
  stack_size?: number;
  equipped?: boolean;
  locked?: boolean;
}

export interface TradeItem extends FrontendItem {
  selected: boolean;
  proposed_value?: number;
  requested_value?: number;
  trade_count?: number;
}

export interface TradeProposalFrontend {
  id: string;
  proposer: Address;
  target_player?: Address;
  proposer_items: TradeItem[];
  requested_items: TradeItem[];
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'expired' | 'cancelled';
  created_at: number;
  expires_at: number;
  message?: string;
}

export interface EscrowedItemFrontend {
  id: string;
  sender: Address;
  recipient: Address;
  exchange_key: string;
  escrowed_key: string;
  created_at: number;
  item: FrontendItem;
  status: 'pending' | 'matched' | 'completed';
  matched_escrow_id?: string;
}

// === UI State Types ===

export interface TradingState {
  player_items: FrontendItem[];
  trading_partner_items: FrontendItem[];
  selected_player_items: string[];
  selected_partner_items: string[];
  current_proposal: TradeProposalFrontend | null;
  active_escrows: EscrowedItemFrontend[];
  trade_history: TradeProposalFrontend[];
  loading: boolean;
  error: string | null;
}

export interface NPCTradingState {
  npc_name: string;
  npc_items: FrontendItem[];
  selected_npc_items: string[];
  selected_player_items: string[];
  trade_confirmation_visible: boolean;
  current_trade: {
    player_items: FrontendItem[];
    npc_items: FrontendItem[];
  } | null;
}

// === Error Types ===

export const TRADING_ERRORS = {
  MISMATCHED_SENDER_RECIPIENT: 0,
  MISMATCHED_EXCHANGE_OBJECT: 1,
  INVALID_ESCROW_STATE: 2,
  UNAUTHORIZED_CUSTODIAN: 3,
  LOCK_KEY_MISMATCH: 0,
  INVALID_RARITY: 0,
  INVALID_ITEM_TYPE: 1,
  UNAUTHORIZED_MINTING: 2,
  INVALID_STATS_LENGTH: 3
} as const;

export type TradingErrorCode = typeof TRADING_ERRORS[keyof typeof TRADING_ERRORS];

export interface TradingError {
  code: TradingErrorCode;
  message: string;
  transaction_digest?: string;
}

// === Configuration Types ===

export interface OneChainConfig {
  network: 'mainnet' | 'testnet' | 'devnet';
  package_id: string;
  custodian_id: string;
  forge_id?: string;
  rpc_url: string;
}

export interface GameConfig {
  max_trade_items: number;
  trade_expiry_time: number; // in seconds
  gas_budget: number;
  confirmations_required: number;
}

// === Event Listener Types ===

export type TradeEventListener = (event: ItemTradedEvent | EscrowCreatedEvent | TradeCompletedEvent | EscrowCancelledEvent) => void;

export interface EventSubscription {
  unsubscribe: () => void;
}

// === Utility Types ===

export type GenericItem = GameItem | Weapon | Armor;
export type TradeableItem = Locked<GenericItem>;
export type EscrowedItem = TradeEscrow<GenericItem>;

export type MoveCallResult = {
  digest: string;
  status: 'success' | 'failed';
  error?: string;
  objectChanges?: any[];
  events?: any[];
};

export interface TransactionOptions {
  gasBudget?: number;
  showObjectChanges?: boolean;
  showEffects?: boolean;
  showEvents?: boolean;
}

// === Contract Function Signatures ===

export interface MoveContractFunctions {
  // Lock module
  lock: (obj: any, ctx: any) => [Locked<any>, Key];
  unlock: <T>(locked: Locked<T>, key: Key) => T;
  key_id: <T>(locked: Locked<T>) => ID;
  key_id_key: (key: Key) => ID;

  // Items module
  create_item: (
    forge: ItemForge,
    item_type: ItemType,
    rarity: RarityLevel,
    name: string,
    description: string,
    stats: number[],
    ctx: any
  ) => GameItem;
  create_weapon: (
    forge: ItemForge,
    rarity: RarityLevel,
    name: string,
    description: string,
    damage: number,
    max_durability: number,
    ctx: any
  ) => Weapon;
  create_armor: (
    forge: ItemForge,
    rarity: RarityLevel,
    name: string,
    description: string,
    defense: number,
    max_durability: number,
    ctx: any
  ) => Armor;

  // Trading module
  initiate_trade: <T>(
    key: Key,
    locked_item: Locked<T>,
    exchange_key: ID,
    recipient: Address,
    custodian: Address,
    ctx: any
  ) => void;
  execute_swap: <T, U>(
    custodian: GameCustodian,
    escrow1: TradeEscrow<T>,
    escrow2: TradeEscrow<U>,
    ctx: any
  ) => void;
  cancel_escrow: <T>(escrow: TradeEscrow<T>, ctx: any) => T;
}

// === Helper Functions ===

export const getItemTypeString = (itemType: ItemType): string => {
  switch (itemType) {
    case ITEM_TYPES.WEAPON: return 'Weapon';
    case ITEM_TYPES.ARMOR: return 'Armor';
    case ITEM_TYPES.CONSUMABLE: return 'Consumable';
    case ITEM_TYPES.RESOURCE: return 'Resource';
    default: return 'Unknown';
  }
};

export const getRarityString = (rarity: RarityLevel): string => {
  switch (rarity) {
    case RARITY_LEVELS.COMMON: return 'Common';
    case RARITY_LEVELS.RARE: return 'Rare';
    case RARITY_LEVELS.EPIC: return 'Epic';
    case RARITY_LEVELS.LEGENDARY: return 'Legendary';
    default: return 'Unknown';
  }
};

export const getRarityColor = (rarity: RarityLevel): string => {
  switch (rarity) {
    case RARITY_LEVELS.COMMON: return '#9CA3AF'; // gray
    case RARITY_LEVELS.RARE: return '#3B82F6'; // blue
    case RARITY_LEVELS.EPIC: return '#8B5CF6'; // purple
    case RARITY_LEVELS.LEGENDARY: return '#F59E0B'; // amber
    default: return '#6B7280'; // gray
  }
};

export const isItemTypeValid = (itemType: number): itemType is ItemType => {
  return Object.values(ITEM_TYPES).includes(itemType as ItemType);
};

export const isRarityValid = (rarity: number): rarity is RarityLevel => {
  return Object.values(RARITY_LEVELS).includes(rarity as RarityLevel);
};