import { useRef, useState, useEffect } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { ConnectModal, useCurrentAccount, useSignAndExecuteTransaction } from '@onelabs/dapp-kit';
import { CreditCard, CreditCardFront, CreditCardNumber, CreditCardName, CreditCardFlipper, CreditCardLogo, CreditCardBack, CreditCardChip } from './components/ui/shadcn-io/credit-card';
import WalletBridgeService from './services/WalletBridgeService';
import OneChainTestMint from './components/OneChainTestMint';

function App() {
    const currentAccount = useCurrentAccount();
    const { mutate: signAndExecuteTransaction, mutateAsync: signAndExecuteTransactionAsync } = useSignAndExecuteTransaction();
    const [gameStarted, setGameStarted] = useState(false);
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
    const [showTestPanel, setShowTestPanel] = useState(false);

    const phaserRef = useRef(null);

    // Initialize wallet bridge when account connects
    useEffect(() => {
        if (currentAccount && signAndExecuteTransactionAsync) {
            console.log('Initializing wallet bridge for account:', currentAccount.address);

            // Initialize the wallet bridge with the connected wallet
            const walletBridge = WalletBridgeService.getInstance();
            walletBridge.initialize(
                {
                    signAndExecuteTransaction: async (input) => {
                        console.log('App.tsx: signAndExecuteTransaction called with:', input);
                        try {
                            // Use mutateAsync which returns a Promise
                            const result = await signAndExecuteTransactionAsync({
                                transaction: input.transaction,
                            });
                            console.log('App.tsx: signAndExecuteTransaction result:', result);

                            // Transform the result to match expected interface
                            const transformedResult = {
                                digest: result.digest,
                                effects: result.effects ? {
                                    status: {
                                        status: 'success' as const, // Default to success for now
                                    },
                                } : undefined,
                                objectChanges: [], // Default to empty array if not available
                            };

                            return transformedResult;
                        } catch (error) {
                            console.error('App.tsx: signAndExecuteTransaction error:', error);
                            throw error;
                        }
                    }
                },
                currentAccount.address
            );

            console.log('Wallet bridge initialized successfully');
        } else {
            // Disconnect wallet bridge when account disconnects
            const walletBridge = WalletBridgeService.getInstance();
            walletBridge.disconnect();
            console.log('Wallet bridge disconnected');
        }
    }, [currentAccount, signAndExecuteTransactionAsync]);

    const handleStartGame = () => {
        setGameStarted(true);
    };

    return (
        <div id="app" className='w-full'>
            {!currentAccount ? (
                <div className="main-menu flex flex-col items-center justify-center">
                    <div className="absolute z-[-1] bg-[url('/assets/bg.webp')] w-screen h-screen bg-cover bg-center opacity-[0.7]"></div>
                    <h1 className="pixelfont text-[5rem] text-[white]">OneValley</h1>
                    <p className='text-[24px]'>Connect your wallet to start your adventure!</p>
                    <ConnectModal
                        trigger={
                            <button className="retroButton">
                                Connect Wallet
                            </button>
                        }
                        open={isConnectModalOpen}
                        onOpenChange={setIsConnectModalOpen}
                    />
                </div>
            ) : gameStarted ? (
                <div className="relative">
                    <PhaserGame ref={phaserRef} />
                    {/* Development Test Panel - Only show in development */}
                    {process.env.NODE_ENV === 'development' && (
                        <div className="absolute top-4 right-4 z-50">
                            <button
                                onClick={() => setShowTestPanel(!showTestPanel)}
                                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded"
                            >
                                🧪 Test Mint
                            </button>
                            {showTestPanel && (
                                <div className="absolute top-12 right-0 w-96 bg-gray-900 rounded-lg shadow-2xl">
                                    <OneChainTestMint />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="main-menu flex flex-col items-center justify-center">
                    <div className="absolute z-[-1] bg-[url('/assets/bg.webp')] w-screen h-screen bg-cover bg-center blur-[2px] opacity-[0.7]"></div>
                    <h1 className="pixelfont text-[5rem] text-[white]">OneValley</h1>
                    <CreditCard className='p-[20px] w-[280px]'>
                        <CreditCardFlipper>
                            <CreditCardFront safeArea={50} className="bg-[#F2F2F2] text-[#909090]">

                                <CreditCardNumber truncateLength={10}>{currentAccount.address}</CreditCardNumber>
                            </CreditCardFront>
                            <CreditCardBack safeArea={20} className="bg-[#F2F2F2] text-[#909090] flex flex-col items-center justify-center border border-[black] border-[40px]">
                                <img src="/assets/onechain.png" alt="OneChain Logo" className="w-1/2 mb-[6rem]" />
                                <CreditCardChip/>
                            </CreditCardBack>
                        </CreditCardFlipper>
                    </CreditCard>
                    <button className="retroButton" onClick={handleStartGame}>
                        Start Game
                    </button>

                    {/* Development Test Panel on Main Menu */}
                    {process.env.NODE_ENV === 'development' && (
                        <div className="mt-6">
                            <button
                                onClick={() => setShowTestPanel(!showTestPanel)}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded"
                            >
                                🧪 Test OneChain Minting
                            </button>
                            {showTestPanel && (
                                <div className="mt-4">
                                    <OneChainTestMint />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default App;
