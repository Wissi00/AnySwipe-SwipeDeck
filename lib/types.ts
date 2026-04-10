export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export type SwipeStatus = 'idle' | 'animating-in' | 'animating-out' | 'done-animating';

export type SwipeableData<T> = {
    id: number;
    status: SwipeStatus;
    direction?: SwipeDirection;
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
    id: _nextId++, status: 'idle', data
});
