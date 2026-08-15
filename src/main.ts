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
      max: 1000, // Limit each IP to 1000 requests
    }),
  );

  // CORS configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
  ];
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
