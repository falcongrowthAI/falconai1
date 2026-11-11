export default function handler(_req, res) {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(
    JSON.stringify({
      status: 'OK',
      service: 'pixel-agents-internal-server',
      timestamp: new Date().toISOString(),
    })
  );
}
