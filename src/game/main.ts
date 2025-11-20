import { WorldSelectionScene } from './scenes/WorldSelectionScene';
import { FarmScene } from './scenes/FarmScene';
import { UIScene } from './scenes/UIScene';
import { AUTO, Game, Types } from "phaser";

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Types.Core.GameConfig = {
    antialias: false,
    type: AUTO,
    parent: 'game-container',
    backgroundColor: '#000000',
    render: {
        pixelArt: true,
        roundPixels: true
    },
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false  // Set to true to see collision boxes
        }
    },
    scene: [
        WorldSelectionScene,
        FarmScene,
        UIScene
    ]
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
}

export default StartGame;
