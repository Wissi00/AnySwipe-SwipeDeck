import type { CardState } from './state';

export type StackProgress = { id: number | null; transition: number; x: number; y: number };

/** Derive presentation from the UI-thread state, independently of React commits. */
export function stackPosition(cards: CardState[], id: number, progress: StackProgress, threshold: number) {
    'worklet';
    const stack = cards.filter(card => card.status === 'idle' || card.status === 'animating-in');
    const index = Math.max(0, stack.findIndex(card => card.id === id));
    const front = stack[0];
    const currentSample = progress.id === front?.id && progress.transition === front?.transition;
    // Undo inserts the returning card on the UI thread before React can mount
    // it. Keep the existing cards in place until that transition publishes its
    // first position; treating the missing sample as zero makes the stack snap
    // back, expand on mount, and then recede a second time during the return.
    const distance = currentSample
        ? Math.max(Math.abs(progress.x), Math.abs(progress.y))
        : front?.status === 'animating-in' ? threshold : 0;
    const advancement = threshold > 0 ? Math.min(1, distance / threshold) : 0;
    const depth = index > 0 ? index - advancement : 0;
    return { scale: 1 - depth * 0.05, translateY: depth * 16 };
}
