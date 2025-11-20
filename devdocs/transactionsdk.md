# OneChain Programmable Transaction Basics

> OneChain Labs TypeScript SDK Documentation

## Table of Contents

- [Installation](#installation)
- [Hello OneChain](#hello-onechain)
- [Transaction Building](#transaction-building)
  - [Multiple Transactions](#multiple-transactions)
- [Executing Transactions](#executing-transactions)
- [Observing Transaction Results](#observing-transaction-results)
- [Transaction Types](#transaction-types)
  - [`tx.splitCoins(coin, amounts)`](#txsplitcoinscoin-amounts)
  - [`tx.mergeCoins(destinationCoin, sourceCoins)`](#txmergecoinsdestinationcoin-sourcecoins)
  - [`tx.transferObjects(objects, address)`](#txtransferobjectsobjects-address)
  - [`tx.moveCall({ target, arguments, typeArguments })`](#txmovecall-target-arguments-typearguments-)
  - [`tx.makeMoveVec({ type, elements })`](#txmakemovevec-type-elements-)
  - [`tx.publish(modules, dependencies)`](#txpublishmodules-dependencies)
- [Passing Inputs to Transactions](#passing-inputs-to-transactions)
  - [JavaScript Values](#javascript-values)
  - [Pure Values](#pure-values)
  - [Object References](#object-references)
  - [Optimized Object References](#optimized-object-references)
  - [Object Helpers](#object-helpers)
  - [Transaction Results](#transaction-results)
- [Getting Transaction Bytes](#getting-transaction-bytes)
- [React Hooks: useSignAndExecuteTransaction](#react-hooks-usesignandexecutetransaction)
  - [Basic Usage](#basic-usage)
  - [Advanced Usage with Custom Options](#advanced-usage-with-custom-options)
  - [Arguments](#arguments)
- [Related Documentation](#related-documentation)

## Installation

```bash
npm install @onelabs/sui
```

## Hello OneChain

To construct transactions, import the Transaction class and construct it:

```typescript
import { Transaction } from '@onelabs/sui/transactions';

const tx = new Transaction();
```

## Transaction Building

You can then add transactions to the transaction block:

```typescript
// create a new coin with balance 100, based on the coins used as gas payment
// you can define any balance here
const [coin] = tx.splitCoins(tx.gas, [100]);

// transfer the split coin to a specific address
tx.transferObjects([coin], '0xSomeSuiAddress');
```
### Multiple Transactions

You can attach multiple transactions of the same type to a transaction block. For example, to get a list of transfers and iterate over them to transfer coins to each of them:

```typescript
interface Transfer {
  to: string;
  amount: number;
}

// procure a list of some Sui transfers to make
const transfers: Transfer[] = getTransfers();

const tx = new Transaction();

// first, split the gas coin into multiple coins
const coins = tx.splitCoins(
  tx.gas,
  transfers.map((transfer) => transfer.amount),
);

// next, create a transfer transaction for each coin
transfers.forEach((transfer, index) => {
  tx.transferObjects([coins[index]], transfer.to);
});
```
## Executing Transactions

After you have the transaction defined, you can directly execute it with a signer using `signAndExecuteTransaction`:

```typescript
client.signAndExecuteTransaction({ signer: keypair, transaction: tx });
```
## Observing Transaction Results

When you use `client.signAndExecuteTransaction` or `client.executeTransactionBlock`, the transaction will be finalized on the blockchain before the function resolves, but the effects of the transaction may not be immediately observable.

There are 2 ways to observe the results of a transaction:

### 1. Transaction Options
Methods like `client.signAndExecuteTransaction` accept an options object with options like `showObjectChanges` and `showBalanceChanges` (see the SuiClient docs for more details). These options will cause the request to contain additional details about the effects of the transaction that can be immediately displayed to the user, or used for further processing in your application.

### 2. Wait for Transaction
The other way effects of transactions can be observed is by querying other RPC methods like `client.getBalances` that return objects or balances owned by a specific address. These RPC calls depend on the RPC node having indexed the effects of the transaction, which may not have happened immediately after a transaction has been executed.

To ensure that effects of a transaction are represented in future RPC calls, you can use the `waitForTransaction` method on the client:

```typescript
const result = await client.signAndExecuteTransaction({ signer: keypair, transaction: tx });
await client.waitForTransaction({ digest: result.digest });
```

Once `waitForTransaction` resolves, any future RPC calls will be guaranteed to reflect the effects of the transaction.

## Transaction Types

Programmable Transactions have two key concepts: **inputs** and **transactions**.

Transactions are steps of execution in the transaction block. Each transaction takes a set of inputs and produces results. The inputs for a transaction depend on the kind of transaction. OneChain supports the following transaction types:

### `tx.splitCoins(coin, amounts)`
Creates new coins with the defined amounts, split from the provided coin. Returns the coins so that it can be used in subsequent transactions.

```typescript
// Example: split gas coin into coins of 100 and 200
tx.splitCoins(tx.gas, [100, 200])
```

### `tx.mergeCoins(destinationCoin, sourceCoins)`
Merges the sourceCoins into the destinationCoin.

```typescript
// Example: merge coin2 and coin3 into coin1
tx.mergeCoins(tx.object(coin1), [tx.object(coin2), tx.object(coin3)])
```

### `tx.transferObjects(objects, address)`
Transfers a list of objects to the specified address.

```typescript
// Example: transfer multiple objects to an address
tx.transferObjects([tx.object(thing1), tx.object(thing2)], myAddress)
```

### `tx.moveCall({ target, arguments, typeArguments })`
Executes a Move call. Returns whatever the Sui Move call returns.

```typescript
// Example: mint an NFT
tx.moveCall({
  target: '0x2::devnet_nft::mint',
  arguments: [
    tx.pure.string(name),
    tx.pure.string(description),
    tx.pure.string(image)
  ]
})
```

### `tx.makeMoveVec({ type, elements })`
Constructs a vector of objects that can be passed into a moveCall. This is required as there's no way to define a vector as an input.

```typescript
// Example: create a vector of objects
tx.makeMoveVec({ elements: [tx.object(id1), tx.object(id2)] })
```

### `tx.publish(modules, dependencies)`
Publishes a Move package. Returns the upgrade capability object.

## Passing Inputs to Transactions

Transaction inputs can be provided in a number of different ways, depending on the transaction, and the type of value being provided.

### JavaScript Values

For specific transaction arguments (amounts in `splitCoins`, and address in `transferObjects`) the expected type is known ahead of time, and you can directly pass raw JavaScript values when calling the transaction method. The SDK will automatically convert to the appropriate Move type.

```typescript
// the amount to split off the gas coin is provided as a pure javascript number
const [coin] = tx.splitCoins(tx.gas, [100]);
// the address for the transfer is provided as a pure javascript string
tx.transferObjects([coin], '0xSomeSuiAddress');
```
### Pure Values

When providing inputs that are not on-chain objects, the values must be serialized as [BCS](https://en.wikipedia.org/wiki/Binary_Coded_Serialization), which can be done using `tx.pure` e.g., `tx.pure.address(address)` or `tx.pure(bcs.vector(bcs.U8).serialize(bytes))`.

`tx.pure` can be called as a function that accepts a SerializedBcs object, or as a namespace that contains functions for each of the supported types.

```typescript
const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(100)]);
const [coin] = tx.splitCoins(tx.gas, [tx.pure(bcs.U64.serialize(100))]);
tx.transferObjects([coin], tx.pure.address('0xSomeSuiAddress'));
tx.transferObjects([coin], tx.pure(bcs.Address.serialize('0xSomeSuiAddress')));
```

To pass vector or option types, you can use the corresponding methods on `tx.pure`, use `tx.pure` as a function with a type argument, or serialize the value before passing it to `tx.pure` using the bcs SDK:

```typescript
import { bcs } from '@onelabs/sui/bcs';

tx.moveCall({
  target: '0x2::foo::bar',
  arguments: [
    // using vector and option methods
    tx.pure.vector('u8', [1, 2, 3]),
    tx.pure.option('u8', 1),
    tx.pure.option('u8', null),

    // Using pure with type arguments
    tx.pure('vector<u8>', [1, 2, 3]),
    tx.pure('option<u8>', 1),
    tx.pure('option<u8>', null),
    tx.pure('vector<option<u8>>', [1, null, 2]),

    // Using bcs.serialize
    tx.pure(bcs.vector(bcs.U8).serialize([1, 2, 3])),
    tx.pure(bcs.option(bcs.U8).serialize(1)),
    tx.pure(bcs.option(bcs.U8).serialize(null)),
    tx.pure(bcs.vector(bcs.option(bcs.U8)).serialize([1, null, 2])),
  ],
});
```
### Object References

To use an on-chain object as a transaction input, you must pass a reference to that object. This can be done by calling `tx.object` with the object id. Transaction arguments that only accept objects (like objects in `transferObjects`) will automatically treat any provided strings as object IDs. For methods like `moveCall` that accept both objects and other types, you must explicitly call `tx.object` to convert the id to an object reference.

```typescript
// Object IDs can be passed to some methods like (transferObjects) directly
tx.transferObjects(['0xSomeObject'], '0xSomeAddress');
// tx.object can be used anywhere an object is accepted
tx.transferObjects([tx.object('0xSomeObject')], '0xSomeAddress');

tx.moveCall({
  target: '0x2::nft::mint',
  // object IDs must be wrapped in moveCall arguments
  arguments: [tx.object('0xSomeObject')],
});

// tx.object automatically converts the object ID to receiving transaction arguments if the moveCall expects it
tx.moveCall({
  target: '0xSomeAddress::example::receive_object',
  // 0xSomeAddress::example::receive_object expects a receiving argument and has a Move definition that looks like this:
  // public fun receive_object<T: key>(parent_object: &mut ParentObjectType, receiving_object: Receiving<ChildObjectType>) { ... }
  arguments: [tx.object('0xParentObjectID'), tx.object('0xReceivingObjectID')],
});
```
#### Optimized Object References

When building a transaction, Sui expects all objects to be fully resolved, including the object version. The SDK automatically looks up the current version of objects for any provided object reference when building a transaction. If the object reference is used as a receiving argument to a `moveCall`, the object reference is automatically converted to a receiving transaction argument. This greatly simplifies building transactions, but requires additional RPC calls.

You can optimize this process by providing a fully resolved object reference instead:

```typescript
import { Inputs } from '@onelabs/sui/transactions';

// for owned or immutable objects
tx.object(Inputs.ObjectRef({ digest, objectId, version }));

// for shared objects
tx.object(Inputs.SharedObjectRef({ objectId, initialSharedVersion, mutable }));

// for receiving objects
tx.object(Inputs.ReceivingRef({ digest, objectId, version }));
```
### Object Helpers

There are a handful of specific object types that can be referenced through helper methods on `tx.object`:

```typescript
tx.object.system(),
tx.object.clock(),
tx.object.random(),
tx.object.denyList(),

tx.object.option({
  type: '0x123::example::Thing',
  // value can be an Object ID, or any other object reference, or null for `none`
  value: '0x456',
}),
```
### Transaction Results

You can also use the result of a transaction as an argument in subsequent transactions. Each transaction method on the transaction builder returns a reference to the transaction result.

```typescript
// split a coin object off of the gas object
const [coin] = tx.splitCoins(tx.gas, [100]);
// transfer the resulting coin object
tx.transferObjects([coin], address);
```

When a transaction returns multiple results, you can access the result at a specific index either using destructuring, or array indexes.

```typescript
// destructuring (preferred, as it gives you logical local names)
const [nft1, nft2] = tx.moveCall({ target: '0x2::nft::mint_many' });
tx.transferObjects([nft1, nft2], address);

// array indexes
const mintMany = tx.moveCall({ target: '0x2::nft::mint_many' });
tx.transferObjects([mintMany[0], mintMany[1]], address);
```
## Getting Transaction Bytes

If you need the transaction bytes, instead of signing or executing the transaction, you can use the `build` method on the transaction builder itself.

> **Important**: You might need to explicitly call `setSender()` on the transaction to ensure that the sender field is populated. This is normally done by the signer before signing the transaction, but will not be done automatically if you're building the transaction bytes yourself.

```typescript
const tx = new Transaction();

// ... add some transactions...

await tx.build({ client });
```

In most cases, building requires your SuiClient to fully resolve input values.

If you have transaction bytes, you can also convert them back into a Transaction class:

```typescript
const bytes = getTransactionBytesFromSomewhere();
const tx = Transaction.from(bytes);
```

---

# React Hooks: useSignAndExecuteTransaction

Use the `useSignAndExecuteTransaction` hook to prompt the user to sign and execute a transaction block with their wallet.

## Basic Usage

```typescript
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from '@onelabs/dapp-kit';
import { Transaction } from '@onelabs/sui/transactions';
import { useState } from 'react';

function MyComponent() {
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    const [digest, setDigest] = useState('');
    const currentAccount = useCurrentAccount();

    return (
        <div style={{ padding: 20 }}>
            <ConnectButton />
            {currentAccount && (
                <>
                    <div>
                        <button
                            onClick={() => {
                                signAndExecuteTransaction(
                                    {
                                        transaction: new Transaction(),
                                        chain: 'sui:devnet',
                                    },
                                    {
                                        onSuccess: (result) => {
                                            console.log('executed transaction', result);
                                            setDigest(result.digest);
                                        },
                                    },
                                );
                            }}
                        >
                            Sign and execute transaction
                        </button>
                    </div>
                    <div>Digest: {digest}</div>
                </>
            )}
        </div>
    );
}
```

## Advanced Usage with Custom Options

To customize how transactions are executed, and what data is returned when executing a transaction, you can pass a custom execute function.

```typescript
import {
    ConnectButton,
    useSuiClient,
    useCurrentAccount,
    useSignAndExecuteTransaction,
} from '@onelabs/dapp-kit';
import { Transaction } from '@onelabs/sui/transactions';
import { useState } from 'react';

function MyComponent() {
    const client = useSuiClient();
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction({
        execute: async ({ bytes, signature }) =>
            await client.executeTransactionBlock({
                transactionBlock: bytes,
                signature,
                options: {
                    // Raw effects are required so the effects can be reported back to the wallet
                    showRawEffects: true,
                    // Select additional data to return
                    showObjectChanges: true,
                },
            }),
    });

    const [digest, setDigest] = useState('');
    const currentAccount = useCurrentAccount();

    return (
        <div style={{ padding: 20 }}>
            <ConnectButton />
            {currentAccount && (
                <>
                    <div>
                        <button
                            onClick={() => {
                                signAndExecuteTransaction(
                                    {
                                        transaction: new Transaction(),
                                        chain: 'sui:devnet',
                                    },
                                    {
                                        onSuccess: (result) => {
                                            console.log('object changes', result.objectChanges);
                                            setDigest(result.digest);
                                        },
                                    },
                                );
                            }}
                        >
                            Sign and execute transaction
                        </button>
                    </div>
                    <div>Digest: {digest}</div>
                </>
            )}
        </div>
    );
}
```

## Arguments

- **`transaction`**: The transaction to sign and execute.
- **`chain`** (optional): The chain identifier the transaction should be signed for. Defaults to the active network of the dApp.
- **`execute`** (optional): A custom function to execute the transaction

In addition to these options, you can also pass any options that the `SuiClient.signAndExecuteTransaction` method accepts.

---

## Related Documentation

- [OneChain SDK Installation](#installation)
- [SuiClient Documentation](./suiclient.md)
- [Move Language Guide](./move-guide.md)
- [React DApp Kit](./dapp-kit.md)