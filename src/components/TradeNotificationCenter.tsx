/**
 * Trade Notification Center React Component
 *
 * Provides real-time notifications and activity feed for trading events.
 * Integrates with the TradeEventService to display trade updates.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { TradeEventService } from '../services/TradeEventService';
import { TradeNotification, TradingActivity } from '../services/TradeEventService';

interface TradeNotificationCenterProps {
  tradeEventService: TradeEventService;
  className?: string;
  maxNotifications?: number;
  maxActivities?: number;
}

interface NotificationToast extends TradeNotification {
  isVisible: boolean;
  isClosing: boolean;
}

export const TradeNotificationCenter: React.FC<TradeNotificationCenterProps> = ({
  tradeEventService,
  className = '',
  maxNotifications = 5,
  maxActivities = 20
}) => {
  const [notifications, setNotifications] = useState<NotificationToast[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activities, setActivities] = useState<TradingActivity[]>([]);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'notifications' | 'activity'>('notifications');

  // Subscribe to new notifications
  useEffect(() => {
    const subscriptionId = tradeEventService.subscribe('new-notification', (notification: TradeNotification) => {
      const toast: NotificationToast = {
        ...notification,
        isVisible: true,
        isClosing: false
      };

      setNotifications(prev => [toast, ...prev].slice(0, maxNotifications));
      setUnreadCount(prev => prev + 1);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        dismissNotification(notification.id);
      }, 5000);
    });

    return () => {
      tradeEventService.unsubscribe(subscriptionId);
    };
  }, [tradeEventService, maxNotifications]);

  // Subscribe to new activities
  useEffect(() => {
    const subscriptionId = tradeEventService.subscribe('new-activity', (activity: TradingActivity) => {
      setActivities(prev => [activity, ...prev].slice(0, maxActivities));
    });

    return () => {
      tradeEventService.unsubscribe(subscriptionId);
    };
  }, [tradeEventService, maxActivities]);

  // Load initial data
  useEffect(() => {
    const initialNotifications = tradeEventService.getNotifications();
    const initialUnread = initialNotifications.filter(n => !n.read).length;

    setNotifications(
      initialNotifications.slice(0, maxNotifications).map(n => ({
        ...n,
        isVisible: false,
        isClosing: false
      }))
    );
    setUnreadCount(initialUnread);
    setActivities(tradeEventService.getActivityLog(maxActivities));
  }, [tradeEventService, maxNotifications, maxActivities]);

  // Dismiss notification
  const dismissNotification = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId
          ? { ...n, isClosing: true }
          : n
      )
    );

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    }, 300);
  }, []);

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    tradeEventService.markNotificationRead(notificationId);
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [tradeEventService]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    tradeEventService.markAllNotificationsRead();
    setUnreadCount(0);
  }, [tradeEventService]);

  // Get notification icon based on type
  const getNotificationIcon = (type: TradeNotification['type']) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  // Get activity icon based on type
  const getActivityIcon = (type: TradingActivity['type']) => {
    switch (type) {
      case 'trade_proposal':
        return '📋';
      case 'trade_completed':
        return '✅';
      case 'trade_cancelled':
        return '❌';
      case 'item_locked':
        return '🔒';
      case 'item_unlocked':
        return '🔓';
      default:
        return '📄';
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) {
      return 'Just now';
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}m ago`;
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}h ago`;
    } else {
      return new Date(timestamp).toLocaleDateString();
    }
  };

  return (
    <div className={`trade-notification-center ${className}`}>
      {/* Notification Bell */}
      <button
        className="notification-bell"
        onClick={() => setIsNotificationCenterOpen(!isNotificationCenterOpen)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '4px'
        }}
      >
        <span style={{ fontSize: '20px' }}>🔔</span>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '0',
              right: '0',
              background: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Toast Notifications */}
      <div className="notification-toasts">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`notification-toast ${notification.isClosing ? 'closing' : ''}`}
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              background: notification.type === 'error' ? '#fee2e2' :
                         notification.type === 'warning' ? '#fef3c7' :
                         notification.type === 'success' ? '#d1fae5' : '#dbeafe',
              border: `1px solid ${
                notification.type === 'error' ? '#fca5a5' :
                notification.type === 'warning' ? '#fde68a' :
                notification.type === 'success' ? '#a7f3d0' : '#93c5fd'
              }`,
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '8px',
              minWidth: '300px',
              maxWidth: '400px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transform: notification.isVisible ? 'translateX(0)' : 'translateX(100%)',
              opacity: notification.isClosing ? 0 : 1,
              transition: 'all 0.3s ease-in-out'
            }}
          >
            <span style={{ fontSize: '18px' }}>
              {getNotificationIcon(notification.type)}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                {notification.title}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                {notification.message}
              </div>
              {notification.action && (
                <button
                  onClick={notification.action.callback}
                  style={{
                    marginTop: '8px',
                    padding: '4px 8px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {notification.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => dismissNotification(notification.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: '#6b7280'
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Notification Center Panel */}
      {isNotificationCenterOpen && (
        <div
          className="notification-center-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'flex-start'
          }}
          onClick={() => setIsNotificationCenterOpen(false)}
        >
          <div
            className="notification-center-panel"
            style={{
              width: '400px',
              height: '100vh',
              background: 'white',
              boxShadow: '-4px 0 6px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                {activeTab === 'notifications' ? 'Notifications' : 'Activity'}
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {activeTab === 'notifications' && unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    style={{
                      padding: '6px 12px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Mark All Read
                  </button>
                )}
                <button
                  onClick={() => setIsNotificationCenterOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <button
                onClick={() => setActiveTab('notifications')}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: activeTab === 'notifications' ? '#f3f4f6' : 'white',
                  border: 'none',
                  borderBottom: activeTab === 'notifications' ? '2px solid #3b82f6' : 'none',
                  cursor: 'pointer'
                }}
              >
                Notifications {unreadCount > 0 && `(${unreadCount})`}
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: activeTab === 'activity' ? '#f3f4f6' : 'white',
                  border: 'none',
                  borderBottom: activeTab === 'activity' ? '2px solid #3b82f6' : 'none',
                  cursor: 'pointer'
                }}
              >
                Activity
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {activeTab === 'notifications' ? (
                <div>
                  {notifications.length === 0 ? (
                    <div style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: '#6b7280'
                    }}>
                      No notifications
                    </div>
                  ) : (
                    notifications.map(notification => (
                      <div
                        key={notification.id}
                        className={`notification-item ${!notification.read ? 'unread' : ''}`}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #f3f4f6',
                          cursor: 'pointer',
                          background: !notification.read ? '#fef3c7' : 'white'
                        }}
                        onClick={() => markAsRead(notification.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <span style={{ fontSize: '16px', marginTop: '2px' }}>
                            {getNotificationIcon(notification.type)}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontWeight: !notification.read ? 'bold' : 'normal',
                              marginBottom: '4px'
                            }}>
                              {notification.title}
                            </div>
                            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                              {notification.message}
                            </div>
                            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                              {formatTimestamp(notification.timestamp)}
                            </div>
                            {notification.action && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  notification.action!.callback();
                                }}
                                style={{
                                  marginTop: '8px',
                                  padding: '4px 8px',
                                  background: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  cursor: 'pointer'
                                }}
                              >
                                {notification.action.label}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div>
                  {activities.length === 0 ? (
                    <div style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: '#6b7280'
                    }}>
                      No recent activity
                    </div>
                  ) : (
                    activities.map(activity => (
                      <div
                        key={activity.id}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #f3f4f6'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <span style={{ fontSize: '16px', marginTop: '2px' }}>
                            {getActivityIcon(activity.type)}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ marginBottom: '4px' }}>
                              {activity.details}
                            </div>
                            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                              {formatTimestamp(activity.timestamp)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Hook for easy integration
export const useTradeNotifications = (tradeEventService: TradeEventService) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestActivity, setLatestActivity] = useState<TradingActivity | null>(null);

  useEffect(() => {
    const updateUnreadCount = () => {
      const notifications = tradeEventService.getNotifications(true);
      setUnreadCount(notifications.length);
    };

    const updateLatestActivity = () => {
      const activities = tradeEventService.getActivityLog(1);
      setLatestActivity(activities[0] || null);
    };

    // Initial load
    updateUnreadCount();
    updateLatestActivity();

    // Subscribe to updates
    const notificationSub = tradeEventService.subscribe('new-notification', updateUnreadCount);
    const activitySub = tradeEventService.subscribe('new-activity', updateLatestActivity);

    return () => {
      tradeEventService.unsubscribe(notificationSub);
      tradeEventService.unsubscribe(activitySub);
    };
  }, [tradeEventService]);

  return {
    unreadCount,
    latestActivity,
    markAllAsRead: () => tradeEventService.markAllNotificationsRead(),
    getNotifications: (unreadOnly?: boolean) => tradeEventService.getNotifications(unreadOnly),
    getActivityLog: (limit?: number) => tradeEventService.getActivityLog(limit)
  };
};