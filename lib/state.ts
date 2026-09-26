import type { SwipeDirection, SwipeStatus } from './types';

export type CardState = { id: number; status: SwipeStatus; direction?: SwipeDirection; transition: number };
export type HistoryEntry = { id: number; direction: SwipeDirection };
export type DeckState = { cards: CardState[]; history: HistoryEntry[]; transition: number; batch: number; locked: boolean };

export const emptyDeck = (): DeckState => ({ cards: [], history: [], transition: 0, batch: 0, locked: false });

/** Keep one completed card mounted so the next undo needs no React commit. */
export function cardsToRender(state: DeckState): CardState[] {
    let idleCount = 0;
    const cards = state.cards.filter(card => card.status !== 'idle' || idleCount++ < 3);
    const last = state.history[state.history.length - 1];
    if (last && !cards.some(card => card.id === last.id)) {
        // This is a render-only entry, not an active card or a remaining item.
        // Prepending preserves the same key/order when undo makes it active.
        cards.unshift({ ...last, status: 'done-animating', transition: 0 });
    }
    return cards;
}

export function frontCard(state: DeckState): CardState | undefined {
    'worklet';
    if (state.locked || state.cards.some(card => card.status === 'animating-in')) return undefined;
    return state.cards.find(card => card.status === 'idle');
}

export function appendCards(state: DeckState, ids: number[], batch: number): DeckState {
    'worklet';
    const known = new Set([...state.cards.map(card => card.id), ...state.history.map(card => card.id)]);
    const cards = [...state.cards];
    for (const id of ids) {
        if (known.has(id)) continue;
        known.add(id);
        cards.push({ id, status: 'idle', transition: 0 });
    }
    return { ...state, cards, batch };
}

/** Gesture and imperative swipes use exactly the same acceptance rules. */
export function swipeCard(state: DeckState, id: number, direction: SwipeDirection, historyLimit: number, waitForSwipe = false): DeckState {
    'worklet';
    if (frontCard(state)?.id !== id) return state;
    const transition = state.transition + 1;
    const history = [...state.history, { id, direction }];
    return {
        ...state,
        transition,
        locked: waitForSwipe,
        cards: state.cards.map(card => card.id === id ? { id, direction, transition, status: 'animating-out' } : card),
        history: historyLimit === 0 ? [] : history.slice(-historyLimit),
    };
}

/** History is recorded at acceptance, never at animation completion. */
export function undoCard(state: DeckState): DeckState {
    'worklet';
    if (state.cards.some(card => card.status === 'animating-in') || state.history.length === 0) return state;
    const last = state.history[state.history.length - 1];
    const transition = state.transition + 1;
    const restored: CardState = { ...last, transition, status: 'animating-in' };
    const exists = state.cards.some(card => card.id === last.id);
    return {
        ...state,
        transition,
        history: state.history.slice(0, -1),
        cards: exists ? state.cards.map(card => card.id === last.id ? restored : card) : [restored, ...state.cards],
    };
}

/** A completion from an interrupted animation cannot finish a newer transition. */
export function finishCard(state: DeckState, id: number, transition: number): DeckState {
    'worklet';
    const card = state.cards.find(entry => entry.id === id);
    if (!card || card.transition !== transition) return state;
    if (card.status === 'animating-out') return { ...state, cards: state.cards.filter(entry => entry.id !== id) };
    if (card.status === 'animating-in') {
        return { ...state, cards: state.cards.map(entry => entry.id === id ? { id, transition, status: 'idle' } : entry) };
    }
    return state;
}

export function swipeDirection(x: number, y: number, vx: number, vy: number, threshold: number): SwipeDirection | undefined {
    'worklet';
    // Use the same tie-break as the overlays. Velocity only commits along the
    // finger's displacement; reversing a drag does not choose the wrong action.
    const horizontal = Math.abs(x) >= Math.abs(y);
    const distance = horizontal ? x : y;
    const velocity = horizontal ? vx : vy;
    if (Math.abs(distance) < threshold && !(Math.abs(velocity) > 800 && distance * velocity > 0)) return undefined;
    if (distance === 0) return undefined;
    return horizontal ? (distance > 0 ? 'right' : 'left') : (distance > 0 ? 'down' : 'up');
}

/** Remove unavailable content without remounting unrelated cards or history. */
export function removeCards(state: DeckState, ids: number[]): DeckState {
    'worklet';
    const removed = new Set(ids);
    return { ...state, cards: state.cards.filter(card => !removed.has(card.id)), history: state.history.filter(card => !removed.has(card.id)) };
}
