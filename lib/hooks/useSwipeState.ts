import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { runOnJS, runOnUI, useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { appendCards, cardsToRender, emptyDeck, frontCard, removeCards, swipeCard, undoCard, type DeckState } from '../state';
import type { SwipeableData, SwipeDirection } from '../types';

interface SwipeStateCallbacks<T> {
    onSwipeLeft?: (item: T) => void;
    onSwipeRight?: (item: T) => void;
    onSwipeUp?: (item: T) => void;
    onSwipeDown?: (item: T) => void;
    onUndo?: (item: T) => void;
    onRemainingChange?: (count: number) => void;
    maxHistorySize?: number;
    waitForSwipe?: boolean;
    debug?: boolean;
}

export const useSwipeState = <T extends object>(callbacks: SwipeStateCallbacks<T>) => {
    const state = useSharedValue<DeckState>(emptyDeck());
    const mounted = useRef(true);
    const callbacksRef = useRef(callbacks);
    useLayoutEffect(() => { callbacksRef.current = callbacks; });
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);
    const waitForSwipe = callbacks.waitForSwipe ?? false;
    const historyLimit = callbacks.maxHistorySize == null ? Infinity : Math.max(0, Math.floor(callbacks.maxHistorySize) || 0);
    // Payloads stay on JS. Only small status entries cross the UI boundary.
    const data = useRef(new Map<number, { value: T; batch: number }>());
    const batch = useRef(0);
    const [snapshot, setSnapshot] = useState<DeckState>(emptyDeck);

    const receiveSnapshot = useCallback((next: DeckState) => {
        if (!mounted.current) return;
        const retained = new Set([...next.cards.map(card => card.id), ...next.history.map(card => card.id)]);
        for (const [id, item] of data.current) {
            // A queued snapshot must not collect data from a newer append.
            if (item.batch <= next.batch && !retained.has(id)) data.current.delete(id);
        }
        setSnapshot(next);
    }, []);
    useAnimatedReaction(() => state.value, next => { runOnJS(receiveSnapshot)(next); });

    const relay = useCallback(async (id: number, direction: SwipeDirection | 'undo', waitForCallback = false) => {
        try {
            if (!mounted.current) return;
            const item = data.current.get(id);
            if (!item) return;
            const current = callbacksRef.current;
            const callback = direction === 'undo' ? current.onUndo :
                ({ left: current.onSwipeLeft, right: current.onSwipeRight, up: current.onSwipeUp, down: current.onSwipeDown })[direction];
            await callback?.(item.value);
        } catch (error) {
            console.error('SwipeDeck callback failed', error);
        } finally {
            if (waitForCallback) runOnUI(() => { state.value = { ...state.value, locked: false }; })();
        }
    }, [state]);

    const requestSwipe = useCallback((id: number, direction: SwipeDirection) => {
        'worklet';
        const previous = state.value;
        const next = swipeCard(previous, id, direction, historyLimit, waitForSwipe);
        if (next === previous) return false;
        runOnJS(relay)(id, direction, waitForSwipe);
        state.value = next;
        return true;
    }, [historyLimit, relay, state, waitForSwipe]);

    const swipe = useCallback((direction: SwipeDirection) => {
        runOnUI(() => {
            const top = frontCard(state.value);
            if (top) requestSwipe(top.id, direction);
        })();
    }, [requestSwipe, state]);

    const undo = useCallback(() => {
        runOnUI(() => {
            const previous = state.value;
            const next = undoCard(previous);
            if (next === previous) return;
            runOnJS(relay)(previous.history[previous.history.length - 1].id, 'undo');
            state.value = next;
        })();
    }, [relay, state]);

    const appendData = useCallback((items: SwipeableData<T>[]) => {
        const ids: number[] = [];
        const nextBatch = ++batch.current;
        for (const item of items) {
            if (!Number.isFinite(item.id) || data.current.has(item.id)) continue;
            data.current.set(item.id, { value: item.data, batch: nextBatch });
            ids.push(item.id);
        }
        if (!ids.length) return;
        runOnUI(() => { state.value = appendCards(state.value, ids, nextBatch); })();
    }, [state]);

    const removeData = useCallback((ids: number[]) => {
        if (!ids.length) return;
        runOnUI(() => { state.value = removeCards(state.value, ids); })();
    }, [state]);

    const remaining = snapshot.cards.filter(card => card.status === 'idle' || card.status === 'animating-in').length;
    useEffect(() => { callbacksRef.current.onRemainingChange?.(remaining); }, [remaining]);

    const cards = cardsToRender(snapshot)
        .flatMap(card => {
            const item = data.current.get(card.id);
            return item ? [{ ...card, data: item.value }] : [];
        });
    if (callbacks.debug) console.log('SwipeDeck', snapshot.cards);
    return { state, cards, requestSwipe, swipe, undo, appendData, removeData };
};
