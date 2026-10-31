export const WRITER_LOCK = 'museum-for-luka-v2-writer';
export type SessionStatus = 'waiting' | 'active' | 'unavailable';

// A storage flag is not a lock. A waiting tab never loads or writes progress.
export function createSaveSession(locks: Pick<LockManager, 'request'> | undefined, status: (value: SessionStatus) => void, lockName = WRITER_LOCK) {
  let generation = 0, active = false, disposed = false;
  let controller: AbortController | null = null;
  let releaseLock: (() => void) | null = null;
  function release() {
    generation++; active = false;
    controller?.abort(); controller = null;
    releaseLock?.(); releaseLock = null;
  }
  function acquire() {
    if (disposed || active || controller) return;
    if (!locks) { status('unavailable'); return; }
    const token = ++generation;
    controller = new AbortController(); status('waiting');
    void locks.request(lockName, { signal: controller.signal }, async () => {
      if (disposed || token !== generation) return;
      // Install release before notifying the app: startup may itself be blocked.
      const held = new Promise<void>(resolve => { releaseLock = resolve; });
      active = true; status('active');
      await held;
    }).catch(error => {
      if (token !== generation || disposed || error?.name === 'AbortError') return;
      release(); status('unavailable');
    });
  }
  return { acquire, release, active: () => active, dispose() { disposed = true; release(); } };
}
