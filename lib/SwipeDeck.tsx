import React, { forwardRef, useImperativeHandle } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SwipeableWrapper } from './SwipeableWrapper';
import { useSwipeState } from './hooks/useSwipeState';
import { styles } from './styles/SwipeDeck.styles';
import { createSwipeableData, SwipeableData, SwipeDeckRef } from './types';

interface SwipeDeckProps<T extends object> {
    data: SwipeableData<T>[];
    ItemComponent: React.ComponentType<T>;
    onSwipeLeft?: (item: T) => void;
    onSwipeRight?: (item: T) => void;
    onSwipeUp?: (item: T) => void;
    onSwipeDown?: (item: T) => void;
    onCardRemoved?: (item: T) => void;
}

const SwipeDeckInner = <T extends object>(
    {
        data,
        ItemComponent,
        onSwipeLeft,
        onSwipeRight,
        onSwipeUp,
        onSwipeDown,
        onCardRemoved
    }: SwipeDeckProps<T>,
    ref: React.ForwardedRef<SwipeDeckRef<T>>
) => {
    const {
        swipeablesArray,
        swipeablesToRender,
        topSwipeableId,
        setSwipeablesArray,
        setStatusAndRelaySwipe,
        setSwipeableStatusToDoneAnimating,
        setSwipeableStatusToIdle,
        setLastAnimatingOutStatusToAnimatingIn,
    } = useSwipeState(data, { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onCardRemoved });

    useImperativeHandle(ref, () => ({
        swipeLeft: () => {
            const top = swipeablesArray.find(s => s.status === 'idle');
            if (top) setStatusAndRelaySwipe(top, 'left');
        },
        swipeRight: () => {
            const top = swipeablesArray.find(s => s.status === 'idle');
            if (top) setStatusAndRelaySwipe(top, 'right');
        },
        swipeUp: () => {
            const top = swipeablesArray.find(s => s.status === 'idle');
            if (top) setStatusAndRelaySwipe(top, 'up');
        },
        swipeDown: () => {
            const top = swipeablesArray.find(s => s.status === 'idle');
            if (top) setStatusAndRelaySwipe(top, 'down');
        },
        undo: (item?: T) => {
            if (swipeablesArray.some(s => s.status === 'animating-out')) {
                setLastAnimatingOutStatusToAnimatingIn();
            } else if (item) {
                setSwipeablesArray(prev => [{ ...createSwipeableData(item), status: 'animating-in' }, ...prev]);
                console.log(`UNDO: Item restored from parent stack`);
            } else {
                console.warn(`UNDO: No item to restore`);
            }
        }
    }));

    return (
        <GestureHandlerRootView style={styles.deckContainer}>
            {swipeablesToRender.map((swipeable) => (
                <SwipeableWrapper
                    key={swipeable.id}
                    status={swipeable.status}
                    direction={swipeable.direction}
                    isTopSwipeable={swipeable.id === topSwipeableId}
                    onSwipeLeft={() => setStatusAndRelaySwipe(swipeable, 'left')}
                    onSwipeRight={() => setStatusAndRelaySwipe(swipeable, 'right')}
                    onSwipeUp={() => setStatusAndRelaySwipe(swipeable, 'up')}
                    onSwipeDown={() => setStatusAndRelaySwipe(swipeable, 'down')}
                    onAnimationOutComplete={() => setSwipeableStatusToDoneAnimating(swipeable.id)}
                    onAnimationInComplete={() => setSwipeableStatusToIdle(swipeable.id)}
                >
                    <ItemComponent {...swipeable.data} />
                </SwipeableWrapper>
            )).reverse()}
        </GestureHandlerRootView>
    );
};

export const SwipeDeck = forwardRef(SwipeDeckInner) as <T extends object>(
    props: SwipeDeckProps<T> & { ref?: React.ForwardedRef<SwipeDeckRef<T>> }
) => React.ReactElement;
