/// Game items module for OneValley GameFi project
/// Implements in-game items as NFTs with trading capabilities
module one_valley_gamefi::items {
    use std::string::String;
    use one::event;

    // === Constants ===
    const WEAPON: u8 = 1;
    const ARMOR: u8 = 2;
    const CONSUMABLE: u8 = 3;
    const RESOURCE: u8 = 4;

    // Item rarity levels
    const COMMON: u8 = 1;
    const RARE: u8 = 2;
    const EPIC: u8 = 3;
    const LEGENDARY: u8 = 4;

    // === Errors ===
    const EInvalidRarity: u64 = 0;
    const EInvalidItemType: u64 = 1;
        const EInvalidStatsLength: u64 = 3;

    // === Structs ===

    /// Core game item structure that represents any in-game item as an NFT
    public struct GameItem has key, store {
        id: UID,
        item_id: u64,
        item_type: u8,
        rarity: u8,
        name: String,
        description: String,
        stats: vector<u64>,
        minted_by: address,
        mint_timestamp: u64,
        owner_history: vector<address>,
    }

    /// Item forge for minting and managing game items
    public struct ItemForge has key {
        id: UID,
        next_item_id: u64,
        total_items_created: u64,
    }

    /// Specialized weapon item
    public struct Weapon has key, store {
        id: UID,
        base: GameItem,
        damage: u64,
        durability: u64,
        max_durability: u64,
    }

    /// Specialized armor item
    public struct Armor has key, store {
        id: UID,
        base: GameItem,
        defense: u64,
        durability: u64,
        max_durability: u64,
    }

    // === Events ===

    /// Event emitted when a new item is minted
    public struct ItemMinted has copy, drop {
        item_id: u64,
        owner: address,
        item_type: u8,
        rarity: u8,
        name: String,
    }

    /// Event emitted when an item is traded
    public struct ItemTraded has copy, drop {
        from: address,
        to: address,
        item_id: u64,
        item_type: u8,
        trade_timestamp: u64,
    }

    // === Public Functions ===

    /// Initialize the module by creating an ItemForge
    fun init(ctx: &mut TxContext) {
        let forge = ItemForge {
            id: object::new(ctx),
            next_item_id: 1,
            total_items_created: 0,
        };
        transfer::transfer(forge, ctx.sender());
    }

    /// Create a new base game item
    public fun create_item(
        forge: &mut ItemForge,
        item_type: u8,
        rarity: u8,
        name: String,
        description: String,
        stats: vector<u64>,
        ctx: &mut TxContext
    ): GameItem {
        // Validate inputs
        assert!(is_valid_item_type(item_type), EInvalidItemType);
        assert!(is_valid_rarity(rarity), EInvalidRarity);
        assert!(stats.length() <= 5, EInvalidStatsLength);

        let item = GameItem {
            id: object::new(ctx),
            item_id: forge.next_item_id,
            item_type,
            rarity,
            name,
            description,
            stats,
            minted_by: ctx.sender(),
            mint_timestamp: tx_context::epoch_timestamp_ms(ctx),
            owner_history: vector::empty<address>(),
        };

        forge.next_item_id = forge.next_item_id + 1;
        forge.total_items_created = forge.total_items_created + 1;

        event::emit(ItemMinted {
            item_id: item.item_id,
            owner: ctx.sender(),
            item_type,
            rarity,
            name: *(&item.name),
        });

        item
    }

    /// Create a new weapon item
    public fun create_weapon(
        forge: &mut ItemForge,
        rarity: u8,
        name: String,
        description: String,
        damage: u64,
        max_durability: u64,
        ctx: &mut TxContext
    ): Weapon {
        let base_item = create_item(
            forge,
            WEAPON,
            rarity,
            name,
            description,
            vector[damage, max_durability],
            ctx
        );

        Weapon {
            id: object::new(ctx),
            base: base_item,
            damage,
            durability: max_durability,
            max_durability,
        }
    }

    /// Create a new armor item
    public fun create_armor(
        forge: &mut ItemForge,
        rarity: u8,
        name: String,
        description: String,
        defense: u64,
        max_durability: u64,
        ctx: &mut TxContext
    ): Armor {
        let base_item = create_item(
            forge,
            ARMOR,
            rarity,
            name,
            description,
            vector[defense, max_durability],
            ctx
        );

        Armor {
            id: object::new(ctx),
            base: base_item,
            defense,
            durability: max_durability,
            max_durability,
        }
    }

    /// Update item ownership history when transferred
    public fun update_ownership(item: &mut GameItem, new_owner: address) {
        vector::push_back(&mut item.owner_history, new_owner);
    }

    /// Emit trade event
    public fun emit_trade_event(
        from: address,
        to: address,
        item_id: u64,
        item_type: u8,
        ctx: &TxContext
    ) {
        event::emit(ItemTraded {
            from,
            to,
            item_id,
            item_type,
            trade_timestamp: ctx.epoch_timestamp_ms(),
        });
    }

    // === View Functions ===

    /// Get the item ID
    public fun item_id(item: &GameItem): u64 {
        item.item_id
    }

    /// Get the item type
    public fun item_type(item: &GameItem): u8 {
        item.item_type
    }

    /// Get the item rarity
    public fun rarity(item: &GameItem): u8 {
        item.rarity
    }

    /// Get the item name
    public fun name(item: &GameItem): String {
        *&item.name
    }

    /// Get the item description
    public fun description(item: &GameItem): String {
        *&item.description
    }

    /// Get the item stats
    public fun stats(item: &GameItem): vector<u64> {
        *&item.stats
    }

    /// Get weapon damage
    public fun weapon_damage(weapon: &Weapon): u64 {
        weapon.damage
    }

    /// Get weapon durability
    public fun weapon_durability(weapon: &Weapon): u64 {
        weapon.durability
    }

    /// Get weapon max durability
    public fun weapon_max_durability(weapon: &Weapon): u64 {
        weapon.max_durability
    }

    /// Get armor defense
    public fun armor_defense(armor: &Armor): u64 {
        armor.defense
    }

    /// Get armor durability
    public fun armor_durability(armor: &Armor): u64 {
        armor.durability
    }

    /// Get armor max durability
    public fun armor_max_durability(armor: &Armor): u64 {
        armor.max_durability
    }

    /// Get base game item from weapon
    public fun weapon_base(weapon: &Weapon): &GameItem {
        &weapon.base
    }

    /// Get base game item from armor
    public fun armor_base(armor: &Armor): &GameItem {
        &armor.base
    }

    /// Get forge total items created
    public fun forge_total_items_created(forge: &ItemForge): u64 {
        forge.total_items_created
    }

    // === Private Functions ===

    /// Check if item type is valid
    fun is_valid_item_type(item_type: u8): bool {
        item_type == WEAPON || item_type == ARMOR || item_type == CONSUMABLE || item_type == RESOURCE
    }

    /// Check if rarity is valid
    fun is_valid_rarity(rarity: u8): bool {
        rarity == COMMON || rarity == RARE || rarity == EPIC || rarity == LEGENDARY
    }

    // === Test Functions ===
    #[test_only]
    public fun create_test_item(
        forge: &mut ItemForge,
        item_type: u8,
        name: String,
        ctx: &mut TxContext
    ): GameItem {
        create_item(
            forge,
            item_type,
            COMMON,
            name,
            std::string::utf8(b"Test item"),
            vector[10u64, 20u64],
            ctx
        )
    }
}