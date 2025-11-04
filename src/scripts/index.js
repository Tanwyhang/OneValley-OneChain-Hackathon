import { getFullnodeUrl, SuiClient } from '@onelabs/sui/client';
import { requestSuiFromFaucetV1 } from '@onelabs/sui/faucet';
import { MIST_PER_SUI } from '@onelabs/sui/utils';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
 
const MY_ADDRESS = process.env.SUI_DEV_ADDRESS;

if (!MY_ADDRESS) {
  console.error('SUI_DEV_ADDRESS not found in .env.local');
  process.exit(1);
}
 
// create a new SuiClient object pointing to the network you want to use
const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
 
// Convert MIST to OCT
const balance = (balance) => {
return Number.parseInt(balance.totalBalance) / Number(MIST_PER_SUI);
};
 
const main = async () => {
  // store the JSON representation for the OCT the address owns before using faucet
  const octBefore = await suiClient.getBalance({
    owner: MY_ADDRESS,
  });

  const FAUCET_URL = process.env.FAUCET_URL;

  if (!FAUCET_URL) {
    console.error('FAUCET_URL not found in .env.local');
    process.exit(1);
  }

  await requestSuiFromFaucetV1({
    host: FAUCET_URL,
    recipient: MY_ADDRESS,
  });

  // store the JSON representation for the OCT the address owns after using faucet
  const octAfter = await suiClient.getBalance({
    owner: MY_ADDRESS,
  });

  // Output result to console.
  console.log(
    `Balance before faucet: ${balance(octBefore)} OCT. Balance after: ${balance(
      octAfter,
    )} OCT. Hello, OCT!`,
  );
};

const loop = async () => {
  while (true) {
    await main();
    console.log('Waiting for 5 seconds before next execution...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
};

loop();