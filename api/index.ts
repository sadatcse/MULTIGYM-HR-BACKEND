import serverless from 'serverless-http';
import { createApp } from '../src/main';

// Cached across warm invocations of the same Lambda instance so we don't
// re-bootstrap Nest (and re-open a Mongoose connection) on every request —
// cold starts still pay the full init cost once.
let cachedHandler: ReturnType<typeof serverless> | null = null;

async function getHandler() {
  if (!cachedHandler) {
    const app = await createApp();
    await app.init();
    cachedHandler = serverless(app.getHttpAdapter().getInstance());
  }
  return cachedHandler;
}

export default async function handler(req: any, res: any) {
  const h = await getHandler();
  return h(req, res);
}
