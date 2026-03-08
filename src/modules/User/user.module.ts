import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../Auth/auth.module';
import { AdminUserController } from './controller/admin-user.controller';
import { AdminUserService } from './service/admin-user.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [UserController,AdminUserController],
  providers: [UserService,AdminUserService],
  exports: [UserService],
})
export class UserModule {}
