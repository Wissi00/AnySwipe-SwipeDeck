import { useRef } from 'react';
import { SwipeableData, SwipeDeckRef } from '../types';

export const useSwipeDeck = <T extends object>() => {
    const ref = useRef<SwipeDeckRef<T>>(null);
    return {
        deckRef: ref,
        swipeLeft:   () => ref.current?.swipeLeft(),
        swipeRight:  () => ref.current?.swipeRight(),
        swipeUp:     () => ref.current?.swipeUp(),
        swipeDown:   () => ref.current?.swipeDown(),
        undo:        () => ref.current?.undo(),
        appendData:  (items: SwipeableData<T>[]) => ref.current?.appendData(items),
    };
};
