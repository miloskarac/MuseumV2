import dimetrodon from '../assets/animals/dimetrodon.jpg';
import eryops from '../assets/animals/eryops.jpg';
import trilobite from '../assets/animals/trilobite.jpg';
import type { ExhibitId } from './exhibit';

type AnimalIllustration = {
  image: string; alt: string; author: string; source: string; license: string; licenseUrl: string; note: string;
};

// Local Wikimedia thumbnails. Source/license details accompany the shipped assets.
export const ANIMAL_ILLUSTRATIONS: Record<ExhibitId, AnimalIllustration> = {
  dimetrodon: {
    image: dimetrodon, alt: 'Диметродон са великим једром на леђима, насликан у природи.',
    author: 'Дмитриј Богданов; дораде: Monsieur X',
    source: 'https://commons.wikimedia.org/wiki/File:Dimetrodon8DB.jpg',
    license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    note: 'Уметничка реконструкција. Боје и шаре су претпоставка.',
  },
  eryops: {
    image: eryops, alt: 'Ериопс са широком главом, четири раширене ноге и дугим репом.',
    author: 'Дмитриј Богданов', source: 'https://commons.wikimedia.org/wiki/File:Eryops1DB.jpg',
    license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    note: 'Уметничка реконструкција. Боје и шаре су претпоставка.',
  },
  trilobite: {
    image: trilobite, alt: 'Реконструкција трилобита изотелуса, са оклопом, ножицама и пипцима.',
    author: 'Прехисторика ЦМ', source: 'https://commons.wikimedia.org/wiki/File:Isotelus_Solo_Reconstruction.jpg',
    license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    note: 'Ово је изотелус, једна врста трилобита. Боје и шаре су претпоставка.',
  },
};

export const illustrationText = {
  title: 'Тако је могао да изгледа', credit: 'О слици', author: 'Илустрација', source: 'Извор',
};
