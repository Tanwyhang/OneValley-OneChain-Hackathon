import * as Phaser from 'phaser';
import { ContextualAction, ActionType } from './ContextualActionManager';

export class SimpleHint {
    public text: Phaser.GameObjects.Text;
    public action: ContextualAction;
    public visible: boolean = true;

    constructor(
        scene: Phaser.Scene,
        action: ContextualAction,
        x: number,
        y: number
    ) {
        this.action = action;

        // Create simple text object like NPC names
        this.text = scene.add.text(x, y, action.message, {
            fontSize: '14px',
            color: this.getTextColor(action.type),
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
            resolution: 3
        });

        this.text.setOrigin(0.5);
        this.text.setDepth(15); // Above NPC names (depth 10) but below most UI
    }

    private getTextColor(actionType: ActionType): string {
        switch (actionType) {
            case ActionType.HARVEST:
                return '#4fff4f'; // Green
            case ActionType.PLANT:
                return '#cd853f'; // Brown
            case ActionType.CHAT:
                return '#6495ed'; // Blue
            case ActionType.CUT:
                return '#cd853f'; // Brown
            case ActionType.ATTACK:
                return '#ff6b6b'; // Red
            case ActionType.COLLECT:
                return '#ffd700'; // Gold
            case ActionType.TRADE:
                return '#da70d6'; // Purple
            case ActionType.MARKETPLACE:
                return '#48d1cc'; // Cyan
            default:
                return '#ffffff'; // White
        }
    }

    public updatePosition(x: number, y: number): void {
        this.text.setPosition(x, y);
    }

    public show(): void {
        this.text.setVisible(true);
        this.visible = true;
    }

    public hide(): void {
        this.text.setVisible(false);
        this.visible = false;
    }

    public destroy(): void {
        if (this.text) {
            this.text.destroy();
        }
    }

    public setEnabled(enabled: boolean): void {
        if (enabled && !this.visible) {
            this.show();
        } else if (!enabled && this.visible) {
            this.hide();
        }
    }
}

export class FloatingHintManager {
    private scene: Phaser.Scene;
    private activeHints: Map<string, SimpleHint> = new Map();
    private maxHints: number = 1; // Show only highest priority hint at a time
    private updateInterval: number = 100; // Update every 100ms
    private lastUpdateTime: number = 0;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    /**
     * Update floating hints based on available actions
     */
    public update(availableActions: ContextualAction[]): void {
        const currentTime = Date.now();

        // Throttle updates for performance
        if (currentTime - this.lastUpdateTime < this.updateInterval) {
            return;
        }

        this.lastUpdateTime = currentTime;

        // Filter enabled actions and sort by priority, take only the highest priority one
        const enabledActions = availableActions
            .filter(action => action.enabled)
            .slice(0, this.maxHints);

        // Create hint IDs for tracking
        const currentHintIds = new Set<string>();
        enabledActions.forEach(action => {
            const hintId = this.getHintId(action);
            currentHintIds.add(hintId);
        });

        // Remove hints that are no longer needed
        for (const [hintId, hint] of this.activeHints) {
            if (!currentHintIds.has(hintId)) {
                hint.hide();
                setTimeout(() => {
                    this.removeHint(hintId);
                }, 100);
            }
        }

        // Add or update hints for current actions
        enabledActions.forEach((action) => {
            const hintId = this.getHintId(action);
            let hint = this.activeHints.get(hintId);

            if (!hint) {
                // Create new hint
                hint = this.createHint(action);
                this.activeHints.set(hintId, hint);
            }

            // Update position using world coordinates (no screen conversion)
            this.updateHintPosition(hint, action);

            // Update enabled state
            hint.setEnabled(action.enabled);

            // Show the hint immediately
            hint.show();
        });
    }

    private getHintId(action: ContextualAction): string {
        // Create unique ID based on action type and target
        if (action.target) {
            return `${action.type}_${action.target.x || 0}_${action.target.y || 0}`;
        }
        return `${action.type}_${action.targetX || 0}_${action.targetY || 0}`;
    }

    private createHint(action: ContextualAction): SimpleHint {
        // Use world coordinates directly like NPC names
        let x = action.targetX || this.scene.cameras.main.width / 2;
        let y = action.targetY || this.scene.cameras.main.height / 2;

        // For actions with targets (NPCs, enemies, crops), use target position
        if (action.target && action.target.x && action.target.y) {
            x = action.target.x;
            y = action.target.y - 40; // Appear above the target
        }

        return new SimpleHint(this.scene, action, x, y);
    }

    private updateHintPosition(hint: SimpleHint, action: ContextualAction): void {
        let targetX: number;
        let targetY: number;

        // Set position based on action type, using world coordinates directly
        switch (action.type) {
            case ActionType.COLLECT:
                // Collection hint appears in screen coordinates (special case)
                targetX = this.scene.cameras.main.width - 150;
                targetY = 100;
                break;
            case ActionType.ATTACK:
                // Attack hints appear above enemies
                if (action.target && action.target.x && action.target.y) {
                    targetX = action.target.x;
                    targetY = action.target.y - 60; // Above enemy
                } else {
                    targetX = action.targetX || 0;
                    targetY = (action.targetY || 0) - 60;
                }
                break;
            case ActionType.CHAT:
                // Chat hints appear above NPCs
                if (action.target && action.target.x && action.target.y) {
                    targetX = action.target.x;
                    targetY = action.target.y - 80; // Above NPC, like name text
                } else {
                    targetX = action.targetX || 0;
                    targetY = (action.targetY || 0) - 80;
                }
                break;
            case ActionType.HARVEST:
            case ActionType.PLANT:
            case ActionType.CUT:
                // Action hints appear above target tiles/objects
                targetX = action.targetX || 0;
                targetY = (action.targetY || 0) - 50; // Above tile
                break;
            case ActionType.TRADE:
                // Trade hints appear above NPCs
                if (action.target && action.target.x && action.target.y) {
                    targetX = action.target.x;
                    targetY = action.target.y - 100; // Above NPC, higher than chat
                } else {
                    targetX = action.targetX || 0;
                    targetY = (action.targetY || 0) - 100;
                }
                break;
            case ActionType.MARKETPLACE:
                // Marketplace hints appear above marketplace
                targetX = action.targetX || 0;
                targetY = (action.targetY || 0) - 60;
                break;
            default:
                // Default: use provided coordinates
                targetX = action.targetX || 0;
                targetY = action.targetY || 0;
                break;
        }

        hint.updatePosition(targetX, targetY);
    }

    private removeHint(hintId: string): void {
        const hint = this.activeHints.get(hintId);
        if (hint) {
            hint.destroy();
            this.activeHints.delete(hintId);
        }
    }

    /**
     * Clear all hints immediately
     */
    public clearAllHints(): void {
        this.activeHints.forEach(hint => {
            hint.destroy();
        });
        this.activeHints.clear();
    }

    /**
     * Get the number of active hints
     */
    public getActiveHintCount(): number {
        return this.activeHints.size;
    }

    /**
     * Set maximum number of hints to display
     */
    public setMaxHints(max: number): void {
        this.maxHints = max;
    }

    /**
     * Destroy the hint manager and clean up all hints
     */
    public destroy(): void {
        this.clearAllHints();
    }
}