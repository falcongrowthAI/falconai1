import * as fs from 'node:fs';
import * as path from 'node:path';

const packages = [
  'config',
  'security',
  'contracts',
  'db-core',
  'db-tenant',
  'ai-runtime',
  'office-engine',
];

for (const pkg of packages) {
  const dir = path.resolve('node_modules', '@falcon', pkg);
  fs.mkdirSync(dir, { recursive: true });
  const oldTs = path.join(dir, 'index.ts');
  if (fs.existsSync(oldTs)) fs.unlinkSync(oldTs);
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
      2
    )
  );
  fs.writeFileSync(
    path.join(dir, 'index.js'),
    `export * from '../../../packages/${pkg}/src/index.ts';\n`
  );
}
console.log('Linked @falcon/* workspace packages with .js entrypoints successfully.');
