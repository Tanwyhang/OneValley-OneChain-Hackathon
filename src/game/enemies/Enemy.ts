import Phaser from 'phaser';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
    private maxHp: number;
    private currentHp: number;
    private damage: number;
    private moveSpeed: number;
    private enemyType: 'skeleton' | 'slime';
    private isDead: boolean = false;
    private moveTimer?: Phaser.Time.TimerEvent;
    private currentMoveDirection: { x: number; y: number } = { x: 0, y: 0 };

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        texture: string,
        enemyType: 'skeleton' | 'slime',
        hp: number,
        damage: number,
        moveSpeed: number
    ) {
        super(scene, x, y, texture);
        
        this.enemyType = enemyType;
        this.maxHp = hp;
        this.currentHp = hp;
        this.damage = damage;
        this.moveSpeed = moveSpeed;

        // Add to scene
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Set up physics body
        this.setCollideWorldBounds(true);
        
        // Adjust body size and scale based on enemy type
        if (enemyType === 'skeleton') {
            this.setScale(1.2); // Make skeleton 2x bigger
            this.setSize(24, 28);
            this.setOffset(4, 4);
        } else if (enemyType === 'slime') {
            this.setSize(48, 48);
            this.setOffset(8, 16);
        }

        // Start AI behavior
        this.startAI();
    }

    private startAI(): void {
        // Random movement AI
        this.moveTimer = this.scene.time.addEvent({
            delay: Phaser.Math.Between(1000, 3000),
            callback: this.changeDirection,
            callbackScope: this,
            loop: true
        });

        this.changeDirection();
    }

    private changeDirection(): void {
        if (this.isDead) return;

        // Random direction or stand still
        const directions = [
            { x: 0, y: 0 },      // Stand still
            { x: -1, y: 0 },     // Left
            { x: 1, y: 0 },      // Right
            { x: 0, y: -1 },     // Up
            { x: 0, y: 1 },      // Down
        ];

        this.currentMoveDirection = Phaser.Utils.Array.GetRandom(directions);
        
        // Update animation based on movement
        if (this.enemyType === 'skeleton') {
            if (this.currentMoveDirection.x === 0 && this.currentMoveDirection.y === 0) {
                this.play('skeleton-idle-down', true);
            } else if (this.currentMoveDirection.y > 0) {
                this.play('skeleton-walk-down', true);
            } else if (this.currentMoveDirection.y < 0) {
                this.play('skeleton-walk-up', true);
            } else {
                this.play('skeleton-walk-side', true);
                this.setFlipX(this.currentMoveDirection.x < 0);
            }
        } else if (this.enemyType === 'slime') {
            if (this.currentMoveDirection.x === 0 && this.currentMoveDirection.y === 0) {
                this.play('slime-idle', true);
            } else {
                this.play('slime-jump', true);
            }
        }
    }

    public takeDamage(amount: number): void {
        if (this.isDead) return;

        this.currentHp -= amount;

        // Flash red when damaged
        this.setTint(0xff0000);
        this.scene.time.delayedCall(200, () => {
            this.clearTint();
        });

        if (this.currentHp <= 0) {
            this.die();
        }
    }

    private die(): void {
        this.isDead = true;
        this.setVelocity(0, 0);

        // Stop AI
        if (this.moveTimer) {
            this.moveTimer.remove();
        }

        // Play death animation
        if (this.enemyType === 'skeleton') {
            this.play('skeleton-dead', true);
        } else if (this.enemyType === 'slime') {
            this.play('slime-dead', true);
        }

        // Remove after animation
        this.scene.time.delayedCall(1000, () => {
            this.destroy();
        });
    }

    public getDamage(): number {
        return this.damage;
    }

    public getIsDead(): boolean {
        return this.isDead;
    }

    preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta);

        if (!this.isDead) {
            // Move in current direction
            this.setVelocity(
                this.currentMoveDirection.x * this.moveSpeed,
                this.currentMoveDirection.y * this.moveSpeed
            );
        }
    }

    destroy(fromScene?: boolean): void {
        if (this.moveTimer) {
            this.moveTimer.remove();
        }
        super.destroy(fromScene);
    }
}
