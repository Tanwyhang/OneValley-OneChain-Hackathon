/**
 * OneChain Transaction Service
 *
 * Wrapper for OneChain Transaction SDK operations to handle
 * escrow-based trading functionality for OneValley GameFi items.
 */

import { Transaction } from '@onelabs/sui/transactions';
import { SuiClient } from '@onelabs/sui/client';
import { fromB64 } from '@onelabs/sui/utils';

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

// OneValley Move contract addresses (deployed on devnet)
const ONEVALLEY_PACKAGE_ID = '0x9d3d2c56c66134068a6be7ded289cf1915939f0b65a46483d3414a6da5f3ef89';
const GAME_CUSTODIAN_ID = '0xf70caa11d1b82cfeeef2f5385e4798d95f1f829dd3dcf81535af5ce7e24d24cd';

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
   * Validate if a string is a valid Sui object ID
   * Must be 0x followed by 64 hexadecimal characters
   */
  private isValidSuiObjectId(id: string): boolean {
    if (!id || typeof id !== 'string') return false;
    
    // Check if starts with 0x and has correct length
    if (!id.startsWith('0x')) return false;
    
    // Remove 0x prefix and check if remaining part is valid hex
    const hexPart = id.slice(2);
    
    // Must be 64 hex characters for a full object ID
    if (hexPart.length !== 64) return false;
    
    // Check if all characters are valid hex (0-9, a-f, A-F)
    return /^[0-9a-fA-F]{64}$/.test(hexPart);
  }

  /**
   * Lock an item for trading using the lock.move module
   */
  async lockItem(itemId: string): Promise<ItemLockResult> {
    if (!this.signer) {
      throw new Error('No wallet signer set. Use setSigner() first.');
    }

    if (!itemId) {
      throw new Error('Item ID is required for locking');
    }

    if (!this.currentAddress) {
      throw new Error('No current address set for transaction.');
    }

    console.log(`Attempting to lock item: ${itemId} for address: ${this.currentAddress}`);

    // Validate that itemId is a valid Sui object ID (must be 0x + 64 hex chars)
    if (!this.isValidSuiObjectId(itemId)) {
      throw new Error(`Invalid Sui object ID: ${itemId}. Item must be minted as NFT first before locking.`);
    }

    const tx = new Transaction();

    // Note: Don't set sender manually - signer handles this
    // tx.setSender(this.currentAddress); // ❌ Remove this line

    // Call the lock function from lock.move
    try {
      const [lockedItem, key] = tx.moveCall({
        target: `${LOCK_MODULE}::lock`,
        arguments: [tx.object(itemId)],
        typeArguments: [] // Type will be inferred from the item
      });
    } catch (error) {
      console.error('Failed to create moveCall:', error);
      throw new Error(`Failed to create lock transaction: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Execute transaction using OneChain SDK standard pattern
    let result;
    try {
      console.log('Executing transaction with signer...');
      const signerResult = this.signer.signAndExecuteTransaction({
        transaction: tx,
        options: {
          showObjectChanges: true,
          showEffects: true
        }
      });
      
      // Ensure we await the result properly
      result = await signerResult;
      
      console.log('Transaction executed, result type:', typeof result);
      console.log('Transaction result:', result);
      
    } catch (error) {
      console.error('Transaction execution failed:', error);
      throw new Error(`Transaction execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Debug: Log the result structure
    console.log('Transaction result structure:', JSON.stringify(result, null, 2));

    // Validate result structure
    if (!result) {
      console.error('Transaction returned null/undefined result');
      console.error('Signer type:', typeof this.signer);
      console.error('Signer keys:', this.signer ? Object.keys(this.signer) : 'null');
      throw new Error('Transaction returned no result - signer may not be properly configured');
    }

    // Check for transaction success with proper error handling
    if (!result.effects) {
      console.error('Transaction result missing effects:', result);
      throw new Error('Transaction result missing effects property');
    }

    if (result.effects.status?.status !== 'success') {
      const errorMsg = result.effects.status?.error || 'Unknown transaction error';
      throw new Error(`Transaction failed: ${errorMsg}`);
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
    if (!this.currentAddress) {
      throw new Error('No current address set for transfer');
    }
    tx.transferObjects([returnedItem], this.currentAddress); // Use current address

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
        if (object.data?.content && 'type' in object.data.content &&
            object.data.content.type === `${ITEMS_MODULE}::GameItem` &&
            'fields' in object.data.content) {
          const fields = object.data.content.fields as any;
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
        if (object.data?.content && 'type' in object.data.content &&
            typeof object.data.content.type === 'string' &&
            object.data.content.type.includes('TradeEscrow') &&
            'fields' in object.data.content) {
          const fields = object.data.content.fields as any;
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