import { Scene } from 'phaser';
import { EventBus } from '../EventBus';

interface WorldData {
    name: string;
    thumbnail: string;
    mapKey: string;
}

interface FriendData {
    name: string;
    status: string;
    thumbnail: string;
}

export class WorldSelectionScene extends Scene {
    private selectedTab: 'friends' | 'worlds' = 'worlds';
    private worldCards: Phaser.GameObjects.Container[] = [];
    private searchText: Phaser.GameObjects.Text | null = null;
    private searchInput: string = '';
    private selectedCardIndex: number = 0;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: {
        up: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        left: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key;
    };
    private enterKey!: Phaser.Input.Keyboard.Key;
    private friendsTab!: Phaser.GameObjects.Container;
    private worldsTab!: Phaser.GameObjects.Container;

    private allWorlds: WorldData[] = [
        { name: "YOUR FARM", thumbnail: 'farm_map', mapKey: 'FarmScene' },
        { name: "SUNNY FARM", thumbnail: 'farm_map', mapKey: 'FarmScene' },
        { name: "GREEN FARM", thumbnail: 'farm_map', mapKey: 'FarmScene' },
        { name: "VALLEY FARM", thumbnail: 'farm_map', mapKey: 'FarmScene' },
        { name: "HILL FARM", thumbnail: 'farm_map', mapKey: 'FarmScene' },
        { name: "RIVER FARM", thumbnail: 'farm_map', mapKey: 'FarmScene' },
        { name: "FOREST FARM", thumbnail: 'farm_map', mapKey: 'FarmScene' },
        { name: "MEADOW FARM", thumbnail: 'farm_map', mapKey: 'FarmScene' },
        { name: "SUNSET FARM", thumbnail: 'farm_map', mapKey: 'FarmScene' },
        { name: "MAPLE FARM", thumbnail: 'farm_map', mapKey: 'FarmScene' },
        { name: "SPRING FARM", thumbnail: 'farm_map', mapKey: 'FarmScene' },
        { name: "AUTUMN FARM", thumbnail: 'farm_map', mapKey: 'FarmScene' },
        { name: "WINTER FARM", thumbnail: 'farm_map', mapKey: 'FarmScene' },
        { name: "SUMMER FARM", thumbnail: 'farm_map', mapKey: 'FarmScene' },
        { name: "MOON FARM", thumbnail: 'farm_map', mapKey: 'FarmScene' },
    ];

    private friends: FriendData[] = [
        { name: "ALEX", status: "ONLINE", thumbnail: 'farm_thumbnail' },
        { name: "EMMA", status: "OFFLINE", thumbnail: 'farm_thumbnail' },
        { name: "JACK", status: "ONLINE", thumbnail: 'farm_thumbnail' },
        { name: "LILY", status: "ONLINE", thumbnail: 'farm_thumbnail' },
        { name: "MAX", status: "OFFLINE", thumbnail: 'farm_thumbnail' },
        { name: "SOPHIE", status: "ONLINE", thumbnail: 'farm_thumbnail' },
        { name: "NOAH", status: "OFFLINE", thumbnail: 'farm_thumbnail' },
        { name: "MIA", status: "ONLINE", thumbnail: 'farm_thumbnail' },
    ];

    private worlds: WorldData[] = [];
    private filteredData: (WorldData | FriendData)[] = [];

    constructor() {
        super('WorldSelectionScene');
    }

    preload() {
        this.load.setPath('assets');
        
        // Load the login menu background
        this.load.image('menu_bg', 'bg.webp');
        
        // Load farm example image for all cards
        this.load.image('farm_thumbnail', 'farm_eg.webp');
        
        // Debug: Check if image loaded
        this.load.on('filecomplete', (key: string) => {
            if (key === 'farm_thumbnail') {
                console.log('Farm thumbnail loaded successfully!');
            }
        });
        
        this.load.on('filecompletefailed', (key: string) => {
            if (key === 'farm_thumbnail') {
                console.error('Failed to load farm thumbnail!');
            }
        });
    }

    create() {
        this.worlds = [...this.allWorlds];
        this.filteredData = this.selectedTab === 'worlds' ? this.worlds : this.friends;
        
        this.cameras.main.fadeIn(500, 0, 0, 0);
        
        this.createBackground();
        this.createHeader();
        this.createSearchBar();
        this.createWorldGrid();
        this.setupKeyboard();
        this.updateCardSelection();
        
        EventBus.emit('current-scene-ready', this);
    }

    private setupKeyboard(): void {
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = {
            up: this.input.keyboard!.addKey('W'),
            down: this.input.keyboard!.addKey('S'),
            left: this.input.keyboard!.addKey('A'),
            right: this.input.keyboard!.addKey('D')
        };
        this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        this.cursors.left.on('down', () => this.moveSelection(-1, 0));
        this.cursors.right.on('down', () => this.moveSelection(1, 0));
        this.cursors.up.on('down', () => this.moveSelection(0, -1));
        this.cursors.down.on('down', () => this.moveSelection(0, 1));
        
        this.wasd.left.on('down', () => this.moveSelection(-1, 0));
        this.wasd.right.on('down', () => this.moveSelection(1, 0));
        this.wasd.up.on('down', () => this.moveSelection(0, -1));
        this.wasd.down.on('down', () => this.moveSelection(0, 1));
        
        this.enterKey.on('down', () => this.selectCurrentCard());

        this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Backspace') {
                this.searchInput = this.searchInput.slice(0, -1);
                this.updateSearch();
            } else if (event.key.length === 1 && /[a-zA-Z0-9 ]/.test(event.key)) {
                this.searchInput += event.key.toUpperCase();
                this.updateSearch();
            }
        });
    }

    private moveSelection(dx: number, dy: number): void {
        const cols = 5;
        const currentRow = Math.floor(this.selectedCardIndex / cols);
        const currentCol = this.selectedCardIndex % cols;
        
        const newCol = Phaser.Math.Clamp(currentCol + dx, 0, cols - 1);
        const newRow = currentRow + dy;
        const newIndex = newRow * cols + newCol;
        
        if (newIndex >= 0 && newIndex < this.worldCards.length) {
            this.selectedCardIndex = newIndex;
            this.updateCardSelection();
        }
    }

    private updateCardSelection(): void {
        this.worldCards.forEach((card, index) => {
            const isSelected = index === this.selectedCardIndex;
            
            const selectionGlow = (card as any).selectionGlow;
            if (selectionGlow) {
                selectionGlow.destroy();
                (card as any).selectionGlow = null;
            }
            
            if (isSelected) {
                const size = 140;
                const glow = this.add.graphics();
                glow.lineStyle(4, 0xFF6B35, 1);
                glow.strokeRect(-size / 2 - 3, -size / 2 - 3, size + 6, size + 6);
                card.addAt(glow, 0);
                (card as any).selectionGlow = glow;
            }
        });
    }

    private selectCurrentCard(): void {
        if (this.worldCards[this.selectedCardIndex]) {
            const data = this.filteredData[this.selectedCardIndex];
            if (this.selectedTab === 'worlds') {
                this.enterWorld(data as WorldData);
            } else {
                console.log(`Visiting friend: ${(data as FriendData).name}`);
            }
        }
    }

    private updateSearch(): void {
        if (this.searchText) {
            this.searchText.setText(this.searchInput || 'SEARCH…');
            this.searchText.setColor(this.searchInput ? '#000000' : '#999999');
        }
        
        const query = this.searchInput.toLowerCase();
        if (this.selectedTab === 'worlds') {
            this.filteredData = query ? this.allWorlds.filter(w => w.name.toLowerCase().includes(query)) : this.allWorlds;
        } else {
            this.filteredData = query ? this.friends.filter(f => f.name.toLowerCase().includes(query)) : this.friends;
        }
        
        this.selectedCardIndex = 0;
        this.refreshGrid();
    }

    private refreshGrid(): void {
        this.worldCards.forEach(card => card.destroy());
        this.worldCards = [];
        this.createWorldGrid();
        this.updateCardSelection();
    }

    private createBackground(): void {
        const { width, height } = this.cameras.main;
        
        const bg = this.add.image(width / 2, height / 2, 'menu_bg');
        
        const scaleX = width / bg.width;
        const scaleY = height / bg.height;
        const scale = Math.max(scaleX, scaleY);
        bg.setScale(scale);
        
        // Animated overlay with pulsing effect
        const overlay = this.add.graphics();
        overlay.fillStyle(0x2C1810, 0.4);
        overlay.fillRect(0, 0, width, height);
        
        this.tweens.add({
            targets: overlay,
            alpha: { from: 0.4, to: 0.6 },
            duration: 3000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Enhanced vignette
        const vignette = this.add.graphics();
        vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.5, 0, 0, 0.5);
        vignette.fillRect(0, 0, width, 80);
        vignette.fillRect(0, height - 80, width, 80);
        vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.4, 0.4, 0);
        vignette.fillRect(0, 80, 100, height - 160);
        vignette.fillRect(width - 100, 80, 100, height - 160);
        
        // Floating particles
        const particles = this.add.particles(0, 0, 'farm_thumbnail', {
            x: { min: 0, max: width },
            y: { min: 0, max: height },
            scale: { start: 0.02, end: 0 },
            alpha: { start: 0.6, end: 0 },
            speed: { min: 10, max: 30 },
            lifespan: 4000,
            frequency: 300,
            blendMode: 'ADD',
            tint: 0xFFD700
        });
        particles.setDepth(-1);
    }

    private createHeader(): void {
        const { width } = this.cameras.main;
        const centerX = width / 2;
        const headerY = 80;
        
        // Tab dimensions
        const tabWidth = 180;
        const tabHeight = 50;
        const tabSpacing = 20;
        
        this.friendsTab = this.createTab(
            centerX - tabWidth / 2 - tabSpacing / 2,
            headerY,
            tabWidth,
            tabHeight,
            'FRIENDS',
            this.selectedTab === 'friends'
        );
        this.friendsTab.setSize(tabWidth, tabHeight);
        this.friendsTab.setInteractive(new Phaser.Geom.Rectangle(-tabWidth / 2, -tabHeight / 2, tabWidth, tabHeight), Phaser.Geom.Rectangle.Contains);
        this.friendsTab.input!.cursor = 'pointer';
        this.friendsTab.on('pointerdown', () => this.switchTab('friends'));
        
        this.worldsTab = this.createTab(
            centerX + tabWidth / 2 + tabSpacing / 2,
            headerY,
            tabWidth,
            tabHeight,
            'WORLDS',
            this.selectedTab === 'worlds'
        );
        this.worldsTab.setSize(tabWidth, tabHeight);
        this.worldsTab.setInteractive(new Phaser.Geom.Rectangle(-tabWidth / 2, -tabHeight / 2, tabWidth, tabHeight), Phaser.Geom.Rectangle.Contains);
        this.worldsTab.input!.cursor = 'pointer';
        this.worldsTab.on('pointerdown', () => this.switchTab('worlds'));
    }

    private createTab(
        x: number,
        y: number,
        width: number,
        height: number,
        label: string,
        isActive: boolean
    ): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        
        const graphics = this.add.graphics();
        const fillColor = isActive ? 0x8B4513 : 0xD2B48C; // Dark brown if active, tan otherwise
        const borderColor = isActive ? 0x5C2E0A : 0xA0826D;
        
        graphics.fillStyle(fillColor, 1);
        graphics.lineStyle(4, borderColor, 1);
        
        graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
        graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
        
        // Add inner highlight for 3D effect
        if (isActive) {
            const highlight = this.add.graphics();
            highlight.lineStyle(2, 0xD2691E, 0.5);
            highlight.strokeRoundedRect(-width / 2 + 3, -height / 2 + 3, width - 6, height - 6, 6);
            container.add(highlight);
        }
        
        const text = this.add.text(0, 0, label, {
            fontFamily: '"Press Start 2P", system-ui, -apple-system, sans-serif',
            fontSize: '16px',
            color: isActive ? '#FFE4B5' : '#5C4033',
            resolution: 1
        }).setOrigin(0.5);
        
        container.add([graphics, text]);
        return container;
    }

    private createSearchBar(): void {
        const { width } = this.cameras.main;
        const centerX = width / 2;
        const searchY = 170;
        
        const searchWidth = 500;
        const searchHeight = 45;
        
        const graphics = this.add.graphics();
        graphics.fillStyle(0xFFFAF0, 1); // Floral white
        graphics.lineStyle(3, 0x8B7355, 1); // Brown border
        graphics.fillRoundedRect(centerX - searchWidth / 2, searchY - searchHeight / 2, searchWidth, searchHeight, 10);
        graphics.strokeRoundedRect(centerX - searchWidth / 2, searchY - searchHeight / 2, searchWidth, searchHeight, 10);
        
        // Inner shadow effect
        const innerShadow = this.add.graphics();
        innerShadow.lineStyle(2, 0xD2B48C, 0.5);
        innerShadow.strokeRoundedRect(centerX - searchWidth / 2 + 2, searchY - searchHeight / 2 + 2, searchWidth - 4, searchHeight - 4, 8);
        
        this.searchText = this.add.text(centerX - searchWidth / 2 + 15, searchY, 'SEARCH…', {
            fontFamily: '"Press Start 2P", system-ui, -apple-system, sans-serif',
            fontSize: '14px',
            color: '#A0826D',
            resolution: 1
        }).setOrigin(0, 0.5);
    }

    private createWorldGrid(): void {
        const { width, height } = this.cameras.main;
        const centerX = width / 2;
        const startY = 240;
        
        // Grid configuration - 5 columns, 3 rows
        const cols = 5;
        const rows = 3;
        const cardSize = 140;
        const cardSpacing = 18;
        
        // Calculate starting position to center the grid
        const totalWidth = cols * cardSize + (cols - 1) * cardSpacing;
        const startX = centerX - totalWidth / 2;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const index = row * cols + col;
                if (index < this.filteredData.length) {
                    const x = startX + col * (cardSize + cardSpacing) + cardSize / 2;
                    const y = startY + row * (cardSize + cardSpacing) + cardSize / 2;
                    
                    const card = this.selectedTab === 'worlds' 
                        ? this.createWorldCard(x, y, cardSize, this.filteredData[index] as WorldData)
                        : this.createFriendCard(x, y, cardSize, this.filteredData[index] as FriendData);
                    this.worldCards.push(card);
                    
                    // Staggered fade-in with bounce
                    card.setAlpha(0);
                    card.setScale(0);
                    this.tweens.add({
                        targets: card,
                        alpha: 1,
                        scale: 1,
                        duration: 400,
                        delay: index * 50,
                        ease: 'Back.easeOut'
                    });
                    
                    // Floating effect
                    this.tweens.add({
                        targets: card,
                        y: card.y - 8,
                        duration: 2000 + index * 100,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            }
        }
    }

    private createWorldCard(
        x: number,
        y: number,
        size: number,
        worldData: WorldData
    ): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.5);
        shadow.fillRect(-size / 2 + 5, -size / 2 + 5, size, size);
        
        const border = this.add.graphics();
        border.fillStyle(0xF5DEB3, 1); // Wheat color
        border.lineStyle(5, 0x6B4423, 1); // Darker brown border
        border.fillRoundedRect(-size / 2, -size / 2, size, size, 12);
        border.strokeRoundedRect(-size / 2, -size / 2, size, size, 12);
        
        const highlight = this.add.graphics();
        highlight.lineStyle(2, 0xFFE4B5, 1);
        highlight.beginPath();
        highlight.moveTo(-size / 2 + 5, size / 2 - 5);
        highlight.lineTo(-size / 2 + 5, -size / 2 + 5);
        highlight.lineTo(size / 2 - 5, -size / 2 + 5);
        highlight.strokePath();
        
        const innerShadow = this.add.graphics();
        innerShadow.lineStyle(2, 0x4A2C1A, 1);
        innerShadow.beginPath();
        innerShadow.moveTo(size / 2 - 5, -size / 2 + 5);
        innerShadow.lineTo(size / 2 - 5, size / 2 - 5);
        innerShadow.lineTo(-size / 2 + 5, size / 2 - 5);
        innerShadow.strokePath();
        
        // Thumbnail area with farm image
        const thumbnailHeight = size * 0.65;
        const thumbnailWidth = size - 24;
        
        // Create background for thumbnail area first
        const thumbnailBg = this.add.graphics();
        thumbnailBg.fillStyle(0xF5DEB3, 0.5); // Light background
        thumbnailBg.fillRect(-size / 2 + 12, -size / 2 + 12, thumbnailWidth, thumbnailHeight - 12);
        
        // Add the farm image
        const farmImage = this.add.image(0, -size / 2 + 12 + (thumbnailHeight - 12) / 2, 'farm_thumbnail');
        
        if (this.textures.exists('farm_thumbnail')) {
            console.log('Farm thumbnail loaded, dimensions:', farmImage.width, farmImage.height);
            
            // Scale the image to fit the thumbnail area while maintaining aspect ratio
            const scaleX = thumbnailWidth / farmImage.width;
            const scaleY = (thumbnailHeight - 12) / farmImage.height;
            const scale = Math.min(scaleX, scaleY);
            farmImage.setScale(scale);
            
            console.log('Applied scale:', scale, 'Final size:', farmImage.displayWidth, farmImage.displayHeight);
        } else {
            console.error('Farm thumbnail texture does not exist!');
        }
        
        // Add pixel grid pattern overlay on thumbnail
        const gridSize = 8;
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x000000, 0.1);
        for (let i = 0; i < size - 24; i += gridSize) {
            grid.lineBetween(-size / 2 + 12 + i, -size / 2 + 12, -size / 2 + 12 + i, -size / 2 + thumbnailHeight);
            grid.lineBetween(-size / 2 + 12, -size / 2 + 12 + i, size / 2 - 12, -size / 2 + 12 + i);
        }
        
        const nameBarHeight = size * 0.35;
        const nameBar = this.add.graphics();
        
        nameBar.fillStyle(0x8B4513, 1); // Saddle brown
        nameBar.fillRect(-size / 2, size / 2 - nameBarHeight, size, nameBarHeight);
        
        nameBar.fillStyle(0xA0522D, 1); // Sienna highlight
        nameBar.fillRect(-size / 2, size / 2 - nameBarHeight, size, 3);
        
        const corners = this.add.graphics();
        corners.fillStyle(0xFFD700, 1);
        corners.fillRect(-size / 2 + 8, size / 2 - nameBarHeight + 8, 4, 4);
        corners.fillRect(size / 2 - 12, size / 2 - nameBarHeight + 8, 4, 4);
        corners.fillRect(-size / 2 + 8, size / 2 - 12, 4, 4);
        corners.fillRect(size / 2 - 12, size / 2 - 12, 4, 4);
        
        const shadowText = this.add.text(2, size / 2 - nameBarHeight / 2 + 2, worldData.name, {
            fontFamily: '"Press Start 2P", system-ui, -apple-system, sans-serif',
            fontSize: '11px',
            color: '#000000',
            align: 'center',
            wordWrap: { width: size - 24 },
            stroke: '#000000',
            strokeThickness: 2,
            resolution: 1
        }).setOrigin(0.5);
        
        const nameText = this.add.text(0, size / 2 - nameBarHeight / 2, worldData.name, {
            fontFamily: '"Press Start 2P", system-ui, -apple-system, sans-serif',
            fontSize: '11px',
            color: '#FFFFFF',
            align: 'center',
            wordWrap: { width: size - 24 },
            stroke: '#5C2E0A',
            strokeThickness: 3,
            shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true },
            resolution: 1
        }).setOrigin(0.5);
        
        container.add([shadow, border, highlight, innerShadow, thumbnailBg, farmImage, grid, nameBar, corners, shadowText, nameText]);
        
        container.setSize(size, size);
        container.setInteractive(new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size), Phaser.Geom.Rectangle.Contains);
        container.input!.cursor = 'pointer';
        
        // Hover effects
        container.on('pointerover', () => {
            this.tweens.add({
                targets: container,
                scale: 1.1,
                duration: 200,
                ease: 'Power2'
            });
        });
        
        container.on('pointerout', () => {
            this.tweens.add({
                targets: container,
                scale: 1,
                duration: 200,
                ease: 'Power2'
            });
        });
        
        container.on('pointerdown', () => {
            this.tweens.add({
                targets: container,
                scale: 0.95,
                duration: 100,
                yoyo: true,
                onComplete: () => this.enterWorld(worldData)
            });
        });
        
        return container;
    }

    private createFriendCard(
        x: number,
        y: number,
        size: number,
        friendData: FriendData
    ): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.5);
        shadow.fillRect(-size / 2 + 5, -size / 2 + 5, size, size);
        
        const border = this.add.graphics();
        border.fillStyle(0xF5DEB3, 1);
        border.lineStyle(5, 0x6B4423, 1);
        border.fillRoundedRect(-size / 2, -size / 2, size, size, 12);
        border.strokeRoundedRect(-size / 2, -size / 2, size, size, 12);
        
        const thumbnailHeight = size * 0.65;
        const thumbnailWidth = size - 24;
        
        const thumbnailBg = this.add.graphics();
        thumbnailBg.fillStyle(0xF5DEB3, 0.5);
        thumbnailBg.fillRect(-size / 2 + 12, -size / 2 + 12, thumbnailWidth, thumbnailHeight - 12);
        
        const farmImage = this.add.image(0, -size / 2 + 12 + (thumbnailHeight - 12) / 2, 'farm_thumbnail');
        if (this.textures.exists('farm_thumbnail')) {
            const scaleX = thumbnailWidth / farmImage.width;
            const scaleY = (thumbnailHeight - 12) / farmImage.height;
            farmImage.setScale(Math.min(scaleX, scaleY));
        }
        
        const nameBarHeight = size * 0.35;
        const nameBar = this.add.graphics();
        const statusColor = friendData.status === 'ONLINE' ? 0x228B22 : 0x696969; // Forest green or dim gray
        nameBar.fillStyle(statusColor, 1);
        nameBar.fillRect(-size / 2, size / 2 - nameBarHeight, size, nameBarHeight);
        
        // Add highlight bar
        const highlightBar = this.add.graphics();
        const highlightColor = friendData.status === 'ONLINE' ? 0x32CD32 : 0x808080;
        highlightBar.fillStyle(highlightColor, 1);
        highlightBar.fillRect(-size / 2, size / 2 - nameBarHeight, size, 3);
        
        const nameText = this.add.text(0, size / 2 - nameBarHeight / 2 + 5, friendData.name, {
            fontFamily: '"Press Start 2P", system-ui, -apple-system, sans-serif',
            fontSize: '11px',
            color: '#FFFFFF',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3,
            shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true },
            resolution: 1
        }).setOrigin(0.5);
        
        const statusText = this.add.text(0, size / 2 - nameBarHeight / 2 - 10, friendData.status, {
            fontFamily: '"Press Start 2P", system-ui, -apple-system, sans-serif',
            fontSize: '8px',
            color: '#FFE4B5',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 2,
            resolution: 1
        }).setOrigin(0.5);
        
        container.add([shadow, border, thumbnailBg, farmImage, nameBar, highlightBar, nameText, statusText]);
        
        container.setSize(size, size);
        container.setInteractive(new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size), Phaser.Geom.Rectangle.Contains);
        container.input!.cursor = 'pointer';
        
        // Hover effects
        container.on('pointerover', () => {
            this.tweens.add({
                targets: container,
                scale: 1.1,
                duration: 200,
                ease: 'Power2'
            });
        });
        
        container.on('pointerout', () => {
            this.tweens.add({
                targets: container,
                scale: 1,
                duration: 200,
                ease: 'Power2'
            });
        });
        
        container.on('pointerdown', () => {
            this.tweens.add({
                targets: container,
                scale: 0.95,
                duration: 100,
                yoyo: true,
                onComplete: () => console.log(`Visiting friend: ${friendData.name}`)
            });
        });
        
        return container;
    }

    private switchTab(tab: 'friends' | 'worlds'): void {
        if (this.selectedTab === tab) return;
        
        this.selectedTab = tab;
        this.searchInput = '';
        this.filteredData = tab === 'worlds' ? this.allWorlds : this.friends;
        this.selectedCardIndex = 0;
        
        this.friendsTab.destroy();
        this.worldsTab.destroy();
        if (this.searchText) this.searchText.destroy();
        
        this.createHeader();
        this.createSearchBar();
        this.refreshGrid();
    }

    private enterWorld(worldData: WorldData): void {
        console.log(`Entering world: ${worldData.name}`);
        
        // Fade out and transition to the selected world scene
        this.cameras.main.fadeOut(500, 0, 0, 0);
        
        this.cameras.main.once('camerafadeoutcomplete', () => {
            if (worldData.mapKey === 'FarmScene') {
                this.scene.start('FarmScene');
            } else {
                console.log(`Scene ${worldData.mapKey} not implemented yet`);
                this.cameras.main.fadeIn(500, 0, 0, 0);
            }
        });
    }
}
