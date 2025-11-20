# OneChain/Sui Coding Conventions

This guide outlines recommended conventions and best practices for writing Move smart contracts on OneChain (which uses Sui's Move language). Following these guidelines helps create more maintainable, secure, and composable code that aligns with ecosystem standards.

## Organization Principles

### Package Structure
A OneChain package consists of:

```
sources/
    my_module.move
    another_module.move
    ...
tests/
    my_module_tests.move
    ...
examples/
    using_my_module.move
Move.lock
Move.toml
```

- **sources/**: Directory containing Move code to be uploaded to the blockchain
- **Move.toml**: Manifest file declaring dependencies and package information
- **Move.lock**: Auto-generated dependency lock file (should be in git)
- **tests/**: Optional test directory (not uploaded on-chain)
- **examples/**: Optional examples directory (not uploaded on-chain)

### Package Naming
- Package name should be in PascalCase: `name = "MyPackage"`
- Named address should be snake_case: `my_package = 0x0`
- Use automated address management instead of `published-at` field

### Module Design
- Design modules around one object or data structure
- Each variant structure should have its own module to avoid complexity
- Module declarations don't need brackets
- Compiler provides default use statements for widely used modules

```move
module conventions::wallet;

public struct Wallet has key, store {
    id: UID,
    amount: u64
}
```

## Code Structure

### Body Organization
Structure code using comments with `===` around titles:

```move
module conventions::comments;

// === Imports ===

// === Errors ===

// === Constants ===

// === Structs ===

// === Events ===

// === Method Aliases ===

// === Public Functions ===

// === View Functions ===

// === Admin Functions ===

// === Package Functions ===

// === Private Functions ===

// === Test Functions ===
```

### Function Organization
- `init` function should be first in the module (if it exists)
- Sort functions by purpose and user flow
- Use explicit function names like `admin_set_fees`
- Test functions should be in the `tests/` directory

### Import Grouping
Group imports by dependency:

```move
use std::string::String;
use sui::{
    coin::Coin,
    balance,
    table::Table
};
use my_dep::battle::{Battle, Score};
```

## Naming Conventions

### Constants
- Constants should be uppercase with snake case: `MAX_NAME_LENGTH`
- Error constants should be PascalCase starting with `E`: `EInvalidName`

```move
const MAX_NAME_LENGTH: u64 = 64;
const EInvalidName: u64 = 0;  // Correct
const E_INVALID_NAME: u64 = 0; // Wrong
```

### Structs
- Declare struct abilities in order: `key`, `copy`, `drop`, `store`
- Don't use 'potato' in struct names
- Use `Event` suffix for event structs
- Support positional fields for simple wrappers

```move
// Dynamic field keys
public struct ReceiptKey(ID) has copy, drop, store;

// Dynamic field
public struct Receipt<Data> has key, store {
    id: UID,
    data: Data
}

// Events
public struct TradeCompleted has copy, drop {
    from: address,
    to: address,
    item_id: ID
}
```

### CRUD Function Names
Follow standard CRUD naming conventions:

| Purpose | Function Name | Description |
|---------|---------------|-------------|
| Create | `new`, `create` | Creates objects |
| Create Empty | `empty` | Creates empty struct |
| Add | `add` | Adds values |
| Remove | `remove` | Removes values |
| Check | `exists`, `contains` | Checks existence |
| Access | `borrow`, `borrow_mut` | Returns references |
| Get | `property_name` | Returns field value |
| Set | `property_name_mut` | Returns mutable field |
| Destroy | `drop`, `destroy`, `destroy_empty` | Destroys objects |
| Transform | `to_name`, `from_name` | Type conversion |

### Generics
- Use single letters (`T`, `U`) or descriptive full names
- Prioritize readability

```move
public struct Receipt<T> has store { ... }
public struct Receipt<Data> has store { ... }
```

## Code Structure Patterns

### Shared Objects
Library modules should provide two functions: one to instantiate, one to share:

```move
module conventions::shop;

public struct Shop has key {
    id: UID
}

public fun new(ctx: &mut TxContext): Shop {
    Shop { id: object::new(ctx) }
}

public fun share(shop: Shop) {
    transfer::share_object(shop);
}
```

### Pure Functions
Keep functions pure for composability. Avoid `transfer::transfer` in core functions:

```move
// ✅ Right - Returns excess coins
public fun add_liquidity<CoinX, CoinY, LpCoin>(
    pool: &mut Pool,
    coin_x: Coin<CoinX>,
    coin_y: Coin<CoinY>
): (Coin<LpCoin>, Coin<CoinX>, Coin<CoinY>) {
    // Implementation
}

// ❌ Wrong - Mixes logic with transfers
public fun impure_add_liquidity<CoinX, CoinY, LpCoin>(
    pool: &mut Pool,
    coin_x: Coin<CoinX>,
    coin_y: Coin<CoinY>,
    ctx: &mut TxContext
): Coin<LpCoin> {
    let (lp_coin, coin_x, coin_y) = add_liquidity(pool, coin_x, coin_y);
    transfer::public_transfer(coin_x, tx_context::sender(ctx));
    lp_coin
}
```

### Coin Arguments
Pass coins by value with exact amounts for better transaction readability:

```move
// ✅ Right
public fun swap<CoinX, CoinY>(coin_in: Coin<CoinX>): Coin<CoinY> {
    // Implementation
}

// ❌ Wrong
public fun exchange<CoinX, CoinY>(coin_in: &mut Coin<CoinX>, value: u64): Coin<CoinY> {
    // Implementation
}
```

### Access Control
Use capability objects instead of address arrays for composability:

```move
// ✅ Right - Composable with other protocols
public fun withdraw(
    state: &mut State,
    account: &mut Account,
    ctx: &mut TxContext
): Coin<SUI> {
    let authorized_balance = account.balance;
    account.balance = 0;
    coin::take(&mut state.balance, authorized_balance, ctx)
}

// ❌ Wrong - Less composable
public fun wrong_withdraw(state: &mut State, ctx: &mut TxContext): Coin<SUI> {
    let sender = tx_context::sender(ctx);
    let authorized_balance = table::borrow_mut(&mut state.accounts, sender);
    let value = *authorized_balance;
    *authorized_balance = 0;
    coin::take(&mut state.balance, value, ctx)
}
```

### Data Storage: Owned vs Shared Objects
- Use **owned objects** for one-to-one relationships
- Use **shared objects** when you need additional functionality

```move
// ✅ Owned object - for individual user data
public struct OwnedWallet has key {
    id: UID,
    balance: Balance<SUI>
}

// ✅ Shared object - when you need extra functionality
public struct SharedWallet has key {
    id: UID,
    balance: Balance<SUI>,
    accounts: Table<address, u64>
}
```

### Admin Capability
In admin-gated functions, place capability as the second parameter:

```move
// ✅ Right - Normal method associativity
public fun set(account: &mut Account, _: &Admin, new_name: String) {
    // Implementation
}

// ❌ Wrong - Reversed associativity
public fun update(_: &Admin, account: &mut Account, new_name: String) {
    // Implementation
}
```

## Documentation

### Comments
- Use `///` for documentation comments (explain what)
- Use `//` for technical comments (explain how)
- Add field comments for struct properties
- Document parameters and return values in complex functions

```move
/// Creates and returns a new Hero object
public fun new(ctx: &mut TxContext): Hero {
    Hero {
        id: object::new(ctx),
        power: 0
    }
}

// should be initialized before being shared
public fun initialize_hero(hero: &mut Hero) {
    hero.power = 100;
}

public struct Hero has key, store {
    id: UID,
    // power of the nft
    power: u64
}
```

## GameFi Specific Patterns

### Game Item Structure
```move
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
}

public struct ItemForge has key {
    id: UID,
    next_item_id: u64,
    total_items_created: u64,
}
```

### Event Naming
```move
public struct ItemMinted has copy, drop {
    item_id: u64,
    owner: address,
    item_type: u8,
    rarity: u8,
}

public struct ItemTraded has copy, drop {
    from: address,
    to: address,
    item_id: ID,
    item_type: u8,
}
```

### Escrow Pattern for Trading
```move
public struct TradeEscrow<T: key + store> has key {
    id: UID,
    sender: address,
    recipient: address,
    exchange_key: ID,
    escrowed_key: ID,
    escrowed: T,
}
```

These conventions ensure your OneChain GameFi smart contracts are secure, maintainable, and follow ecosystem best practices.