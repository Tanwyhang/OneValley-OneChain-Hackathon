'use client';

import { useSyncExternalStore } from 'react';

export type NotificationKind = 'success' | 'error' | 'warning' | 'info';

export interface PlayerStats {
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  level: number;
  experience: number;
  experienceToNextLevel: number;
}

export interface GameNotification {
  id: string;
  timestamp: number;
  type: NotificationKind;
  title: string;
  message: string;
  duration?: number;
}

interface HUDDataState {
  playerStats: PlayerStats;
  goldCount: number;
  selectedSlot: number;
  isBackpackOpen: boolean;
  isMarketplaceOpen: boolean;
  isSettingsOpen: boolean;
  isGuideOpen: boolean;
  currentScene: string;
  notifications: GameNotification[];
}

interface HUDActions {
  updatePlayerStats: (stats: Partial<PlayerStats>) => void;
  setHealth: (health: number) => void;
  setEnergy: (energy: number) => void;
  setSelectedSlot: (slot: number) => void;
  setGoldCount: (gold: number) => void;
  toggleBackpack: (open?: boolean) => void;
  toggleMarketplace: (open?: boolean) => void;
  toggleSettings: (open?: boolean) => void;
  toggleGuide: (open?: boolean) => void;
  addNotification: (notification: Omit<GameNotification, 'id' | 'timestamp'>) => void;
  clearNotifications: () => void;
  setCurrentScene: (scene: string) => void;
  resetHUD: () => void;
}

export type HUDStore = HUDDataState & HUDActions;

type HUDSelector<T> = (state: HUDStore) => T;

type PartialUpdater = Partial<HUDDataState> | ((state: HUDStore) => Partial<HUDDataState>);

const listeners = new Set<() => void>();

const createInitialPlayerStats = (): PlayerStats => ({
  health: 100,
  maxHealth: 100,
  energy: 100,
  maxEnergy: 100,
  level: 1,
  experience: 0,
  experienceToNextLevel: 100,
});

const createInitialDataState = (): HUDDataState => ({
  playerStats: createInitialPlayerStats(),
  goldCount: 0,
  selectedSlot: 0,
  isBackpackOpen: false,
  isMarketplaceOpen: false,
  isSettingsOpen: false,
  isGuideOpen: false,
  currentScene: 'menu',
  notifications: [],
});

let state: HUDStore; // defined after actions

const notifySubscribers = () => {
  listeners.forEach(listener => listener());
};

const setState = (updater: PartialUpdater): void => {
  const partial = typeof updater === 'function' ? updater(state) : updater;
  if (!partial) return;
  state = { ...state, ...partial };
  notifySubscribers();
};

const getState = (): HUDStore => state;

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const clamp = (value: number, minValue: number, maxValue: number): number => {
  if (value < minValue) return minValue;
  if (value > maxValue) return maxValue;
  return value;
};

const actions: HUDActions = {
  updatePlayerStats: (stats) => {
    setState(prev => ({ playerStats: { ...prev.playerStats, ...stats } }));
  },
  setHealth: (health) => {
    setState(prev => ({
      playerStats: {
        ...prev.playerStats,
        health: clamp(health, 0, prev.playerStats.maxHealth),
      }
    }));
  },
  setEnergy: (energy) => {
    setState(prev => ({
      playerStats: {
        ...prev.playerStats,
        energy: clamp(energy, 0, prev.playerStats.maxEnergy),
      }
    }));
  },
  setSelectedSlot: (slot) => {
    setState({ selectedSlot: Math.max(0, Math.floor(slot)) });
  },
  setGoldCount: (gold) => {
    setState({ goldCount: Math.max(0, Math.floor(gold)) });
  },
  toggleBackpack: (open) => {
    setState(prev => ({ isBackpackOpen: typeof open === 'boolean' ? open : !prev.isBackpackOpen }));
  },
  toggleMarketplace: (open) => {
    setState(prev => ({ isMarketplaceOpen: typeof open === 'boolean' ? open : !prev.isMarketplaceOpen }));
  },
  toggleSettings: (open) => {
    setState(prev => ({ isSettingsOpen: typeof open === 'boolean' ? open : !prev.isSettingsOpen }));
  },
  toggleGuide: (open) => {
    setState(prev => ({ isGuideOpen: typeof open === 'boolean' ? open : !prev.isGuideOpen }));
  },
  addNotification: (notification) => {
    const idBase = notification.title ? notification.title.replace(/\s+/g, '-') : 'hud';
    const id = `${idBase}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: GameNotification = {
      id,
      timestamp: Date.now(),
      ...notification,
    };

    setState(prev => ({
      notifications: [...prev.notifications, entry].slice(-50),
    }));
  },
  clearNotifications: () => {
    setState({ notifications: [] });
  },
  setCurrentScene: (scene) => {
    setState({ currentScene: scene });
  },
  resetHUD: () => {
    setState(() => createInitialDataState());
  },
};

state = {
  ...createInitialDataState(),
  ...actions,
};

type UseGameHUDStore = {
  <T = HUDStore>(selector?: HUDSelector<T>): T;
  getState: () => HUDStore;
  setState: (updater: PartialUpdater) => void;
  subscribe: (listener: () => void) => () => void;
};

const useGameHUDStoreHook = (<T = HUDStore>(selector?: HUDSelector<T>): T => {
  const getSnapshot = () => (selector ? selector(state) : (state as unknown as T));
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}) as UseGameHUDStore;

useGameHUDStoreHook.getState = getState;
useGameHUDStoreHook.setState = setState;
useGameHUDStoreHook.subscribe = subscribe;

export const useGameHUDStore = useGameHUDStoreHook;
