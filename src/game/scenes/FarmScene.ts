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
    private escKey!: Phaser.Input.Keyboard.Key;
    private attackKey!: Phaser.Input.Keyboard.Key;

    // Particle properties
    private particleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
    private windTimer!: Phaser.Time.TimerEvent;
    
    // Farming properties
    private farmableTileIndices: Set<number> = new Set([521, 522, 523, 578, 579, 580, 635, 636, 637]);

    // Player state
    private playerSpeed: number = 150;
    private playerRunSpeed: number = 250;
    private currentDirection: string = 'down';
    private initialZoom: number = 3;
    private isAttacking: boolean = false;
    
    // Chickens
    private chickens: Phaser.Physics.Arcade.Sprite[] = [];
    
    // NPC
    private npc!: Phaser.Physics.Arcade.Sprite;

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
        this.load.spritesheet('player', '../Cute_Fantasy_Free/Player/Player.png', {
            frameWidth: 32,
            frameHeight: 32
        });

        // Load player attack sprite (128x128 image, 4 columns x 4 rows, but last row only has 4 frames)
        // Actual calculation: width 128/4 = 32, height 128/4 = 32
        this.load.spritesheet('player_attack', '../Cute_Fantasy_Free/Player/Player_Attack.png', {
            frameWidth: 32,
            frameHeight: 32
        });

        // Load chicken sprite (64x64 image, 2 columns x 2 rows)
        // Row 1: idle (2 frames), Row 2: walking (2 frames)
        this.load.spritesheet('chicken', '../Cute_Fantasy_Free/Animals/Chicken/Chicken.png', {
            frameWidth: 32,
            frameHeight: 32
        });
        
        // Load NPC sprite (same size as player: 32x32)
        this.load.spritesheet('npc', '../Cute_Fantasy_Free/Player/Npc.png', {
            frameWidth: 32,
            frameHeight: 32
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
        this.createChickenAnimations();
        this.createNPCAnimations();
        this.createPlayer();
        this.createChickens();
        this.createNPC();
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
        this.updateNPCNamePosition();
    }

    private updateNPCNamePosition(): void {
        if (!this.npc || !this.npc.active) return;
        
        const nameText = this.npc.getData('nameText');
        if (nameText) {
            nameText.setPosition(this.npc.x, this.npc.y - 40);
        }
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
        // Idle animations (6 frames each, looping)
        this.anims.create({
            key: 'idle-up',
            frames: this.anims.generateFrameNumbers('player', { start: 12, end: 17 }),
            frameRate: 6,
            repeat: -1
        });
        this.anims.create({
            key: 'idle-right',
            frames: this.anims.generateFrameNumbers('player', { start: 6, end: 11 }),
            frameRate: 6,
            repeat: -1
        });
        this.anims.create({
            key: 'idle-down',
            frames: this.anims.generateFrameNumbers('player', { start: 0, end: 5 }),
            frameRate: 6,
            repeat: -1
        });
        this.anims.create({
            key: 'idle-left',
            frames: this.anims.generateFrameNumbers('player', { start: 6, end: 11 }),
            frameRate: 6,
            repeat: -1
        });

        // Walk animations (6 frames each)
        this.anims.create({
            key: 'walk-up',
            frames: this.anims.generateFrameNumbers('player', { start: 30, end: 35 }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'walk-right',
            frames: this.anims.generateFrameNumbers('player', { start: 24, end: 29 }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'walk-down',
            frames: this.anims.generateFrameNumbers('player', { start: 18, end: 23 }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'walk-left',
            frames: this.anims.generateFrameNumbers('player', { start: 24, end: 29 }),
            frameRate: 8,
            repeat: -1
        });

        // Run animations (same frames as walk, faster)
        this.anims.create({
            key: 'run-up',
            frames: this.anims.generateFrameNumbers('player', { start: 30, end: 35 }),
            frameRate: 12,
            repeat: -1
        });
        this.anims.create({
            key: 'run-right',
            frames: this.anims.generateFrameNumbers('player', { start: 24, end: 29 }),
            frameRate: 12,
            repeat: -1
        });
        this.anims.create({
            key: 'run-down',
            frames: this.anims.generateFrameNumbers('player', { start: 18, end: 23 }),
            frameRate: 12,
            repeat: -1
        });
        this.anims.create({
            key: 'run-left',
            frames: this.anims.generateFrameNumbers('player', { start: 24, end: 29 }),
            frameRate: 12,
            repeat: -1
        });

        // Attack animations (4 frames each, using separate attack sprite sheet)
        this.anims.create({
            key: 'attack-up',
            frames: this.anims.generateFrameNumbers('player_attack', { start: 8, end: 11 }),
            frameRate: 10,
            repeat: 0
        });
        this.anims.create({
            key: 'attack-right',
            frames: this.anims.generateFrameNumbers('player_attack', { start: 4, end: 7 }),
            frameRate: 10,
            repeat: 0
        });
        this.anims.create({
            key: 'attack-down',
            frames: this.anims.generateFrameNumbers('player_attack', { start: 0, end: 3 }),
            frameRate: 10,
            repeat: 0
        });
        this.anims.create({
            key: 'attack-left',
            frames: this.anims.generateFrameNumbers('player_attack', { start: 4, end: 7 }),
            frameRate: 10,
            repeat: 0
        });

        // Dead animation (4 frames)
        this.anims.create({
            key: 'dead',
            frames: this.anims.generateFrameNumbers('player_attack', { start: 12, end: 15 }),
            frameRate: 6,
            repeat: 0
        });
    }

    private createChickenAnimations(): void
    {
        // Chicken idle animation (2 frames)
        this.anims.create({
            key: 'chicken-idle',
            frames: this.anims.generateFrameNumbers('chicken', { start: 0, end: 1 }),
            frameRate: 4,
            repeat: -1
        });

        // Chicken walking animation (2 frames)
        this.anims.create({
            key: 'chicken-walk',
            frames: this.anims.generateFrameNumbers('chicken', { start: 2, end: 3 }),
            frameRate: 6,
            repeat: -1
        });
    }

    private createNPCAnimations(): void
    {
        // NPC idle animations (same structure as player)
        this.anims.create({
            key: 'npc-idle-down',
            frames: this.anims.generateFrameNumbers('npc', { start: 0, end: 5 }),
            frameRate: 6,
            repeat: -1
        });
        this.anims.create({
            key: 'npc-idle-right',
            frames: this.anims.generateFrameNumbers('npc', { start: 6, end: 11 }),
            frameRate: 6,
            repeat: -1
        });
        this.anims.create({
            key: 'npc-idle-up',
            frames: this.anims.generateFrameNumbers('npc', { start: 12, end: 17 }),
            frameRate: 6,
            repeat: -1
        });

        // NPC walk animations
        this.anims.create({
            key: 'npc-walk-down',
            frames: this.anims.generateFrameNumbers('npc', { start: 18, end: 23 }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'npc-walk-right',
            frames: this.anims.generateFrameNumbers('npc', { start: 24, end: 29 }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'npc-walk-up',
            frames: this.anims.generateFrameNumbers('npc', { start: 30, end: 35 }),
            frameRate: 8,
            repeat: -1
        });
    }

    private createPlayer(): void
    {
        // Spawn player at center of map (400, 400 for 800x800 farm map)
        this.player = this.physics.add.sprite(400, 400, 'player', 0);
        this.player.setScale(2.0);
        this.player.setCollideWorldBounds(true);
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        body.setSize(19.2, 16);
        body.setOffset(6.4, 12.8);
        this.player.play('idle-down');
        this.player.setDepth(1000);
        
        // Add collision with map layers (trees, houses)
        this.collisionLayers.forEach(layer => {
            this.physics.add.collider(this.player, layer);
        });
    }

    private createChickens(): void
    {
        // Spawn 3 chickens at different positions on the farm
        const chickenPositions = [
            { x: 200, y: 300 },
            { x: 600, y: 400 },
            { x: 400, y: 600 }
        ];

        chickenPositions.forEach(pos => {
            const chicken = this.physics.add.sprite(pos.x, pos.y, 'chicken', 0);
            chicken.setScale(1.5);
            chicken.play('chicken-idle');
            chicken.setDepth(100);
            
            // Add health data to chicken
            chicken.setData('health', 3);
            chicken.setData('maxHealth', 3);
            
            // Store chicken in array
            this.chickens.push(chicken);
            
            // Add collision with map layers
            this.collisionLayers.forEach(layer => {
                this.physics.add.collider(chicken, layer);
            });

            // Make chicken walk randomly
            const movementTimer = this.time.addEvent({
                delay: Phaser.Math.Between(2000, 4000),
                callback: () => this.moveChickenRandomly(chicken),
                loop: true
            });
            
            // Store timer reference on chicken
            chicken.setData('movementTimer', movementTimer);
        });
    }

    private createNPC(): void
    {
        // Spawn NPC at position (300, 400) using npc sprite
        this.npc = this.physics.add.sprite(300, 400, 'npc', 0);
        this.npc.setScale(2.0);
        this.npc.setDepth(100);
        
        // Set up collision body (same as player)
        const body = this.npc.body as Phaser.Physics.Arcade.Body;
        body.setSize(19.2, 16);
        body.setOffset(6.4, 12.8);
        
        // Add collision with map layers
        this.collisionLayers.forEach(layer => {
            this.physics.add.collider(this.npc, layer);
        });
        
        // Play idle animation
        this.npc.play('npc-idle-down');
        
        // Store starting position for NPC
        this.npc.setData('startX', 300);
        this.npc.setData('startY', 400);
        
        // Add name text above NPC
        const nameText = this.add.text(this.npc.x, this.npc.y - 40, 'herman', {
            fontSize: '10px',
            color: '#ffffff'
        });
        nameText.setOrigin(0.5);
        nameText.setDepth(101);
        
        // Store name text reference on NPC for potential updates
        this.npc.setData('nameText', nameText);
        
        // Set up patrol behavior
        this.setupNPCPatrol();
    }

    private moveChickenRandomly(chicken: Phaser.Physics.Arcade.Sprite): void
    {
        // Randomly decide to walk or idle
        const shouldWalk = Math.random() > 0.5;
        
        if (shouldWalk) {
            // Random direction
            const velocityX = Phaser.Math.Between(-50, 50);
            const velocityY = Phaser.Math.Between(-50, 50);
            chicken.setVelocity(velocityX, velocityY);
            chicken.play('chicken-walk', true);
            
            // Flip chicken based on direction
            if (velocityX < 0) {
                chicken.setFlipX(true);
            } else if (velocityX > 0) {
                chicken.setFlipX(false);
            }
            
            // Stop after a short time
            this.time.delayedCall(1000, () => {
                chicken.setVelocity(0, 0);
                chicken.play('chicken-idle', true);
            });
        }
    }

    private setupNPCWandering(): void
    {
        // Make NPC wander randomly
        const wanderTimer = this.time.addEvent({
            delay: Phaser.Math.Between(2000, 5000),
            callback: () => this.moveNPCRandomly(),
            loop: true
        });
        
        // Store timer reference on NPC
        this.npc.setData('wanderTimer', wanderTimer);
    }

    private setupNPCPatrol(): void
    {
        // Start with 4 second idle, then begin patrol loop
        this.time.delayedCall(4000, () => {
            this.startNPCPatrolCycle();
        });
    }

    private startNPCPatrolCycle(): void
    {
        if (!this.npc || !this.npc.active) return;
        
        const speed = 60;
        const walkDuration = 2000; // Walk for 2 seconds
        const idleDuration = 4000; // Idle for 4 seconds in the middle
        
        // Step 1: Walk right
        this.npc.setFlipX(false);
        this.npc.setVelocity(speed, 0);
        this.npc.play('npc-walk-right', true);
        
        this.time.delayedCall(walkDuration, () => {
            if (!this.npc || !this.npc.active) return;
            
            // Step 2: Stop and idle
            this.npc.setVelocity(0, 0);
            this.npc.play('npc-idle-right', true);
            
            this.time.delayedCall(idleDuration, () => {
                if (!this.npc || !this.npc.active) return;
                
                // Step 3: Walk left back to starting position
                this.npc.setFlipX(true);
                this.npc.setVelocity(-speed, 0);
                this.npc.play('npc-walk-right', true); // Use walk-right animation but flipped
                
                this.time.delayedCall(walkDuration, () => {
                    if (!this.npc || !this.npc.active) return;
                    
                    // Step 4: Stop at starting position and idle
                    this.npc.setVelocity(0, 0);
                    this.npc.setFlipX(false);
                    this.npc.play('npc-idle-right', true);
                    
                    // Wait 4 seconds then loop
                    this.time.delayedCall(4000, () => {
                        this.startNPCPatrolCycle();
                    });
                });
            });
        });
    }

    private moveNPCRandomly(): void
    {
        if (!this.npc || !this.npc.active) return;
        
        // Randomly decide to walk or idle
        const shouldWalk = Math.random() > 0.6;
        
        if (shouldWalk) {
            // Choose a random direction
            const directions = ['up', 'down', 'left', 'right'];
            const direction = Phaser.Utils.Array.GetRandom(directions);
            this.npc.setData('direction', direction);
            
            const speed = 60;
            let velocityX = 0;
            let velocityY = 0;
            
            switch (direction) {
                case 'up':
                    velocityY = -speed;
                    break;
                case 'down':
                    velocityY = speed;
                    break;
                case 'left':
                    velocityX = -speed;
                    this.npc.setFlipX(true);
                    break;
                case 'right':
                    velocityX = speed;
                    this.npc.setFlipX(false);
                    break;
            }
            
            this.npc.setVelocity(velocityX, velocityY);
            this.npc.play(`npc-walk-${direction}`, true);
            
            // Stop after a random time
            this.time.delayedCall(Phaser.Math.Between(1000, 2500), () => {
                if (this.npc && this.npc.active) {
                    this.npc.setVelocity(0, 0);
                    const currentDirection = this.npc.getData('direction');
                    this.npc.play(`npc-idle-${currentDirection}`, true);
                }
            });
        } else {
            // Just idle
            this.npc.setVelocity(0, 0);
            const currentDirection = this.npc.getData('direction');
            this.npc.play(`npc-idle-${currentDirection}`, true);
        }
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
        this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.attackKey = this.input.keyboard!.addKey('Q');
        
        this.escKey.on('down', () => this.exitFarm());
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
        // Check if attack key is being held down
        if (this.attackKey.isDown) {
            this.handleAttack();
            return;
        }
        
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
        // Don't update animation if attacking
        if (this.isAttacking) {
            return;
        }
        
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

    private handleAttack(): void {
        // Stop player movement during attack
        this.player.setVelocity(0, 0);
        
        // If already attacking, just continue
        if (this.isAttacking) {
            return;
        }
        
        this.isAttacking = true;
        
        // Check for chickens in attack range
        this.checkAttackHit();
        
        // Switch to attack texture
        this.player.setTexture('player_attack', 0);
        
        // Play attack animation based on current direction (loop while holding)
        const attackAnim = `attack-${this.currentDirection}`;
        this.player.play(attackAnim, true);
        
        // Listen for animation complete to loop or stop
        this.player.on('animationcomplete', this.onAttackComplete, this);
    }
    
    private checkAttackHit(): void {
        const attackRange = 50;
        
        this.chickens.forEach(chicken => {
            if (!chicken.active) return;
            
            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                chicken.x, chicken.y
            );
            
            if (distance < attackRange) {
                this.damageChicken(chicken);
            }
        });
    }
    
    private damageChicken(chicken: Phaser.Physics.Arcade.Sprite): void {
        const currentHealth = chicken.getData('health');
        const newHealth = currentHealth - 1;
        chicken.setData('health', newHealth);
        
        // Flash red when hit
        chicken.setTint(0xff0000);
        this.time.delayedCall(200, () => {
            chicken.clearTint();
        });
        
        if (newHealth <= 0) {
            // Chicken dies
            chicken.setVelocity(0, 0);
            chicken.setAlpha(0.5);
            
            // Cancel the movement timer to prevent callbacks on destroyed object
            const movementTimer = chicken.getData('movementTimer');
            if (movementTimer) {
                movementTimer.destroy();
            }
            
            // Fade out and destroy
            this.tweens.add({
                targets: chicken,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    chicken.destroy();
                }
            });
        }
    }
    
    private onAttackComplete(): void {
        // If Q is still being held, play the attack animation again (loop)
        if (this.attackKey.isDown) {
            // Check for hits on each attack cycle
            this.checkAttackHit();
            const attackAnim = `attack-${this.currentDirection}`;
            this.player.play(attackAnim, true);
        } else {
            // Q released, stop attacking
            this.isAttacking = false;
            this.player.off('animationcomplete', this.onAttackComplete, this);
            // Switch back to normal player texture
            this.player.setTexture('player', 0);
            this.player.play(`idle-${this.currentDirection}`, true);
        }
    }

    private exitFarm(): void {
        this.cameras.main.fadeOut(500, 0, 0, 0);
        
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('WorldSelectionScene');
        });
    }

    destroy(): void
    {
        // Clean up resize event listener
        this.scale.off('resize', this.handleResize, this);
        this.windTimer.destroy();
    }
}
