const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const output = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, Set });
  return exports;
}
const { emptyDeck, appendCards, swipeCard, undoCard, finishCard } = load('../lib/state.ts');
const { stackPosition } = load('../lib/stack.ts');
const threshold = 140;
const sample = (id, transition, x = 0, y = 0) => ({ id, transition, x, y });
const position = (state, id, progress) => ({ ...stackPosition(state.cards, id, progress, threshold) });
function swiped(direction = 'left') {
  const state = swipeCard(appendCards(emptyDeck(), [1, 2, 3, 4], 1), 1, direction, 50);
  return finishCard(state, 1, state.transition);
}

test('undo preserves every visible stack slot while the returning card waits for React to mount', () => {
  const before = swiped();
  const progress = sample(2, 0);
  const after = undoCard(before);
  for (const id of [2, 3, 4]) {
    assert.deepEqual(position(after, id, progress), position(before, id, progress));
  }
});

test('a stale sample from the same card cannot make an undo start at the center', () => {
  const state = undoCard(swiped());
  for (const progress of [sample(null, 0), sample(1, 0), sample(1, state.transition - 1, 10)]) {
    assert.deepEqual(position(state, 2, progress), { scale: 1, translateY: 0 });
  }
});

for (const [direction, x, y] of [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]]) {
  test(`undo from ${direction} recedes once as the returning card enters the stack`, () => {
    const state = undoCard(swiped(direction));
    const frames = [560, 140, 105, 70, 35, 0].map(distance =>
      position(state, 2, sample(1, state.transition, distance * x, distance * y)));
    assert.deepEqual(frames[0], { scale: 1, translateY: 0 });
    assert.deepEqual(frames[1], frames[0]);
    assert.deepEqual(frames[3], { scale: 0.975, translateY: 8 });
    assert.deepEqual(frames.at(-1), { scale: 0.95, translateY: 16 });
    for (let index = 1; index < frames.length; index++) {
      assert.ok(frames[index].scale <= frames[index - 1].scale);
      assert.ok(frames[index].translateY >= frames[index - 1].translateY);
    }
    assert.deepEqual(position(finishCard(state, 1, state.transition), 2, sample(1, state.transition)), frames.at(-1));
  });
}

test('rapid undo of a mounted outgoing card uses its current position, not an earlier transition', () => {
  let state = swipeCard(appendCards(emptyDeck(), [1, 2, 3], 1), 1, 'right', 50);
  state = undoCard(state);
  assert.deepEqual(position(state, 2, sample(1, state.transition - 1)), { scale: 1, translateY: 0 });
  assert.deepEqual(position(state, 2, sample(1, state.transition, 70)), { scale: 0.975, translateY: 8 });
});

test('normal dragging still advances the stack and ignores another card\'s progress', () => {
  const state = swiped();
  assert.deepEqual(position(state, 3, sample(2, 0, 70)), { scale: 0.975, translateY: 8 });
  assert.deepEqual(position(state, 3, sample(1, 1, 560)), { scale: 0.95, translateY: 16 });
});
