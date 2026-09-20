import { createContext, useContext } from 'react';

export interface SwipeableCardState {
    /**
     * True while this card is the deck's front card: the one the user can
     * swipe, with no idle card drawn over it. Back cards are mounted and laid
     * out behind the front card, so a card whose content must only be shown
     * when it can actually be seen (an ad view that records its impression
     * on attach) should wait for this before rendering that content.
     */
    isFront: boolean;
}

export const SwipeableCardContext = createContext<SwipeableCardState | null>(null);

/**
 * Reads the deck state of the card that rendered the calling component.
 * Outside a deck there is nothing covering the component, so it reports
 * `isFront: true`.
 */
export const useSwipeableCard = (): SwipeableCardState => {
    const ctx = useContext(SwipeableCardContext);
    return ctx ?? { isFront: true };
};
