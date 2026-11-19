export function createRoomCompletionUi(root: HTMLElement) {
  const banner = document.createElement('aside'); banner.id = 'room-completion'; banner.className = 'room-completion'; banner.hidden = true;
  banner.innerHTML = '<strong role="status">Браво! Прва сала је завршена! 🎉</strong><p>Сва четири фосила су изложена. Друга сала стиже касније.</p><button>Настави шетњу</button>';
  root.querySelector('.stage')!.append(banner);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let blocked = false, pending = false;
  const hide = () => { clearTimeout(timer); banner.hidden = true; pending = false; };
  const reveal = () => { if (pending && !blocked) { banner.hidden = false; timer = setTimeout(hide, 7000); } };
  banner.querySelector('button')!.onclick = hide;
  return { show() { hide(); pending = true; reveal(); }, hide,
    // Native activity dialogs cover the stage. Begin the celebration's visible
    // time only after the child closes the fossil information card.
    setBlocked(value: boolean) {
      if (blocked === value) return;
      blocked = value; clearTimeout(timer); banner.hidden = true; reveal();
    },
    dispose() { hide(); banner.remove(); } };
}
