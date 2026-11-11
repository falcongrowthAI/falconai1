import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, '../../../apps/api/dist/public/index.html');
const fallbackHtml = fs.existsSync(htmlPath)
  ? fs.readFileSync(htmlPath, 'utf8')
  : '<!doctype html><html><head><meta charset="utf-8"><title>FALCON GROWTH</title></head><body><h1>FALCON GROWTH</h1></body></html>';

export default function handler(_req, res) {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(fallbackHtml);
}
