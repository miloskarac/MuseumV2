export const UPGRADES = [
  { id: 'boots', cost: 16, title: 'Удобне чизме', benefit: 'Ходаш мало брже.', icon: 'boots' },
  { id: 'shovel', cost: 24, title: 'Боља лопата', benefit: 'Копаш мало брже.', icon: 'shovel' },
  { id: 'helper-tools', cost: 30, title: 'Бољи алат за помоћника', benefit: 'Помоћник копа мало брже.', icon: 'tools' },
] as const;
export type UpgradeId = typeof UPGRADES[number]['id'];
export const UPGRADE_EFFECTS = { walk: 1.2, shovel: 1.25, helper: 1.25 } as const;
export const upgradeText = {
  title: 'Побољшања', hint: 'Изабери опрему. Свако побољшање остаје твоје.', buy: 'Купи', close: 'Затвори',
  ready: 'Спремно за куповину.', owned: 'Купљено', unknown: 'Опрема није доступна.',
  notHere: 'Врати се у музеј.', displayFirst: 'Прво доврши једну поставку.', helperFirst: 'Прво унајми помоћника.',
  exhausted: 'Нема преостале земље за копање.', insufficient: 'Потребно је још новчића.',
};
