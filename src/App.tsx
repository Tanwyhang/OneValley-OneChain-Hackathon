import { useRef, useState } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { ConnectModal, useCurrentAccount } from '@onelabs/dapp-kit';
import { CreditCard, CreditCardFront, CreditCardNumber, CreditCardName, CreditCardFlipper, CreditCardLogo, CreditCardBack, CreditCardChip } from './components/ui/shadcn-io/credit-card';

function App() {
    const currentAccount = useCurrentAccount();
    const [gameStarted, setGameStarted] = useState(false);
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

    const phaserRef = useRef(null);

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
                <PhaserGame ref={phaserRef} />
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
                </div>
            )}
        </div>
    );
}

export default App;
