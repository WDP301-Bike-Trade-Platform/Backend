import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  
  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Tự động loại bỏ các properties không có trong DTO
      forbidNonWhitelisted: true, // Throw error nếu có property không hợp lệ
      transform: true, // Tự động chuyển đổi kiểu dữ liệu
    }),
  );
  
  app.useGlobalInterceptors(new BigIntInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API')
    .setDescription('API docs')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || 'http://localhost';

  await app.listen(port);

  console.log(` Server running at ${host}:${port}`);
  console.log(` Swagger docs at ${host}:${port}/api`);
}

bootstrap().catch((err) => {
  console.error('❌ Bootstrap failed', err);
  process.exit(1);
});
