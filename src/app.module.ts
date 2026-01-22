import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/Auth/auth.module';

@Module({
  imports: [AuthModule], // 👈 thêm AuthModule vào đây
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
