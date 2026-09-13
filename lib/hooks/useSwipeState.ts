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
  //
  // Every write below goes through `modify`, which applies the update on the UI
  // thread against the value that is current *there*. From the JS thread a plain
  // `.value = …` is not that: the read is synchronous but the write is queued, so
  // two JS-side updates in one tick both compute from the same stale array and the
  // second silently discards the first — and a gesture or animation finishing on
  // the UI thread in between is discarded the same way. That is how cards were
  // dropped, and how a card could come back as `animating-in` after its data had
  // already been removed (see `swipeablesToRender`).
  const swipeableStatuses = useSharedValue<SwipeableStatusEntry[]>([]);

  // `modify` is typed to hand back the exact generic it was given; every update
  // here is a plain array in and out, which is the same thing minus the ceremony.
  const updateStatuses = (update: (statuses: SwipeableStatusEntry[]) => SwipeableStatusEntry[]) =>
    swipeableStatuses.modify(update as <S extends SwipeableStatusEntry[]>(statuses: S) => S);

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
      const topId = topStatus.id;
      const dataItem = swipeablesArrayData.find((d) => d.id === topId);

      if (dataItem) {
        swipedStackRef.current.push({
          id: topId,
          data: dataItem.data,
          direction: topStatus.direction,
        });
        log(`🥞 History stack : [${swipedStackRef.current.map((s) => `#${s.id}`).join(" ")}]`);

        // Remove from React state
        setSwipeablesArrayData((prev) => prev.filter((d) => d.id !== topId));
      }

      updateStatuses((statuses) => {
        "worklet";
        return statuses.filter((s) => s.id !== topId);
      });
    }
  }, [statusesSnapshot]);

  // ── appendData: add items to both SharedValue and React state ──
  const appendData = (items: SwipeableData<T>[]) => {
    setSwipeablesArrayData((prev) => [
      ...prev,
      ...items.map((item) => ({ id: item.id, data: item.data })),
    ]);
    const entries: SwipeableStatusEntry[] = items.map((item) => ({ id: item.id, status: "idle" as const }));
    updateStatuses((statuses) => {
      "worklet";
      return [...statuses, ...entries];
    });
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
  //
  // The checks live inside the worklet so they see the same array the write
  // applies to. A swipe is accepted once, or not at all: it is rejected while
  // any card is still animating in, or once the card is no longer idle.
  const setStatusOutAndRelaySwipe = (swipeableId: number, direction: SwipeDirection) => {
    updateStatuses((statuses) => {
      "worklet";
      const entry = statuses.find((s) => s.id === swipeableId);
      if (!entry || entry.status !== "idle") {
        if (debug) console.warn(`SWIPE REJECTED: Card ${swipeableId} is not idle (current status: ${entry?.status})`);
        return statuses;
      }
      if (statuses.some((s) => s.status === "animating-in")) {
        if (debug) console.warn("SWIPE ATTEMPT LOCKED");
        return statuses;
      }
      runOnJS(relaySwipe)(swipeableId, direction);
      return statuses.map((s) => (s.id === swipeableId ? { ...s, status: "animating-out" as const, direction } : s));
    });
  };

  // ── undoFromHistory: writes to SharedValue ──
  //
  // Which branch applies depends on whether a card is still animating out, and
  // that is decided on the UI thread — where the exit animation is the thing that
  // flips it. Deciding it from a JS-side read raced the animation's last frame:
  // the card was turned back to `animating-in` after it had already finished, so
  // the done-animating effect had removed its data while its status came back to
  // life. Rendering that card was the crash.
  const restoreFromHistory = () => {
    const item = swipedStackRef.current.pop();
    if (!item) {
      warn(`↩️: No item in history`);
      return;
    }
    const entry: SwipeableStatusEntry = { id: item.id, status: "animating-in", direction: item.direction };
    setSwipeablesArrayData((prev) => [{ id: item.id, data: item.data }, ...prev]);
    updateStatuses((statuses) => {
      "worklet";
      return [entry, ...statuses];
    });
    log(`↩️: Item restored from history`);
  };

  const undoFromHistory = () => {
    updateStatuses((statuses) => {
      "worklet";
      let lastAnimOut = -1;
      for (let i = statuses.length - 1; i >= 0; i--) {
        if (statuses[i].status === "animating-out") {
          lastAnimOut = i;
          break;
        }
      }
      if (lastAnimOut >= 0) {
        // Set last animating-out back to animating-in
        return statuses.map((s, i) => (i === lastAnimOut ? { ...s, status: "animating-in" as const } : s));
      }
      runOnJS(restoreFromHistory)();
      return statuses;
    });
  };

  // ── Filter for rendering from snapshot ──
  //
  // Statuses and data are two stores updated on two threads, so a status can be
  // mirrored back before its data is added, or after its data was removed. Such
  // an entry has nothing to draw; it must be skipped, not rendered with `undefined`
  // data — the host's card component would read a field off it and throw, and a
  // throw during render takes the whole host app down.
  let idleRenderCount = 0;
  const swipeablesToRender: { id: number; status: SwipeableStatusEntry["status"]; direction?: SwipeDirection; data: T }[] = [];
  for (const s of statusesSnapshot) {
    const renderable = s.status === "animating-out" || s.status === "animating-in" || (s.status === "idle" && idleRenderCount < 3);
    if (!renderable) continue;
    const dataItem = swipeablesArrayData.find((d) => d.id === s.id);
    if (!dataItem) {
      warn(`Card ${s.id} has a status (${s.status}) but no data yet; skipped this render`);
      continue;
    }
    if (s.status === "idle") idleRenderCount++;
    swipeablesToRender.push({ id: s.id, status: s.status, direction: s.direction, data: dataItem.data });
  }

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
