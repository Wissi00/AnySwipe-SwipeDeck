import { useEffect, useRef, useState } from "react";
import { runOnJS, useAnimatedReaction, useSharedValue } from "react-native-reanimated";
import type { SwipeableStatusEntry } from "../SwipeDeckContext";
import { SwipeableData, SwipeDirection } from "../types";

interface SwipeStateCallbacks<T> {
  onSwipeLeft?: (item: T) => void;
  onSwipeRight?: (item: T) => void;
  onSwipeUp?: (item: T) => void;
  onSwipeDown?: (item: T) => void;
  onRemainingChange?: (count: number) => void;
  debug?: boolean;
}

export const useSwipeState = <T extends object>(callbacks: SwipeStateCallbacks<T>) => {
  const { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onRemainingChange, debug = false } = callbacks;

  const log = (...args: unknown[]) => {
    if (debug) console.log(...args);
  };

  const warn = (...args: unknown[]) => {
    if (debug) console.warn(...args);
  };

  // ── Source of truth: SharedValue for statuses (UI-thread instant) ──
  const swipeableStatuses = useSharedValue<SwipeableStatusEntry[]>([]);

  // ── React state: strictly holds IDs and Data ──
  const [swipeablesArrayData, setSwipeablesArrayData] = useState<{id: number, data: T}[]>([]);

  // History needs direction to know from where it returns
  const swipedStackRef = useRef<(SwipeableData<T> & { direction?: SwipeDirection })[]>([]);

  // ── Mirror SharedValue into React state to avoid reading .value during render ──
  const [statusesSnapshot, setStatusesSnapshot] = useState<SwipeableStatusEntry[]>([]);

  useAnimatedReaction(
    () => swipeableStatuses.value,
    (current) => {
      runOnJS(setStatusesSnapshot)(current);
    },
  );

  // ── Remaining count ──
  const remainingCount = statusesSnapshot.filter((s) => s.status === "idle").length;

  useEffect(() => {
    onRemainingChange?.(remainingCount);
  }, [remainingCount]);

  // ── Debug log ──
  const deckLog = statusesSnapshot
    .map((s) => {
      const statusLabel = s.status === "animating-out" ? "OUT" : s.status === "animating-in" ? "IN" : "idle";
      return `#${s.id}(${statusLabel})`;
    })
    .join(" ");
  log("🃏 Deck array:", `[ ${deckLog} ]`);

  // ── Handle done-animating: remove card, push to history ──
  useEffect(() => {
    if (statusesSnapshot.length > 0 && statusesSnapshot[0].status === "done-animating") {
      const topStatus = statusesSnapshot[0];
      const dataItem = swipeablesArrayData.find((d) => d.id === topStatus.id);

      if (dataItem) {
        swipedStackRef.current.push({
          id: topStatus.id,
          data: dataItem.data,
          direction: topStatus.direction,
        });
        log(`🥞 History stack : [${swipedStackRef.current.map((s) => `#${s.id}`).join(" ")}]`);

        // Remove from React state
        setSwipeablesArrayData((prev) => prev.filter((d) => d.id !== topStatus.id));
      }

      // Remove from SharedValue by reading its *latest* physical value
      swipeableStatuses.value = swipeableStatuses.value.filter((s) => s.id !== topStatus.id);
    }
  }, [statusesSnapshot]);

  // ── appendData: add items to both SharedValue and React state ──
  const appendData = (items: SwipeableData<T>[]) => {
    setSwipeablesArrayData((prev) => [
      ...prev,
      ...items.map((item) => ({ id: item.id, data: item.data })),
    ]);
    swipeableStatuses.value = [
      ...swipeableStatuses.value,
      ...items.map((item) => ({ id: item.id, status: "idle" as const })),
    ];
  };

  // ── relaySwipe: lookup data and dispatch the event ──
  const relaySwipe = (swipeableId: number, direction: SwipeDirection) => {
    const dataItem = swipeablesArrayData.find((d) => d.id === swipeableId);
    if (dataItem) {
      switch (direction) {
        case "left":
          onSwipeLeft?.(dataItem.data);
          break;
        case "right":
          onSwipeRight?.(dataItem.data);
          break;
        case "up":
          onSwipeUp?.(dataItem.data);
          break;
        case "down":
          onSwipeDown?.(dataItem.data);
          break;
      }
    }
  };

  // ── setStatusOutAndRelaySwipe: writes to SharedValue + calls direction callback ──
  const setStatusOutAndRelaySwipe = (swipeableId: number, direction: SwipeDirection) => {
    // Read SharedValue for instant, accurate status checks
    const entry = swipeableStatuses.value.find((s) => s.id === swipeableId);
    if (!entry || entry.status !== "idle") {
      warn(`SWIPE REJECTED: Card ${swipeableId} is not idle (current status: ${entry?.status})`);
      return;
    }

    const hasAnimatingIn = swipeableStatuses.value.some((s) => s.status === "animating-in");
    if (hasAnimatingIn) {
      warn(`SWIPE ATTEMPT LOCKED`);
      return;
    }

    // Write to SharedValue (source of truth)
    swipeableStatuses.value = swipeableStatuses.value.map((s) =>
      s.id === swipeableId ? { ...s, status: "animating-out" as const, direction } : s,
    );

    relaySwipe(swipeableId, direction);
  };

  // ── undoFromHistory: writes to SharedValue ──
  const undoFromHistory = () => {
    const hasAnimatingOut = swipeableStatuses.value.some((s) => s.status === "animating-out");
    if (hasAnimatingOut) {
      // Set last animating-out back to animating-in
      const lastAnimOut = swipeableStatuses.value.findLast((s) => s.status === "animating-out");
      if (lastAnimOut) {
        swipeableStatuses.value = swipeableStatuses.value.map((s) =>
          s.id === lastAnimOut.id ? { ...s, status: "animating-in" as const } : s,
        );
      } else {
        warn(`UNDO: No animating-out card found`);
      }
    } else {
      const item = swipedStackRef.current.pop();
      if (item) {
        const entry: SwipeableStatusEntry = { id: item.id, status: "animating-in", direction: item.direction };
        setSwipeablesArrayData((prev) => [{ id: item.id, data: item.data }, ...prev]);
        swipeableStatuses.value = [entry, ...swipeableStatuses.value];
        log(`↩️: Item restored from history`);
      } else {
        warn(`↩️: No item in history`);
      }
    }
  };

  // ── Filter for rendering from snapshot ──
  let idleRenderCount = 0;
  const swipeablesToRender = statusesSnapshot
    .filter((s) => {
      if (s.status === "animating-out" || s.status === "animating-in") return true;
      if (s.status === "idle" && idleRenderCount < 3) {
        idleRenderCount++;
        return true;
      }
      return false;
    })
    .map((s) => {
      const dataItem = swipeablesArrayData.find((d) => d.id === s.id);
      return {
        id: s.id,
        status: s.status,
        direction: s.direction,
        data: dataItem?.data as T, // safe because both states are kept in sync
      };
    });

  return {
    swipeablesArrayData,
    swipeablesToRender,
    swipeableStatuses,
    appendData,
    relaySwipe,
    setStatusOutAndRelaySwipe,
    undoFromHistory,
  };
};
