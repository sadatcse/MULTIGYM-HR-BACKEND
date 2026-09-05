import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = process.env.PORT || 8000;

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

  app.enableCors({
    origin: (origin, callback) => {
      const normalizedOrigin = origin?.endsWith('/') ? origin.slice(0, -1) : origin;
      if (!origin || allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  // Static files
  app.useStaticAssets(join(__dirname, '..', 'public'));

  app.setGlobalPrefix('api', { exclude: ['/'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(port);
  console.log(`Server started at ${new Date()}`);
}
bootstrap();
