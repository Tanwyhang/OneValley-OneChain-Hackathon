import { getFullnodeUrl, SuiClient } from '@onelabs/sui/client';
import dotenv from 'dotenv';

// Configure dotenv to load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Get the wallet address from environment variables
const ownerAddress = process.env.ONECHAIN_DEV_ADDRESS;

if (!ownerAddress) {
  console.error('Error: ONECHAIN_DEV_ADDRESS not found in .env.local file.');
  process.exit(1);
}

// Create a new SuiClient object pointing to the testnet
const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

async function fetchOwnedObjects() {
  console.log(`Fetching owned objects for address: ${ownerAddress}...`);

  try {
    // Make the RPC call to get owned objects
    const objects = await suiClient.getOwnedObjects({ limit: 5, owner: ownerAddress! , options: { showType: true, showContent: true, showDisplay: true } });

    if (objects.data.length === 0) {
      console.log('No objects found for this address.');
      return;
    }

    console.log('Successfully fetched objects:');
    // Print the result in a readable JSON format
    console.log(JSON.stringify(objects, null, 2));

  } catch (error) {
    console.error('An error occurred while fetching objects:', error);
  }
}

// Run the script
fetchOwnedObjects();
