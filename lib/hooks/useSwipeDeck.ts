import { useRef } from 'react';
import { SwipeDeckRef } from '../types';

export const useSwipeDeck = <T extends object>() => {
    const ref = useRef<SwipeDeckRef<T>>(null);
    return {
        deckRef: ref,
        swipeLeft:  () => ref.current?.swipeLeft(),
        swipeRight: () => ref.current?.swipeRight(),
        swipeUp:    () => ref.current?.swipeUp(),
        swipeDown:  () => ref.current?.swipeDown(),
        undo: (item?: T) => ref.current?.undo(item),
    };
};
