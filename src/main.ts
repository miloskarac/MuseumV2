import './style.css';
import { startPrototype } from './app/prototype';

const dispose = startPrototype(document.querySelector<HTMLDivElement>('#app')!);
if (import.meta.hot) import.meta.hot.dispose(dispose);
