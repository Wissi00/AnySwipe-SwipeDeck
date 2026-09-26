import React, { forwardRef, memo, useImperativeHandle, useMemo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { SwipeDeckContext, useSwipeDeckContext } from "./SwipeDeckContext";
import { SwipeableWrapper } from "./SwipeableWrapper";
import { useSwipeState } from "./hooks/useSwipeState";
import { styles } from "./styles/SwipeDeck.styles";
import { stackPosition, type StackProgress } from "./stack";
import { SwipeDeckRef, SwipeOverlayConfig } from "./types";


interface StackSlotProps {
  id: number;
  progress: SharedValue<StackProgress>;
  children: React.ReactNode;
}

const StackSlot = ({ id, progress, children }: StackSlotProps) => {
  const { state } = useSwipeDeckContext();
  const { width } = useWindowDimensions();
  const threshold = width * 0.35;

  const style = useAnimatedStyle(() => {
    const { scale, translateY } = stackPosition(state.value.cards, id, progress.value, threshold);
    return {
      transform: [{ scale }, { translateY }],
    };
  });

  return <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, style]}>{children}</Animated.View>;
};

// Status changes must not re-render expensive poster/card content.
const CardContent = memo(function CardContent<T extends object>({ ItemComponent, data }: {
  ItemComponent: React.ComponentType<T>; data: T;
}) { return <ItemComponent {...data} />; }) as <T extends object>(props: {
  ItemComponent: React.ComponentType<T>; data: T;
}) => React.ReactElement;

interface SwipeDeckProps<T extends object> {
  ItemComponent: React.ComponentType<T>;
  onSwipeLeft?: (item: T) => void;
  onSwipeRight?: (item: T) => void;
  onSwipeUp?: (item: T) => void;
  onSwipeDown?: (item: T) => void;
  onCardPress?: (item: T) => void;
  /** Fired only when the deck accepts an undo. */
  onUndo?: (item: T) => void;
  /** Retained undo payloads; default unlimited, 0 disables history. */
  maxHistorySize?: number;
  /** Lock input at acceptance until the swipe callback's promise settles. */
  waitForSwipe?: boolean;
  onRemainingChange?: (count: number) => void;
  overlayConfig?: SwipeOverlayConfig;
  /** Per-item overlays; return null to render no gesture overlay for that card. */
  overlayConfigForItem?: (item: T) => SwipeOverlayConfig | null;
  /** Removes the deck Tap recognizer while retaining its Pan dismissal gesture. */
  disableCardPressForItem?: (item: T) => boolean;
  debug?: boolean;
}

const SwipeDeckInner = <T extends object>(
  { ItemComponent, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onCardPress, onUndo, maxHistorySize, waitForSwipe, onRemainingChange, overlayConfig, overlayConfigForItem, disableCardPressForItem, debug = false }: SwipeDeckProps<T>,
  ref: React.ForwardedRef<SwipeDeckRef<T>>,
) => {
  const { state, cards, requestSwipe, swipe, undo, appendData, removeData } = useSwipeState<T>({
    onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onUndo, maxHistorySize, waitForSwipe, onRemainingChange, debug,
  });
  const context = useMemo(() => ({ state, requestSwipe }), [state, requestSwipe]);

  const progress = useSharedValue<StackProgress>({ id: null, transition: 0, x: 0, y: 0 });

  useImperativeHandle(ref, () => ({
    swipeLeft: () => swipe('left'),
    swipeRight: () => swipe('right'),
    swipeUp: () => swipe('up'),
    swipeDown: () => swipe('down'),
    undo,
    appendData,
    removeData,
  }), [swipe, undo, appendData, removeData]);
  return (
    <SwipeDeckContext.Provider value={context}>
    <GestureHandlerRootView style={styles.deckContainer}>
      {cards
        .map((swipeable) => {
          return (
            <StackSlot
              key={swipeable.id}
              id={swipeable.id}
              progress={progress}
            >
              <SwipeableWrapper
                status={swipeable.status}
                direction={swipeable.direction}
                id={swipeable.id}
                progress={progress}
                onCardPress={(!onCardPress || disableCardPressForItem?.(swipeable.data)) ? undefined : () => onCardPress?.(swipeable.data)}
                overlayConfig={overlayConfigForItem ? overlayConfigForItem(swipeable.data) || undefined : overlayConfig}
              >
                <CardContent ItemComponent={ItemComponent} data={swipeable.data} />
              </SwipeableWrapper>
            </StackSlot>
          );
        })
        .reverse()}
    </GestureHandlerRootView>
    </SwipeDeckContext.Provider>
  );
};

export const SwipeDeck = forwardRef(SwipeDeckInner) as <T extends object = any>(
  props: SwipeDeckProps<T> & { ref?: React.ForwardedRef<SwipeDeckRef<T>> },
) => React.ReactElement;
