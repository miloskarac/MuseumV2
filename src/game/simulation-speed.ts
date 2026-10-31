export const GAME_SPEEDS = [1, 2, 5, 10] as const;
export type GameSpeed = typeof GAME_SPEEDS[number];

// Repeat the ordinary bounded update so collision, contact and panel guards
// run between steps. Clamp real time first: a stalled/hidden tab never catches up.
export function advanceSimulation(realSeconds: number, speed: GameSpeed, step: (seconds: number) => void) {
  if (!Number.isFinite(realSeconds) || realSeconds <= 0) return;
  const seconds = Math.min(realSeconds, 0.05);
  for (let i = 0; i < speed; i++) step(seconds);
}
