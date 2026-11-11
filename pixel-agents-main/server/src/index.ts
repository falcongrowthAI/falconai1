import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(_req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(
    JSON.stringify({
      status: 'OK',
      service: 'pixel-agents-internal-server',
      timestamp: new Date().toISOString(),
    })
  );
}
