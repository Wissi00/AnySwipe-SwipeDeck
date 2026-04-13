import type { ReactNode } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export type DirectionOverlayConfig = {
    color?: string;
    icon?: ReactNode;
    maxOpacity?: number;
};

export type SwipeOverlayConfig = {
    left?: DirectionOverlayConfig;
    right?: DirectionOverlayConfig;
    up?: DirectionOverlayConfig;
    down?: DirectionOverlayConfig;
};

export type SwipeStatus = 'idle' | 'animating-in' | 'animating-out' | 'done-animating';

export type SwipeableData<T> = {
    id: number;
    data: T;
};

export interface SwipeDeckRef<T extends object> {
    swipeLeft: () => void;
    swipeRight: () => void;
    swipeUp: () => void;
    swipeDown: () => void;
    undo: () => void;
    appendData: (items: SwipeableData<T>[]) => void;
}

let _nextId = 0;
export const createSwipeableData = <T extends object>(data: T): SwipeableData<T> => ({
    id: _nextId++, data
});
    