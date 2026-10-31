import { SITE, ERYOPS_SITE } from './journey.ts';

// Camp colors describe the game's setting, not a reconstructed ancient habitat.
export const MAP_SITES = [
  { id: SITE.id, title: 'Зелена пољана', period: 'Перм', cost: 0, playable: true,
    grass: '#a5bd83', trail: '#dfcfa7', earth: '#b99068', leaf: '#6e985a', difficulty: 'Један слој земље' },
  { id: ERYOPS_SITE.id, title: 'Окерни брег', period: 'Перм', cost: 24, playable: true,
    grass: '#b8b57d', trail: '#e7c59b', earth: '#bf895e', leaf: '#87935b', difficulty: 'Два слоја земље' },
  { id: 'future-site-03', title: 'Ново налазиште', period: 'Период још није изабран', cost: 0, playable: false,
    grass: '#b4c4bb', trail: '#dce2da', earth: '#a3b4ad', leaf: '#819d91', difficulty: 'Стиже касније' },
] as const;
export const mapSite = (id: string) => MAP_SITES.find(site => site.id === id);
export const mapText = {
  title: 'Карта', hint: 'Изабери куда путујемо.', close: 'Затвори', museum: 'Музеј',
  home: 'Наши фосили и поставке', travel: 'Путуј', buy: 'Отвори налазиште',
  ready: 'Спремно за отварање', owned: 'Отворено', exhausted: 'Ископавање завршено · камп је отворен',
  siteFirst: 'Прво заврши ископавање на Зеленој пољани.', displayFirst: 'Прво доврши једну поставку у музеју.',
  insufficient: 'Потребно је још новчића', future: 'Стиже касније', busy: 'Сачекај да завршимо повратак у камп.',
  camp: 'Приђи кругу за ископавање. Карта води у музеј.', closed: 'Све је ископано! Карта води у музеј.',
};
