import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadFalconEnvConfig } from '../packages/config/src/index.ts';
import { FalconGrowthApiServer } from '../apps/api/src/index.ts';

let serverInstance: FalconGrowthApiServer | null = null;

function getServer(): FalconGrowthApiServer {
  if (!serverInstance) {
    const config = loadFalconEnvConfig();
    const dataDir =
      process.env.FALCON_DATA_DIR ?? join(tmpdir(), 'falcon-growth-runtime');
    serverInstance = new FalconGrowthApiServer({
      dataDir,
      masterKmsKeyHex: config.FALCON_MASTER_KMS_KEY,
      jwtSecret: config.FALCON_JWT_SECRET,
      webPublicDir: resolve(process.cwd(), 'apps', 'web', 'public'),
    });
  }
  return serverInstance;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const srv = getServer();
  await srv.handleHttpRequest(req, res);
}
