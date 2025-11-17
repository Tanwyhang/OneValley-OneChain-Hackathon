/// Escrow-based trading module for OneValley GameFi project
/// Implements secure P2P item trading using OneChain's escrow pattern
module one_valley_gamefi::trading {
    use std::string::String;
    use one::object::{ID, UID};
    use one::transfer;
    use one::tx_context::{TxContext};
    use one::event;
    use one_valley_gamefi::lock::{Locked, Key};
    use one_valley_gamefi::items;

    // === Errors ===
    const EMismatchedSenderRecipient: u64 = 0;
    const EMismatchedExchangeObject: u64 = 1;
    const EInvalidEscrowState: u64 = 2;
    const EUnauthorizedCustodian: u64 = 3;

    // === Structs ===

    /// An object held in escrow for secure trading
    /// This follows OneChain's owned escrow pattern for GameFi
    public struct TradeEscrow<T: key + store> has key {
        id: UID,
        /// Owner of the escrowed item
        sender: address,
        /// Intended recipient of the trade
        recipient: address,
        /// ID of the key that unlocks the desired item
        exchange_key: ID,
        /// ID of the key that locked this escrowed item
        escrowed_key: ID,
        /// The escrowed item being traded
        escrowed: T,
        /// Trade status timestamp
        created_at: u64,
    }

    /// Game custodian that manages escrow trades
    /// Acts as trusted third party for better UX and lower latency
    public struct GameCustodian has key {
        id: UID,
        total_trades: u64,
        active_escrows: u64,
        owner: address,
    }

    /// Trade proposal for initiating trades
    public struct TradeProposal has copy, drop {
        proposer: address,
        proposed_item: ID,
        desired_item: ID,
        expiry_timestamp: u64,
    }

    // === Events ===

    /// Event emitted when a new escrow is created
    public struct EscrowCreated has copy, drop {
        escrow_id: ID,
        sender: address,
        recipient: address,
        item_type: u8,
        created_at: u64,
    }

    /// Event emitted when a trade is completed
    public struct TradeCompleted has copy, drop {
        escrow_id_1: ID,
        escrow_id_2: ID,
        trader_1: address,
        trader_2: address,
        completed_at: u64,
    }

    /// Event emitted when an escrow is cancelled
    public struct EscrowCancelled has copy, drop {
        escrow_id: ID,
        sender: address,
        reason: String,
        cancelled_at: u64,
    }

    // === Public Functions ===

    /// Initialize the trading system by creating a GameCustodian
    fun init(ctx: &mut TxContext) {
        let custodian = GameCustodian {
            id: object::new(ctx),
            total_trades: 0,
            active_escrows: 0,
            owner: ctx.sender(),
        };
        transfer::share_object(custodian);
    }

    /// Initiate a trade by creating an escrow
    /// The proposer locks their item and creates an escrow with the desired item's key
    public fun initiate_trade<T: key + store>(
        key: Key,
        locked_item: Locked<T>,
        exchange_key: ID,
        recipient: address,
        custodian: address,
        ctx: &mut TxContext
    ) {
        let escrow = TradeEscrow {
            id: object::new(ctx),
            sender: ctx.sender(),
            recipient,
            exchange_key,
            escrowed_key: object::id(&key),
            escrowed: locked_item.unlock(key),
            created_at: tx_context::epoch_timestamp_ms(ctx),
        };

        // Determine item type for event
        let item_type = get_item_type(&escrow.escrowed);

        event::emit(EscrowCreated {
            escrow_id: object::id(&escrow),
            sender: ctx.sender(),
            recipient,
            item_type,
            created_at: escrow.created_at,
        });

        transfer::transfer(escrow, custodian);
    }

    /// Execute a swap between two escrowed items
    /// Can only be called by the custodian
    public fun execute_swap<T: key + store, U: key + store>(
        mut custodian: &mut GameCustodian,
        escrow1: TradeEscrow<T>,
        escrow2: TradeEscrow<U>,
        ctx: &TxContext
    ) {
        // Verify caller is authorized
        assert!(custodian.owner == tx_context::sender(ctx), EUnauthorizedCustodian);

        // Unpack escrows for validation
        let TradeEscrow {
            id: id1,
            sender: sender1,
            recipient: recipient1,
            exchange_key: exchange_key1,
            escrowed_key: escrowed_key1,
            escrowed: escrowed1,
            created_at: _,
        } = escrow1;

        let TradeEscrow {
            id: id2,
            sender: sender2,
            recipient: recipient2,
            exchange_key: exchange_key2,
            escrowed_key: escrowed_key2,
            escrowed: escrowed2,
            created_at: _,
        } = escrow2;

        // Get escrow IDs before deletion
        let escrow_id_1 = object::uid_to_inner(&id1);
        let escrow_id_2 = object::uid_to_inner(&id2);

        // Validate trade matching
        assert!(sender1 == recipient2, EMismatchedSenderRecipient);
        assert!(sender2 == recipient1, EMismatchedSenderRecipient);
        assert!(escrowed_key1 == exchange_key2, EMismatchedExchangeObject);
        assert!(escrowed_key2 == exchange_key1, EMismatchedExchangeObject);

        // Clean up UID objects
        object::delete(id1);
        object::delete(id2);

        // Update custodian stats
        custodian.total_trades = custodian.total_trades + 1;
        custodian.active_escrows = custodian.active_escrows - 2;

        // Get item info for events before transfer
        let item_id1 = get_item_id_direct(&escrowed1);
        let item_type1 = get_item_type_direct(&escrowed1);
        let item_id2 = get_item_id_direct(&escrowed2);
        let item_type2 = get_item_type_direct(&escrowed2);

        // Execute the swap
        transfer::public_transfer(escrowed1, recipient1);
        transfer::public_transfer(escrowed2, recipient2);

        // Emit events for frontend using items module
        items::emit_trade_event(
            sender1,
            recipient1,
            item_id1,
            item_type1,
            ctx
        );

        items::emit_trade_event(
            sender2,
            recipient2,
            item_id2,
            item_type2,
            ctx
        );

        event::emit(TradeCompleted {
            escrow_id_1: escrow_id_1,
            escrow_id_2: escrow_id_2,
            trader_1: sender1,
            trader_2: sender2,
            completed_at: tx_context::epoch_timestamp_ms(ctx),
        });
    }

    /// Cancel an escrow and return the item to the original owner
    /// Can only be called by the escrow creator or custodian
    public fun cancel_escrow<T: key + store>(
        escrow: TradeEscrow<T>,
        ctx: &TxContext
    ): T {
        let sender = tx_context::sender(ctx);
        let TradeEscrow {
            id,
            sender: escrow_sender,
            recipient: _,
            exchange_key: _,
            escrowed_key: _,
            escrowed,
            created_at: _,
        } = escrow;

        // Only sender can cancel their own escrow
        assert!(sender == escrow_sender, EInvalidEscrowState);

        let escrow_id = object::uid_to_inner(&id);
        object::delete(id);

        event::emit(EscrowCancelled {
            escrow_id,
            sender: escrow_sender,
            reason: std::string::utf8(b"User cancelled"),
            cancelled_at: tx_context::epoch_timestamp_ms(ctx),
        });

        escrowed
    }

    /// Admin function to update custodian stats when escrow is created
    public fun increment_active_escrows(custodian: &mut GameCustodian, ctx: &TxContext) {
        assert!(custodian.owner == tx_context::sender(ctx), EUnauthorizedCustodian);
        custodian.active_escrows = custodian.active_escrows + 1;
    }

    // === View Functions ===

    /// Get escrow sender
    public fun escrow_sender<T: key + store>(escrow: &TradeEscrow<T>): address {
        escrow.sender
    }

    /// Get escrow recipient
    public fun escrow_recipient<T: key + store>(escrow: &TradeEscrow<T>): address {
        escrow.recipient
    }

    /// Get escrow exchange key
    public fun escrow_exchange_key<T: key + store>(escrow: &TradeEscrow<T>): ID {
        escrow.exchange_key
    }

    /// Get escrow created timestamp
    public fun escrow_created_at<T: key + store>(escrow: &TradeEscrow<T>): u64 {
        escrow.created_at
    }

    /// Get custodian total trades
    public fun custodian_total_trades(custodian: &GameCustodian): u64 {
        custodian.total_trades
    }

    /// Get custodian active escrows
    public fun custodian_active_escrows(custodian: &GameCustodian): u64 {
        custodian.active_escrows
    }

    /// Get custodian owner
    public fun custodian_owner(custodian: &GameCustodian): address {
        custodian.owner
    }

    // === Private Helper Functions ===

    /// Get item type from a generic escrowed object
    /// This requires the object to have a way to determine its type
    fun get_item_type<T: key + store>(item: &T): u8 {
        // This is a placeholder - in practice, you'd need to determine
        // the item type based on the actual object structure
        // For now, assume it's a weapon
        1 // WEAPON
    }

    /// Get item ID from a generic escrowed object
    fun get_item_id<T: key + store>(item: &T): u64 {
        // This would need to be implemented based on the actual object structure
        0 // Placeholder
    }

    /// Direct item type detection for known types
    fun get_item_type_direct<T: key + store>(item: &T): u8 {
        // This would use type reflection or known patterns
        // For demonstration purposes, return default
        1 // WEAPON
    }

    /// Direct item ID detection for known types
    fun get_item_id_direct<T: key + store>(item: &T): u64 {
        // This would use type reflection or known patterns
        // For demonstration purposes, return default
        0 // Placeholder
    }

    // === Admin Functions ===

    /// Transfer custodian ownership
    public fun transfer_custodian_ownership(
        custodian: GameCustodian,
        new_owner: address,
        ctx: &mut TxContext
    ) {
        assert!(custodian.owner == tx_context::sender(ctx), EUnauthorizedCustodian);
        let GameCustodian { id, total_trades, active_escrows, owner: _ } = custodian;

        let new_custodian = GameCustodian {
            id: object::new(ctx),
            total_trades,
            active_escrows,
            owner: new_owner,
        };

        object::delete(id);
        transfer::share_object(new_custodian);
    }

    // === Test Functions ===
    #[test_only]
    public fun create_test_escrow<T: key + store>(
        sender: address,
        recipient: address,
        exchange_key: ID,
        escrowed: T,
        ctx: &mut TxContext
    ): TradeEscrow<T> {
        // Create a dummy object to get a valid ID
        let dummy_obj = object::new(ctx);
        let dummy_id = object::uid_to_inner(&dummy_obj);
        object::delete(dummy_obj);

        TradeEscrow {
            id: object::new(ctx),
            sender,
            recipient,
            exchange_key,
            escrowed_key: dummy_id,
            escrowed,
            created_at: tx_context::epoch_timestamp_ms(ctx),
        }
    }

    #[test_only]
    public fun create_test_custodian(owner: address, ctx: &mut TxContext): GameCustodian {
        GameCustodian {
            id: object::new(ctx),
            total_trades: 0,
            active_escrows: 0,
            owner,
        }
    }
}