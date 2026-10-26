// Entfernt den alten Build (index.html und assets/ im Projektordner), bevor Vite neu baut.
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('..', import.meta.url));
rmSync(new URL('../assets', import.meta.url), { recursive: true, force: true });
rmSync(new URL('../index.html', import.meta.url), { force: true });
console.log(`Alter Build in ${dir} entfernt.`);
