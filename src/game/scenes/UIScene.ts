import * as Phaser from 'phaser';
import { SCENE_KEYS } from './SceneKeys';
// 1. First, let's update the Slot interface at the top of the file
interface Slot {
    bg: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    x: number;
    y: number;
    itemId?: string;  // The unique identifier for the item
    itemImage?: Phaser.GameObjects.Image;  // The actual image in the slot
    countText?: Phaser.GameObjects.Text;  // Text showing item count
    itemType?: string;  // e.g., 'weapon', 'consumable', 'tool'
}

export class UIScene extends Phaser.Scene {
    #hudContainer!: Phaser.GameObjects.Container;
    #hearts!: Phaser.GameObjects.Sprite[];
    private itemBarContainer!: Phaser.GameObjects.Container;
    private slots: Slot[] = [];
    private selectedIndex: number = 0;
    private readonly SLOT_COUNT = 8;
    private barBg!: Phaser.GameObjects.Image;
    private cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
    private selectionIndicator?: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    private keyHandlers: Phaser.Events.EventEmitter[] = [];

    // Backpack properties
    private backpackContainer!: Phaser.GameObjects.Container;
    private backpackSlots: Slot[] = [];
    private backpackBg!: Phaser.GameObjects.Image;
    private backpackVisible: boolean = false;
    private readonly BACKPACK_SLOT_COUNT = 25; // 5x5 grid
    private readonly BACKPACK_COLS = 5;
    private readonly BACKPACK_ROWS = 5;
    private backpackKey!: Phaser.Input.Keyboard.Key;
    private backpackOverlay!: Phaser.GameObjects.Rectangle;

    // Drag and drop properties
    private draggedItem: { itemId: string; itemType?: string; count?: number; sourceSlot: Slot; sourceIndex: number; sourceType: 'itembar' | 'backpack' } | null = null;
    private dragGhost?: Phaser.GameObjects.Image;

    // Marketplace properties
    private marketplaceContainer!: Phaser.GameObjects.Container;
    private marketplaceBg!: Phaser.GameObjects.Image;
    private marketplaceVisible: boolean = false;
    private marketplaceSlots: Slot[] = [];
    private marketplaceButtons: Phaser.GameObjects.Image[] = [];
    private selectedCategory: 'Weapons' | 'Armors' | 'Misc' | 'Consumables' = 'Weapons';
    private marketplaceOverlay!: Phaser.GameObjects.Rectangle;
    private readonly MARKETPLACE_SLOT_COUNT = 30; // 5x6
    private readonly MARKETPLACE_COLS = 5;
    private readonly MARKETPLACE_ROWS = 6;
    private marketplaceCreated: boolean = false;

    constructor() {
        super({
            key: SCENE_KEYS.UI,
            active: true
        });
    }

    public create(): void {
        // Set custom cursor with larger size
        this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');

        // Reset marketplace state
        this.marketplaceCreated = false;
        this.marketplaceButtons = [];
        this.marketplaceSlots = [];
        this.backpackSlots = [];
        this.slots = [];

        // Create main HUD container with high depth
        this.#hudContainer = this.add.container(0, 0).setDepth(10000);
        this.#hearts = [];
        this.keyHandlers = [];

        // Create item bar
        this.createItemBar();

        // Handle window resize with proper context binding
        this.scale.on('resize', this.handleResize, this);

        // Cleanup on scene shutdown
        this.events.once('shutdown', () => {
            this.scale.off('resize', this.handleResize, this);
            this.cleanupKeyHandlers();
            this.input.off('pointermove', this.onDragMove, this);
            this.#hudContainer.destroy(true);
        });

        // Start with UI hidden by default
        this.hideUI();

        // Select first slot by default
        this.selectedIndex = 0;
        this.updateSelection();

        // Setup keyboard input for item selection
        this.setupInput();

        // Create backpack (hidden by default)
        this.createBackpack();

        // Create marketplace (hidden by default)
        this.createMarketplace();

        // Create settings button at top right
        this.createSettingsButton();
    }

    public showUI(): void {
        this.#hudContainer.setVisible(true);
    }

    public hideUI(): void {
        this.#hudContainer.setVisible(false);
    }

    private createItemBar(): void {
        // Create item bar container
        this.itemBarContainer = this.add.container(0, 0);
        this.itemBarContainer.setScrollFactor(0);
        this.itemBarContainer.setDepth(25000);
        this.#hudContainer.add(this.itemBarContainer);

        // Create slots
        this.createSlots();
        this.setupKeys();
        this.updatePosition();
    }

    private createSlots(): void {
        const slotSize = 48;
        const spacing = 6;
        const totalWidth = (this.SLOT_COUNT * (slotSize + spacing)) - spacing;
        const startX = -totalWidth / 2 + slotSize / 2;

        // Add the itembar background if it exists
        if (this.textures.exists('itembar')) {
            this.barBg = this.add.image(0, 0, 'itembar')
                .setOrigin(0.5, 0.5)
                .setDepth(50);
            this.itemBarContainer.add(this.barBg);
        }

        for (let i = 0; i < this.SLOT_COUNT; i++) {
            const x = startX + i * (slotSize + spacing);

            // Create slot background
            let slotBg;
            if (this.textures.exists('slot')) {
                slotBg = this.add.image(x, 0, 'slot')
                    .setOrigin(0.5, 0.5)
                    .setDepth(100);
            } else {
                slotBg = this.add.rectangle(x, 0, slotSize, slotSize, 0x000000, 0.3)
                    .setOrigin(0.5, 0.5)
                    .setDepth(100);
            }

            this.itemBarContainer.add(slotBg);

            const slot: Slot = {
                bg: slotBg,
                x: x,
                y: 0
            };
            this.slots.push(slot);

            // Make slot interactive for drag and drop
            this.makeSlotInteractive(slotBg, i, 'itembar');
        }

        // Create selection indicator last so it's above slots
        if (this.textures.exists('selected-slot')) {
            this.selectionIndicator = this.add.image(0, 0, 'selected-slot')
                .setOrigin(0.5, 0.5)
                .setVisible(false)
                .setDepth(200); // Above slots
        } else {
            this.selectionIndicator = this.add.rectangle(0, 0, slotSize + 8, slotSize + 8, 0, 0)
                .setStrokeStyle(2, 0x00ff00)
                .setOrigin(0.5, 0.5)
                .setVisible(false)
                .setDepth(200);
        }
        this.itemBarContainer.add(this.selectionIndicator);
    }

    private setupKeys(): void {
        // Clean up any existing key handlers
        this.cleanupKeyHandlers();

        // Add keyboard controls for slot selection (1-8)
        for (let i = 0; i < this.SLOT_COUNT; i++) {
            const key = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes[i + 49]); // 49 is keycode for '1'
            const handler = () => {
                this.selectedIndex = i;
                this.updateSelection();
            };
            key?.on('down', handler);
            this.keyHandlers.push(key?.on('down', handler) || new Phaser.Events.EventEmitter());
        }
    }

    // 4. Update the updateSelection method to handle item layering
    private updateSelection(): void {
        if (!this.selectionIndicator) return;

        // Update selection indicator position
        const slot = this.slots[this.selectedIndex];
        if (slot) {
            this.selectionIndicator.setPosition(slot.x, slot.y);
            this.selectionIndicator.setVisible(true);

            // Ensure proper layering
            this.selectionIndicator.setDepth(500); // Keep it below numbers but above slots

            // Force update the display list
            this.children.sort('depth');
        }

        // Emit event when selection changes
        const selectedItem = this.getSelectedItem();
        this.events.emit('slot-selected', {
            slotIndex: this.selectedIndex,
            item: selectedItem
        });
    }

    // 3. Update the addItem method to handle item types and better positioning
    public addItem(itemId: string, slotIndex: number, itemType: string = 'item', count: number = 1): void {
        if (slotIndex < 0 || slotIndex >= this.SLOT_COUNT) {
            console.warn(`Invalid slot index: ${slotIndex}`);
            return;
        }

        const slot = this.slots[slotIndex];
        if (!slot) return;

        // Remove existing item if any
        if (slot.itemImage) {
            slot.itemImage.destroy();
        }
        if (slot.countText) {
            slot.countText.destroy();
        }

        // Add item image with proper depth
        const textureKey = itemId;

        // Check if the texture exists
        if (this.textures.exists(textureKey)) {
            slot.itemImage = this.add.image(slot.x, slot.y, textureKey)
                .setDisplaySize(32, 32)
                .setOrigin(0.5, 0.5)
                .setDepth(1000 + slotIndex);
            this.itemBarContainer.add(slot.itemImage);
        } else {
            console.warn(`Texture not found: ${textureKey}`);
            // Add a placeholder for debugging
            slot.itemImage = this.add.rectangle(slot.x, slot.y, 32, 32, 0xff0000)
                .setOrigin(0.5, 0.5)
                .setDepth(1000 + slotIndex);
            this.itemBarContainer.add(slot.itemImage);
        }

        // Add item count if more than 1
        if (count > 1) {
            slot.countText = this.add.text(
                slot.x + 10,
                slot.y + 10,
                count.toString(),
                {
                    fontSize: '14px',
                    color: '#ffffff',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    padding: { x: 2, y: 1 }
                }
            ).setOrigin(1, 1)
                .setDepth(1001 + slotIndex); // Even higher depth than item image

            this.itemBarContainer.add(slot.countText);
        }

        // Store item data
        slot.itemId = itemId;
        slot.itemType = itemType;

        // Force update the display list
        this.children.sort('depth');
    }

    public updatePosition(): void {
        const x = this.cameras.main.centerX;
        const y = this.cameras.main.height - 60; // Position at bottom of screen
        this.itemBarContainer.setPosition(x, y);
    }

    private handleResize(gameSize: Phaser.Structs.Size): void {
        if (!this.scene.settings.active) return;
        this.itemBarContainer.setVisible(true);
        this.updatePosition();
    }

    private setupInput(): void {
        // Add number key support (1-8)
        for (let i = 0; i < this.SLOT_COUNT; i++) {
            const key = this.input.keyboard?.addKey(48 + i + 1); // 49 is '1', 50 is '2', etc.
            key?.on('down', () => {
                this.selectSlot(i);
            });
        }

        // Add arrow key support
        this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            if (event.key === 'ArrowLeft') {
                this.selectSlot((this.selectedIndex - 1 + this.SLOT_COUNT) % this.SLOT_COUNT);
                event.preventDefault();
            } else if (event.key === 'ArrowRight') {
                this.selectSlot((this.selectedIndex + 1) % this.SLOT_COUNT);
                event.preventDefault();
            }
        });

        // Add 'B' key to toggle backpack (only in FarmScene)
        this.backpackKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B);
        this.backpackKey.on('down', () => {
            const farmScene = this.scene.get(SCENE_KEYS.FARM);
            if (farmScene && farmScene.scene.isActive()) {
                if (this.backpackVisible) {
                    this.hideBackpack();
                } else if (this.marketplaceVisible) {
                    this.marketplaceContainer.setVisible(false);
                    this.showBackpack();
                } else {
                    this.showBackpack();
                }
            }
        });

        // Add 'ESC' key to close marketplace/backpack
        const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        escKey.on('down', () => {
            if (this.backpackVisible) {
                this.hideBackpack();
                // If marketplace was open before, show it back
                if (this.marketplaceVisible) {
                    this.marketplaceContainer.setVisible(true);
                }
            } else if (this.marketplaceVisible) {
                this.hideMarketplace();
            }
        });
    }

    private cleanupKeyHandlers(): void {
        this.keyHandlers.forEach(handler => handler.off('down'));
        this.keyHandlers = [];
    }

    private selectSlot(index: number): void {
        if (index < 0 || index >= this.SLOT_COUNT) return;
        this.selectedIndex = index;
        this.updateSelection();
    }

    // 2. Add a method to get the currently selected item
    public getSelectedItem(): { itemId: string; itemType?: string } | null {
        const slot = this.slots[this.selectedIndex];
        if (slot && slot.itemId) {
            return {
                itemId: slot.itemId,
                itemType: slot.itemType
            };
        }
        return null;
    }

    public getSlot(index: number): Slot | undefined {
        return this.slots[index];
    }

    // ===== BACKPACK METHODS =====

    private createBackpack(): void {
        // Create backpack container (centered on screen)
        this.backpackContainer = this.add.container(0, 0);
        this.backpackContainer.setScrollFactor(0);
        this.backpackContainer.setDepth(15000); // Below item bar (25000)
        this.backpackContainer.setVisible(false);

        // Add grey overlay (larger to cover edges when zoomed)
        this.backpackOverlay = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width * 2,
            this.cameras.main.height * 2,
            0x000000,
            0.7
        );
        this.backpackOverlay.setOrigin(0.5);
        this.backpackOverlay.setDepth(50);
        this.backpackOverlay.setScrollFactor(0);
        this.backpackOverlay.setVisible(false);

        // ADJUST BACKPACK IMAGE SCALE
        const backpackScale = 2.0;

        // Add backpack background image
        if (this.textures.exists('backpack')) {
            this.backpackBg = this.add.image(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                'backpack'
            );
            this.backpackBg.setOrigin(0.5);
            this.backpackBg.setScale(backpackScale);
            this.backpackBg.setDepth(100);
            this.backpackContainer.add(this.backpackBg);
        }

        // Create 5x5 grid of slots
        this.createBackpackSlots(backpackScale);

        // Add to HUD container
        this.#hudContainer.add(this.backpackContainer);
    }

    private createBackpackSlots(backpackScale: number): void {
        // Slots scale with backpack automatically
        const slotSize = 48 * backpackScale;
        
        const cols = this.BACKPACK_COLS;
        const rows = this.BACKPACK_ROWS;
        
        // Grid area is 368x270, centered in backpack
        const gridWidth = cols * slotSize;
        const gridHeight = rows * slotSize;
        
        // ADJUST THESE VALUES TO MOVE THE GRID (scaled with backpack)
        const offsetX = 3 * backpackScale; // Positive = move right, Negative = move left
        const offsetY = 14 * backpackScale; // Positive = move down, Negative = move up
        
        // Calculate starting position (top-left of grid)
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;
        const startX = centerX - gridWidth / 2 + slotSize / 2 + offsetX;
        const startY = centerY - gridHeight / 2 + slotSize / 2 + offsetY;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = startX + col * slotSize;
                const y = startY + row * slotSize;

                // Create slot background
                let slotBg;
                if (this.textures.exists('slot')) {
                    slotBg = this.add.image(x, y, 'slot')
                        .setOrigin(0.5, 0.5)
                        .setScale(backpackScale)
                        .setDepth(200);
                } else {
                    slotBg = this.add.rectangle(x, y, slotSize, slotSize, 0x000000, 0.3)
                        .setOrigin(0.5, 0.5)
                        .setDepth(100);
                }

                this.backpackContainer.add(slotBg);

                const slot: Slot = {
                    bg: slotBg,
                    x: x,
                    y: y
                };
                this.backpackSlots.push(slot);

                // Make slot interactive for drag and drop
                this.makeSlotInteractive(slotBg, row * cols + col, 'backpack');
            }
        }
    }

    // ===== DRAG AND DROP METHODS =====

    private makeSlotInteractive(slotBg: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle, slotIndex: number, slotType: 'itembar' | 'backpack'): void {
        slotBg.setInteractive({ draggable: false });

        slotBg.on('pointerover', () => {
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });

        slotBg.on('pointerout', () => {
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });

        slotBg.on('pointerdown', () => {
            if (this.draggedItem) return; // Prevent starting new drag while dragging
            const slot = slotType === 'itembar' ? this.slots[slotIndex] : this.backpackSlots[slotIndex];
            if (slot && slot.itemId) {
                this.startDrag(slot, slotIndex, slotType);
            }
        });

        slotBg.on('pointerup', () => {
            if (this.draggedItem) {
                const targetSlot = slotType === 'itembar' ? this.slots[slotIndex] : this.backpackSlots[slotIndex];
                this.onDrop(targetSlot, slotIndex, slotType);
            }
        });
    }

    private startDrag(slot: Slot, slotIndex: number, slotType: 'itembar' | 'backpack'): void {
        if (!slot.itemId || !slot.itemImage) return;

        this.draggedItem = {
            itemId: slot.itemId,
            itemType: slot.itemType,
            count: slot.countText ? parseInt(slot.countText.text) : 1,
            sourceSlot: slot,
            sourceIndex: slotIndex,
            sourceType: slotType
        };

        // Change cursor to grab
        this.input.setDefaultCursor('url(assets/ui/cursor-grab.png) 16 16, grab');

        // Create ghost image
        this.dragGhost = this.add.image(slot.itemImage.x, slot.itemImage.y, slot.itemId)
            .setDisplaySize(32, 32)
            .setAlpha(0.7)
            .setDepth(30000);

        // Hide original item
        slot.itemImage.setVisible(false);
        if (slot.countText) slot.countText.setVisible(false);

        // Follow pointer
        this.input.on('pointermove', this.onDragMove, this);
    }

    private onDragMove(pointer: Phaser.Input.Pointer): void {
        if (this.dragGhost) {
            this.dragGhost.setPosition(pointer.x, pointer.y);
        }
    }

    private onDrop(targetSlot: Slot, targetIndex: number, targetType: 'itembar' | 'backpack'): void {
        if (!this.draggedItem) return;

        const sourceSlot = this.draggedItem.sourceSlot;
        const sourceIndex = this.draggedItem.sourceIndex;
        const sourceType = this.draggedItem.sourceType;

        // Swap items
        this.swapItems(sourceSlot, sourceIndex, sourceType, targetSlot, targetIndex, targetType);

        // Cleanup
        this.endDrag();
    }

    private swapItems(fromSlot: Slot, fromIndex: number, fromType: 'itembar' | 'backpack', toSlot: Slot, toIndex: number, toType: 'itembar' | 'backpack'): void {
        // Store target slot data
        const targetItemId = toSlot.itemId;
        const targetItemType = toSlot.itemType;
        const targetCount = toSlot.countText ? parseInt(toSlot.countText.text) : 1;

        // Move source item to target
        if (toType === 'itembar') {
            this.addItem(fromSlot.itemId!, toIndex, fromSlot.itemType, this.draggedItem!.count);
        } else {
            this.addItemToBackpack(fromSlot.itemId!, toIndex, fromSlot.itemType, this.draggedItem!.count);
        }

        // Move target item to source (if exists)
        if (targetItemId) {
            if (fromType === 'itembar') {
                this.addItem(targetItemId, fromIndex, targetItemType, targetCount);
            } else {
                this.addItemToBackpack(targetItemId, fromIndex, targetItemType, targetCount);
            }
        } else {
            // Clear source slot if target was empty
            this.clearSlot(fromIndex, fromType);
        }
    }

    private endDrag(): void {
        if (this.dragGhost) {
            this.dragGhost.destroy();
            this.dragGhost = undefined;
        }

        // Reset cursor
        this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');

        this.input.off('pointermove', this.onDragMove, this);
        this.draggedItem = null;
    }

    private clearSlot(slotIndex: number, slotType: 'itembar' | 'backpack'): void {
        const slot = slotType === 'itembar' ? this.slots[slotIndex] : this.backpackSlots[slotIndex];
        if (!slot) return;

        if (slot.itemImage) {
            slot.itemImage.destroy();
            slot.itemImage = undefined;
        }
        if (slot.countText) {
            slot.countText.destroy();
            slot.countText = undefined;
        }
        slot.itemId = undefined;
        slot.itemType = undefined;
    }

    public addItemToBackpack(itemId: string, slotIndex: number, itemType: string = 'item', count: number = 1): void {
        if (slotIndex < 0 || slotIndex >= this.BACKPACK_SLOT_COUNT) {
            console.warn(`Invalid backpack slot index: ${slotIndex}`);
            return;
        }

        const slot = this.backpackSlots[slotIndex];
        if (!slot) return;

        // Remove existing item if any
        if (slot.itemImage) slot.itemImage.destroy();
        if (slot.countText) slot.countText.destroy();

        // Add item image
        if (this.textures.exists(itemId)) {
            slot.itemImage = this.add.image(slot.x, slot.y, itemId)
                .setDisplaySize(32, 32)
                .setOrigin(0.5, 0.5)
                .setDepth(1000 + slotIndex);
            this.backpackContainer.add(slot.itemImage);
        } else {
            console.warn(`Texture not found: ${itemId}`);
            slot.itemImage = this.add.rectangle(slot.x, slot.y, 32, 32, 0xff0000)
                .setOrigin(0.5, 0.5)
                .setDepth(1000 + slotIndex);
            this.backpackContainer.add(slot.itemImage);
        }

        // Add item count if more than 1
        if (count > 1) {
            slot.countText = this.add.text(
                slot.x + 10,
                slot.y + 10,
                count.toString(),
                {
                    fontSize: '14px',
                    color: '#ffffff',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    padding: { x: 2, y: 1 }
                }
            ).setOrigin(1, 1)
                .setDepth(1001 + slotIndex);
            this.backpackContainer.add(slot.countText);
        }

        // Store item data
        slot.itemId = itemId;
        slot.itemType = itemType;

        this.children.sort('depth');
    }

    public toggleBackpack(): void {
        this.backpackVisible = !this.backpackVisible;
        this.backpackContainer.setVisible(this.backpackVisible);
        this.backpackOverlay.setVisible(this.backpackVisible);
    }

    public showBackpack(): void {
        this.backpackVisible = true;
        this.backpackContainer.setVisible(true);
        this.backpackOverlay.setVisible(true);
    }

    public hideBackpack(): void {
        this.backpackVisible = false;
        this.backpackContainer.setVisible(false);
        this.backpackOverlay.setVisible(false);
        
        // If marketplace was open, show it back
        if (this.marketplaceVisible) {
            this.marketplaceContainer.setVisible(true);
        }
    }

    // ===== MARKETPLACE METHODS =====

    private createMarketplace(): void {
        if (this.marketplaceCreated) return;
        this.marketplaceCreated = true;

        // Create marketplace container (centered on screen)
        this.marketplaceContainer = this.add.container(0, 0);
        this.marketplaceContainer.setScrollFactor(0);
        this.marketplaceContainer.setDepth(15000); // Below item bar (25000)
        this.marketplaceContainer.setVisible(false);

        // Add grey overlay
        this.marketplaceOverlay = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width * 2,
            this.cameras.main.height * 2,
            0x000000,
            0.7
        );
        this.marketplaceOverlay.setOrigin(0.5);
        this.marketplaceOverlay.setDepth(50);
        this.marketplaceOverlay.setScrollFactor(0);
        this.marketplaceOverlay.setVisible(false);

        // ADJUST MARKETPLACE IMAGE SCALE HERE
        const marketplaceScale = 1.5; // Change this value to scale marketplace

        // Add marketplace background image
        if (!this.textures.exists('marketplace')) {
            console.error('Marketplace texture not found!');
            return;
        }

        this.marketplaceBg = this.add.image(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            'marketplace'
        );
        this.marketplaceBg.setOrigin(0.5);
        this.marketplaceBg.setScale(marketplaceScale);
        this.marketplaceBg.setDepth(100);
        this.marketplaceContainer.add(this.marketplaceBg);

        // Create category buttons
        this.createMarketplaceButtons(marketplaceScale);

        // Create slot grid
        this.createMarketplaceSlots(marketplaceScale);

        // Create close button
        this.createMarketplaceCloseButton(marketplaceScale);

        // Create buy/sell buttons
        this.createMarketplaceBuyButton(marketplaceScale);
        this.createMarketplaceSellButton();

        // Add to HUD container
        this.#hudContainer.add(this.marketplaceContainer);
    }

    private createMarketplaceButtons(marketplaceScale: number): void {
        const categories = [
            { name: 'Weapons', x: 113, y: 1, width: 48, height: 32 },
            { name: 'Armors', x: 161, y: 1, width: 48, height: 32 },
            { name: 'Misc', x: 209, y: 1, width: 48, height: 32 },
            { name: 'Consumables', x: 257, y: 1, width: 96, height: 32 }
        ];

        // Get marketplace frame dimensions
        const frameCenterX = this.cameras.main.centerX;
        const frameCenterY = this.cameras.main.centerY;
        const frameWidth = this.marketplaceBg.width * marketplaceScale;
        const frameHeight = this.marketplaceBg.height * marketplaceScale;

        categories.forEach((cat, index) => {
            // Convert relative position to absolute
            const absoluteX = frameCenterX - (frameWidth / 2) + (cat.x * marketplaceScale) + (cat.width * marketplaceScale / 2);
            const absoluteY = frameCenterY - (frameHeight / 2) + (cat.y * marketplaceScale) + (cat.height * marketplaceScale / 2);

            // Create button
            const catName = cat.name.toLowerCase();
            const button = this.add.image(absoluteX, absoluteY, `btn-${catName}`);
            button.setOrigin(0.5);
            button.setScale(marketplaceScale);
            button.setInteractive({ useHandCursor: true });
            button.setDepth(200);

            // Click handler
            button.on('pointerdown', () => this.selectCategory(cat.name as any, index));

            // Hover effects
            button.on('pointerover', () => {
                if (this.selectedCategory !== cat.name) {
                    button.setScale(marketplaceScale * 1.05);
                }
                this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
            });
            button.on('pointerout', () => {
                button.setScale(marketplaceScale);
                this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
            });

            this.marketplaceButtons.push(button);
            this.marketplaceContainer.add(button);
        });

        // Select first button (Weapons) by default
        this.selectedCategory = 'Weapons';
        if (this.marketplaceButtons.length > 0 && this.marketplaceButtons[0] && this.marketplaceButtons[0].active) {
            this.marketplaceButtons[0].setTexture('btn-weapons-selected');
        }
        this.loadMarketplaceItems('Weapons');
    }

    private createMarketplaceSlots(marketplaceScale: number): void {
        const startX = 113;
        const startY = 33;
        const slotSize = 48;

        // Get marketplace frame dimensions
        const frameCenterX = this.cameras.main.centerX;
        const frameCenterY = this.cameras.main.centerY;
        const frameWidth = this.marketplaceBg.width * marketplaceScale;
        const frameHeight = this.marketplaceBg.height * marketplaceScale;

        for (let row = 0; row < this.MARKETPLACE_ROWS; row++) {
            for (let col = 0; col < this.MARKETPLACE_COLS; col++) {
                const relativeX = startX + (col * slotSize);
                const relativeY = startY + (row * slotSize);

                const absoluteX = frameCenterX - (frameWidth / 2) + (relativeX * marketplaceScale) + (slotSize * marketplaceScale / 2);
                const absoluteY = frameCenterY - (frameHeight / 2) + (relativeY * marketplaceScale) + (slotSize * marketplaceScale / 2);

                // Create slot
                const slotBg = this.add.image(absoluteX, absoluteY, 'slot');
                slotBg.setOrigin(0.5);
                slotBg.setScale(marketplaceScale);
                slotBg.setDepth(200);

                const slot: Slot = { bg: slotBg, x: absoluteX, y: absoluteY };
                this.marketplaceSlots.push(slot);
                this.marketplaceContainer.add(slotBg);

                // Make interactive (for buy/sell)
                slotBg.setInteractive();
                slotBg.on('pointerover', () => {
                    this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
                });
                slotBg.on('pointerout', () => {
                    this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
                });
                slotBg.on('pointerdown', () => this.handleMarketplaceSlotClick(row * this.MARKETPLACE_COLS + col));
            }
        }
    }

    private selectCategory(category: 'Weapons' | 'Armors' | 'Misc' | 'Consumables', index: number): void {
        this.selectedCategory = category;

        // Update button visuals
        const categoryNames = ['weapons', 'armors', 'misc', 'consumables'];
        this.marketplaceButtons.forEach((btn, i) => {
            const catName = categoryNames[i];
            if (i === index) {
                btn.setTexture(`btn-${catName}-selected`);
            } else {
                btn.setTexture(`btn-${catName}`);
            }
        });

        // Load items for selected category (placeholder for now)
        this.loadMarketplaceItems(category);
    }

    private createMarketplaceCloseButton(marketplaceScale: number): void {
        // Get marketplace frame dimensions
        const frameCenterX = this.cameras.main.centerX;
        const frameCenterY = this.cameras.main.centerY;
        const frameWidth = this.marketplaceBg.width * marketplaceScale;
        const frameHeight = this.marketplaceBg.height * marketplaceScale;

        // ADJUST CLOSE BUTTON POSITION HERE
        const closeOffsetX = -10; // Increase to move left, decrease to move right
        const closeOffsetY = 16; // Increase to move down, decrease to move up
        
        // Position close button at top-right corner
        const closeX = frameCenterX + (frameWidth / 2) - (closeOffsetX * marketplaceScale);
        const closeY = frameCenterY - (frameHeight / 2) + (closeOffsetY * marketplaceScale);

        const closeButton = this.add.text(closeX, closeY, 'X', {
            fontSize: `${24 * marketplaceScale}px`,
            color: '#ff0000',
            fontStyle: 'bold'
        });
        closeButton.setOrigin(0.5);
        closeButton.setDepth(300);
        closeButton.setInteractive({ useHandCursor: true });

        closeButton.on('pointerdown', () => {
            this.hideMarketplace();
        });

        closeButton.on('pointerover', () => {
            closeButton.setScale(1.2);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });

        closeButton.on('pointerout', () => {
            closeButton.setScale(1);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });

        this.marketplaceContainer.add(closeButton);
    }

    private createMarketplaceBuyButton(marketplaceScale: number): void {
        // Get marketplace frame dimensions
        const frameCenterX = this.cameras.main.centerX;
        const frameCenterY = this.cameras.main.centerY;
        const frameWidth = this.marketplaceBg.width * marketplaceScale;
        const frameHeight = this.marketplaceBg.height * marketplaceScale;

        // Buy button position (19, 280) from marketplace frame origin
        const buyX = frameCenterX - (frameWidth / 2) + (19 * marketplaceScale);
        const buyY = frameCenterY - (frameHeight / 2) + (280 * marketplaceScale);

        const buyButton = this.add.image(buyX, buyY, 'buy-button');
        buyButton.setOrigin(0, 0);
        buyButton.setScale(marketplaceScale);
        buyButton.setDepth(300);
        buyButton.setInteractive({ useHandCursor: true });

        buyButton.on('pointerdown', () => {
            console.log('Buy button clicked');
            // TODO: Implement buy logic
        });

        buyButton.on('pointerover', () => {
            buyButton.setScale(marketplaceScale * 1.1);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });

        buyButton.on('pointerout', () => {
            buyButton.setScale(marketplaceScale);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });

        this.marketplaceContainer.add(buyButton);
    }

    private createMarketplaceSellButton(): void {
        // Position after item bar (to the right)
        const itemBarX = this.cameras.main.centerX;
        const itemBarY = this.cameras.main.height - 60;
        
        // Calculate item bar width (8 slots * 48px + 7 gaps * 6px)
        const slotSize = 48;
        const spacing = 6;
        const itemBarWidth = (this.SLOT_COUNT * (slotSize + spacing)) - spacing;
        
        const sellX = itemBarX + (itemBarWidth / 2) + 20;
        const sellY = itemBarY;

        const sellButton = this.add.image(sellX, sellY, 'sell-button');
        sellButton.setOrigin(0, 0.5);
        sellButton.setDepth(26000); // Above item bar
        sellButton.setScrollFactor(0);
        sellButton.setInteractive({ useHandCursor: true });
        sellButton.setVisible(false); // Hidden by default, show when marketplace opens

        sellButton.on('pointerdown', () => {
            console.log('Sell button clicked');
            // TODO: Implement sell logic
        });

        sellButton.on('pointerover', () => {
            sellButton.setScale(1.1);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });

        sellButton.on('pointerout', () => {
            sellButton.setScale(1);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });

        this.#hudContainer.add(sellButton);
        
        // Store reference for show/hide
        this.marketplaceContainer.setData('sellButton', sellButton);
    }

    private loadMarketplaceItems(category: string): void {
        // Clear existing items
        this.marketplaceSlots.forEach(slot => {
            if (slot.itemImage) {
                slot.itemImage.destroy();
                slot.itemImage = undefined;
            }
            if (slot.countText) {
                slot.countText.destroy();
                slot.countText = undefined;
            }
            slot.itemId = undefined;
            slot.itemType = undefined;
        });

        // TODO: Load items based on category
        console.log(`Loading items for category: ${category}`);
    }

    private handleMarketplaceSlotClick(slotIndex: number): void {
        const slot = this.marketplaceSlots[slotIndex];
        if (slot && slot.itemId) {
            console.log(`Clicked marketplace slot ${slotIndex} with item: ${slot.itemId}`);
            // TODO: Implement buy logic
        }
    }

    public showMarketplace(): void {
        this.marketplaceVisible = true;
        this.marketplaceContainer.setVisible(true);
        this.marketplaceOverlay.setVisible(true);
        
        // Show sell button
        const sellButton = this.marketplaceContainer.getData('sellButton');
        if (sellButton) sellButton.setVisible(true);
        
        // Disable player movement
        const farmScene = this.scene.get(SCENE_KEYS.FARM) as any;
        if (farmScene && farmScene.player) {
            farmScene.player.setVelocity(0, 0);
        }
    }

    public hideMarketplace(): void {
        this.marketplaceVisible = false;
        this.marketplaceContainer.setVisible(false);
        this.marketplaceOverlay.setVisible(false);
        
        // Hide sell button
        const sellButton = this.marketplaceContainer.getData('sellButton');
        if (sellButton) sellButton.setVisible(false);
    }

    public isMarketplaceOpen(): boolean {
        return this.marketplaceVisible;
    }

    public isBackpackOpen(): boolean {
        return this.backpackVisible;
    }

    public toggleMarketplace(): void {
        if (this.marketplaceVisible) {
            this.hideMarketplace();
        } else {
            this.showMarketplace();
        }
    }

    private createSettingsButton(): void {
        const settingsButton = this.add.image(
            this.cameras.main.width - 50,
            50,
            'settings-button'
        );
        settingsButton.setScrollFactor(0);
        settingsButton.setDepth(100);
        settingsButton.setScale(1.0);
        settingsButton.setInteractive();

        settingsButton.on('pointerover', () => {
            settingsButton.setScale(1.1);
            this.input.setDefaultCursor('url(assets/ui/cursor-selection.png) 16 16, pointer');
        });

        settingsButton.on('pointerout', () => {
            settingsButton.setScale(1.0);
            this.input.setDefaultCursor('url(assets/ui/cursor-normal.png) 16 16, auto');
        });

        settingsButton.on('pointerdown', () => {
            console.log('Settings button clicked');
            // TODO: Open settings menu
        });

        this.#hudContainer.add(settingsButton);
    }
}