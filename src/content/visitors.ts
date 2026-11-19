export const VISITORS = { basePrice: 1, perDisplay: 1, arrivalSeconds: [12, 10, 8],
  serviceSeconds: 1, speed: 2.4, viewingSeconds: 5 } as const;
export const VISITOR_CAPACITIES = {
  1: { waiting: 6, admitted: 6 }, 2: { waiting: 10, admitted: 12 }, 3: { waiting: 14, admitted: 18 },
} as const;
export const CASHIER = { x: 5.3, z: -1.6, width: 1.8, depth: 0.8 };
export const CASHIER_STATION = { x: CASHIER.x, z: CASHIER.z + 1.05, radius: 0.65 };
export const VISITOR_ENTRANCE = { x: 3.8, z: -5.85, width: 2.4 };
export const ENTRANCE_POSTS = [-1, 1].map(side => ({ x: VISITOR_ENTRANCE.x + side * VISITOR_ENTRANCE.width / 2,
  z: VISITOR_ENTRANCE.z, width: 0.28, depth: 0.28 }));
export const VISITOR_DOOR = { x: VISITOR_ENTRANCE.x, z: -5.3 };
export const CASH_PILE = { x: 6.85, z: CASHIER.z, width: 0.9, depth: 0.9, maxNotes: 20, pickupRadius: 1.1 };
// Fold the six-place line inside the cashier area, clear of the entrance and
// the player station. Future rooms require their own physical queue extension.
const QUEUE_POINTS = [
  { x: 5.3, z: -2.65 }, { x: 6.3, z: -2.65 }, { x: 7.3, z: -2.65 },
  { x: 7.3, z: -3.55 }, { x: 6.3, z: -3.55 }, { x: 5.3, z: -3.55 },
] as const;
export const queuePoint = (index: number) => QUEUE_POINTS[index] ?? QUEUE_POINTS[0];
export const visitorText = {
  cashier: 'Каса', entrance: 'Улаз', price: 'Улазница', first: 'Доврши једну поставку да посетиоци дођу.',
  approach: 'Стани у круг код касе да продајеш улазнице.', serving: 'Продајемо улазнице!',
  waiting: 'Чекају', welcome: 'Чекамо посетиоце.', increase: 'Улазница',
  admitted: 'У музеју', full: 'Музеј је пун. Чекамо да неко изађе.',
  collect: 'Приђи новчаницама', pending: 'Новчанице код касе', collected: 'Новчанице су у торби!',
};
