Kiosk Client
Kiosk Client is the base for all Kiosk SDK functionality.

We recommend you keep only one instance of KioskClient throughout your dApp or script. For example, in react, you'd use a context to provide the client.

Creating a kiosk client
You can follow the example to create a KioskClient. The client currently supports MAINNET and TESTNET. View next section for usage in other networks.

Mysten Kiosk rules and extensions are not supported in Devnet due to network wipes (that would require constantly changing the package IDs).


import { KioskClient, Network } from '@onelabs/kiosk';
import { getFullnodeUrl, SuiClient } from '@onelabs/sui/client';
 
// We need a Sui Client. You can re-use the SuiClient of your project
// (it's not recommended to create a new one).
const client = new SuiClient({ url: getFullnodeUrl('testnet') });
 
// Now we can use it to create a kiosk Client.
const kioskClient = new KioskClient({
	client,
	network: Network.TESTNET,
});
Using KioskClient on devnet or localnet
To use all the functionality of Kiosk SDK outside of MAINNET and TESTNET, use Network.CUSTOM as the network, and pass the packageIds for the rules and extensions you want to use.


// constructing it for custom network use.
const kioskClient = new KioskClient({
	client,
	network: Network.CUSTOM,
	packageIds: {
		kioskLockRulePackageId: '0x...',
		royaltyRulePackageId: '0x...',
		personalKioskRulePackageId: '0x...',
		floorPriceRulePackageId: '0x...',
	},
});


Querying
You can use the kioskClient to query kiosk data. It helps you get owned kiosks for an address, as well as fetching all the contents of a specified kiosk.

Querying owned kiosks
Querying owned kiosks returns a list of kioskOwnerCaps, as well as a list of the kioskIds.

KioskOwnerCap is important in this case, as it is used for managing an owned kiosk, as well as purchasing.


const kioskClient = new KioskClient({...});
const address = '0xAddress'
// You can perform actions, like querying the owned kiosks for an address.
const { kioskOwnerCaps, kioskIds } = await kioskClient.getOwnedKiosks({ address });
console.log(kioskOwnerCaps);
 
/**
 * An example response for an address that owns two kiosks (one of which is personal)
[
  {
    isPersonal: true,
    digest: '9mstxLa87E3VEewQ62EEQDKb7ZH2irrEXeMetQjQHzXz',
    version: '18',
    objectId: '0x5d4df1b8da5e1b6bafbb4b7dc5c73e532324d82c86e331f71bf1ea5dff18dccc',
    kioskId: '0x8453fc71611ce8ff73efcca42ed241dcaf7dc65411b56a7be42e6a0bc3d72c13'
  },
  {
    isPersonal: false,
    digest: '8fsKgCh5c2ycPKMVUqUz2H6D9WkPjRHmGP454z67afJh',
    version: '15',
    objectId: '0x84f5a9a1379d73eceae03d0578637936e208daa809e04ec07a8085c798a980fd',
    kioskId: '0xf8c826aae52bc576768032ce496b7fc349f9003603ed1541c8033fc5c2dd2d2c'
  }
]
 */
Querying kiosk content
You can follow the sample to query a kiosk's contents. We recommend saving the items structure (KioskItem), as it's useful when you're trying to purchase from one.

listing field only applies on items that are listed for sale.


const kioskClient = new KioskClient({...});
 
const id = `0xKioskId`;
 
// You can perform actions, like querying the owned kiosks for an address.
const res = await kioskClient.getKiosk({
    id,
    options: {
        withKioskFields: true, // this flag also returns the `kiosk` object in the response, which includes the base setup
        withListingPrices: true, // This flag enables / disables the fetching of the listing prices.
    }
});
console.log(res);
/**
 * An example response of an existing kiosk
 *
{
  items: [
    {
      objectId: '0xf65e88a33466763cabd11b7c2a57938cf4fa707c6cf767cb428894e14caf1537',
      type: '0xd12f8e0fdae3f5d88d2fc4af2e869ea503491e2d8da5f3136320b65bdcf70ab3::hero::Hero',
      isLocked: false,
      kioskId: '0x6d45df1942c11048a9182e3f732262e6e3c95ddd2e5f338c565f531717c2617f',
      listing: undefined,
      data: {
        objectId: '0xf65e88a33466763cabd11b7c2a57938cf4fa707c6cf767cb428894e14caf1537',
        version: '18',
        digest: 'As9fkLEP4QVChhYuGemB185xyyzWG4hspSa3UZ6TWR8b',
        display: { data: null, error: null },
        content: {
          dataType: 'moveObject',
          type: '0xd12f8e0fdae3f5d88d2fc4af2e869ea503491e2d8da5f3136320b65bdcf70ab3::hero::Hero',
          hasPublicTransfer: true,
          fields: {
            id: {
              id: '0xf65e88a33466763cabd11b7c2a57938cf4fa707c6cf767cb428894e14caf1537'
            },
            level: 3
          }
        }
      }
    },
    {
      objectId: '0x34def97cb8c357fcfdf22f72421d4f6f01706662acf7be1afb6e7391d5491372',
      type: '0xd12f8e0fdae3f5d88d2fc4af2e869ea503491e2d8da5f3136320b65bdcf70ab3::hero::Hero',
      isLocked: true,
      kioskId: '0x6d45df1942c11048a9182e3f732262e6e3c95ddd2e5f338c565f531717c2617f',
      listing: undefined,
      data: {
        objectId: '0x34def97cb8c357fcfdf22f72421d4f6f01706662acf7be1afb6e7391d5491372',
        version: '15',
        digest: 'J1MdmHUCXJEKd86rkmMwWASMV86wGkVS9P6SFPyRaKVV',
        display: { data: null, error: null },
        content: {
          dataType: 'moveObject',
          type: '0xd12f8e0fdae3f5d88d2fc4af2e869ea503491e2d8da5f3136320b65bdcf70ab3::hero::Hero',
          hasPublicTransfer: true,
          fields: {
            id: {
              id: '0x34def97cb8c357fcfdf22f72421d4f6f01706662acf7be1afb6e7391d5491372'
            },
            level: 1
          }
        }
      }
    }
  ],
  itemIds: [
    '0xf65e88a33466763cabd11b7c2a57938cf4fa707c6cf767cb428894e14caf1537',
    '0x34def97cb8c357fcfdf22f72421d4f6f01706662acf7be1afb6e7391d5491372'
  ],
  listingIds: [],
  extensions: [],
  kiosk: {
    id: '6d45df1942c11048a9182e3f732262e6e3c95ddd2e5f338c565f531717c2617f',
    profits: '100000',
    owner: '96300f8d9064f954f99db2d7fbe2ad0c5e4344f0e22392330285d399498cfaf3',
    itemCount: 2,
    allowExtensions: false
  }
}
 */
Query kiosk extension
Queries an extension's data. Returns null if there's no extension with that type installed.


// Assuming we have a kioskClient instance.
const kioskClient = new KioskClient({...});
 
// The type of the custom extension.
const type = '0xAddress::custom_extension::ACustomExtensionType';
 
const extension = await kioskClient.getKioskExtension({
  kioskId: '0xAKioskId',
  type
});
 
console.log(extension);
 
/**
 * An example output of the response
{
  objectId: 'extensionObjectId',
  type: '0xAddress::custom_extension::ACustomExtensionType',
  isEnabled: true,
  permissions: "3",
  storageId: '0xExampleStorageId',
  storageSize: "0",
}
*/
Querying transfer policy for type

const kioskClient = new KioskClient({...});
 
const itemType = '0xAddress::hero::Hero';
// You can perform actions, like querying the owned kiosks for an address.
const policies = await kioskClient.getTransferPolicies(itemType)
console.log(policies);
 
/* An example output of the response
[
  {
    id: '0x074847055fe4ea9a7f51eeaf095c05875509403059115af121cfea9b8de355de',
    type: '0x2::transfer_policy::TransferPolicy<0x85926b03d56e49bedfca558fc6a2540d43bdfb5c218190d63b571f33afe255f8::hero::Hero>',
    owner: { Shared: { initial_shared_version: 5 } },
    rules: [
      'a82212d931d3bc7c3401552d935abced7b7fd41d4f57a99f0f47b9196b2f57f5::kiosk_lock_rule::Rule',
      'a82212d931d3bc7c3401552d935abced7b7fd41d4f57a99f0f47b9196b2f57f5::floor_price_rule::Rule',
      'a82212d931d3bc7c3401552d935abced7b7fd41d4f57a99f0f47b9196b2f57f5::royalty_rule::Rule',
      'a82212d931d3bc7c3401552d935abced7b7fd41d4f57a99f0f47b9196b2f57f5::personal_kiosk_rule::Rule'
    ],
    balance: '20000'
  }
]
*/
Get owned transfer policies
Queries to find all the owned transfer policies. Useful to manage transfer policies, and can be combined with TransferPolicyTransaction to easily add or remove rules and withdraw profits.


// Assuming we have a kioskClient instance.
const kioskClient = new KioskClient({...});
 
// The address that owns the transfer policies.
const address = '0xAddress';
// You can perform actions, like querying the owned kiosks for an address.
const policies = await kioskClient.getOwnedTransferPolicies({ address });
console.log(policies);
 
/**
 * An example output of the response
[
  {
    policyId: '0x6b6eca8df6e70ea6447e639ef26b519039b5e9123642258eea1b3c781e94faca',
    policyCapId: '0x34a4794d4ad6578ac345d23ca0f7a4632ca88de297daaf24a1cdbc91e1547be4',
    type: '0xbe01d0594bedbce45c0e08c7374b03bf822e9b73cd7d555bf39c39bbf09d23a9::hero::Hero'
  },
  {
    policyId: '0x87ac2dd80011ed2de9c7916a19145ff520959acd3d8c3dbd100aa74b34155a0a',
    policyCapId: '0x858edda13c5c9086b2491eafed39e0ea58511268bb90d90464a2d7b5ed3f3880',
    type: '0xbe01d0594bedbce45c0e08c7374b03bf822e9b73cd7d555bf39c39bbf09d23a9::hero::Villain'
  }
]
*/
Get owned transfer policies by type
Queries to find all the owned transfer policies for a specific type. Useful to manage transfer policies, and can be combined with


// Assuming you have a kioskClient instance.
const kioskClient = new KioskClient({...});
 
// The address that owns the transfer policies.
const address = '0xAddress';
// The type of the transfer policy.
const type = '0xbe01d0594bedbce45c0e08c7374b03bf822e9b73cd7d555bf39c39bbf09d23a9::hero::Hero';
 
// We can query by type.
const policies = await kioskClient.getOwnedTransferPoliciesByType({ address, type });
 
// An example output of the response
// [
//   {
//     policyId: '0x6b6eca8df6e70ea6447e639ef26b519039b5e9123642258eea1b3c781e94faca',
//     policyCapId: '0x34a4794d4ad6578ac345d23ca0f7a4632ca88de297daaf24a1cdbc91e1547be4',
//     type: '0xbe01d0594bedbce45c0e08c7374b03bf822e9b73cd7d555bf39c39bbf09d23a9::hero::Hero'
//   }
// ]

KioskTransaction
KioskTransaction is the client to build transactions that involve Kiosk. It's used similar to Transaction, and helps in building a transaction.

You need to instatiate it once in every Programmable Transaction Block (PTB) that you're building.

There are two flows to follow, the first being managing an existing kiosk, and the second is creating a new one. It hides all the complexity between a personal and a non-personal kiosk.

Using an existing kiosk
If you have already retrieved a kiosk from kioskClient.getOwnedKiosks(), you can pass a cap.

You must always call kioskTx.finalize() before signing and executing the transaction, as your last command.


// Initiliazed somewhere in the app.
const kioskClient = new KioskClient({...});
const { kioskOwnerCaps } = await kioskClient.getOwnedKiosks({ address: '0xMyAddress'});
 
const tx = new Transaction();
const kioskTx = new KioskTransaction({ transaction: tx, kioskClient, cap: kioskOwnerCaps[0] });
 
// Now you can do whatever you want with kioskTx.
// For example, you could withdraw the profits from the kiosk.
kioskTx.withdraw('0xMyAddress', 100_000_000n);
 
// You could also chain some other functionality if you want to.
kioskTx
    .place({
        itemType: '0xMyItemType',
        item: '0xMyItem',
    })
    .list({
        itemType: '0xMyItemType',
        itemId: '0xMyItem',
        price: 10000n
    });
 
// Always called as our last kioskTx interaction.
kioskTx.finalize();
 
// Sign and execute transaction.
await signAndExecuteTransaction({tx: tx});
Creating a new kiosk
If you don't have a kiosk yet, you can create one using create(). The KioskTransaction enables use of the newly created kiosk to execute some functionality in the same PTB.


// Initiliazed somewhere in the app.
const kioskClient = new KioskClient({...});
 
const tx = new Transaction();
const kioskTx = new KioskTransaction({ transaction: tx, kioskClient });
 
// Calls the creation function.
kioskTx.create();
 
// We can use the kiosk for some action.
// For example, placing an item in the newly created kiosk.
kioskTx.place({
    itemType: '0x...::hero::Hero',
    item: '0xAHero',
});
 
// Shares the kiosk and transfers the `KioskOwnerCap` to the owner.
kioskTx.shareAndTransferCap('0xMyAddress');
 
// Always called as our last kioskTx interaction.
kioskTx.finalize();
 
// Sign and execute transaction.
await signAndExecuteTransaction({tx: tx});
Creating a new personal kiosk
KioskTransaction makes it easy to create a new personal kiosk, and use it in the same PTB.


// Initiliazed somewhere in the app.
const kioskClient = new KioskClient({...});
 
const tx = new Transaction();
const kioskTx = new KioskTransaction({ transaction: tx, kioskClient });
 
// An example that creates a personal kiosk, uses it to place an item, and shares it.
// The `PersonalKioskCap` is automatically transferred to the sender when calling `.finalize()`.
// The `Kiosk` is automatically shared when calling `.finalize()`.
kioskTx
    .createPersonal(true) // `true` allows us to reuse the kiosk in the same PTB. If we pass false, we can only call `kioskTx.finalize()`.
    .place({
        itemType: '0x...::hero::Hero',
        item: '0xAHero',
    })
    .finalize(); // finalize is always our last call.
 
// Sign and execute transaction.
await signAndExecuteTransaction({tx: tx});

Managing Owned Kiosk
KioskClient helps in managing a kiosk.

You need to follow the steps explained in the Kiosk Transaction section to create a KioskTransaction.

Available functions
take
Removes an item from the Kiosk and returns a TransactionArgument to use it in a different Programmable Transaction Block (PTB) call.


const item = '0xHeroAddress';
const itemType = '0x..::hero::Hero';
 
/// Assume `kioskClient` and `cap` are supplied to the function as explained in the previous section.
const tx = new Transaction();
const kioskTx = new KioskTransaction({ transaction: tx, kioskClient, cap });
 
// Take item from kiosk.
const item = kioskTx.take({
	itemId: item,
	itemType,
});
 
// Do something with `item`, like transfer it to someone else.
tx.transferObjects([item], 'address_to_transfer_the_object');
 
// Finalize the kiosk Tx.
kioskTx.finalize();
 
// Sign and execute transaction.
await signAndExecuteTransaction({ tx: tx });
transfer
Similar to take, but transfers the item to an address internally.


const item = '0xHeroAddress';
const itemType = '0x..::hero::Hero';
 
/// Assume `kioskClient` and `cap` are supplied to the function as explained in the previous section.
const tx = new Transaction();
const kioskTx = new KioskTransaction({ transaction: tx, kioskClient, cap });
 
// Take item from kiosk.
kioskTx
	.transfer({
		itemId: item,
		itemType,
		address: 'address_to_transfer_the_object',
	})
	.finalize();
 
// Sign and execute transaction.
await signAndExecuteTransaction({ tx: tx });
place
Places an item in the kiosk.


const item = '0xHeroAddress';
const itemType = '0x..::hero::Hero';
 
/// Assume `kioskClient` and `cap` are supplied to the function as explained in the previous section.
const tx = new Transaction();
const kioskTx = new KioskTransaction({ transaction: tx, kioskClient, cap });
 
kioskTx
	.place({
		item,
		itemType,
	})
	.finalize();
 
// Sign and execute transaction.
await signAndExecuteTransaction({ tx: tx });
list
Lists an item for sale (the item must be in the kiosk).


const itemId = '0xHeroAddress';
const itemType = '0x..::hero::Hero';
 
// Assume `kioskClient` and `cap` are supplied to the function as explained in the previous section.
const tx = new Transaction();
const kioskTx = new KioskTransaction({ transaction: tx, kioskClient, cap });
 
kioskTx
	.list({
		itemId,
		itemType,
		price: 100000n,
	})
	.finalize();
 
// Sign and execute transaction.
await signAndExecuteTransaction({ tx: tx });
placeAndList
List an item for sale by first placing it in the kiosk (places the item and lists it for sale). It's a short hand for place() and list().


const item = '0xHeroAddress';
const itemType = '0x..::hero::Hero';
 
// Assume `kioskClient` and `cap` are supplied to the function as explained in the previous section.
const tx = new Transaction();
const kioskTx = new KioskTransaction({ transaction: tx, kioskClient, cap });
 
kioskTx
	.placeAndList({
		itemId,
		itemType,
		price: 100000n,
	})
	.finalize();
 
// Sign and execute transaction.
await signAndExecuteTransaction({ tx: tx });
delist
Removes the listing, keeping the item placed in the kiosk.


const itemId = '0xHeroAddress';
const itemType = '0x..::hero::Hero';
 
/// assume `kioskClient` and `cap` are supplied to the function as explained in the previous section.
const tx = new Transaction();
const kioskTx = new KioskTransaction({ transaction: tx, kioskClient, cap });
 
kioskTx
	.delist({
		itemId,
		itemType,
	})
	.finalize();
 
// sign and execute transaction.
await signAndExecuteTransaction({ tx: tx });
withdraw
Withdraw (all or specific amount) from a kiosk.

amount: Can be empty, which will withdraw all the funds.


// Assume `kioskClient` and `cap` are supplied to the function as explained in the previous section.
const tx = new Transaction();
const kioskTx = new KioskTransaction({ transaction: tx, kioskClient, cap });
 
kioskTx
	.withdraw({
		address: 'address_to_transfer_funds',
		amount: 100000n,
	})
	.finalize();
 
// Sign and execute transaction.
await signAndExecuteTransaction({ tx: tx });
borrowTx (callback)
Borrows an item from a kiosk. This function follows the callback approach, similar to the ownerCap. The return of the item happens automatically after the execution of the callback.


const itemId = '0xHeroAddress';
const itemType = '0x..::hero::Hero';
 
/// assume `kioskClient` and `cap` are supplied to the function as explained in the previous section.
const tx = new Transaction();
const kioskTx = new KioskTransaction({ transaction: tx, kioskClient, cap });
 
kioskTx
	.borrowTx(
		{
			itemId,
			itemType,
		},
		(item) => {
			tx.moveCall({
				target: '0xMyGame::hero::level_up',
				arguments: [item],
			});
		},
	)
	.finalize();
 
// Sign and execute transaction.
await signAndExecuteTransaction({ tx: tx });
borrow / return
Similar to borrowTx, borrows an item from the kiosk, but returns two transaction arguments: item & promise. You can use the item in your PTBs, but you must always call the return() function with the item and the Promise.


const itemId = '0xHeroAddress';
const itemType = '0x..::hero::Hero';
 
// Assume `kioskClient` and `cap` are supplied to the function as explained in the previous section.
const tx = new Transaction();
const kioskTx = new KioskTransaction({ transaction: tx, kioskClient, cap });
 
const [item, promise] = kioskTx.borrow({
	itemId,
	itemType,
});
 
tx.moveCall({
	target: '0xMyGame::hero::level_up',
	arguments: [item],
});
 
kioskClient
	.return({
		itemType,
		item,
		promise,
	})
	.finalize();
 
// Sign and execute transaction.
await signAndExecuteTransaction({ tx: tx });

Purchasing from a kiosk
One of the base functionalities of the SDK is a seamless purchasing flow, allowing for ease of rules resolving (hiding away the calls). The SDK supports all four rules by default, and works for TESTNET and MAINNET. To support other networks, follow the instructions in the Introduction.

How to purchase
By default, the SDK places the item in the caller's kiosk, unless there's a lock rule, in which case it locks it.

Them following is an example of a purchase call.


const item = {
	itemType: '0x..::hero::Hero',
	itemId: '0x..',
	price: 100000n,
	sellerKiosk: '0xSellerKiosk',
};
 
// Assume `kioskClient` and `cap` are supplied to the function as explained in the previous section.
const tx = new Transaction();
const kioskTx = new KioskTransaction({ transaction: tx, kioskClient, cap });
 
await kioskTx.purchaseAndResolve({
	itemType: item.itemType,
	itemId: item.itemId,
	price: item.price,
	sellerKiosk: item.sellerKiosk,
});
 
kioskTx.finalize();
 
// Sign and execute transaction.
await signAndExecuteTransaction({ tx: tx });
The function queries for a TransferPolicy for that item, and if a policy is found, it automatically resolves all the rules, one by one. You can add a custom rule resolver in the KioskClient instance, with instructions on how to resolve a custom rule. Read more in the next section.

Supporting a custom rule
You can use the purchaseAndResolve function to support a custom rule.


const kioskClient = new KioskClient({...});
const myCustomRule = {
		rule: `0xMyRuleAddress::game_rule::Rule`,
		packageId: `0xMyRuleAddress`,
        // The resolving function. This is called when calling the `purchaseAndResolve`.
		resolveRuleFunction: (params: RuleResolvingParams) => {
            // By knowing the params we have here, we can extract the variables we need to resolve this rule.
            const { transaction, itemType, packageId, extraArgs } = params;
            const { gamePass } = extraArgs;
            if(!gamePass) throw new Error("GamePass not supplied");
 
            // Calls the game's rule prove function, which could, for example
            // allow rules to resolve only if the holder has a gamePass object.
            transaction.moveCall({
                target: `${packageId}::game_rule::prove_pass`,
                typeArguments: [itemType],
                arguments: [transferRequest, transaction.object(gamePass)],
            });
        },
};
// This allows rules resolution from the `purchaseAndResolve` function.
kioskClient.addRuleResolver(myCustomRule);
 
// Assume `cap` is supplied to the function as explained in the introduction section.
const tx = new Transaction();
const kioskTx = new KioskTransaction({ transaction: tx, kioskClient, cap });
 
await kioskTx.purchaseAndResolve({
	itemType: item.itemType,
	itemId: item.itemId,
	price: item.price,
	sellerKiosk: item.sellerKiosk,
	extraArgs: {
		gamePass: '0xMyGamePassObjectId'
	}
});
 
kioskTx.finalize();
 
// Sign and execute transaction.
await signAndExecuteTransaction({ tx: tx });

// For reference, here's the RuleResolvingParams contents.
type RuleResolvingParams = {
	transaction: Transaction;
	itemType: string;
	itemId: string;
	price: string;
	policyId: ObjectArgument;
	kiosk: ObjectArgument;
	ownedKiosk: ObjectArgument;
	ownedKioskCap: ObjectArgument;
	transferRequest: TransactionArgument;
	purchasedItem: TransactionArgument;
	packageId: string;
	extraArgs: Record<string, any>; // extraParams contains more possible {key, values} to pass for custom rules.
};
