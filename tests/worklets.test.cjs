const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');

test('production compilation workletizes transitions and never captures overlay React trees', () => {
  const root = path.resolve(__dirname, '../..');
  for (const file of ['state.ts', 'stack.ts', 'hooks/useSwipeState.ts', 'SwipeDeck.tsx', 'SwipeableWrapper.tsx']) {
    const { code } = babel.transformFileSync(path.resolve(__dirname, '../lib', file), {
      cwd: root, configFile: path.join(root, 'babel.config.js'), envName: 'production',
    });
    assert.match(code, /__workletHash/);
    for (const closure of code.matchAll(/__closure\s*=\s*\{([^}]*)\}/g)) {
      assert.doesNotMatch(closure[1], /overlayConfig|callbacksRef|swipeablesArrayData|rotationZ/);
    }
  }
});
