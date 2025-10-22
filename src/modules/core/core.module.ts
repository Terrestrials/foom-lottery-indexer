import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'

import { BlockchainModule } from 'src/modules/blockchain/blockchain.module'
import { DatabaseModule } from 'src/modules/database/database.module'
import { LotteryModule } from 'src/modules/lottery/lottery.module'
import { CoreController } from './core.controller'
import { CoreService } from './core.service'
import { ApiModule } from 'src/modules/api/api.module'
import { FoomCashBotModule } from 'src/modules/foom-cash-bot'
import { CoreEventsModule } from './events/core-events.module'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CoreEventsModule,
    DatabaseModule,
    LotteryModule,
    ApiModule,
    FoomCashBotModule,
    BlockchainModule,
  ],
  controllers: [CoreController],
  providers: [CoreService],
  exports: [CoreService],
})
export class CoreModule {}
