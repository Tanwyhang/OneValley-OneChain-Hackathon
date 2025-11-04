import { Scene } from 'phaser';
import { EventBus } from '../EventBus';

export class Game extends Scene
{
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
        super('Game');
    }

    preload ()
    {
        this.load.setPath('assets');
        
        this.load.spritesheet('player', 'sprites/player/player_walk.png', {
            frameWidth: 125,
            frameHeight: 250
        });
        
        this.load.image('background', 'bg.png');
    }

    create ()
    {
        this.add.image(512, 384, 'background');
        
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
        this.player = this.physics.add.sprite(512, 384, 'player', 0);
        this.player.setScale(0.30);
        this.player.setCollideWorldBounds(true);
        this.player.body!.setSize(this.player.width * 0.6, this.player.height * 0.5);
        this.player.body!.setOffset(this.player.width * 0.2, this.player.height * 0.4);
        this.player.play('idle-down');
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
        this.cameras.main.setBounds(0, 0, 1024, 768);
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
}
