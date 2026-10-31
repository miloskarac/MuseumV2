// One Dimetrodon, exactly six independently recovered anatomy groups.
// The original two discovery IDs remain stable for explicit V2 conversion.
export const SPECIMEN_ID = 'dimetrodon';
export const GROUPS = [
  { id: 'skull', discoveryId: 'bone-study-head', label: 'Лобања' },
  { id: 'spine-sail', discoveryId: 'bone-study-01', label: 'Кичма и једро' },
  { id: 'ribs', discoveryId: 'dimetrodon-ribs', label: 'Ребра' },
  { id: 'front-legs', discoveryId: 'dimetrodon-front-legs', label: 'Предње ноге' },
  { id: 'hind-legs', discoveryId: 'dimetrodon-hind-legs', label: 'Задње ноге' },
  { id: 'tail', discoveryId: 'dimetrodon-tail', label: 'Реп' },
] as const;

export const exhibitText = {
  name: 'Диметродон',
  storyTitle: 'Упознај Диметродона',
  storyEra: 'Перм · Пре диносауруса',
  storyIntro: 'Твој скелет је готов и има причу. Хајде да је прочитамо!',
  storyObserve: 'Погледај скелет: можеш ли да пронађеш једро и дугачак реп?',
  backToMuseum: 'Назад у музеј',
  storyFacts: [
    { title: 'Када је живео?', text: 'Живео је веома давно, пре првих диносауруса. То доба зовемо перм.' },
    { title: 'Шта је јео?', text: 'Јео је друге животиње. Имао је оштре зубе — неке велике, а неке мале.' },
    { title: 'Како је изгледао?', text: 'Имао је четири ноге, дугачак реп и велико једро на леђима. Једро су подупирале дугачке кости.' },
    { title: 'Да ли је био диносаурус?', text: 'Није! Иако личи на диносауруса, припадао је другој групи животиња. Био је ближи сродник сисара, у које спадамо и ми.' },
  ],
  complete: 'Твој први експонат је готов!',
  end: 'Ова мала пустоловина је завршена. Прошетај музејом и погледај свој експонат.',
  next: 'Можеш поново да отвориш картицу експоната.',
  assemble: 'Сложи фосил', card: 'Погледај картицу',
  about: 'О фосилу',
  approach: 'Приђи кругу испред постоља.',
  partsTray: 'Твоји налази', assemblyPreview: 'Твој скелет', placeSlot: 'Место',
  instruction: 'Изабери део, па његово место. Можеш и да га превучеш.',
  harmless: 'Пробај друго место. Део је и даље у торби.',
  placed: 'Одлично! Део је на свом месту.',
  missing: 'Пронађи и очисти свих шест делова на првом налазишту.',
  return: 'Врати се у музеј кроз круг поред врата. Сложи фосил на постољу.',
  empty: 'Делови су на постољу. Погледај свој експонат.',
  unknown: 'Твој фосил', progress: 'Постављено',
} as const;

// Child-friendly paraphrases checked against museum sources; not expert review.
export const educationReview = {
  status: 'requires-scientific-review',
  sourceChecked: '2026-10-18',
  sources: [
    'https://whatsinaname.hmnh.harvard.edu/dimetrodon',
    'https://www.nhm.ac.uk/discover/what-are-dinosaurs.html',
  ],
} as const;

export const SLAB_PART = { id: 'trilobite-whole', discoveryId: 'trilobite-slab', label: 'Фосил на плочи' } as const;
export const FIRST_PARTS = [...GROUPS, SLAB_PART] as const;
export const ERYOPS_GROUPS = [
  { id: 'eryops-skull', discoveryId: 'eryops-skull-find', label: 'Лобања ериопса' },
  { id: 'eryops-spine', discoveryId: 'eryops-spine-find', label: 'Кичма ериопса' },
  { id: 'eryops-ribs', discoveryId: 'eryops-ribs-find', label: 'Ребра ериопса' },
  { id: 'eryops-front-legs', discoveryId: 'eryops-front-legs-find', label: 'Предње ноге ериопса' },
  { id: 'eryops-hind-legs', discoveryId: 'eryops-hind-legs-find', label: 'Задње ноге ериопса' },
  { id: 'eryops-tail', discoveryId: 'eryops-tail-find', label: 'Реп ериопса' },
] as const;
export const ALL_PARTS = [...FIRST_PARTS, ...ERYOPS_GROUPS] as const;
export const eryopsText = {
  name: 'Ериопс', storyTitle: 'Упознај ериопса', storyEra: 'Перм · Пре диносауруса',
  storyIntro: 'Сложио си још један скелет! Погледај његову широку главу.',
  storyObserve: 'Упореди ериопса и Диметродона: који има једро на леђима?',
  storyFacts: [
    { title: 'Када је живео?', text: 'Живео је у доба перма, много пре првих диносауруса.' },
    { title: 'Да ли је био диносаурус?', text: 'Није. Ериопс је био древни водоземац. И данашње жабе и даждевњаци су водоземци.' },
    { title: 'Како је изгледао?', text: 'Имао је широку, пљоснату главу, четири ноге и реп. Његове ноге су биле раширене у страну.' },
    { title: 'Шта видиш на скелету?', text: 'Потражи лобању, кичму и ребра. То су неки од делова које си пронашао и сложио!' },
  ],
} as const;
export const eryopsReview = {
  status: 'source-checked-requires-scientific-review', sourceChecked: '2026-10-18',
  reference: 'docs/references/museum/Eryops.png',
  sources: ['https://www.nhm.ac.uk/our-science/services/collections/palaeontology/fossil-amphibians.html',
    'https://digitalcollections.amnh.org/archive/Eryops-skull--1909-2URM1THIB6ZP.html'],
} as const;
export const trilobiteText = {
  name: 'Трилобит', storyTitle: 'Упознај трилобита', storyEra: 'Давна мора · Пре диносауруса',
  storyIntro: 'Твој фосил је на постољу! Упознај једног давног становника мора.',
  storyObserve: 'Пронађи средину оклопа, па погледај његову леву и десну страну.',
  storyFacts: [
    { title: 'Где је живео?', text: 'Трилобити су живели у морима. Неки су пузали по морском дну, а неки су пливали.' },
    { title: 'Када су живели?', text: 'Појавили су се много пре диносауруса. Данас више нема живих трилобита.' },
    { title: 'Какав је био оклоп?', text: 'Тело је штитио тврд оклоп са много чланака. Његови остаци могу да се сачувају као фосил.' },
    { title: 'Шта значи име?', text: 'Име трилобит значи „три режња“. Дуж оклопа се виде средишњи део и две бочне стране.' },
  ],
} as const;
export const trilobiteReview = {
  sourceChecked: '2026-10-18', status: 'source-checked-stylized-group-example',
  sources: ['https://oumnh.ox.ac.uk/learn-what-were-trilobites', 'https://www.nhm.ac.uk/discover/how-trilobites-conquered-prehistoric-oceans.html'],
} as const;

// Shared rules use required part IDs; only presentation selects a visual recipe.
export const EXHIBITS = [
  { id: SPECIMEN_ID, mode: 'assembled', parts: GROUPS.map(g => g.id), text: exhibitText, missing: exhibitText.missing },
  { id: 'trilobite', mode: 'whole', parts: [SLAB_PART.id], text: trilobiteText, missing: 'Пронађи и очисти фосил на плочи у првом налазишту.' },
  { id: 'eryops', mode: 'assembled', parts: ERYOPS_GROUPS.map(g => g.id), text: eryopsText, missing: 'Пронађи и очисти шест делова ериопса на другом налазишту.' },
] as const;
export type ExhibitId = typeof EXHIBITS[number]['id'];
export const exhibitDefinition = (id: ExhibitId) => EXHIBITS.find(exhibit => exhibit.id === id)!;
