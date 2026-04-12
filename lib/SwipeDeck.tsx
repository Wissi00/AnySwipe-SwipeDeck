import React, { forwardRef, useImperativeHandle } from "react";
import { Dimensions, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { SwipeableWrapper } from "./SwipeableWrapper";
import { useSwipeState } from "./hooks/useSwipeState";
import { styles } from "./styles/SwipeDeck.styles";
import { SwipeableData, SwipeDeckRef, SwipeOverlayConfig } from "./types";

const { width: screenWidth } = Dimensions.get("window");
const SWIPE_THRESHOLD = screenWidth * 0.35;

interface StackSlotProps {
  stackOffset: number;
  frontCardTranslateX: SharedValue<number>;
  frontCardTranslateY: SharedValue<number>;
  children: React.ReactNode;
}

const StackSlot = ({ stackOffset, frontCardTranslateX, frontCardTranslateY, children }: StackSlotProps) => {
  const style = useAnimatedStyle(() => {
    const currentScale = 1 - stackOffset * 0.05;
    const targetScale = 1 - Math.max(0, stackOffset - 1) * 0.05;
    const currentVertOffset = stackOffset * 16;
    const targetVertOffset = Math.max(0, stackOffset - 1) * 16;

    let dynScale = currentScale;
    let dynOffset = currentVertOffset;

    if (stackOffset > 0) {
      const maxDist = Math.max(Math.abs(frontCardTranslateX.value), Math.abs(frontCardTranslateY.value));
      if (maxDist > 0) {
        dynOffset = interpolate(maxDist, [0, SWIPE_THRESHOLD], [currentVertOffset, targetVertOffset], Extrapolation.CLAMP);
        dynScale = interpolate(maxDist, [0, SWIPE_THRESHOLD], [currentScale, targetScale], Extrapolation.CLAMP);
      }
    }

    return {
      transform: [{ scale: dynScale }, { translateY: dynOffset }],
    };
  });

  return <Animated.View style={[StyleSheet.absoluteFillObject, style]}>{children}</Animated.View>;
};

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

  const topCardTranslateX = useSharedValue(0);
  const topCardTranslateY = useSharedValue(0);

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

  let idleIndex = 0;

  return (
    <GestureHandlerRootView style={styles.deckContainer}>
      {swipeablesToRender
        .map((swipeable) => {
          const stackOffset = swipeable.status === "idle" ? idleIndex++ : 0;
          return (
            <StackSlot
              key={swipeable.id}
              stackOffset={stackOffset}
              frontCardTranslateX={topCardTranslateX}
              frontCardTranslateY={topCardTranslateY}
            >
              <SwipeableWrapper
                status={swipeable.status}
                direction={swipeable.direction}
                isTopSwipeable={swipeable.id === topSwipeableId}
                frontCardTranslateX={topCardTranslateX}
                frontCardTranslateY={topCardTranslateY}
                onSwipeLeft={() => setStatusOutAndRelaySwipe(swipeable, "left")}
                onSwipeRight={() => setStatusOutAndRelaySwipe(swipeable, "right")}
                onSwipeUp={() => setStatusOutAndRelaySwipe(swipeable, "up")}
                onSwipeDown={() => setStatusOutAndRelaySwipe(swipeable, "down")}
                onAnimationOutComplete={() => {
                  setSwipeableStatusToDoneAnimating(swipeable.id);
                  topCardTranslateX.value = 0;
                  topCardTranslateY.value = 0;
                }}
                onAnimationInComplete={() => { setSwipeableStatusToIdle(swipeable.id); }}
                overlayConfig={overlayConfig}
              >
                <ItemComponent {...swipeable.data} />
              </SwipeableWrapper>
            </StackSlot>
          );
        })
        .reverse()}
    </GestureHandlerRootView>
  );
};

export const SwipeDeck = forwardRef(SwipeDeckInner) as <T extends object = any>(
  props: SwipeDeckProps<T> & { ref?: React.ForwardedRef<SwipeDeckRef<T>> },
) => React.ReactElement;
