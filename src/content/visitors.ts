export const VISITORS = { basePrice: 1, perDisplay: 1, arrivalSeconds: [12, 10, 8],
  capacity: 6, queueCapacity: 3, serviceSeconds: 1, speed: 2.4, viewingSeconds: 5 } as const;
export const CASHIER = { x: 5.3, z: -1.6, width: 1.8, depth: 0.8 };
export const CASHIER_STATION = { x: CASHIER.x, z: CASHIER.z + 1.05, radius: 0.65 };
export const VISITOR_ENTRANCE = { x: 3.8, z: -5.85, width: 2.4 };
export const ENTRANCE_POSTS = [-1, 1].map(side => ({ x: VISITOR_ENTRANCE.x + side * VISITOR_ENTRANCE.width / 2,
  z: VISITOR_ENTRANCE.z, width: 0.28, depth: 0.28 }));
export const VISITOR_DOOR = { x: VISITOR_ENTRANCE.x, z: -5.3 };
export const CASH_PILE = { x: 6.85, z: CASHIER.z, width: 0.9, depth: 0.9, maxCoins: 40 };
export const queuePoint = (index: number) => ({ x: CASHIER.x, z: CASHIER.z - 1.05 - index * 0.9 });
export const VIEW_POINTS = {
  dimetrodon: { x: -2.8, z: -3.4 }, trilobite: { x: -1, z: 4.5 }, eryops: { x: -12.5, z: -3.4 },
} as const;
export const visitorText = {
  cashier: 'Каса', entrance: 'Улаз', price: 'Улазница', first: 'Доврши једну поставку да посетиоци дођу.',
  approach: 'Стани у круг код касе да продајеш улазнице.', serving: 'Продајемо улазнице!',
  waiting: 'Чекају', welcome: 'Чекамо посетиоце.', increase: 'Улазница +1',
};
