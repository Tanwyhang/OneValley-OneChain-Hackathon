import { Scene } from 'phaser';
import { EventBus } from '../EventBus';

export class FarmScene extends Scene
{
    // Map properties
    private map!: Phaser.Tilemaps.Tilemap;
    private tileset!: Phaser.Tilemaps.Tileset;
    private collisionLayers: Phaser.Tilemaps.TilemapLayer[] = [];
    
    // Player-related properties
    private player!: Phaser.Physics.Arcade.Sprite;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: {
        up: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        left: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key;
    };
    private shiftKey!: Phaser.Input.Keyboard.Key;
    
    // Player state
    private playerSpeed: number = 150;
    private playerRunSpeed: number = 250;
    private currentDirection: string = 'down';

    constructor ()
    {
        super('FarmScene');
    }

    preload ()
    {
        this.load.setPath('assets');
        
        // Load tileset and farm map
        this.load.image('tileset', 'tilesets/roguelikeSheet_transparent.png');
        this.load.tilemapTiledJSON('farm_map', 'maps/farm_map.json');
        
        // Load player sprite
        this.load.spritesheet('player', 'sprites/player/player_walk.png', {
            frameWidth: 125,
            frameHeight: 250
        });
    }

    create ()
    {
        // Create the farm map
        this.createMap();
        
        // Create player and controls
        this.createPlayerAnimations();
        this.createPlayer();
        this.setupInputs();
        this.setupCamera();
        
        EventBus.emit('current-scene-ready', this);
    }

    update ()
    {
        this.handlePlayerMovement();
    }

    private createMap(): void
    {
        // Create the tilemap
        this.map = this.make.tilemap({ key: 'farm_map' });
        
        // Add the tileset (the name 'Roguelike' must match the tileset name in the JSON)
        this.tileset = this.map.addTilesetImage('Roguelike', 'tileset')!;
        
        // Create layers in order (bottom to top)
        const groundLayer = this.map.createLayer('Ground', this.tileset, 0, 0);
        const farmingLayer = this.map.createLayer('Farming Dirt + Water + Routes', this.tileset, 0, 0);
        const decoLayer = this.map.createLayer('Deco', this.tileset, 0, 0);
        const treesLayer = this.map.createLayer('Trees', this.tileset, 0, 0);
        const houseBodyLayer = this.map.createLayer('House\'s Body', this.tileset, 0, 0);
        const houseRoofLayer = this.map.createLayer('House\'s Roof', this.tileset, 0, 0);
        const houseObjLayer = this.map.createLayer('House\'s Obj', this.tileset, 0, 0);
        
        // Set collision for trees and house layers (player can't walk through them)
        treesLayer?.setCollisionByExclusion([-1]);
        houseBodyLayer?.setCollisionByExclusion([-1]);
        houseRoofLayer?.setCollisionByExclusion([-1]);
        houseObjLayer?.setCollisionByExclusion([-1]);
        
        // Store collision layers for later use with player (filter out nulls)
        this.collisionLayers = [treesLayer, houseBodyLayer, houseRoofLayer, houseObjLayer].filter(layer => layer !== null) as Phaser.Tilemaps.TilemapLayer[];
        
        // Set world bounds to match map size (50 tiles * 16 pixels = 800x800)
        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    }

    private createPlayerAnimations(): void
    {
        // DOWN animations (frames 0, 3)
        this.anims.create({
            key: 'idle-down',
            frames: [{ key: 'player', frame: 0 }],
            frameRate: 1,
            repeat: -1
        });
        
        this.anims.create({
            key: 'walk-down',
            frames: [{ key: 'player', frame: 0 }, { key: 'player', frame: 3 }],
            frameRate: 6,
            repeat: -1
        });
        
        this.anims.create({
            key: 'run-down',
            frames: [{ key: 'player', frame: 0 }, { key: 'player', frame: 3 }],
            frameRate: 10,
            repeat: -1
        });
        
        // UP animations (frames 1, 5)
        this.anims.create({
            key: 'idle-up',
            frames: [{ key: 'player', frame: 1 }],
            frameRate: 1,
            repeat: -1
        });
        
        this.anims.create({
            key: 'walk-up',
            frames: [{ key: 'player', frame: 1 }, { key: 'player', frame: 5 }],
            frameRate: 6,
            repeat: -1
        });
        
        this.anims.create({
            key: 'run-up',
            frames: [{ key: 'player', frame: 1 }, { key: 'player', frame: 5 }],
            frameRate: 10,
            repeat: -1
        });
        
        // LEFT animations (mirrored from right frames 2, 6)
        this.anims.create({
            key: 'idle-left',
            frames: [{ key: 'player', frame: 2 }],
            frameRate: 1,
            repeat: -1
        });
        
        this.anims.create({
            key: 'walk-left',
            frames: [{ key: 'player', frame: 2 }, { key: 'player', frame: 6 }],
            frameRate: 6,
            repeat: -1
        });
        
        this.anims.create({
            key: 'run-left',
            frames: [{ key: 'player', frame: 2 }, { key: 'player', frame: 6 }],
            frameRate: 10,
            repeat: -1
        });
        
        // RIGHT animations (frames 2, 6)
        this.anims.create({
            key: 'idle-right',
            frames: [{ key: 'player', frame: 2 }],
            frameRate: 1,
            repeat: -1
        });
        
        this.anims.create({
            key: 'walk-right',
            frames: [{ key: 'player', frame: 2 }, { key: 'player', frame: 6 }],
            frameRate: 6,
            repeat: -1
        });
        
        this.anims.create({
            key: 'run-right',
            frames: [{ key: 'player', frame: 2 }, { key: 'player', frame: 6 }],
            frameRate: 10,
            repeat: -1
        });
    }

    private createPlayer(): void
    {
        // Spawn player at center of map (400, 400 for 800x800 farm map)
        this.player = this.physics.add.sprite(400, 400, 'player', 0);
        this.player.setScale(0.30);
        this.player.setCollideWorldBounds(true);
        this.player.body!.setSize(this.player.width * 0.6, this.player.height * 0.5);
        this.player.body!.setOffset(this.player.width * 0.2, this.player.height * 0.4);
        this.player.play('idle-down');
        
        // Add collision with map layers (trees, houses)
        this.collisionLayers.forEach(layer => {
            this.physics.add.collider(this.player, layer);
        });
    }    private setupInputs(): void
    {
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = {
            up: this.input.keyboard!.addKey('W'),
            down: this.input.keyboard!.addKey('S'),
            left: this.input.keyboard!.addKey('A'),
            right: this.input.keyboard!.addKey('D')
        };
        this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    }

    private setupCamera(): void
    {
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        // Set camera bounds to match map size
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        // Set initial zoom based on screen size
        this.updateCameraZoom();

        // Listen for resize events
        this.scale.on('resize', this.handleResize, this);
    }

    private updateCameraZoom(): void
    {
        const gameWidth = this.scale.gameSize.width;
        const gameHeight = this.scale.gameSize.height;

        // Calculate zoom to fit the map nicely on screen
        // Use a base zoom that works well for the map size
        const baseZoom = Math.min(gameWidth / 800, gameHeight / 600);

        // Ensure zoom doesn't go below 1 or above 3
        const zoom = Phaser.Math.Clamp(baseZoom, 1, 3);

        this.cameras.main.setZoom(zoom);
    }

    private handleResize(gameSize: Phaser.Structs.Size): void
    {
        // Update camera bounds to match new game size
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

        // Update zoom based on new screen size
        this.updateCameraZoom();
    }

    private handlePlayerMovement(): void
    {
        const left = this.cursors.left.isDown || this.wasd.left.isDown;
        const right = this.cursors.right.isDown || this.wasd.right.isDown;
        const up = this.cursors.up.isDown || this.wasd.up.isDown;
        const down = this.cursors.down.isDown || this.wasd.down.isDown;
        const isRunning = this.shiftKey.isDown;
        
        const speed = isRunning ? this.playerRunSpeed : this.playerSpeed;
        this.player.setVelocity(0, 0);
        
        if (left) {
            this.player.setVelocityX(-speed);
            this.currentDirection = 'left';
        } else if (right) {
            this.player.setVelocityX(speed);
            this.currentDirection = 'right';
        }
        
        if (up) {
            this.player.setVelocityY(-speed);
            this.currentDirection = 'up';
        } else if (down) {
            this.player.setVelocityY(speed);
            this.currentDirection = 'down';
        }
        
        if (this.player.body!.velocity.x !== 0 && this.player.body!.velocity.y !== 0) {
            this.player.setVelocity(
                this.player.body!.velocity.x * 0.7071,
                this.player.body!.velocity.y * 0.7071
            );
        }
        
        this.updatePlayerAnimation(isRunning);
    }

    private updatePlayerAnimation(isRunning: boolean): void
    {
        const isMoving = this.player.body!.velocity.x !== 0 || this.player.body!.velocity.y !== 0;
        
        if (this.currentDirection === 'left') {
            this.player.setFlipX(true);
        } else {
            this.player.setFlipX(false);
        }
        
        if (!isMoving) {
            this.player.play(`idle-${this.currentDirection}`, true);
        } else if (isRunning) {
            this.player.play(`run-${this.currentDirection}`, true);
        } else {
            this.player.play(`walk-${this.currentDirection}`, true);
        }
    }

    destroy(): void
    {
        // Clean up resize event listener
        this.scale.off('resize', this.handleResize, this);
    }
}
