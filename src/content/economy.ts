// Approved V2 6.1 values. Existing sites/stands remain free in this increment.
export const ECONOMY = { version: 1, startingCoins: 20, dropChance: 0.125, dropCoins: 1, layoutRevision: 1 } as const;
export const economyText = {
  coins: 'Новчићи', waiting: 'Игра је отворена у другом прозору. Затвори га да наставиш овде.',
  unavailable: 'Овај прегледач не може безбедно да отвори игру. Покушај у другом прегледачу.',
  conflict: 'Сачувана игра се променила у другом прозору. Поново отвори игру да наставиш.',
  loading: 'Отварамо игру…', retry: 'Покушај поново',
} as const;
