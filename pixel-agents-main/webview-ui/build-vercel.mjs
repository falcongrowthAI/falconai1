import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, 'dist');
fs.mkdirSync(outDir, { recursive: true });

const candidateHtml = [
  path.resolve(__dirname, '../../apps/web/public/index.html'),
  path.resolve(__dirname, '../../apps/api/dist/public/index.html'),
  path.resolve(__dirname, 'index.html'),
];

let copied = false;
for (const src of candidateHtml) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(outDir, 'index.html'));
    copied = true;
    break;
  }
}

if (!copied) {
  fs.writeFileSync(
    path.join(outDir, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><title>FALCON GROWTH</title></head><body><h1>FALCON GROWTH</h1></body></html>',
    'utf8'
  );
}

console.log('[webview-ui] Built static assets to dist/index.html');
