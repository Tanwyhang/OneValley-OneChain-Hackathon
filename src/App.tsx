import { useRef } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { ConnectButton, useWallet } from '@onelabs/dapp-kit';

function App() {
    const { connected } = useWallet();

    //  References to the PhaserGame component (game and scene are exposed)
    const phaserRef = useRef<IRefPhaserGame | null>(null);

    return (
        <div id="app">
            {connected ? (
                <PhaserGame ref={phaserRef} />
            ) : (
                <div className="main-menu">
                    <h1>Welcome to OneValley</h1>
                    <p>Connect your wallet to start your adventure!</p>
                    <ConnectButton />
                </div>
            )}
        </div>
    );
}

export default App
