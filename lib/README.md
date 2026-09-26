# AnySwipe SwipeDeck

A headless, four-direction swipe deck library for React Native.

## Install

```sh
npm install anyswipe-swipedeck
```

## Peer dependencies

You must already have these installed in your app:

- `react`
- `react-native`
- `react-native-gesture-handler`
- `react-native-reanimated`
- `react-native-worklets` (required by `react-native-reanimated`)

## Usage

See the project root README for the full API reference, demo app instructions, and examples.


### Transactional swipe callbacks (1.4.0)

`onUndo(item)` runs only after the UI thread accepts an undo. Apply the inverse
application action here, rather than immediately after calling `undo()`; an undo
requested while a card is returning is ignored. Swipe callbacks are delivered
once at acceptance, and history follows swipe order even when exits finish out
of order.

`waitForSwipe` locks further swipes at acceptance until the direction callback
settles. Return the save/vote promise from that callback (do not discard it with
`void`). This is useful for voting screens that restore a failed vote with
`undo()`. The lock also releases if the callback rejects.

`maxHistorySize` bounds retained undo payloads. It defaults to unlimited for
compatibility. Use `0` for an endless demonstration with no undo, or a finite
limit for long feeds. `useSwipeDeck` returns stable methods suitable for effect
dependencies. Repeated append IDs are ignored.

The latest completed swipe stays mounted invisibly offscreen, allowing undo
to start on the UI thread without remounting its content. Only one completed
history view is retained; older payloads mount as needed during the preceding
undo. This does not increase the remaining count or retain any views when
`maxHistorySize` is `0`. Content with native resources should release those
resources on unmount, rather than at swipe acceptance.

Keep the deck mounted when its remaining count reaches zero; render completion
or pagination UI alongside it so undo history and the final exit survive.

`removeData(ids)` removes unavailable cards, and their undo entries, without
emitting swipe callbacks. It keeps the rest of the deck mounted. Hosts that
mirror history should remove those same entries from their own history.
