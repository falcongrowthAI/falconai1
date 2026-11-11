import type { IncomingMessage, ServerResponse } from 'node:http';
import handler from '../apps/api/src/server.ts';

export default async function vercelRootHandler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await handler(req, res);
}
