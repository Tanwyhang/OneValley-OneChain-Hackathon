/**
 * OneChain Transaction Service
 *
 * Wrapper for OneChain Transaction SDK operations to handle
 * escrow-based trading functionality for OneValley GameFi items.
 */

import { Transaction } from '@onelabs/sui/dist/esm/transactions';
import { SuiClient } from '@onelabs/sui/dist/esm/client';
import { fromB64 } from '@onelabs/sui/dist/esm/utils';

// OneChain wallet SDK types
export interface Signer {
  signAndExecuteTransaction(input: {
    transaction: Transaction;
    options?: {
      showObjectChanges?: boolean;
      showEffects?: boolean;
      showEvents?: boolean;
    };
  }): Promise<{
    digest: string;
    effects?: {
      status: {
        status: 'success' | 'failure';
        error?: string;
      };
    };
    objectChanges?: Array<{
      type: 'created' | 'mutated' | 'deleted' | 'transferred';
      objectId: string;
      objectType: string;
      sender?: string;
      owner?: {
        AddressOwner?: string;
      };
    }>;
  }>;
}

// OneValley Move contract addresses (replace with actual deployed addresses)
const ONEVALLEY_PACKAGE_ID = '0x...'; // Replace with actual package ID
const GAME_CUSTODIAN_ID = '0x...'; // Replace with actual custodian ID

// Move module targets
const LOCK_MODULE = `${ONEVALLEY_PACKAGE_ID}::lock`;
const ITEMS_MODULE = `${ONEVALLEY_PACKAGE_ID}::items`;
const TRADING_MODULE = `${ONEVALLEY_PACKAGE_ID}::trading`;

export interface ItemLockResult {
  lockedItemId: string;
  keyId: string;
  transactionDigest: string;
}

export interface EscrowCreateResult {
  escrowId: string;
  transactionDigest: string;
  status: 'pending' | 'completed';
}

export interface TradeExecutionResult {
  tradeId: string;
  transactionDigest: string;
  status: 'completed';
}

export interface OneValleyItem {
  id: string;
  item_type: number; // 1=WEAPON, 2=ARMOR, 3=CONSUMABLE, 4=RESOURCE
  rarity: number; // 1=COMMON, 2=RARE, 3=EPIC, 4=LEGENDARY
  name: string;
  description: string;
  stats: number[];
  minted_by: string;
  mint_timestamp: number;
  owner_history: string[];
}

export interface EscrowedItem {
  id: string;
  sender: string;
  recipient: string;
  exchange_key: string;
  escrowed_key: string;
  created_at: number;
  item: OneValleyItem;
}

export class OneChainTransactionService {
  private client: SuiClient;
  private signer: Signer | null = null;
  private currentAddress: string | null = null;

  constructor(client: SuiClient) {
    this.client = client;
  }

  /**
   * Set the signer for transaction execution (from OneChain wallet SDK)
   */
  setSigner(signer: Signer) {
    this.signer = signer;
  }

  /**
   * Set the current wallet address for transactions
   */
  setCurrentAddress(address: string) {
    this.currentAddress = address;
  }

  /**
   * Get the current wallet address
   */
  getCurrentAddress(): string | null {
    return this.currentAddress;
  }

  /**
   * Get the current signer
   */
  getSigner(): Signer | null {
    return this.signer;
  }

  /**
   * Lock an item for trading using the lock.move module
   */
  async lockItem(itemId: string): Promise<ItemLockResult> {
    if (!this.signer) {
      throw new Error('No wallet signer set. Use setSigner() first.');
    }

    const tx = new Transaction();

    // Note: Don't set sender manually - signer handles this
    // tx.setSender(this.currentAddress); // ❌ Remove this line

    // Call the lock function from lock.move
    const [lockedItem, key] = tx.moveCall({
      target: `${LOCK_MODULE}::lock`,
      arguments: [tx.object(itemId)],
      typeArguments: [] // Type will be inferred from the item
    });

    // Execute transaction using OneChain SDK standard pattern
    const result = await this.signer.signAndExecuteTransaction({
      transaction: tx,
      options: {
        showObjectChanges: true,
        showEffects: true
      }
    });

    if (result.effects?.status.status !== 'success') {
      throw new Error(`Transaction failed: ${result.effects?.status.error}`);
    }

    // Extract created object IDs from the transaction response
    // Fixed for OneChain SDK object change structure
    const objectChanges = result.objectChanges || [];
    const lockedItemChange = objectChanges.find(change =>
      change.type === 'created' && change.objectType.includes('Locked')
    );
    const keyChange = objectChanges.find(change =>
      change.type === 'created' && change.objectType.includes('Key')
    );

    if (!lockedItemChange || !keyChange) {
      throw new Error('Could not extract locked item or key IDs from transaction');
    }

    return {
      lockedItemId: lockedItemChange.objectId,
      keyId: keyChange.objectId,
      transactionDigest: result.digest
    };
  }

  /**
   * Initiate a trade by creating an escrow
   */
  async initiateTrade(
    keyId: string,
    lockedItemId: string,
    exchangeKeyId: string,
    recipientAddress: string
  ): Promise<EscrowCreateResult> {
    if (!this.signer) {
      throw new Error('No wallet signer set. Use setSigner() first.');
    }

    const tx = new Transaction();
    // Note: Don't set sender manually - signer handles this

    // Call initiate_trade from trading.move
    const escrow = tx.moveCall({
      target: `${TRADING_MODULE}::initiate_trade`,
      arguments: [
        tx.object(keyId),
        tx.object(lockedItemId),
        tx.pure.address(exchangeKeyId),
        tx.pure.address(recipientAddress),
        tx.pure.address(GAME_CUSTODIAN_ID)
      ]
    });

    // Also increment active escrows counter
    tx.moveCall({
      target: `${TRADING_MODULE}::increment_active_escrows`,
      arguments: [tx.object(GAME_CUSTODIAN_ID)]
    });

    const result = await this.signer.signAndExecuteTransaction({
      transaction: tx,
      options: {
        showObjectChanges: true,
        showEffects: true
      }
    });

    if (result.effects?.status.status !== 'success') {
      throw new Error(`Transaction failed: ${result.effects?.status.error}`);
    }

    // Extract escrow ID from transaction response
    const objectChanges = result.objectChanges || [];
    const escrowChange = objectChanges.find(change =>
      change.type === 'created' && change.objectType.includes('TradeEscrow')
    );

    if (!escrowChange) {
      throw new Error('Could not extract escrow ID from transaction');
    }

    return {
      escrowId: escrowChange.objectId,
      transactionDigest: result.digest,
      status: 'pending'
    };
  }

  /**
   * Execute a swap between two escrowed items
   * (This would typically be called by the custodian)
   */
  async executeSwap(
    escrow1Id: string,
    escrow2Id: string
  ): Promise<TradeExecutionResult> {
    if (!this.signer) {
      throw new Error('No wallet signer set. Use setSigner() first.');
    }

    const tx = new Transaction();
    // Note: Don't set sender manually - signer handles this

    // Call execute_swap from trading.move
    tx.moveCall({
      target: `${TRADING_MODULE}::execute_swap`,
      arguments: [
        tx.object(GAME_CUSTODIAN_ID),
        tx.object(escrow1Id),
        tx.object(escrow2Id)
      ]
    });

    const result = await this.signer.signAndExecuteTransaction({
      transaction: tx,
      options: {
        showObjectChanges: true,
        showEffects: true
      }
    });

    if (result.effects?.status.status !== 'success') {
      throw new Error(`Transaction failed: ${result.effects?.status.error}`);
    }

    return {
      tradeId: result.digest,
      transactionDigest: result.digest,
      status: 'completed'
    };
  }

  /**
   * Cancel an escrow and return the item to the original owner
   */
  async cancelEscrow(escrowId: string): Promise<string> {
    if (!this.signer) {
      throw new Error('No wallet signer set. Use setSigner() first.');
    }

    const tx = new Transaction();
    // Note: Don't set sender manually - signer handles this

    // Call cancel_escrow from trading.move
    const returnedItem = tx.moveCall({
      target: `${TRADING_MODULE}::cancel_escrow`,
      arguments: [tx.object(escrowId)]
    });

    // Note: Since we don't have direct access to address from signer,
    // we'll need to handle transfers differently or get address from signer
    // For now, this is a limitation that needs wallet SDK integration
    tx.transferObjects([returnedItem], '0x...'); // This will need to be updated

    const result = await this.signer.signAndExecuteTransaction({
      transaction: tx,
      options: {
        showEffects: true
      }
    });

    if (result.effects?.status.status !== 'success') {
      throw new Error(`Transaction failed: ${result.effects?.status.error}`);
    }

    return result.digest;
  }

  /**
   * Get player's owned GameItem NFTs
   */
  async getPlayerItems(address?: string): Promise<OneValleyItem[]> {
    const playerAddress = address || this.currentAddress;
    if (!playerAddress) {
      throw new Error('No wallet address provided');
    }

    try {
      // Get objects owned by the address
      const objects = await this.client.getOwnedObjects({
        owner: playerAddress,
        filter: {
          MatchAll: [
            {
              StructType: `${ITEMS_MODULE}::GameItem`
            }
          ]
        },
        options: {
          showContent: true,
          showType: true
        }
      });

      const items: OneValleyItem[] = [];

      for (const object of objects.data) {
        if (object.data?.content?.type === `${ITEMS_MODULE}::GameItem`) {
          const fields = (object.data.content.fields as any);
          items.push({
            id: object.data.objectId,
            item_type: fields.item_type,
            rarity: fields.rarity,
            name: fields.name,
            description: fields.description,
            stats: fields.stats,
            minted_by: fields.minted_by,
            mint_timestamp: fields.mint_timestamp,
            owner_history: fields.owner_history
          });
        }
      }

      return items;
    } catch (error) {
      console.error('Error fetching player items:', error);
      return [];
    }
  }

  /**
   * Get active escrows
   */
  async getActiveEscrows(): Promise<EscrowedItem[]> {
    try {
      // Get escrow objects (these would be owned by the custodian)
      const escrows = await this.client.getOwnedObjects({
        owner: GAME_CUSTODIAN_ID,
        filter: {
          MatchAll: [
            {
              StructType: `${TRADING_MODULE}::TradeEscrow`
            }
          ]
        },
        options: {
          showContent: true,
          showType: true
        }
      });

      const escrowedItems: EscrowedItem[] = [];

      for (const object of escrows.data) {
        if (object.data?.content?.type.includes('TradeEscrow')) {
          const fields = (object.data.content.fields as any);
          escrowedItems.push({
            id: object.data.objectId,
            sender: fields.sender,
            recipient: fields.recipient,
            exchange_key: fields.exchange_key,
            escrowed_key: fields.escrowed_key,
            created_at: fields.created_at,
            item: fields.escrowed // This would need proper type extraction
          });
        }
      }

      return escrowedItems;
    } catch (error) {
      console.error('Error fetching active escrows:', error);
      return [];
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(digest: string): Promise<void> {
    await this.client.waitForTransaction({
      digest,
      options: {
        showEffects: true
      }
    });
  }

  /**
   * Get transaction details
   */
  async getTransaction(digest: string) {
    return await this.client.getTransactionBlock({
      digest,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true
      }
    });
  }
}