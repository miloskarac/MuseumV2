import dimetrodon from '../assets/animals/dimetrodon.jpg';
import eryops from '../assets/animals/eryops.jpg';
import trilobite from '../assets/animals/trilobite.jpg';
import walchia from '../assets/animals/walchia-reconstruction.svg';
import type { ExhibitId } from './exhibit';

type AnimalIllustration = {
  image: string; alt: string; author: string; source: string; license?: string; licenseUrl?: string; note: string;
  caption?: string; fossilCaption?: string; visibleNote?: string;
};

// Local Wikimedia thumbnails. Source/license details accompany the shipped assets.
export const ANIMAL_ILLUSTRATIONS: Partial<Record<ExhibitId, AnimalIllustration>> = {
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
  walchia: {
    image: walchia, alt: 'Илустративна реконструкција валхије: усправно стабло, спратови бочних грана и ситни уски листови.',
    author: 'Музеј за Луку · оригинални цртеж',
    source: 'https://repository.si.edu/bitstream/handle/10088/7135/paleo_2007_DiMichele_Abo_RPP_small.pdf',
    caption: 'Жива биљка · реконструкција', fossilCaption: 'Откривени фосил · гранчица',
    visibleNote: 'Тако је могла да изгледа. Боје и облик крошње су претпоставка.',
    note: 'Оригинална илустрација за ову игру, према описима фосилних четинара. Није фотографија нити тачан изглед једне врсте.',
  },
};

export const illustrationText = {
  title: 'Тако је могао да изгледа', credit: 'О слици', author: 'Илустрација', source: 'Извор',
};
