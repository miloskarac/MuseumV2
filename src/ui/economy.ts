import { economyText as t } from '../content/economy';
import { visitorText } from '../content/visitors';

export function createEconomyUi(root: HTMLElement, retrySession: () => void) {
  const badge = document.createElement('div'); badge.className = 'coin-balance';
  badge.innerHTML = `<span class="banknote-stack" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--note:${i}" hidden></i>`).join('')}</span><span class="coin-label">${t.coins}</span><strong id="coin-count">—</strong><span id="coin-gain" role="status"></span>`;
  root.querySelector('.masthead')!.append(badge);
  const blocker = document.createElement('section'); blocker.className = 'session-blocker';
  blocker.innerHTML = `<div role="status"><p></p><button>${t.retry}</button></div>`;
  root.append(blocker);
  blocker.querySelector('button')!.onclick = retrySession;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const gain = badge.querySelector<HTMLElement>('#coin-gain')!;
  const stack = badge.querySelector<HTMLElement>('.banknote-stack')!;
  const notes = [...stack.children] as HTMLElement[];
  return {
    balance(coins: number, earned = 0, cashPickup = false) {
      badge.querySelector('#coin-count')!.textContent = String(coins);
      badge.setAttribute('aria-label', `${t.coins}: ${coins}`);
      // A bounded visual summary of the current wallet, never another ledger.
      const count = Math.min(notes.length, Math.ceil(Math.sqrt(Math.max(0, coins))));
      notes.forEach((note, i) => { note.hidden = i >= count; });
      if (earned > 0) {
        clearTimeout(timer); gain.textContent = cashPickup ? visitorText.collected : `+${earned}`;
        stack.classList.toggle('collecting', cashPickup);
        timer = setTimeout(() => { gain.textContent = ''; stack.classList.remove('collecting'); }, 1500);
      }
    },
    clearGain() { clearTimeout(timer); gain.textContent = ''; stack.classList.remove('collecting'); },
    session(message: string | null) {
      blocker.hidden = message === null;
      blocker.querySelector('p')!.textContent = message ?? '';
    },
    dispose() { clearTimeout(timer); badge.remove(); blocker.remove(); },
  };
}
