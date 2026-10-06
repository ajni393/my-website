import { mkdir, readdir, copyFile } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir('dist/assets', { recursive: true });
for (const filename of await readdir('.')) {
  if (/\.(html|css)$/.test(filename) || filename === 'script.js') {
    await copyFile(filename, `dist/${filename}`);
  }
}
await build({ entryPoints: ['src/app.js'], bundle: true, minify: true, format: 'esm', platform: 'browser', outfile: 'dist/assets/app.js' });
