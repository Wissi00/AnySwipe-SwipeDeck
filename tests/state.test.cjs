const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const output = ts.transpileModule(fs.readFileSync(require.resolve('../lib/state.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(output, { exports: exportsObject, Set });
const { emptyDeck, appendCards, cardsToRender, frontCard, swipeCard, undoCard, finishCard, swipeDirection, removeCards } = exportsObject;
const deck = () => appendCards(emptyDeck(), [1, 2, 3], 1);
const ids = entries => Array.from(entries, entry => entry.id);

test('append is atomic, idempotent, and keeps outgoing cards', () => {
  let state = swipeCard(deck(), 1, 'left', 50);
  state = appendCards(state, [2, 4, 4, 5], 2);
  assert.deepEqual(ids(state.cards), [1, 2, 3, 4, 5]);
  assert.equal(state.cards[0].status, 'animating-out');
  assert.equal(state.batch, 2);
});

test('only the front card swipes, and a duplicate cannot fire a second action', () => {
  const initial = deck();
  assert.equal(swipeCard(initial, 2, 'right', 50), initial);
  const swiped = swipeCard(initial, 1, 'right', 50);
  assert.equal(swipeCard(swiped, 1, 'left', 50), swiped);
  assert.equal(frontCard(swiped).id, 2);
});

test('undo during exit survives a stale completion and locks every swipe path', () => {
  const swiped = swipeCard(deck(), 1, 'left', 50);
  const returning = undoCard(swiped);
  assert.equal(finishCard(returning, 1, swiped.transition), returning);
  assert.equal(swipeCard(returning, 2, 'up', 50), returning);
  assert.equal(undoCard(returning), returning);
  assert.equal(frontCard(returning), undefined);
  assert.equal(frontCard(finishCard(returning, 1, returning.transition)).id, 1);
});

test('out-of-order exits preserve LIFO undo order', () => {
  let state = swipeCard(deck(), 1, 'left', 50);
  const firstTransition = state.transition;
  state = swipeCard(state, 2, 'up', 50);
  state = finishCard(state, 2, state.transition);
  state = finishCard(state, 1, firstTransition);
  state = undoCard(state);
  assert.equal(state.cards[0].id, 2);
  assert.equal(state.cards[0].direction, 'up');
  state = finishCard(state, 2, state.transition);
  state = undoCard(state);
  assert.equal(state.cards[0].id, 1);
});

test('a completion cannot finish a later swipe of the same card', () => {
  let state = swipeCard(deck(), 1, 'right', 50);
  const oldTransition = state.transition;
  state = undoCard(state);
  state = finishCard(state, 1, state.transition);
  state = swipeCard(state, 1, 'down', 50);
  assert.equal(finishCard(state, 1, oldTransition), state);
  assert.equal(state.cards[0].status, 'animating-out');
});

test('the last card remains undoable after its animation finishes', () => {
  let state = swipeCard(appendCards(emptyDeck(), [1], 1), 1, 'down', 50);
  state = finishCard(state, 1, state.transition);
  assert.equal(state.cards.length, 0);
  state = undoCard(state);
  assert.deepEqual(ids(state.cards), [1]);
});

test('bounded history and the endless demo release old entries', () => {
  let state = deck();
  for (const id of [1, 2, 3]) {
    state = swipeCard(state, id, 'up', 2);
    state = finishCard(state, id, state.transition);
  }
  assert.deepEqual(ids(state.history), [2, 3]);
  const noUndo = swipeCard(deck(), 1, 'left', 0);
  assert.equal(noUndo.history.length, 0);
  assert.equal(undoCard(noUndo), noUndo);
});

test('direction, velocity, diagonal ties, and opposite flicks are deterministic', () => {
  for (const [x,y,vx,vy,result] of [
    [141,0,0,0,'right'], [-141,0,0,0,'left'], [0,-141,0,0,'up'], [0,141,0,0,'down'],
    [30,10,900,0,'right'], [10,-30,0,-900,'up'], [30,10,-900,0,undefined],
    [0,0,900,900,undefined], [100,100,0,0,undefined], [150,150,0,0,'right'],
  ]) assert.equal(swipeDirection(x,y,vx,vy,140), result);
});

test('async hosts lock input at swipe acceptance, before the JS callback runs', () => {
  const state = swipeCard(deck(), 1, 'right', 50, true);
  assert.equal(frontCard(state), undefined);
  assert.equal(swipeCard(state, 2, 'left', 50, true), state);
  assert.equal(undoCard(state).cards[0].status, 'animating-in');
  assert.equal(frontCard({ ...state, locked: false }).id, 2);
});

test('removing an unavailable ad preserves organic history and the active card', () => {
  let state = swipeCard(deck(), 1, 'left', 50);
  state = swipeCard(state, 2, 'right', 50);
  state = removeCards(state, [2]);
  assert.deepEqual(ids(state.cards), [1, 3]);
  assert.deepEqual(ids(state.history), [1]);
  assert.equal(frontCard(state).id, 3);
  assert.equal(undoCard(state).cards[0].id, 1);
});

test('a completed exit retains one render-only card without changing the active deck', () => {
  let state = swipeCard(deck(), 1, 'left', 50);
  assert.deepEqual(ids(cardsToRender(state)), [1, 2, 3]); // no duplicate while exiting
  state = finishCard(state, 1, state.transition);
  const rendered = cardsToRender(state);
  assert.deepEqual(ids(rendered), [1, 2, 3]);
  assert.equal(rendered[0].status, 'done-animating');
  assert.equal(rendered[0].direction, 'left');
  assert.deepEqual(ids(state.cards), [2, 3]);
  assert.equal(frontCard(state).id, 2);
});

test('completed history mounts at most one card even after a long swipe session', () => {
  let state = appendCards(emptyDeck(), Array.from({ length: 103 }, (_, i) => i + 1), 1);
  for (let id = 1; id <= 100; id++) {
    state = swipeCard(state, id, 'right', 50);
    state = finishCard(state, id, state.transition);
    assert.equal(cardsToRender(state).length, 4);
    assert.equal(cardsToRender(state).filter(card => card.status === 'done-animating').length, 1);
  }
  assert.deepEqual(ids(cardsToRender(state)), [100, 101, 102, 103]);
  assert.equal(state.history.length, 50);
});

test('undo prepares the next older card during the current return and removal releases retained views', () => {
  let state = deck();
  for (const id of [1, 2]) {
    state = swipeCard(state, id, 'up', 50);
    state = finishCard(state, id, state.transition);
  }
  assert.deepEqual(ids(cardsToRender(state)), [2, 3]);
  state = undoCard(state);
  const rendered = cardsToRender(state);
  assert.deepEqual(ids(rendered), [1, 2, 3]);
  assert.equal(rendered[0].status, 'done-animating');
  assert.equal(rendered[1].status, 'animating-in');
  state = removeCards(state, [1]);
  assert.deepEqual(ids(cardsToRender(state)), [2, 3]);
});

test('decks without undo history do not retain completed cards', () => {
  let state = swipeCard(deck(), 1, 'down', 0);
  state = finishCard(state, 1, state.transition);
  assert.deepEqual(ids(cardsToRender(state)), [2, 3]);
});
