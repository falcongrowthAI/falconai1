import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvConfig } from '@falcon/config';
import { FalconGrowthApiServer } from './index.ts';

let singletonServer: FalconGrowthApiServer | null = null;

export function getOrCreateApiServer(): FalconGrowthApiServer {
  if (!singletonServer) {
    const config = loadEnvConfig();
    singletonServer = new FalconGrowthApiServer({
      dataDir: resolve(process.cwd(), config.dataDir),
      masterKmsKeyHex: config.masterKmsKeyHex,
      jwtSecret: config.jwtSecret,
    });
  }
  return singletonServer;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const srv = getOrCreateApiServer();
  await srv.handleHttpRequest(req, res);
}

const isDirectExecution =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  const config = loadEnvConfig();
  const srv = getOrCreateApiServer();
  const { url } = await srv.listen(config.apiPort, config.apiHost);
  console.log(
    `[FALCON GROWTH] Plataforma SaaS + Escritório Virtual 3D ativa em ${url}`,
  );
}
