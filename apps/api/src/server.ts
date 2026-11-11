import { resolve } from 'node:path';
import { loadFalconEnvConfig } from '@falcon/config';
import { FalconGrowthApiServer } from './index.ts';

const config = loadFalconEnvConfig();
const dataDir = resolve(process.cwd(), '.falcon-data');

const server = new FalconGrowthApiServer({
  dataDir,
  masterKmsKeyHex: config.FALCON_MASTER_KMS_KEY,
  jwtSecret: config.FALCON_JWT_SECRET,
  webPublicDir: resolve(process.cwd(), 'apps', 'web', 'public'),
});

const port = config.FALCON_API_PORT || 4000;
const { url } = await server.listen(port, '127.0.0.1');
console.log(
  `[FALCON GROWTH] Plataforma SaaS + Escritório Virtual 3D ativa em ${url}`,
);
