/**
 * OneChain Minting Service
 * 
 * Handles minting game items as NFTs on OneChain using the deployed ItemForge
 */

import { Transaction } from '@onelabs/sui/transactions';
import { SuiClient } from '@onelabs/sui/client';
import { ONECHAIN_CONTRACTS, ONECHAIN_MODULES } from '../config/contracts';

// Item types from items.move
export const ITEM_TYPES = {
  WEAPON: 1,
  ARMOR: 2,
  CONSUMABLE: 3,
  RESOURCE: 4,
} as const;

// Rarity levels from items.move
export const RARITY_LEVELS = {
  COMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
} as const;

export interface MintItemParams {
  itemType: number;
  rarity: number;
  name: string;
  description: string;
  stats: number[];
}

export interface MintResult {
  itemObjectId: string;
  transactionDigest: string;
  itemId: number; // Sequential ID from forge
}

export interface Signer {
  signAndExecuteTransaction(input: {
    transaction: Transaction;
    options?: {
      showObjectChanges?: boolean;
      showEffects?: boolean;
      showEvents?: boolean;
    };
  }): Promise<any>;
}

export class OneChainMintingService {
  private client: SuiClient;
  private signer: Signer | null = null;
  private currentAddress: string | null = null;

  constructor(client: SuiClient) {
    this.client = client;
  }

  setSigner(signer: Signer) {
    this.signer = signer;
  }

  setCurrentAddress(address: string) {
    this.currentAddress = address;
  }

  /**
   * Mint a game item as NFT
   * 
   * @example
   * ```typescript
   * const result = await mintingService.mintItem({
   *   itemType: ITEM_TYPES.CONSUMABLE,
   *   rarity: RARITY_LEVELS.COMMON,
   *   name: "Health Potion",
   *   description: "Restores 50 HP",
   *   stats: [50, 0]
   * });
   * console.log('Minted item:', result.itemObjectId);
   * ```
   */
  async mintItem(params: MintItemParams): Promise<MintResult> {
    if (!this.signer) {
      throw new Error('No wallet signer set. Use setSigner() first.');
    }

    if (!this.currentAddress) {
      throw new Error('No current address set for transaction.');
    }

    // Validate parameters
    if (params.stats.length > 5) {
      throw new Error('Stats array cannot exceed 5 elements');
    }

    console.log('🎨 Minting item:', params.name);

    const tx = new Transaction();

    // Call create_item function
    const [item] = tx.moveCall({
      target: `${ONECHAIN_MODULES.ITEMS}::create_item`,
      arguments: [
        tx.object(ONECHAIN_CONTRACTS.ITEM_FORGE), // forge: &mut ItemForge
        tx.pure.u8(params.itemType),              // item_type: u8
        tx.pure.u8(params.rarity),                // rarity: u8
        tx.pure.string(params.name),              // name: String
        tx.pure.string(params.description),       // description: String
        tx.pure.vector('u64', params.stats),      // stats: vector<u64>
      ],
    });

    // Transfer the item to the current user
    tx.transferObjects([item], this.currentAddress);

    // Execute transaction
    const result = await this.signer.signAndExecuteTransaction({
      transaction: tx,
      options: {
        showObjectChanges: true,
        showEffects: true,
        showEvents: true,
      },
    });

    if (result.effects?.status.status !== 'success') {
      throw new Error(`Mint transaction failed: ${result.effects?.status.error || 'Unknown error'}`);
    }

    // Extract the created item object ID
    const createdObject = result.objectChanges?.find(
      (change: any) => 
        change.type === 'created' && 
        change.objectType.includes('::items::GameItem')
    );

    if (!createdObject) {
      throw new Error('Could not find created GameItem in transaction result');
    }

    // Extract item ID from events
    const itemMintedEvent = result.events?.find(
      (event: any) => event.type.includes('::items::ItemMinted')
    );

    const itemId = itemMintedEvent?.parsedJson?.item_id || 0;

    console.log('✅ Item minted successfully!');
    console.log('  - Object ID:', createdObject.objectId);
    console.log('  - Sequential ID:', itemId);
    console.log('  - Transaction:', result.digest);

    return {
      itemObjectId: createdObject.objectId,
      transactionDigest: result.digest,
      itemId,
    };
  }

  /**
   * Mint a weapon NFT with specific weapon properties
   */
  async mintWeapon(params: {
    rarity: number;
    name: string;
    description: string;
    damage: number;
    maxDurability: number;
  }): Promise<MintResult> {
    if (!this.signer) {
      throw new Error('No wallet signer set. Use setSigner() first.');
    }

    if (!this.currentAddress) {
      throw new Error('No current address set for transaction.');
    }

    console.log('⚔️ Minting weapon:', params.name);

    const tx = new Transaction();

    const [weapon] = tx.moveCall({
      target: `${ONECHAIN_MODULES.ITEMS}::create_weapon`,
      arguments: [
        tx.object(ONECHAIN_CONTRACTS.ITEM_FORGE),
        tx.pure.u8(params.rarity),
        tx.pure.string(params.name),
        tx.pure.string(params.description),
        tx.pure.u64(params.damage),
        tx.pure.u64(params.maxDurability),
      ],
    });

    tx.transferObjects([weapon], this.currentAddress);

    const result = await this.signer.signAndExecuteTransaction({
      transaction: tx,
      options: {
        showObjectChanges: true,
        showEffects: true,
        showEvents: true,
      },
    });

    if (result.effects?.status.status !== 'success') {
      throw new Error(`Mint weapon failed: ${result.effects?.status.error || 'Unknown error'}`);
    }

    const createdObject = result.objectChanges?.find(
      (change: any) => 
        change.type === 'created' && 
        change.objectType.includes('::items::Weapon')
    );

    if (!createdObject) {
      throw new Error('Could not find created Weapon in transaction result');
    }

    const itemMintedEvent = result.events?.find(
      (event: any) => event.type.includes('::items::ItemMinted')
    );

    const itemId = itemMintedEvent?.parsedJson?.item_id || 0;

    console.log('✅ Weapon minted successfully!');

    return {
      itemObjectId: createdObject.objectId,
      transactionDigest: result.digest,
      itemId,
    };
  }

  /**
   * Mint an armor NFT with specific armor properties
   */
  async mintArmor(params: {
    rarity: number;
    name: string;
    description: string;
    defense: number;
    maxDurability: number;
  }): Promise<MintResult> {
    if (!this.signer) {
      throw new Error('No wallet signer set. Use setSigner() first.');
    }

    if (!this.currentAddress) {
      throw new Error('No current address set for transaction.');
    }

    console.log('🛡️ Minting armor:', params.name);

    const tx = new Transaction();

    const [armor] = tx.moveCall({
      target: `${ONECHAIN_MODULES.ITEMS}::create_armor`,
      arguments: [
        tx.object(ONECHAIN_CONTRACTS.ITEM_FORGE),
        tx.pure.u8(params.rarity),
        tx.pure.string(params.name),
        tx.pure.string(params.description),
        tx.pure.u64(params.defense),
        tx.pure.u64(params.maxDurability),
      ],
    });

    tx.transferObjects([armor], this.currentAddress);

    const result = await this.signer.signAndExecuteTransaction({
      transaction: tx,
      options: {
        showObjectChanges: true,
        showEffects: true,
        showEvents: true,
      },
    });

    if (result.effects?.status.status !== 'success') {
      throw new Error(`Mint armor failed: ${result.effects?.status.error || 'Unknown error'}`);
    }

    const createdObject = result.objectChanges?.find(
      (change: any) => 
        change.type === 'created' && 
        change.objectType.includes('::items::Armor')
    );

    if (!createdObject) {
      throw new Error('Could not find created Armor in transaction result');
    }

    const itemMintedEvent = result.events?.find(
      (event: any) => event.type.includes('::items::ItemMinted')
    );

    const itemId = itemMintedEvent?.parsedJson?.item_id || 0;

    console.log('✅ Armor minted successfully!');

    return {
      itemObjectId: createdObject.objectId,
      transactionDigest: result.digest,
      itemId,
    };
  }

  /**
   * Get all items owned by the current user
   */
  async getUserItems(): Promise<any[]> {
    if (!this.currentAddress) {
      throw new Error('No current address set');
    }

    const objects = await this.client.getOwnedObjects({
      owner: this.currentAddress,
      filter: {
        StructType: `${ONECHAIN_CONTRACTS.PACKAGE_ID}::items::GameItem`,
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    return objects.data;
  }
}

export default OneChainMintingService;
