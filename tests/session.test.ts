import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSaveSession } from '../src/persistence/session.ts';

function fixture() {
  const requests: { signal: AbortSignal; run: () => Promise<unknown>; resolve: () => void }[] = [];
  const locks = { request(_name: string, options: { signal: AbortSignal }, callback: () => Promise<unknown>) {
    return new Promise<void>(resolve => requests.push({ signal: options.signal, run: callback, resolve }));
  } } as unknown as Pick<LockManager, 'request'>;
  return { locks, requests };
}

test('session never becomes writable while waiting and can reacquire after page suspension', async () => {
  const f = fixture(), statuses: string[] = [];
  const session = createSaveSession(f.locks, s => statuses.push(s));
  session.acquire(); session.acquire(); assert.equal(f.requests.length, 1);
  assert.equal(session.active(), false); assert.deepEqual(statuses, ['waiting']);
  const held = f.requests[0].run(); assert.equal(session.active(), true);
  session.release(); await held; assert.equal(session.active(), false);
  session.acquire(); assert.equal(f.requests.length, 2);
  const resumed = f.requests[1].run(); assert.equal(session.active(), true);
  session.dispose(); await resumed;
  session.acquire(); assert.equal(f.requests.length, 2);
});

test('cancelled queued acquisition cannot revive a disposed or superseded session', async () => {
  const f = fixture(), statuses: string[] = [];
  const session = createSaveSession(f.locks, s => statuses.push(s));
  session.acquire(); session.release(); session.acquire();
  assert.equal(f.requests[0].signal.aborted, true);
  await f.requests[0].run(); assert.equal(session.active(), false);
  session.dispose(); await f.requests[1].run(); assert.equal(session.active(), false);
  assert.equal(statuses.includes('active'), false);
});

test('unsupported or denied locking fails closed without activating a writer', async () => {
  const statuses: string[] = [];
  const missing = createSaveSession(undefined, s => statuses.push(s)); missing.acquire();
  assert.equal(missing.active(), false); assert.deepEqual(statuses, ['unavailable']);
  const denied = createSaveSession({ request: () => Promise.reject(Error('denied')) } as unknown as Pick<LockManager,'request'>, s => statuses.push(s));
  denied.acquire(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(denied.active(), false); assert.equal(statuses.at(-1), 'unavailable'); denied.dispose();
});

test('an isolated QA save can use its own lock without acquiring the normal game lock', async () => {
  const names: string[] = [];
  const locks = { request(name: string) { names.push(name); return Promise.reject(Error('stop')); } } as unknown as Pick<LockManager, 'request'>;
  const session = createSaveSession(locks, () => {}, 'museum-purchases-qa');
  session.acquire(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(names, ['museum-purchases-qa']); session.dispose();
});
