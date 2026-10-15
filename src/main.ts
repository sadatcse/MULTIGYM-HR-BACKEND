import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { text } from 'express';
import { join } from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Builds and configures the Nest app without starting a listener, so it can
// be reused both by the local dev server (bootstrap() below, which calls
// app.listen()) and by api/index.ts's Vercel serverless handler (which
// calls app.init() and hands the underlying Express instance to
// serverless-http instead — a Vercel function can't call app.listen()).
export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security middleware
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hidePoweredBy: true,
    }),
  );

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 5000, // Limit each IP to 5000 requests — a single dashboard page
      // easily fires dozens of requests per load (dev-mode double-effects,
      // per-tab data fetches, notification polling); 1000/5min was hit by
      // routine interactive use once the earlier infinite-loop bug is fixed.
    }),
  );

  // Brute-force protection for sign-in: 20 attempts per 15 minutes per IP.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    skipSuccessfulRequests: true,
    legacyHeaders: false,
    message: { statusCode: 429, message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
  });
  app.use(['/api/employee/login', '/api/user/login'], loginLimiter);

  // Allowed cross-origin requests for web and mobile clients
  // CORS configuration
  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://multigym-next.vercel.app'
    ]
  )
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter(Boolean);

  // Outside production, any http://localhost / 127.0.0.1 port is allowed too
  // (Next dev server, Expo web preview on :8081, etc.).
  const isDev = (process.env.NODE_ENV || '').trim() !== 'production';
  const isLocalDevOrigin = (o: string) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);

  app.enableCors({
    origin: (origin, callback) => {
      const normalizedOrigin = origin?.endsWith('/') ? origin.slice(0, -1) : origin;
      if (!origin || allowedOrigins.includes(normalizedOrigin) || (isDev && isLocalDevOrigin(normalizedOrigin))) {
        callback(null, true);
      } else {
        // Refuse quietly (no CORS headers) instead of throwing a 500.
        callback(null, false);
      }
    },
    credentials: true,
  });

  // ZKTeco ADMS devices post attendance logs as tab-separated plain text
  // (often with a misleading content-type), so the /iclock routes read the
  // raw body as text before Nest's JSON/urlencoded parsers see it.
  app.use('/iclock', text({ type: '*/*', limit: '5mb' }));

  // Static files
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Device firmware hardcodes /iclock/*, so those stay outside /api.
  app.setGlobalPrefix('api', {
    exclude: [
      '/',
      { path: 'iclock/cdata', method: RequestMethod.ALL },
      { path: 'iclock/getrequest', method: RequestMethod.ALL },
      { path: 'iclock/devicecmd', method: RequestMethod.ALL },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  return app;
}

async function bootstrap() {
  const app = await createApp();
  const port = process.env.PORT || 8000;
  await app.listen(port);
  console.log(`Server started at ${new Date()}`);
}

// Only start a listening server when this file is run directly (local dev /
// a traditional Node host). api/index.ts imports createApp() from this same
// file for the Vercel serverless path, and importing a module always runs
// its top-level code — this guard is what stops that import from also
// calling app.listen() on a platform that doesn't support it.
if (require.main === module) {
  bootstrap();
}
