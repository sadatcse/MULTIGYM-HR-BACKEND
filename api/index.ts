import { createApp } from '../src/main';

// Cached across warm invocations of the same Lambda instance so we don't
// re-bootstrap Nest (and re-open a Mongoose connection) on every request —
// cold starts still pay the full init cost once.
//
// Vercel's Node.js runtime hands this file real (req, res) objects — the
// same signature Node's own http.createServer() uses — and an Express app
// instance is directly callable with that exact signature, so no adapter
// library is needed here. (An earlier version of this file used
// serverless-http, which expects AWS Lambda's event/context shape instead;
// handing it Vercel's real req/res silently hung every request forever,
// since it never wrote anything back to the actual res.)
let cachedExpressApp: any = null;

async function getExpressApp() {
  if (!cachedExpressApp) {
    const app = await createApp();
    await app.init();
    cachedExpressApp = app.getHttpAdapter().getInstance();
  }
  return cachedExpressApp;
}

export default async function handler(req: any, res: any) {
  const expressApp = await getExpressApp();
  expressApp(req, res);
}
