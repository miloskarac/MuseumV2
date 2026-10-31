import { createSaveWriter } from '../persistence/save.ts';
import type { SaveStatus, StoragePort } from '../persistence/save.ts';

export type CommitResult = 'saved' | 'idle' | 'failed' | 'blocked';
// Own the exact pending candidate and its success effect. Retrying never reruns
// a gameplay command. Checkpoints and critical commits share one ordered writer.
export function createCommitter<T>(storage: StoragePort, status: (value: SaveStatus) => void,
  scheduler?: Parameters<typeof createSaveWriter<T>>[2]) {
  let blocked = true, failed = false;
  let pendingEffect: (() => void) | null = null;
  const writer = createSaveWriter<T>(storage, value => {
    if (value === 'failed') failed = true;
    status(value);
  }, scheduler);
  function flush(): CommitResult {
    if (blocked) return 'blocked';
    if (!writer.hasPending()) return failed ? 'failed' : 'idle';
    if (!writer.flush()) return 'failed';
    failed = false;
    const effect = pendingEffect; pendingEffect = null;
    effect?.();
    return 'saved';
  }
  return {
    enable() { blocked = false; failed = false; writer.enable(); },
    canMutate: () => !blocked && !failed && !pendingEffect,
    commit(candidate: T, publish: (value: T) => void): CommitResult {
      if (blocked || failed || pendingEffect) return 'blocked';
      const snapshot = structuredClone(candidate);
      pendingEffect = () => publish(snapshot);
      writer.schedule(snapshot);
      return flush();
    },
    checkpoint(candidate: T) {
      if (blocked || failed || pendingEffect) return false;
      writer.schedule(candidate); return true;
    },
    flush,
    reset() {
      if (blocked || !writer.reset()) return false;
      pendingEffect = null; failed = false; return true;
    },
    block() { blocked = true; pendingEffect = null; writer.cancel(); },
    dispose() { blocked = true; pendingEffect = null; writer.dispose(); },
  };
}
