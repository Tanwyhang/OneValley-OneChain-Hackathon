import * as Phaser from 'phaser';
import { FarmScene } from '../scenes/FarmScene';

export enum ActionType {
    HARVEST = 'harvest',
    PLANT = 'plant',
    CHAT = 'chat',
    CUT = 'cut',
    ATTACK = 'attack',
    COLLECT = 'collect',
    TRADE = 'trade',
    MARKETPLACE = 'marketplace'
}

export interface ContextualAction {
    type: ActionType;
    message: string;
    key: string;
    priority: number; // Higher number = higher priority
    targetX?: number;
    targetY?: number;
    target?: any; // Reference to the target object (NPC, crop, etc.)
    enabled: boolean;
}

export interface ActionDetectionResult {
    availableActions: ContextualAction[];
    highestPriorityAction?: ContextualAction;
}

export class ContextualActionManager {
    private scene: FarmScene;
    private lastCheckTime: number = 0;
    private readonly CHECK_INTERVAL: number = 100; // Check every 100ms
    private detectionRadius: number = 100; // Default detection radius

    constructor(scene: FarmScene) {
        this.scene = scene;
    }

    /**
     * Update detection of available actions
     */
    public update(): ActionDetectionResult {
        const currentTime = Date.now();

        // Throttle checking for performance
        if (currentTime - this.lastCheckTime < this.CHECK_INTERVAL) {
            return { availableActions: [] };
        }

        this.lastCheckTime = currentTime;
        const availableActions: ContextualAction[] = [];

        // Check each type of action
        this.checkHarvestingActions(availableActions);
        this.checkPlantingActions(availableActions);
        this.checkChatActions(availableActions);
        this.checkCuttingActions(availableActions);
        this.checkCombatActions(availableActions);
        this.checkCollectionActions(availableActions);
        this.checkTradeActions(availableActions);
        this.checkMarketplaceActions(availableActions);

        // Sort by priority (highest first)
        availableActions.sort((a, b) => b.priority - a.priority);

        return {
            availableActions,
            highestPriorityAction: availableActions[0]
        };
    }

    private checkHarvestingActions(actions: ContextualAction[]): void {
        // Check if player is near mature crops
        const crops = this.scene['crops'] as Map<string, any>;
        const player = this.scene['player'];

        if (!crops || !player) return;

        let hasMatureCropNearby = false;
        let closestCrop: any = null;
        let closestDistance = Infinity;

        crops.forEach((crop, cropKey) => {
            if (crop.growthStage === 2) { // Mature crop
                const distance = Phaser.Math.Distance.Between(
                    player.x, player.y,
                    crop.x * 64 + 32, crop.y * 64 + 32 // Convert tile to world coordinates
                );

                if (distance < this.detectionRadius && distance < closestDistance) {
                    hasMatureCropNearby = true;
                    closestCrop = crop;
                    closestDistance = distance;
                }
            }
        });

        if (hasMatureCropNearby && closestCrop) {
            actions.push({
                type: ActionType.HARVEST,
                message: 'Press H to Harvest',
                key: 'H',
                priority: 90, // High priority - resource gathering
                targetX: closestCrop.x * 64 + 32,
                targetY: closestCrop.y * 64 + 32,
                target: closestCrop,
                enabled: !this.scene['isHarvesting'] && !this.scene['isChatting'] && !this.scene['isCutting']
            });
        }
    }

    private checkPlantingActions(actions: ContextualAction[]): void {
        // Check if player is on tilled soil with no crop
        const player = this.scene['player'];
        const farmingLayer = this.scene['farmingLayer'];
        const crops = this.scene['crops'] as Map<string, any>;

        if (!player || !farmingLayer || !crops) return;

        const playerTileX = farmingLayer.worldToTileX(player.x);
        const playerTileY = farmingLayer.worldToTileY(player.y);

        // Check 2-tile radius around player
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                const checkX = playerTileX + dx;
                const checkY = playerTileY + dy;

                if (checkX >= 0 && checkY >= 0 && checkX < farmingLayer.width && checkY < farmingLayer.height) {
                    const tile = farmingLayer.getTileAt(checkX, checkY);

                    // Check if it's tilled soil (using the tile index)
                    if (tile && tile.index === 138) { // Tilled soil tile index
                        const cropKey = `${checkX},${checkY}`;

                        // Check if there's no existing crop
                        if (!crops.has(cropKey)) {
                            actions.push({
                                type: ActionType.PLANT,
                                message: 'Press E to Plant Carrot',
                                key: 'E',
                                priority: 70, // Medium priority
                                targetX: checkX * 64 + 32,
                                targetY: checkY * 64 + 32,
                                enabled: true
                            });
                            return; // Only show one planting hint
                        }
                    }
                }
            }
        }
    }

    private checkChatActions(actions: ContextualAction[]): void {
        // Check if player is near NPCs
        const sceneAny = this.scene as any;
        const player = sceneAny.player as Phaser.Physics.Arcade.Sprite | undefined;
        const npcs: Array<Phaser.GameObjects.Sprite> = Array.isArray(sceneAny.npcs)
            ? sceneAny.npcs
            : sceneAny.npc
                ? [sceneAny.npc]
                : [];

        if (!player || npcs.length === 0) return;

        npcs.forEach(npc => {
            const distance = Phaser.Math.Distance.Between(
                player.x, player.y,
                npc.x, npc.y
            );

            if (distance < 80) { // NPC interaction range
                actions.push({
                    type: ActionType.CHAT,
                    message: 'Press Space to Chat',
                    key: 'Space',
                    priority: 80, // High priority - social interaction
                    targetX: npc.x,
                    targetY: npc.y - 50,
                    target: npc,
                    enabled: !this.scene['isChatting'] && !this.scene['isHarvesting']
                });
            }
        });
    }

    private checkCuttingActions(actions: ContextualAction[]): void {
        // Check if player is near trees
        const sceneAny = this.scene as any;
        const player = sceneAny.player as Phaser.Physics.Arcade.Sprite | undefined;
        const treeLayers: Phaser.Tilemaps.TilemapLayer[] = Array.isArray(sceneAny.treeLayers)
            ? sceneAny.treeLayers
            : sceneAny.treeLayer
                ? [sceneAny.treeLayer]
                : [];

        if (!player || treeLayers.length === 0) return;

        const activeTreeLayer = treeLayers[0];
        const playerTileX = activeTreeLayer.worldToTileX(player.x);
        const playerTileY = activeTreeLayer.worldToTileY(player.y);

        // Check for trees in 2-tile radius
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                const checkX = playerTileX + dx;
                const checkY = playerTileY + dy;

                if (checkX >= 0 && checkY >= 0 && checkX < activeTreeLayer.width && checkY < activeTreeLayer.height) {
                    const tile = activeTreeLayer.getTileAt(checkX, checkY);

                    // Check if it's a tree (using tree tile indices)
                    if (tile && tile.index >= 128 && tile.index <= 137) { // Tree tile indices
                        actions.push({
                            type: ActionType.CUT,
                            message: 'Press R to Cut Tree',
                            key: 'R',
                            priority: 60, // Medium-low priority
                            targetX: checkX * 64 + 32,
                            targetY: checkY * 64 + 32,
                            enabled: !this.scene['isHarvesting'] && !this.scene['isChatting'] && !this.scene['isCutting']
                        });
                        return; // Only show one cutting hint
                    }
                }
            }
        }
    }

    private checkCombatActions(actions: ContextualAction[]): void {
        // Check if player is near enemies
        const enemies = this.scene['enemies'] as any[];
        const player = this.scene['player'];

        if (!enemies || !player) return;

        enemies.forEach(enemy => {
            if (enemy.active && !enemy.isDead) {
                const distance = Phaser.Math.Distance.Between(
                    player.x, player.y,
                    enemy.x, enemy.y
                );

                if (distance < 80) { // Combat range
                    actions.push({
                        type: ActionType.ATTACK,
                        message: 'Press Q to Attack',
                        key: 'Q',
                        priority: 95, // Highest priority - combat
                        targetX: enemy.x,
                        targetY: enemy.y - 30,
                        target: enemy,
                        enabled: true
                    });
                }
            }
        });
    }

    private checkCollectionActions(actions: ContextualAction[]): void {
        // Check if player has harvested items to collect
        const harvestedCount = this.scene['harvestedCarrotCount'] || 0;

        if (harvestedCount > 0) {
            actions.push({
                type: ActionType.COLLECT,
                message: `Press C to Collect All (${harvestedCount})`,
                key: 'C',
                priority: 85, // High priority - resource management
                targetX: this.scene.cameras.main.width - 150,
                targetY: 100,
                enabled: !this.scene['isCollecting'] && !this.scene['mintModalVisible']
            });
        }
    }

    private checkTradeActions(actions: ContextualAction[]): void {
        // Check if player is near NPCs with trading enabled
        const sceneAny = this.scene as any;
        const player = sceneAny.player as Phaser.Physics.Arcade.Sprite | undefined;
        const npcs: Array<Phaser.GameObjects.Sprite> = Array.isArray(sceneAny.npcs)
            ? sceneAny.npcs
            : sceneAny.npc
                ? [sceneAny.npc]
                : [];

        if (!player || npcs.length === 0) return;

        npcs.forEach(npc => {
            const distance = Phaser.Math.Distance.Between(
                player.x, player.y,
                npc.x, npc.y
            );

            if (distance < 80) { // NPC interaction range
                actions.push({
                    type: ActionType.TRADE,
                    message: 'Click for Trade',
                    key: 'Click',
                    priority: 75, // Medium-high priority
                    targetX: npc.x,
                    targetY: npc.y - 80,
                    target: npc,
                    enabled: !this.scene['isChatting']
                });
            }
        });
    }

    private checkMarketplaceActions(actions: ContextualAction[]): void {
        // Check if player is near the marketplace
        const player = this.scene['player'];

        if (!player) return;

        // Marketplace position (approximate center of market building)
        const marketX = 2000; // Approximate X coordinate of marketplace
        const marketY = 1400; // Approximate Y coordinate of marketplace

        const distance = Phaser.Math.Distance.Between(
            player.x, player.y,
            marketX, marketY
        );

        if (distance < 150) { // Marketplace interaction range
            actions.push({
                type: ActionType.MARKETPLACE,
                message: 'Click for Marketplace',
                key: 'Click',
                priority: 65, // Medium priority
                targetX: marketX,
                targetY: marketY - 50,
                enabled: true
            });
        }
    }

    /**
     * Set detection radius for action checking
     */
    public setDetectionRadius(radius: number): void {
        this.detectionRadius = radius;
    }

    /**
     * Get current detection radius
     */
    public getDetectionRadius(): number {
        return this.detectionRadius;
    }
}