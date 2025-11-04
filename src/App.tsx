import { useRef } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
// import { ConnectButton, useWallet } from '@onelabs/dapp-kit';

function App() {
    // TODO: Uncomment wallet integration when ready (Phase 1 - Task 2)
    // const { connected } = useWallet();

    //  References to the PhaserGame component (game and scene are exposed)
    const phaserRef = useRef<IRefPhaserGame | null>(null);

    return (
        <div id="app">
            {/* Temporarily show game directly without wallet connection */}
            <PhaserGame ref={phaserRef} />
            
            {/* TODO: Uncomment when wallet integration is ready */}
            {/* {connected ? (
                <PhaserGame ref={phaserRef} />
            ) : (
                <div className="main-menu">
                    <h1>Welcome to OneValley</h1>
                    <p>Connect your wallet to start your adventure!</p>
                    <ConnectButton />
                </div>
            )} */}
        </div>
    );
}

export default App
