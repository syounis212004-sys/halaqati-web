import fs from 'node:fs/promises';
import path from 'node:path';
const dist=path.join(process.cwd(),'dist');
await fs.copyFile(path.join(dist,'index.html'),path.join(dist,'404.html'));
console.log('Created GitHub Pages 404 fallback.');
