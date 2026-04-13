import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type { SwipeDirection, SwipeStatus } from './types';

export type SwipeableStatusEntry = { id: number; status: SwipeStatus; direction?: SwipeDirection };

interface SwipeDeckContextValue {
    swipeableStatuses: SharedValue<SwipeableStatusEntry[]>;
}

export const SwipeDeckContext = createContext<SwipeDeckContextValue | null>(null);

export const useSwipeDeckContext = (): SwipeDeckContextValue => {
    const ctx = useContext(SwipeDeckContext);
    if (!ctx) throw new Error('useSwipeDeckContext must be used inside SwipeDeck');
    return ctx;
};
