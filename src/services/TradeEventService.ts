/**
 * Trade Event Service
 *
 * Handles real-time trade events, notifications, and UI updates
 * Integrates with the existing Phaser EventBus for game-wide communication.
 */

import { EventBus } from '../game/EventBus';
import {
  FrontendItem,
  TradeProposalFrontend,
  ItemMintedEvent,
  ItemTradedEvent,
  EscrowCreatedEvent,
  TradeCompletedEvent,
  EscrowCancelledEvent,
  EscrowedItemFrontend
} from '../types/onechain';

export interface TradeNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  action?: {
    label: string;
    callback: () => void;
  };
}

export interface TradeEventSubscription {
  id: string;
  eventType: string;
  callback: (data: any) => void;
  once?: boolean;
}

export interface TradingActivity {
  id: string;
  type: 'trade_proposal' | 'trade_completed' | 'trade_cancelled' | 'item_locked' | 'item_unlocked';
  timestamp: number;
  player: string;
  items: FrontendItem[];
  other_player?: string;
  details: string;
}

export class TradeEventService {
  private notifications: Map<string, TradeNotification> = new Map();
  private subscriptions: Map<string, TradeEventSubscription> = new Map();
  private activityLog: TradingActivity[] = [];
  private maxActivityLogSize = 100;
  private maxNotifications = 50;

  // WebSocket connection for real-time updates (optional)
  private wsConnection: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;

  constructor() {
    this.initializeEventHandlers();
    this.initializeWebSocket();
    this.startPeriodicCleanup();
  }

  /**
   * Initialize event handlers for the EventBus
   */
  private initializeEventHandlers() {
    // Listen to trade events from EventBus
    EventBus.on('trade-proposal-created', this.handleTradeProposalCreated.bind(this));
    EventBus.on('trade-proposal-accepted', this.handleTradeProposalAccepted.bind(this));
    EventBus.on('trade-proposal-cancelled', this.handleTradeProposalCancelled.bind(this));
    EventBus.on('trade-executed', this.handleTradeExecuted.bind(this));
    EventBus.on('trade-failed', this.handleTradeFailed.bind(this));
    EventBus.on('item-locked', this.handleItemLocked.bind(this));
    EventBus.on('item-unlocked', this.handleItemUnlocked.bind(this));
    EventBus.on('escrow-created', this.handleEscrowCreated.bind(this));
    EventBus.on('escrow-cancelled', this.handleEscrowCancelled.bind(this));

    // Listen to blockchain events (would come from OneChain SDK)
    EventBus.on('blockchain-event', this.handleBlockchainEvent.bind(this));

    // Listen to wallet events
    EventBus.on('wallet-connected', this.handleWalletConnected.bind(this));
    EventBus.on('wallet-disconnected', this.handleWalletDisconnected.bind(this));
  }

  /**
   * Initialize WebSocket connection for real-time updates
   */
  private initializeWebSocket() {
    if (typeof window === 'undefined') return;

    try {
      const wsUrl = process.env.NEXT_PUBLIC_TRADE_WS_URL || 'ws://localhost:8081/trades';
      this.wsConnection = new WebSocket(wsUrl);

      this.wsConnection.onopen = () => {
        console.log('Trade events WebSocket connected');
        this.reconnectAttempts = 0;
        this.addNotification({
          type: 'success',
          title: 'Real-time Trading Enabled',
          message: 'You will receive live updates for trade activities'
        });
      };

      this.wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.wsConnection.onclose = () => {
        console.log('Trade events WebSocket disconnected');
        this.attemptReconnect();
      };

      this.wsConnection.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.log('WebSocket not available, using event polling fallback');
    }
  }

  /**
   * Attempt to reconnect WebSocket
   */
  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting WebSocket reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      setTimeout(() => {
        this.initializeWebSocket();
      }, this.reconnectDelay);
    } else {
      console.log('Max reconnection attempts reached, using polling fallback');
      this.addNotification({
        type: 'warning',
        title: 'Real-time Updates Limited',
        message: 'Some updates may be delayed'
      });
    }
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(data: any) {
    switch (data.type) {
      case 'trade_proposal':
        this.handleRemoteTradeProposal(data.payload);
        break;
      case 'trade_update':
        this.handleTradeUpdate(data.payload);
        break;
      case 'market_update':
        this.handleMarketUpdate(data.payload);
        break;
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }

  /**
   * Event handlers for different trade events
   */

  private handleTradeProposalCreated(data: { proposal: TradeProposalFrontend; proposer: string }) {
    this.addActivity({
      type: 'trade_proposal',
      player: data.proposer,
      items: data.proposal.proposer_items,
      details: `Created new trade proposal offering ${data.proposal.proposer_items.length} items`
    });

    this.addNotification({
      type: 'info',
      title: 'Trade Proposal Created',
      message: `Your trade proposal has been posted successfully`,
      action: {
        label: 'View',
        callback: () => EventBus.emit('open-trade-proposals')
      }
    });

    // Broadcast to other players
    this.broadcastEvent('trade-proposal-created', data);
  }

  private handleTradeProposalAccepted(data: { proposal: TradeProposalFrontend; acceptor: string }) {
    this.addActivity({
      type: 'trade_completed',
      player: data.proposal.proposer,
      other_player: data.acceptor,
      items: [...data.proposal.proposer_items, ...data.proposal.requested_items],
      details: `Trade completed between ${data.proposal.proposer} and ${data.acceptor}`
    });

    this.addNotification({
      type: 'success',
      title: 'Trade Accepted!',
      message: `Your trade proposal was accepted by ${data.acceptor}`,
      action: {
        label: 'View Items',
        callback: () => EventBus.emit('open-inventory')
      }
    });
  }

  private handleTradeProposalCancelled(data: { proposalId: string; reason?: string }) {
    this.addNotification({
      type: 'warning',
      title: 'Trade Cancelled',
      message: data.reason || 'The trade proposal was cancelled'
    });
  }

  private handleTradeExecuted(data: { transactionDigest: string; playerItems: FrontendItem[]; partnerItems: FrontendItem[] }) {
    this.addActivity({
      type: 'trade_completed',
      player: 'current_player', // Would be actual player address
      items: [...data.playerItems, ...data.partnerItems],
      details: 'Trade executed successfully'
    });

    this.addNotification({
      type: 'success',
      title: 'Trade Completed!',
      message: 'Your items have been exchanged successfully'
    });

    // Refresh inventory
    EventBus.emit('refresh-inventory');
  }

  private handleTradeFailed(data: { error: string; reason?: string }) {
    this.addNotification({
      type: 'error',
      title: 'Trade Failed',
      message: data.error || 'The trade could not be completed'
    });
  }

  private handleItemLocked(data: { itemId: string; itemName: string }) {
    this.addActivity({
      type: 'item_locked',
      player: 'current_player',
      items: [], // Would include the locked item
      details: `${data.itemName} locked for trading`
    });

    this.addNotification({
      type: 'info',
      title: 'Item Locked',
      message: `${data.itemName} is now locked in an active trade`
    });
  }

  private handleItemUnlocked(data: { itemId: string; itemName: string }) {
    this.addActivity({
      type: 'item_unlocked',
      player: 'current_player',
      items: [], // Would include the unlocked item
      details: `${data.itemName} unlocked and returned to inventory`
    });

    // Refresh inventory
    EventBus.emit('refresh-inventory');
  }

  private handleEscrowCreated(data: { escrowId: string; itemId: string; recipient: string }) {
    this.addActivity({
      type: 'trade_proposal',
      player: 'current_player',
      items: [],
      other_player: data.recipient,
      details: `Escrow created for trade with ${data.recipient}`
    });
  }

  private handleEscrowCancelled(data: { escrowId: string; reason: string }) {
    this.addNotification({
      type: 'warning',
      title: 'Escrow Cancelled',
      message: `Trade escrow was cancelled: ${data.reason}`
    });
  }

  private handleBlockchainEvent(data: { eventType: string; eventData: any }) {
    switch (data.eventType) {
      case 'ItemMinted':
        this.handleItemMinted(data.eventData as ItemMintedEvent);
        break;
      case 'ItemTraded':
        this.handleItemTraded(data.eventData as ItemTradedEvent);
        break;
      case 'EscrowCreated':
        this.handleBlockchainEscrowCreated(data.eventData as EscrowCreatedEvent);
        break;
      case 'TradeCompleted':
        this.handleBlockchainTradeCompleted(data.eventData as TradeCompletedEvent);
        break;
      case 'EscrowCancelled':
        this.handleBlockchainEscrowCancelled(data.eventData as EscrowCancelledEvent);
        break;
    }
  }

  private handleItemMinted(event: ItemMintedEvent) {
    if (this.isCurrentUser(event.owner)) {
      this.addNotification({
        type: 'success',
        title: 'New Item Minted!',
        message: `You received ${event.name}`,
        action: {
          label: 'View Item',
          callback: () => EventBus.emit('open-inventory')
        }
      });
    }
  }

  private handleItemTraded(event: ItemTradedEvent) {
    if (this.isCurrentUser(event.to)) {
      this.addNotification({
        type: 'success',
        title: 'Item Received!',
        message: `You received a new item in a trade`
      });
    }
  }

  private handleBlockchainEscrowCreated(event: EscrowCreatedEvent) {
    this.addActivity({
      type: 'trade_proposal',
      player: event.sender,
      items: [],
      other_player: event.recipient,
      details: `Escrow created for item type ${event.item_type}`
    });
  }

  private handleBlockchainTradeCompleted(event: TradeCompletedEvent) {
    this.addActivity({
      type: 'trade_completed',
      player: event.trader_1,
      other_player: event.trader_2,
      items: [],
      details: `Trade completed between traders`
    });
  }

  private handleBlockchainEscrowCancelled(event: EscrowCancelledEvent) {
    this.addActivity({
      type: 'trade_cancelled',
      player: event.sender,
      items: [],
      details: `Escrow cancelled: ${event.reason}`
    });
  }

  private handleWalletConnected(data: { address: string }) {
    this.addNotification({
      type: 'success',
      title: 'Wallet Connected',
      message: `Connected to wallet ${data.address.substring(0, 6)}...${data.address.substring(data.address.length - 4)}`
    });

    // Request initial trade data
    EventBus.emit('request-trade-updates');
  }

  private handleWalletDisconnected() {
    this.addNotification({
      type: 'warning',
      title: 'Wallet Disconnected',
      message: 'Real-time trading updates are paused'
    });

    // Clear current user data
    this.clearUserData();
  }

  /**
   * Public API methods
   */

  /**
   * Subscribe to trade events
   */
  subscribe(eventType: string, callback: (data: any) => void, once = false): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const subscription: TradeEventSubscription = {
      id: subscriptionId,
      eventType,
      callback,
      once
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Also subscribe to EventBus for game-wide events
    EventBus.on(eventType, callback);

    return subscriptionId;
  }

  /**
   * Unsubscribe from trade events
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      EventBus.off(subscription.eventType, subscription.callback);
      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Get notifications
   */
  getNotifications(unreadOnly = false): TradeNotification[] {
    const notifications = Array.from(this.notifications.values())
      .sort((a, b) => b.timestamp - a.timestamp);

    return unreadOnly ? notifications.filter(n => !n.read) : notifications;
  }

  /**
   * Mark notification as read
   */
  markNotificationRead(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.read = true;
      this.notifications.set(notificationId, notification);
    }
  }

  /**
   * Mark all notifications as read
   */
  markAllNotificationsRead(): void {
    for (const [id, notification] of this.notifications.entries()) {
      notification.read = true;
      this.notifications.set(id, notification);
    }
  }

  /**
   * Get activity log
   */
  getActivityLog(limit?: number): TradingActivity[] {
    const activities = this.activityLog
      .sort((a, b) => b.timestamp - a.timestamp);

    return limit ? activities.slice(0, limit) : activities;
  }

  /**
   * Clear activity log
   */
  clearActivityLog(): void {
    this.activityLog = [];
  }

  /**
   * Broadcast event to WebSocket (if connected)
   */
  private broadcastEvent(eventType: string, data: any) {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify({
        type: eventType,
        payload: data,
        timestamp: Date.now()
      }));
    }
  }

  /**
   * Helper methods
   */

  private addNotification(notification: Omit<TradeNotification, 'id' | 'timestamp' | 'read'>) {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullNotification: TradeNotification = {
      ...notification,
      id,
      timestamp: Date.now(),
      read: false
    };

    this.notifications.set(id, fullNotification);

    // Limit notifications size
    if (this.notifications.size > this.maxNotifications) {
      const oldestId = Array.from(this.notifications.keys())[0];
      this.notifications.delete(oldestId);
    }

    // Emit notification event for UI
    EventBus.emit('new-notification', fullNotification);
  }

  private addActivity(activity: Omit<TradingActivity, 'id' | 'timestamp'>) {
    const fullActivity: TradingActivity = {
      ...activity,
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    this.activityLog.push(fullActivity);

    // Limit activity log size
    if (this.activityLog.length > this.maxActivityLogSize) {
      this.activityLog = this.activityLog.slice(-this.maxActivityLogSize);
    }

    // Emit activity event for UI
    EventBus.emit('new-activity', fullActivity);
  }

  private isCurrentUser(address: string): boolean {
    // This would check against the current wallet address
    // For now, return false (would be implemented with actual wallet integration)
    return false;
  }

  private handleRemoteTradeProposal(proposal: TradeProposalFrontend) {
    // Handle trade proposals from other players
    this.addNotification({
      type: 'info',
      title: 'New Trade Proposal',
      message: `${proposal.proposer} wants to trade with you`,
      action: {
        label: 'View',
        callback: () => EventBus.emit('open-trade-proposal', proposal.id)
      }
    });
  }

  private handleTradeUpdate(update: { proposalId: string; status: string }) {
    // Handle updates to existing trade proposals
    if (update.status === 'completed') {
      this.addNotification({
        type: 'success',
        title: 'Trade Completed',
        message: 'One of your active trades has been completed'
      });
    } else if (update.status === 'cancelled') {
      this.addNotification({
        type: 'warning',
        title: 'Trade Cancelled',
        message: 'One of your active trades has been cancelled'
      });
    }
  }

  private handleMarketUpdate(update: any) {
    // Handle market-wide updates (price changes, new items, etc.)
    this.addNotification({
      type: 'info',
      title: 'Market Update',
      message: 'Trading market has been updated'
    });
  }

  private clearUserData() {
    // Clear user-specific data when wallet disconnects
    this.activityLog = this.activityLog.filter(activity =>
      activity.player !== 'current_player'
    );
  }

  private startPeriodicCleanup() {
    // Clean up old notifications and expired data periodically
    setInterval(() => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      // Clean old notifications
      for (const [id, notification] of this.notifications.entries()) {
        if (now - notification.timestamp > maxAge) {
          this.notifications.delete(id);
        }
      }

      // Clean old activity
      this.activityLog = this.activityLog.filter(activity =>
        now - activity.timestamp <= maxAge
      );
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Get trade event statistics
   */
  getEventStats(): {
    totalNotifications: number;
    unreadNotifications: number;
    totalActivities: number;
    activeSubscriptions: number;
  } {
    const notifications = Array.from(this.notifications.values());
    const unreadCount = notifications.filter(n => !n.read).length;

    return {
      totalNotifications: notifications.length,
      unreadNotifications: unreadCount,
      totalActivities: this.activityLog.length,
      activeSubscriptions: this.subscriptions.size
    };
  }

  /**
   * Cleanup service
   */
  cleanup() {
    // Close WebSocket connection
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }

    // Unsubscribe all EventBus events
    for (const subscription of this.subscriptions.values()) {
      EventBus.off(subscription.eventType, subscription.callback);
    }

    this.subscriptions.clear();
    this.notifications.clear();
    this.activityLog = [];
  }
}