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
import { SwipeDeckContext, useSwipeDeckContext } from "./SwipeDeckContext";
import { SwipeableWrapper } from "./SwipeableWrapper";
import { useSwipeState } from "./hooks/useSwipeState";
import { styles } from "./styles/SwipeDeck.styles";
import { SwipeableData, SwipeDeckRef, SwipeOverlayConfig } from "./types";

const { width: screenWidth } = Dimensions.get("window");
const SWIPE_THRESHOLD = screenWidth * 0.35;

interface StackSlotProps {
  id: number;
  frontCardTranslateX: SharedValue<number>;
  frontCardTranslateY: SharedValue<number>;
  children: React.ReactNode;
}

const StackSlot = ({ id, frontCardTranslateX, frontCardTranslateY, children }: StackSlotProps) => {
  const { swipeableStatuses } = useSwipeDeckContext();

  const style = useAnimatedStyle(() => {
    const statuses = swipeableStatuses.value;
    let stackOffset = 0;
    let idleCount = 0;
    for (let i = 0; i < statuses.length; i++) {
      if (statuses[i].status === "idle") {
        if (statuses[i].id === id) {
          stackOffset = idleCount;
          break;
        }
        idleCount++;
      }
    }

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
  onCardPress?: (item: T) => void;
  onRemainingChange?: (count: number) => void;
  overlayConfig?: SwipeOverlayConfig;
  debug?: boolean;
}

const SwipeDeckInner = <T extends object>(
  { ItemComponent, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onCardPress, onRemainingChange, overlayConfig, debug = false }: SwipeDeckProps<T>,
  ref: React.ForwardedRef<SwipeDeckRef<T>>,
) => {
  const {
    swipeablesArrayData,
    swipeablesToRender,
    swipeableStatuses,
    appendData,
    relaySwipe,
    setStatusOutAndRelaySwipe,
    undoFromHistory,
  } = useSwipeState<T>({ onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onRemainingChange, debug });

  const topCardTranslateX = useSharedValue(0);
  const topCardTranslateY = useSharedValue(0);

  useImperativeHandle(ref, () => ({
    swipeLeft: () => {
      const top = swipeableStatuses.value.find((s) => s.status === "idle");
      if (top) {
         setStatusOutAndRelaySwipe(top.id, "left"); } else {
         console.warn("No card available to swipe LEFT");
      }
    },
    swipeRight: () => {
      const top = swipeableStatuses.value.find((s) => s.status === "idle");
      if (top) setStatusOutAndRelaySwipe(top.id, "right");
    },
    swipeUp: () => {
      const top = swipeableStatuses.value.find((s) => s.status === "idle");
      if (top) setStatusOutAndRelaySwipe(top.id, "up");
    },
    swipeDown: () => {
      const top = swipeableStatuses.value.find((s) => s.status === "idle");
      if (top) setStatusOutAndRelaySwipe(top.id, "down");
    },
    undo: undoFromHistory,
    appendData: (items: SwipeableData<T>[]) => appendData(items),
  }));
return (
    <SwipeDeckContext.Provider value={{ swipeableStatuses }}>
    <GestureHandlerRootView style={styles.deckContainer}>
      {swipeablesToRender
        .map((swipeable) => {
          return (
            <StackSlot
              key={swipeable.id}
              id={swipeable.id}
              frontCardTranslateX={topCardTranslateX}
              frontCardTranslateY={topCardTranslateY}
            >
              <SwipeableWrapper
                status={swipeable.status}
                direction={swipeable.direction}
                id={swipeable.id}
                frontCardTranslateX={topCardTranslateX}
                frontCardTranslateY={topCardTranslateY}
                onSwipeLeft={() => relaySwipe(swipeable.id, "left")}
                onSwipeRight={() => relaySwipe(swipeable.id, "right")}
                onSwipeUp={() => relaySwipe(swipeable.id, "up")}
                onSwipeDown={() => relaySwipe(swipeable.id, "down")}
                onCardPress={() => onCardPress?.(swipeable.data)}
                overlayConfig={overlayConfig}
              >
                <ItemComponent {...swipeable.data} />
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
