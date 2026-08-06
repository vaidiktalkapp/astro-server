// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as bodyParser from 'body-parser';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  app.set('trust proxy', true);
  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: [
      'https://vaidik-admin.netlify.app',
      'https://vaidik-web.netlify.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5000',
      'http://3.109.60.127:3002',
      'http://3.109.60.127:3003',
      'https://admin.vaidiktalk.com',
      'https://app.vaidiktalk.com',
      'https://vaidiktalk-ai-2-1a2t.vercel.app',
      'https://vaidiktalk-ai-2.vercel.app',
      'https://vaidik-mu.vercel.app',
      'https://vaidik-a8uz.vercel.app',
      'https://web-vaidik-main.vercel.app',
      'https://admin-portal-rho-two.vercel.app',
      'https://admin-portal-9x2pjk4h9-rajkumaryadav2749s-projects.vercel.app',
    ],
    credentials: true,
  });

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      contentSecurityPolicy: false,
    }),
  );

  /**
   * ✅ RAW BODY ONLY FOR SHOPIFY WEBHOOK
   */
  app.use(
    '/api/v1/shopify/webhooks',
    bodyParser.raw({ type: 'application/json' }),
  );

  /**
   * ✅ JSON BODY FOR ALL OTHER ROUTES
   */
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  /**
   * ✅ Validation Pipe
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  /**
   * ✅ Protect Swagger with Basic Auth
   * Username: admin
   * Password: Vaidik@123
   */
  app.use('/api', (req: any, res: any, next: any) => {
    // Only apply to swagger UI routes, not actual API endpoints (which use /api/v1)
    if (req.originalUrl.startsWith('/api')) {
      // Allow actual API calls to pass through without this auth
      if (req.originalUrl.startsWith('/api/v1')) {
        return next();
      }

      const authHeader = req.headers.authorization;

      // Basic Auth: admin / Vaidik@123
      if (authHeader && authHeader === 'Basic YWRtaW46VmFpZGlrQDEyMw==') {
        return next();
      }

      res.setHeader('WWW-Authenticate', 'Basic realm="Vaidik API Documentation"');
      return res.status(401).send('Unauthorized Access to API Documentation');
    }
    next();
  });

  /**
   * ✅ Swagger
   */
  const config = new DocumentBuilder()
    .setTitle('Project API')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  fs.writeFileSync('./openapi.json', JSON.stringify(document, null, 2));

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Server running on port ${port}`);
}

bootstrap();
