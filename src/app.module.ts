import 'colors';
import { MiddlewareConsumer, Module, NestModule, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InjectConnection, MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { Connection } from 'mongoose';
import { AppController } from './app.controller';
import { EmployeeModule } from './modules/user/user.module';
import { VendorModule } from './modules/vendor/vendor.module';
import { TransactionLogModule } from './modules/transaction-log/transaction-log.module';
import {
  TransactionLog,
  TransactionLogSchema,
} from './modules/transaction-log/schemas/transaction-log.schema';
import { TransactionLoggerMiddleware } from './common/middleware/transaction-logger.middleware';
import { RolePermissionModule } from './modules/role-permission/role-permission.module';
import { DepartmentModule } from './modules/department/department.module';
import { RoleModule } from './modules/role/role.module';
import { BranchModule } from './modules/branch/branch.module';
import { JobPositionModule } from './modules/job-position/job-position.module';
import { ShiftModule } from './modules/shift/shift.module';
import { SettingModule } from './modules/setting/setting.module';
import { GymCalendarModule } from './modules/gym-calendar/gym-calendar.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
    MongooseModule.forFeature([{ name: TransactionLog.name, schema: TransactionLogSchema }]),
    EmployeeModule,
    VendorModule,
    TransactionLogModule,
    RolePermissionModule,
    DepartmentModule,
    RoleModule,
    BranchModule,
    JobPositionModule,
    ShiftModule,
    SettingModule,
    GymCalendarModule,
  ],
  controllers: [AppController],
  providers: [TransactionLoggerMiddleware],
})
export class AppModule implements NestModule, OnModuleInit {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  onModuleInit() {
    const message = `MongoDB Connected: ${this.connection.host}` as any;
    console.log(message.underline.green);
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TransactionLoggerMiddleware).forRoutes('*');
  }
}
