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
import { ChatModule } from './modules/chat/chat.module';

// 7 New HR Enterprise Modules
import { LeaveTypeModule } from './modules/leave-type/leave-type.module';
import { WorkScheduleModule } from './modules/work-schedule/work-schedule.module';
import { LatePolicyModule } from './modules/late-policy/late-policy.module';
import { AdvancePolicyModule } from './modules/advance-policy/advance-policy.module';
import { ProxyDutyModule } from './modules/proxy-duty/proxy-duty.module';
import { OvertimeModule } from './modules/overtime/overtime.module';
import { BonusPolicyModule } from './modules/bonus-policy/bonus-policy.module';

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
    ChatModule,
    LeaveTypeModule,
    WorkScheduleModule,
    LatePolicyModule,
    AdvancePolicyModule,
    ProxyDutyModule,
    OvertimeModule,
    BonusPolicyModule,
  ],
  controllers: [AppController],
  providers: [TransactionLoggerMiddleware],
})
export class AppModule implements NestModule, OnModuleInit {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  onModuleInit() {
    console.log(
      `MongoDB connected successfully to cluster database: ${this.connection.name}`.cyan.bold,
    );
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TransactionLoggerMiddleware).forRoutes('*');
  }
}
