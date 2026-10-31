import { economyText as t } from '../content/economy';

export function createEconomyUi(root: HTMLElement, retrySession: () => void) {
  const badge = document.createElement('div'); badge.className = 'coin-balance';
  badge.innerHTML = `<span class="coin-icon" aria-hidden="true">●</span><span class="coin-label">${t.coins}</span><strong id="coin-count">—</strong><span id="coin-gain" role="status"></span>`;
  root.querySelector('.masthead')!.append(badge);
  const blocker = document.createElement('section'); blocker.className = 'session-blocker';
  blocker.innerHTML = `<div role="status"><p></p><button>${t.retry}</button></div>`;
  root.append(blocker);
  blocker.querySelector('button')!.onclick = retrySession;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const gain = badge.querySelector<HTMLElement>('#coin-gain')!;
  return {
    balance(coins: number, earned = 0) {
      badge.querySelector('#coin-count')!.textContent = String(coins);
      badge.setAttribute('aria-label', `${t.coins}: ${coins}`);
      if (earned > 0) {
        clearTimeout(timer); gain.textContent = `+${earned}`;
        timer = setTimeout(() => { gain.textContent = ''; }, 1500);
      }
    },
    clearGain() { clearTimeout(timer); gain.textContent = ''; },
    session(message: string | null) {
      blocker.hidden = message === null;
      blocker.querySelector('p')!.textContent = message ?? '';
    },
    dispose() { clearTimeout(timer); badge.remove(); blocker.remove(); },
  };
}
