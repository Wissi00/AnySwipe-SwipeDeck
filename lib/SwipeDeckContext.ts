import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type { SwipeDirection } from './types';
import type { DeckState } from './state';

interface SwipeDeckContextValue {
    state: SharedValue<DeckState>;
    requestSwipe: (id: number, direction: SwipeDirection) => boolean;
}

export const SwipeDeckContext = createContext<SwipeDeckContextValue | null>(null);

export const useSwipeDeckContext = (): SwipeDeckContextValue => {
    const ctx = useContext(SwipeDeckContext);
    if (!ctx) throw new Error('useSwipeDeckContext must be used inside SwipeDeck');
    return ctx;
};
