import { useRef, useState } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { ConnectModal, useCurrentAccount } from '@onelabs/dapp-kit';

function App() {
    const currentAccount = useCurrentAccount();
    const [gameStarted, setGameStarted] = useState(false);
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

    const phaserRef = useRef<IRefPhaserGame | null>(null);

    const handleStartGame = () => {
        setGameStarted(true);
    };

    return (
        <div id="app">
            {!currentAccount ? (
                <div className="main-menu">
                    <h1>Welcome to OneValley</h1>
                    <p>Connect your wallet to start your adventure!</p>
                    <ConnectModal
                        trigger={
                            <button className="button">
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
                <div className="main-menu">
                    <h1>Wallet Connected!</h1>
                    <p>Address: {currentAccount.address}</p>
                    <button className="button" onClick={handleStartGame}>Start Game</button>
                </div>
            )}
        </div>
    );
}

export default App;
