import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeyboard } from '../src/input/keyboard.ts';
import { screenDirection } from '../src/game/navigation.ts';

test('physical Cyrillic-layout keys work, opposite keys cancel, blur and transitions clear held input', () => {
  const browserWindow = new EventTarget();
  const browserDocument = new EventTarget();
  const originals = new Map(['window', 'document', 'HTMLElement'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: browserWindow },
    document: { configurable: true, value: browserDocument },
    HTMLElement: { configurable: true, value: class {} },
  });
  const keyboard = createKeyboard();
  const key = (code: string, repeat = false, type = 'keydown') => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { code, key: 'њ', repeat });
    browserWindow.dispatchEvent(event);
  };
  try {
    key('KeyW');
    assert.deepEqual(keyboard.direction(), { x: -0.6, z: 0.8 });
    assert.deepEqual(keyboard.direction('excavation'), screenDirection(0, 1, 'excavation'));
    key('KeyS');
    assert.deepEqual(keyboard.direction(), { x: 0, z: 0 });
    key('KeyS', false, 'keyup');
    for (const clear of [() => browserWindow.dispatchEvent(new Event('blur')), () => browserDocument.dispatchEvent(new Event('visibilitychange')), keyboard.clear]) {
      key('KeyW');
      clear();
      key('KeyW', true);
      assert.deepEqual(keyboard.direction(), { x: 0, z: 0 });
      key('KeyW', false, 'keyup');
    }
    keyboard.dispose();
    key('ArrowRight');
    assert.deepEqual(keyboard.direction(), { x: 0, z: 0 });
  } finally {
    keyboard.dispose();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
