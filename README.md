# SwipeDeck

A headless, 4-direction swipe-deck library for React Native. Bring your own card component — SwipeDeck handles gesture detection, 60fps animations, undo history, and batch loading.

Built as the core interaction layer for [AnySwipe](https://anyswipe-ce76c.web.app), a Tinder-style anime and TV show discovery app.

---

## What it is

SwipeDeck gives you a gesture-driven card stack where users can swipe in any of four directions. It is completely headless — you supply the card UI, SwipeDeck supplies everything else: the gesture system, animation state machine, undo history stack, and the batch-loading trigger.

**Who it is for:** React Native developers building swipe-driven interfaces — discovery feeds, content triage tools, watchlist managers, or anything where a user needs to make a quick decision on a stream of cards.

**What problem it solves:** Most swipe libraries only support left/right, are tightly coupled to their own card UI, or require you to manage swipe state yourself. SwipeDeck supports all four directions, renders whatever component you pass in, and keeps internal state entirely out of your way.

---

## Features

- Swipe in 4 directions: left, right, up, and down
- Gesture-driven and programmatic swiping from buttons or any other trigger
- Animated card stack — back cards appear at a visual offset and scale, and dynamically scale up as the top card is dragged
- Built-in undo with animated card restore — no extra state needed on your side
- Internal history stack managed entirely by the library
- Feed new cards at any time via `appendData`
- Clickable top cards with `onCardPress` callback — swiping and tapping don't interfere
- `onRemainingChange` fires automatically as the card count changes, making infinite scroll trivial to implement
- Customizable swipe overlays with color, directional icons, and opacity controls per direction
- Fully generic — `<SwipeDeck>` renders whatever component you give it, with your own props passed through directly
- Optional `debug` prop for verbose console logging of internal state transitions

---

## Installation

Install the package using your preferred package manager:

```sh
npm install anyswipe-swipedeck
```

Or with yarn:

```sh
yarn add anyswipe-swipedeck
```

You must also have the following peer dependencies installed and linked:

```sh
npm install react-native-gesture-handler react-native-reanimated react-native-worklets
```

For Expo projects, use `npx expo install` instead to get versions matched to your Expo SDK:

```sh
npx expo install react-native-gesture-handler react-native-reanimated react-native-worklets
```

Follow the setup guides for each package:

- [react-native-gesture-handler setup](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation)
- [react-native-reanimated setup](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started)

On Android, make sure `<GestureHandlerRootView>` wraps your app root if your navigation setup does not already include one.

---

## Quick Start

```tsx
import { SwipeDeck, useSwipeDeck, createSwipeableData } from "anyswipe-swipedeck";
import { useRef } from "react";
import { Button, Image } from "react-native";

type CardData = { title: string; imageUri: string };

function MyCard({ title, imageUri }: CardData) {
  return <Image source={{ uri: imageUri }} style={{ width: 300, height: 400 }} />;
}

const BATCH_SIZE = 10;
const LOAD_THRESHOLD = 4;

export default function Feed() {
  const { deckRef, swipeLeft, swipeRight, swipeUp, swipeDown, undo, appendData } = useSwipeDeck<CardData>();

  const indexRef = useRef(0);

  const loadBatch = () => {
    const batch = fetchCards(indexRef.current, BATCH_SIZE).map(createSwipeableData);
    indexRef.current += BATCH_SIZE;
    appendData(batch);
  };

  // onRemainingChange fires with count=0 on first mount — use it as the initial load trigger
  const handleRemainingChange = (count: number) => {
    if (count <= LOAD_THRESHOLD) loadBatch();
  };

  return (
    <>
      <SwipeDeck
        ref={deckRef}
        ItemComponent={MyCard}
        onSwipeLeft={(item) => console.log("skipped", item)}
        onSwipeRight={(item) => console.log("liked", item)}
        onSwipeUp={(item) => console.log("plan to watch", item)}
        onSwipeDown={(item) => console.log("watching", item)}
        onCardPress={(item) => console.log("tapped card", item)}
        onRemainingChange={handleRemainingChange}
      />
      <Button title="Undo" onPress={undo} />
      <Button title="Skip" onPress={swipeLeft} />
      <Button title="Like" onPress={swipeRight} />
      <Button title="Plan to Watch" onPress={swipeUp} />
      <Button title="Watching" onPress={swipeDown} />
    </>
  );
}
```

---

## API Reference

### `useSwipeDeck<T>()`

The primary consumer hook. Returns a ref to wire up to `<SwipeDeck>` and all control functions.

```ts
const {
  deckRef, // Ref to pass to <SwipeDeck ref={deckRef} />
  swipeLeft, // Programmatically swipe the top card left
  swipeRight, // Programmatically swipe the top card right
  swipeUp, // Programmatically swipe the top card up
  swipeDown, // Programmatically swipe the top card down
  undo, // Restore the last swiped card with an animate-in
  appendData, // Append a SwipeableData<T>[] batch to the deck
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
  onCardPress={(item) => {}}
  onRemainingChange={(count) => {}}
  overlayConfig={{
    left: { color: "#FF3B30", icon: <MyIcon />, maxOpacity: 0.9 },
    right: { color: "#4CD964" },
  }}
  debug
/>
```

#### Props

| Prop                     | Type                      | Required | Description                                                                                                        |
| ------------------------ | ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `ref`                    | `SwipeDeckRef<T>`         | Yes      | Ref from `useSwipeDeck`. Required for programmatic control.                                                        |
| `ItemComponent`          | `React.ComponentType<T>`  | Yes      | Your card component. Receives your domain data directly as props.                                                  |
| `onSwipeLeft`            | `(item: T) => void`       | No       | Called when a card is swiped left.                                                                                 |
| `onSwipeRight`           | `(item: T) => void`       | No       | Called when a card is swiped right.                                                                                |
| `onSwipeUp`              | `(item: T) => void`       | No       | Called when a card is swiped up.                                                                                   |
| `onSwipeDown`            | `(item: T) => void`       | No       | Called when a card is swiped down.                                                                                 |
| `onCardPress`            | `(item: T) => void`       | No       | Called when the top card is tapped. Swipes do not trigger taps.                                                    |
| `onRemainingChange`      | `(count: number) => void` | No       | Called whenever the remaining card count changes. Fires with `0` on first mount — use as the initial load trigger. |
| `overlayConfig`          | `SwipeOverlayConfig`      | No       | Configures visual overlays (colors, icons, opacities) that appear during swipes in each direction.                 |
| `allowBackgroundTouches` | `boolean`                 | No       | Allows touch events to pass through to cards stacked behind the top card. Defaults to `false`.                     |
| `debug`                  | `boolean`                 | No       | Enables verbose console logging of internal state transitions. Defaults to `false`.                                |

---

### `createSwipeableData<T>(data: T): SwipeableData<T>`

Wraps your domain data in the internal format required by `appendData`. Auto-assigns a unique ID.

```ts
const card = createSwipeableData({ title: "My Show", imageUri: "https://..." });
// { id: 0, status: 'idle', data: { title: 'My Show', imageUri: '...' } }
```

Use this when building a batch before calling `appendData`:

```ts
const batch = rawItems.map(createSwipeableData);
appendData(batch);
```

---

### Types

```ts
type SwipeOverlayConfig = {
  left?: DirectionOverlayConfig;
  right?: DirectionOverlayConfig;
  up?: DirectionOverlayConfig;
  down?: DirectionOverlayConfig;
};

type DirectionOverlayConfig = {
  color?: string;
  icon?: React.ReactNode;
  maxOpacity?: number; // defaults to 1
};

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

## Demo App

The `app/` directory contains a working Expo demo app. It renders a stack of colored cards and wires up all four swipe directions, programmatic buttons, undo, and batch loading via `onRemainingChange`.

### Run locally

```sh
git clone https://github.com/Wissi00/AnySwipe-SwipeDeck.git
cd AnySwipe-SwipeDeck
npm install
npx expo start
```

Press `a` for Android or `i` for iOS. You will need a running emulator or a physical device with the Expo Go app installed.

The demo is for testing and learning the API only — it is not the AnySwipe production app.

---

## Usage Notes

### Infinite loading

`onRemainingChange` fires every time the remaining card count changes — when a card is fully swiped off, when undo restores a card, or when a batch is appended. It also fires with `count=0` on first mount, making it the correct trigger for your initial data load without a separate `useEffect`.

```tsx
const handleRemainingChange = (count: number) => {
  if (count <= LOAD_THRESHOLD) loadNextBatch();
};
```

### Undo

Undo is managed entirely inside the library. Every swiped card is pushed onto an internal history stack. Calling `undo()` pops the last card and re-inserts it at the top with an animate-in transition. If a card is currently mid-swipe, undo cancels that animation instead.

```ts
const { undo } = useSwipeDeck<CardData>();
<Button onPress={undo} title="Undo" />
```

### Card rendering

Only the top 3 idle cards plus any cards that are currently animating are mounted at a time. Cards deeper in the queue are not rendered until they reach the top, keeping the component tree shallow regardless of batch size.

### Programmatic swiping

All four swipe functions from `useSwipeDeck` target the current top idle card. If the deck is empty or all cards are animating, calls are silently ignored.

### Platform notes

- Requires `react-native-gesture-handler` and `react-native-reanimated` to be installed and linked.
- On Android, wrap your app root in `<GestureHandlerRootView>` if not already present. `<SwipeDeck>` includes one internally, but your navigation setup may need one at the root level too.
- For Expo managed workflow, always use `npx expo install` to get SDK-compatible versions of both peer dependencies.

---

## Development

```sh
# Install dependencies
npm install

# Start the Expo dev server
npx expo start

# Run on Android
npx expo start --android

# Lint
npx expo lint
```

The library source lives entirely in `lib/`. The Expo app in `app/` is the development harness and is not part of the publishable package.

---

## Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/Wissi00/AnySwipe-SwipeDeck).

- Keep changes focused — one concern per PR.
- Match the existing code style (TypeScript, no default exports from library files).
- For larger changes or new features, open an issue first to discuss the approach before writing code.

---

## License

MIT — see [LICENSE](LICENSE).

---

## Support

Open an issue on [GitHub](https://github.com/Wissi00/AnySwipe-SwipeDeck/issues) for bugs, questions, or feature requests.
