import * as fs from 'node:fs';
import * as path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const packages = [
  'config',
  'security',
  'contracts',
  'db-core',
  'db-tenant',
  'ai-runtime',
  'office-engine',
];

// 1. Link @falcon/* in root node_modules for local TypeScript execution & tests
for (const pkg of packages) {
  const dir = path.resolve('node_modules', '@falcon', pkg);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      {
        name: `@falcon/${pkg}`,
        version: '1.0.0',
        type: 'module',
        main: './index.js',
        exports: {
          '.': './index.js',
        },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(dir, 'index.js'),
    `export * from '../../../packages/${pkg}/src/index.ts';\n`,
  );
}

// 2. Compile self-contained JavaScript bundle in apps/api/dist for Vercel deployment
const distDir = path.resolve('apps', 'api', 'dist');
const distPackagesDir = path.join(distDir, 'packages');
const distPublicDir = path.join(distDir, 'public');
fs.mkdirSync(distPackagesDir, { recursive: true });
fs.mkdirSync(distPublicDir, { recursive: true });

function transpileTsToJs(tsSource, isInsidePackagesDir) {
  const js = stripTypeScriptTypes(tsSource, { mode: 'strip' });
  const prefix = isInsidePackagesDir ? './' : './packages/';
  return js
    .replace(
      /from\s+['"]@falcon\/([a-z0-9-]+)['"]/g,
      (_m, pkgName) => `from '${prefix}${pkgName}.js'`,
    )
    .replace(/from\s+['"]\.\/index\.ts['"]/g, "from './index.js'");
}

for (const pkg of packages) {
  const srcFile = path.resolve('packages', pkg, 'src', 'index.ts');
  const tsSource = fs.readFileSync(srcFile, 'utf8');
  const jsOutput = transpileTsToJs(tsSource, true);
  fs.writeFileSync(path.join(distPackagesDir, `${pkg}.js`), jsOutput, 'utf8');
}

for (const apiFile of ['index', 'server']) {
  const srcFile = path.resolve('apps', 'api', 'src', `${apiFile}.ts`);
  const tsSource = fs.readFileSync(srcFile, 'utf8');
  const jsOutput = transpileTsToJs(tsSource, false);
  fs.writeFileSync(path.join(distDir, `${apiFile}.js`), jsOutput, 'utf8');
}

const webIndexHtml = path.resolve('apps', 'web', 'public', 'index.html');
if (fs.existsSync(webIndexHtml)) {
  fs.copyFileSync(webIndexHtml, path.join(distPublicDir, 'index.html'));
  const apiPublicDir = path.resolve('apps', 'api', 'public');
  fs.mkdirSync(apiPublicDir, { recursive: true });
  fs.copyFileSync(webIndexHtml, path.join(apiPublicDir, 'index.html'));
}

console.log(
  'Linked @falcon/* workspace packages and compiled apps/api/dist/*.js bundle successfully.',
);
