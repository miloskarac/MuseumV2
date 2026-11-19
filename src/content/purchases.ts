import type { ExhibitId } from './exhibit.ts';

// Current MVP offers. Historical receipt prices live in frozen contracts.
export const PURCHASES = [
  { id: 'stand-dimetrodon', cost: 12, kind: 'stand', exhibit: 'dimetrodon', title: 'Постоље за велики фосил', hint: 'Овде можеш да слажеш делове са првог налазишта.' },
  { id: 'stand-trilobite', cost: 8, kind: 'stand', exhibit: 'trilobite', title: 'Постоље за малу плочу', hint: 'Овде можеш да поставиш фосил на плочи.' },
  { id: 'west-wing', cost: 18, kind: 'expansion', exhibit: null, title: 'Прошири музеј', hint: 'Отвори нову салу за још један велики фосил.' },
  { id: 'stand-eryops', cost: 16, kind: 'stand', exhibit: 'eryops', title: 'Постоље за ериопса', hint: 'Овде можеш да слажеш делове са другог налазишта.' },
  { id: 'stand-walchia', cost: 10, kind: 'stand', exhibit: 'walchia', title: 'Постоље за валхију', hint: 'Место за гранчицу из другог налазишта.' },
] as const;
export type PurchaseId = typeof PURCHASES[number]['id'];
export const PURCHASE_PAYMENT = { radius: 0.72, secondsPerCoin: 0.25 } as const;
export const purchaseDefinition = (id: string) => PURCHASES.find(offer => offer.id === id);
export const standOffer = (id: ExhibitId) => PURCHASES.find(offer => offer.exhibit === id)!;
export const purchaseText = {
  buy: 'Купи', close: 'Назад', owned: 'Већ је твоје.', bought: 'Спремно! Музеј расте.',
  insufficient: 'Недостају новчићи.', displayFirst: 'Прво доврши један фосил на постољу.',
  dimetrodonFirst: 'Прво сложи диметродона на постољу.', trilobiteFirst: 'Прво постави трилобита.',
  sequenceFirst: 'Прво доврши фосил на свом постољу.',
  eryopsFirst: 'Прво сложи ериопса на постољу.',
  wingFirst: 'Прво прошири музеј.',
  notHere: 'Куповина је доступна у музеју.', hint: 'Стани у златни круг да платиш постоље.',
  paying: 'Плаћамо', remaining: 'Још', needCoins: 'Сакупи још новчића. Уплаћено је сачувано.',
  qa: 'Проба куповине · посебна игра', stand: 'Постоље', expansion: 'Нова сала',
} as const;
