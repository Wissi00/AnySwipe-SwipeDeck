import React, { forwardRef, useImperativeHandle } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SwipeableWrapper } from "./SwipeableWrapper";
import { useSwipeState } from "./hooks/useSwipeState";
import { styles } from "./styles/SwipeDeck.styles";
import { SwipeableData, SwipeDeckRef, SwipeOverlayConfig } from "./types";

interface SwipeDeckProps<T extends object> {
  ItemComponent: React.ComponentType<T>;
  onSwipeLeft?: (item: T) => void;
  onSwipeRight?: (item: T) => void;
  onSwipeUp?: (item: T) => void;
  onSwipeDown?: (item: T) => void;
  onRemainingChange?: (count: number) => void;
  overlayConfig?: SwipeOverlayConfig;
  debug?: boolean;
}

const SwipeDeckInner = <T extends object>(
  { ItemComponent, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onRemainingChange, overlayConfig, debug = false }: SwipeDeckProps<T>,
  ref: React.ForwardedRef<SwipeDeckRef<T>>,
) => {
  const {
    swipeablesArray,
    swipeablesToRender,
    topSwipeableId,
    appendData,
    setStatusOutAndRelaySwipe,
    setSwipeableStatusToDoneAnimating,
    setSwipeableStatusToIdle,
    undoFromHistory,
  } = useSwipeState<T>({ onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onRemainingChange, debug });

  useImperativeHandle(ref, () => ({
    swipeLeft: () => {
      const top = swipeablesArray.find((s) => s.status === "idle");
      if (top) setStatusOutAndRelaySwipe(top, "left");
    },
    swipeRight: () => {
      const top = swipeablesArray.find((s) => s.status === "idle");
      if (top) setStatusOutAndRelaySwipe(top, "right");
    },
    swipeUp: () => {
      const top = swipeablesArray.find((s) => s.status === "idle");
      if (top) setStatusOutAndRelaySwipe(top, "up");
    },
    swipeDown: () => {
      const top = swipeablesArray.find((s) => s.status === "idle");
      if (top) setStatusOutAndRelaySwipe(top, "down");
    },
    undo: undoFromHistory,
    appendData: (items: SwipeableData<T>[]) => appendData(items),
  }));

  return (
    <GestureHandlerRootView style={styles.deckContainer}>
      {swipeablesToRender
        .map((swipeable) => (
          <SwipeableWrapper
            key={swipeable.id}
            status={swipeable.status}
            direction={swipeable.direction}
            isTopSwipeable={swipeable.id === topSwipeableId}
            onSwipeLeft={() => setStatusOutAndRelaySwipe(swipeable, "left")}
            onSwipeRight={() => setStatusOutAndRelaySwipe(swipeable, "right")}
            onSwipeUp={() => setStatusOutAndRelaySwipe(swipeable, "up")}
            onSwipeDown={() => setStatusOutAndRelaySwipe(swipeable, "down")}
            onAnimationOutComplete={() => setSwipeableStatusToDoneAnimating(swipeable.id)}
            onAnimationInComplete={() => {setSwipeableStatusToIdle(swipeable.id)}}
            overlayConfig={overlayConfig}
          >
            <ItemComponent {...swipeable.data} />
          </SwipeableWrapper>
        ))
        .reverse()}
    </GestureHandlerRootView>
  );
};

export const SwipeDeck = forwardRef(SwipeDeckInner) as <T extends object = any>(
  props: SwipeDeckProps<T> & { ref?: React.ForwardedRef<SwipeDeckRef<T>> },
) => React.ReactElement;
