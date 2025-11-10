import { Scene } from 'phaser';
import { EventBus } from '../EventBus';

export class FarmScene extends Scene
{
    // Map properties
    private map!: Phaser.Tilemaps.Tilemap;
    private tileset!: Phaser.Tilemaps.Tileset;
    private collisionLayers: Phaser.Tilemaps.TilemapLayer[] = [];
    private farmingLayer!: Phaser.Tilemaps.TilemapLayer;
    private cropsLayer!: Phaser.Tilemaps.TilemapLayer;
    
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
    private interactKey!: Phaser.Input.Keyboard.Key;

    // Particle properties
    private particleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
    private windTimer!: Phaser.Time.TimerEvent;
    
    // Farming properties
    private farmableTileIndices: Set<number> = new Set([521, 522, 523, 578, 579, 580, 635, 636, 637]);

    // Player state
    private playerSpeed: number = 150;
    private playerRunSpeed: number = 250;
    private currentDirection: string = 'down';
    private initialZoom: number = 5;

    constructor ()
    {
        super('FarmScene');
    }

    preload ()
    {
        this.load.setPath('assets');
        
        // Load tileset and farm map
        this.load.image('tileset', 'tilesets/OneValley.png');
        this.load.tilemapTiledJSON('farm_map', 'maps/farm_map.json');
        
        // Load player sprite
        this.load.spritesheet('player', 'sprites/player/player_walk.png', {
            frameWidth: 125,
            frameHeight: 250
        });

        // Load particle image
        this.load.image('firefly', 'firefly.png');
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
        
        // Create particles
        this.createParticles();

        // Listen for interaction
        this.handleInteraction();

        EventBus.emit('current-scene-ready', this);
    }

    update ()
    {
        this.handlePlayerMovement();
    }

    private createMap(): void
    {
        this.map = this.make.tilemap({ key: 'farm_map' });
        this.tileset = this.map.addTilesetImage('OneValley', 'tileset')!;
        this.collisionLayers = [];

        const createLayer = (
            name: string,
            depth: number,
            collides: boolean = false
        ): Phaser.Tilemaps.TilemapLayer | null => {
            const layer = this.map.createLayer(name, this.tileset, 0, 0);
            layer?.setDepth(depth);

            if (collides && layer) {
                layer.setCollisionByExclusion([-1]);
                this.collisionLayers.push(layer);
            }

            return layer;
        };

        createLayer('Ground', -10);
        this.farmingLayer = createLayer('Farming Dirt + Water + Routes', -5)!;
        this.cropsLayer = this.map.createBlankLayer('Crops', this.tileset, 0, 0)!;
        this.cropsLayer.setDepth(-4);

    createLayer('Deco', 10);
    createLayer('House', 15, false);
    createLayer('Market', 18, false);

        ['Trees A', 'Trees B', 'Trees C', 'Trees D', 'Trees E']
            .forEach((name, index) => createLayer(name, 20 + index, false));

        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    }

    private createParticles(): void {
        this.particleEmitter = this.add.particles(
            0, 0, // x, y coordinates (will be overridden by emitZone)
            'firefly',
            {
                x: { min: 0, max: this.map.widthInPixels },
                y: { min: 0, max: this.map.heightInPixels },
                lifespan: 5000,
                speed: { min: 3, max: 15 },
                scale: { start: 0.1, end: 0 },
                alpha: { start: 1, end: 0 },
                quantity: 3,
                blendMode: 'ADD'
            }
        );

        this.windTimer = this.time.addEvent({
            delay: 5000, // 5 seconds
            callback: this.updateWind,
            callbackScope: this,
            loop: true
        });
    }

    private updateWind(): void {
        const windX = Phaser.Math.Between(-20, 20);
        const windY = Phaser.Math.Between(-20, 20);
        
        // Correct way to set acceleration in recent Phaser 3 versions
        this.particleEmitter.accelerationX = windX;
        this.particleEmitter.accelerationY = windY;
    }

    private createPlayerAnimations(): void
    {
        const directionConfig: Record<string, { idle: number; move: number[] }> = {
            down: { idle: 0, move: [0, 3] },
            up: { idle: 1, move: [1, 5] },
            right: { idle: 2, move: [2, 6] },
            left: { idle: 2, move: [2, 6] }
        };

        Object.entries(directionConfig).forEach(([direction, frames]) => {
            this.anims.create({
                key: `idle-${direction}`,
                frames: [{ key: 'player', frame: frames.idle }],
                frameRate: 1,
                repeat: -1
            });

            const mappedFrames = frames.move.map(frame => ({ key: 'player', frame }));

            this.anims.create({
                key: `walk-${direction}`,
                frames: mappedFrames,
                frameRate: 6,
                repeat: -1
            });

            this.anims.create({
                key: `run-${direction}`,
                frames: mappedFrames,
                frameRate: 10,
                repeat: -1
            });
        });
    }

    private createPlayer(): void
    {
        // Spawn player at center of map (400, 400 for 800x800 farm map)
        this.player = this.physics.add.sprite(400, 400, 'player', 0);
        this.player.setScale(0.30);
        this.player.setCollideWorldBounds(true);
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        body.setSize(this.player.width * 0.6, this.player.height * 0.5);
        body.setOffset(this.player.width * 0.2, this.player.height * 0.4);
        this.player.play('idle-down');
        this.player.setDepth(1000);
        
        // Add collision with map layers (trees, houses)
        this.collisionLayers.forEach(layer => {
            this.physics.add.collider(this.player, layer);
        });
    }

    private setupInputs(): void
    {
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = {
            up: this.input.keyboard!.addKey('W'),
            down: this.input.keyboard!.addKey('S'),
            left: this.input.keyboard!.addKey('A'),
            right: this.input.keyboard!.addKey('D')
        };
        this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        this.interactKey = this.input.keyboard!.addKey('E');
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

        // Use the initialZoom property as the base zoom
        const baseZoom = this.initialZoom;

        // Ensure zoom doesn't go below 1 or above 3
        const zoom = Phaser.Math.Clamp(baseZoom, 1, 100);

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

        const velocity = new Phaser.Math.Vector2(
            Number(right) - Number(left),
            Number(down) - Number(up)
        );

        if (velocity.x < 0) {
            this.currentDirection = 'left';
        } else if (velocity.x > 0) {
            this.currentDirection = 'right';
        }

        if (velocity.y < 0) {
            this.currentDirection = 'up';
        } else if (velocity.y > 0) {
            this.currentDirection = 'down';
        }

        if (velocity.lengthSq() > 0) {
            velocity.normalize().scale(speed);
            this.player.setVelocity(velocity.x, velocity.y);
        } else {
            this.player.setVelocity(0, 0);
        }

        this.updatePlayerAnimation(isRunning);
    }

    private handleInteraction(): void {
        this.interactKey.on('down', () => {
            const playerTileX = this.farmingLayer.worldToTileX(this.player.x);
            const playerTileY = this.farmingLayer.worldToTileY(this.player.y);
            const radius = 2;

            for (let y = playerTileY - radius; y <= playerTileY + radius; y++) {
                for (let x = playerTileX - radius; x <= playerTileX + radius; x++) {
                    const targetTile = this.farmingLayer.getTileAt(x, y);
                    const cropTile = this.cropsLayer.getTileAt(x, y);

                    // Check if the tile is tilled soil and has no crop on it
                    if (targetTile && this.farmableTileIndices.has(targetTile.index) && (!cropTile || cropTile.index === -1)) {
                        // Plant a crop and immediately stop searching
                        this.cropsLayer.putTileAt(1774, x, y);
                        return; 
                    }
                }
            }
        });
    }

    private updatePlayerAnimation(isRunning: boolean): void
    {
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        const isMoving = body.velocity.x !== 0 || body.velocity.y !== 0;
        
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
        this.windTimer.destroy();
    }
}
