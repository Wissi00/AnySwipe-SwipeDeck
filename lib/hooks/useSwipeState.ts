import { useEffect, useState } from 'react';
import { createSwipeableData, SwipeableData, SwipeDirection } from '../types';

interface SwipeStateCallbacks<T> {
    onSwipeLeft?: (item: T) => void;
    onSwipeRight?: (item: T) => void;
    onSwipeUp?: (item: T) => void;
    onSwipeDown?: (item: T) => void;
    onCardRemoved?: (item: T) => void;
}

export const useSwipeState = <T extends object>(
    data: SwipeableData<T>[],
    callbacks: SwipeStateCallbacks<T>
) => {
    const { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onCardRemoved } = callbacks;

    const [swipeablesArray, setSwipeablesArray] = useState<SwipeableData<T>[]>(data);

    // Optimized Sync: Check for new items during render
    const existingIds = new Set(swipeablesArray.map(s => s.id));
    const newItems = data.filter(item => !existingIds.has(item.id));
    if (newItems.length > 0) {
        setSwipeablesArray(prev => [...prev, ...newItems]);
    }

    const deckLog = swipeablesArray.map(s => {
        const statusLabel = s.status === 'animating-out' ? 'OUT' : s.status === 'animating-in' ? 'IN' : 'idle';
        return `#${s.id}(${statusLabel})`;
    }).join(' ');
    console.log('DECK_STATE:', `[ ${deckLog} ]`);

    const setSwipeableStatusToAnimatingOut = (id: number, direction: SwipeDirection) => {
        setSwipeablesArray(prev =>
            prev.map(s =>
                s.id === id ? { ...s, status: 'animating-out', direction } : s
            )
        );
        console.log(`ARRAY_UPDATE: Card ${id} set to animating-out`);
    };

    const setLastAnimatingOutStatusToAnimatingIn = () => {
        setSwipeablesArray(prev => {
            const lastAnimatingOut = prev.findLast(s => s.status === 'animating-out');
            if (lastAnimatingOut) {
                return prev.map(s =>
                    s.id === lastAnimatingOut.id ? { ...s, status: 'animating-in' } : s
                );
            } else {
                console.warn(`ARRAY_UPDATE: No animating-out card found`);
                return prev;
            }
        });
        console.log(`ARRAY_UPDATE: Last animating-out card set to animating-in`);
    };

    const setStatusAndRelaySwipe = (swipeable: SwipeableData<T>, direction: SwipeDirection) => {
        switch (direction) {
            case 'left': onSwipeLeft?.(swipeable.data); break;
            case 'right': onSwipeRight?.(swipeable.data); break;
            case 'up': onSwipeUp?.(swipeable.data); break;
            case 'down': onSwipeDown?.(swipeable.data); break;
        }
        setSwipeableStatusToAnimatingOut(swipeable.id, direction);
    };

    useEffect(() => {
        if (swipeablesArray.length > 0 && swipeablesArray[0].status === 'done-animating') {
            const topCard = swipeablesArray[0];
            console.log(`GATEKEEPER: Card ${topCard.id} released to history.`);
            onCardRemoved?.(topCard.data);
            setSwipeablesArray(prev => prev.slice(1));
        }
    }, [swipeablesArray]);

    const setSwipeableStatusToDoneAnimating = (id: number) => {
        setSwipeablesArray(prev =>
            prev.map(s =>
                s.id === id ? { ...s, status: 'done-animating' } : s
            )
        );
    };

    const setSwipeableStatusToIdle = (id: number) => {
        setSwipeablesArray(prev =>
            prev.map(s =>
                s.id === id ? { ...s, status: 'idle' } : s
            )
        );
        console.log(`SET_IDLE: Card ${id} reset to idle`);
    };

    let idleRenderCount = 0;
    const swipeablesToRender = swipeablesArray.filter(s => {
        if (s.status === 'animating-out' || s.status === 'animating-in') return true;
        if (s.status === 'idle' && idleRenderCount < 3) {
            idleRenderCount++;
            return true;
        }
        return false;
    });

    const topSwipeableId = swipeablesArray.find(s => s.status === 'idle')?.id;

    return {
        swipeablesArray,
        swipeablesToRender,
        topSwipeableId,
        setSwipeablesArray,
        setStatusAndRelaySwipe,
        setSwipeableStatusToDoneAnimating,
        setSwipeableStatusToIdle,
        setLastAnimatingOutStatusToAnimatingIn,
        createSwipeableData,
    };
};
