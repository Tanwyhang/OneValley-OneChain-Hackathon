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

    constructor() {
        super({
            key: SCENE_KEYS.UI,
            active: true
        });
    }

    public create(): void {
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

            this.slots.push({
                bg: slotBg,
                x: x,
                y: 0
            });
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
                this.toggleBackpack();
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

                this.backpackSlots.push({
                    bg: slotBg,
                    x: x,
                    y: y
                });
            }
        }
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
    }
}