import { useEffect, useRef, useState } from "react";
import { SwipeableData, SwipeDirection } from "../types";

interface SwipeStateCallbacks<T> {
  onSwipeLeft?: (item: T) => void;
  onSwipeRight?: (item: T) => void;
  onSwipeUp?: (item: T) => void;
  onSwipeDown?: (item: T) => void;
  onRemainingChange?: (count: number) => void;
}

export const useSwipeState = <T extends object>(callbacks: SwipeStateCallbacks<T>) => {
  const { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onRemainingChange } = callbacks;

  const [swipeablesArray, setSwipeablesArray] = useState<SwipeableData<T>[]>([]);
  const swipedStackRef = useRef<SwipeableData<T>[]>([]);

  const idleCount = swipeablesArray.filter((s) => s.status === "idle").length;

  // Load more trigger, always fires on first mount (causes fetching of initial batch)
  useEffect(() => {
    onRemainingChange?.(idleCount);
  }, [idleCount]);

  const deckLog = swipeablesArray
    .map((s) => {
      const statusLabel = s.status === "animating-out" ? "OUT" : s.status === "animating-in" ? "IN" : "idle";
      return `#${s.id}(${statusLabel})`;
    })
    .join(" ");
  console.log("SWIPEABLE_ARRAY:", `[ ${deckLog} ]`);

  const appendData = (items: SwipeableData<T>[]) => {
    setSwipeablesArray((prev) => [...prev, ...items]);
  };

  const setSwipeableStatusToAnimatingOut = (id: number, direction: SwipeDirection) => {
    setSwipeablesArray((prev) => prev.map((s) => (s.id === id ? { ...s, status: "animating-out", direction } : s)));
    console.log(`ARRAY_UPDATE: Card ${id} set to animating-out`);
  };

  const setLastAnimatingOutStatusToAnimatingIn = () => {
    setSwipeablesArray((prev) => {
      const lastAnimatingOut = prev.findLast((s) => s.status === "animating-out");
      if (lastAnimatingOut) {
        return prev.map((s) => (s.id === lastAnimatingOut.id ? { ...s, status: "animating-in" } : s));
      } else {
        console.warn(`ARRAY_UPDATE: No animating-out card found`);
        return prev;
      }
    });
    console.log(`ARRAY_UPDATE: Last animating-out card set to animating-in`);
  };

  const setStatusAndRelaySwipe = (swipeable: SwipeableData<T>, direction: SwipeDirection) => {
    switch (direction) {
      case "left":
        onSwipeLeft?.(swipeable.data);
        break;
      case "right":
        onSwipeRight?.(swipeable.data);
        break;
      case "up":
        onSwipeUp?.(swipeable.data);
        break;
      case "down":
        onSwipeDown?.(swipeable.data);
        break;
    }
    setSwipeableStatusToAnimatingOut(swipeable.id, direction);
  };

  // When a card finishes animating out, we consider it "removed" and push it to the swiped history stack.
  useEffect(() => {
    if (swipeablesArray.length > 0 && swipeablesArray[0].status === "done-animating") {
      const topCard = swipeablesArray[0];
      console.log(`GATEKEEPER: Card ${topCard.id} released to history.`);
      swipedStackRef.current.push(topCard);
      setSwipeablesArray((prev) => prev.slice(1));
    }
  }, [swipeablesArray]);

  const setSwipeableStatusToDoneAnimating = (id: number) => {
    setSwipeablesArray((prev) => prev.map((s) => (s.id === id ? { ...s, status: "done-animating" } : s)));
  };

  const setSwipeableStatusToIdle = (id: number) => {
    setSwipeablesArray((prev) => prev.map((s) => (s.id === id ? { ...s, status: "idle" } : s)));
    console.log(`SET_IDLE: Card ${id} reset to idle`);
  };

  const undoFromHistory = () => {
    if (swipeablesArray.some((s) => s.status === "animating-out")) {
      setLastAnimatingOutStatusToAnimatingIn();
    } else {
      const item = swipedStackRef.current.pop();
      if (item) {
        setSwipeablesArray((prev) => [{ ...item, status: "animating-in" }, ...prev]);
        console.log(`UNDO: Item restored from history`);
      } else {
        console.warn(`UNDO: No item in history`);
      }
    }
  };

  let idleRenderCount = 0;
  const swipeablesToRender = swipeablesArray.filter((s) => {
    if (s.status === "animating-out" || s.status === "animating-in") return true;
    if (s.status === "idle" && idleRenderCount < 3) {
      idleRenderCount++;
      return true;
    }
    return false;
  });

  const topSwipeableId = swipeablesArray.find((s) => s.status === "idle")?.id;

  return {
    swipeablesArray,
    swipeablesToRender,
    topSwipeableId,
    appendData,
    setStatusAndRelaySwipe,
    setSwipeableStatusToDoneAnimating,
    setSwipeableStatusToIdle,
    undoFromHistory,
  };
};
