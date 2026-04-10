# AnySwipe-SwipeDeck

A headless, generic swipe-deck library for React Native. Bring your own card component — AnySwipe-SwipeDeck handles the gesture detection, animation, history, and infinite loading pattern.

## Features

- Swipe in 4 directions: left, right, up, down
- Gesture-driven **and** programmatic swiping
- Built-in undo with animated card restore
- Internal history — no state management required from the consumer
- Imperative data loading via `appendData` — feed batches as needed
- `onRemainingChange` hook for infinite-scroll style pagination
- Fully generic: your card component receives only its own props

## Requirements

- `react-native-gesture-handler`
- `react-native-reanimated`

## Installation

```sh
# (not yet published — copy lib/ into your project)
```

## Quick Start

```tsx
import { SwipeDeck, useSwipeDeck, createSwipeableData } from "@/lib";

type CardData = { title: string; image: string };

function MyCard({ title, image }: CardData) {
  return <Image source={{ uri: image }} />;
}

const BATCH_SIZE = 10;
const LOAD_THRESHOLD = 4;

export default function Feed() {
  const { deckRef, swipeLeft, swipeRight, undo, appendData } = useSwipeDeck<CardData>();

  const indexRef = useRef(0);

  const loadBatch = () => {
    const batch = fetchCards(indexRef.current, BATCH_SIZE).map(createSwipeableData);
    indexRef.current += BATCH_SIZE;
    appendData(batch);
  };

  useEffect(() => {
    loadBatch();
  }, []);

  return (
    <>
      <SwipeDeck
        ref={deckRef}
        ItemComponent={MyCard}
        onSwipeLeft={(item) => console.log("disliked", item)}
        onSwipeRight={(item) => console.log("liked", item)}
        onRemainingChange={(count) => {
          if (count <= LOAD_THRESHOLD) loadBatch();
        }}
      />
      <Button title="Undo" onPress={undo} />
      <Button title="Skip" onPress={swipeLeft} />
      <Button title="Like" onPress={swipeRight} />
    </>
  );
}
```

## API

### `useSwipeDeck<T>()`

The primary consumer hook. Returns everything needed to control the deck.

```ts
const {
  deckRef, // ref to pass to <SwipeDeck ref={deckRef} />
  swipeLeft, // programmatically swipe the top card left
  swipeRight, // programmatically swipe the top card right
  swipeUp, // programmatically swipe the top card up
  swipeDown, // programmatically swipe the top card down
  undo, // restore the last swiped card with an animate-in
  appendData, // append a batch of SwipeableData<T> to the deck
} = useSwipeDeck<CardData>();
```

---

### `<SwipeDeck>`

```tsx
<SwipeDeck
  ref={deckRef}
  ItemComponent={MyCard}
  onSwipeLeft={(item) => {}}
  onSwipeRight={(item) => {}}
  onSwipeUp={(item) => {}}
  onSwipeDown={(item) => {}}
  onCardRemoved={() => {}}
  onRemainingChange={(count) => {}}
/>
```

#### Props

| Prop                | Type                      | Description                                                                                   |
| ------------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `ref`               | `SwipeDeckRef<T>`         | Ref from `useSwipeDeck`. Required for programmatic control.                                   |
| `ItemComponent`     | `React.ComponentType<T>`  | The card component. Receives your domain data as props.                                       |
| `onSwipeLeft`       | `(item: T) => void`       | Fired when a card is swiped left.                                                             |
| `onSwipeRight`      | `(item: T) => void`       | Fired when a card is swiped right.                                                            |
| `onSwipeUp`         | `(item: T) => void`       | Fired when a card is swiped up.                                                               |
| `onSwipeDown`       | `(item: T) => void`       | Fired when a card is swiped down.                                                             |
| `onCardRemoved`     | `() => void`              | Fired after a card fully animates out and is released from the deck.                          |
| `onRemainingChange` | `(count: number) => void` | Fired whenever the number of idle cards in the deck changes. Use this to trigger batch loads. |

---

### `createSwipeableData<T>(data: T): SwipeableData<T>`

Wraps your domain data in the internal format expected by `appendData`. Auto-assigns a unique ID.

```ts
const card = createSwipeableData({ title: "Hello", image: "..." });
// { id: 0, status: 'idle', data: { title: 'Hello', image: '...' } }
```

---

### Types

```ts
type SwipeDirection = "left" | "right" | "up" | "down";

type SwipeStatus = "idle" | "animating-in" | "animating-out" | "done-animating";

type SwipeableData<T> = {
  id: number;
  status: SwipeStatus;
  direction?: SwipeDirection;
  data: T;
};

interface SwipeDeckRef<T extends object> {
  swipeLeft: () => void;
  swipeRight: () => void;
  swipeUp: () => void;
  swipeDown: () => void;
  undo: () => void;
  appendData: (items: SwipeableData<T>[]) => void;
}
```

---

## Infinite Loading Pattern

`onRemainingChange` fires every time the idle card count changes (a card is swiped, an undo restores one, a batch is appended). Use it instead of managing a counter yourself:

```tsx
<SwipeDeck
  ref={deckRef}
  ItemComponent={MyCard}
  onRemainingChange={(count) => {
    if (count <= 4) loadNextBatch();
  }}
/>
```

On first mount the deck is empty, so `onRemainingChange(0)` fires immediately — this is the intended trigger for the initial load.

---

## Undo

Undo is fully managed internally. The deck keeps a history of every swiped card. Calling `undo()` pops the last entry and re-inserts it at the top with an animate-in transition. No extra state needed on the consumer side.

```ts
const { undo } = useSwipeDeck<CardData>();

<Button onPress={undo} title="Undo" />
```
