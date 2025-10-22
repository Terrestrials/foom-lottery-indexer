import { Module } from '@nestjs/common'
import { FoomCashBotService } from './foom-cash-bot.service'
import { FoomCashBotController } from './foom-cash-bot.controller'
import { ApiModule } from 'src/modules/api/api.module'
import { LotteryModule } from 'src/modules/lottery/lottery.module'
import { BlockchainModule } from 'src/modules/blockchain/blockchain.module'
import { DatabaseModule } from 'src/modules/database/database.module'
import { CoreEventsModule } from 'src/modules/core/events/core-events.module'

@Module({
  imports: [
    ApiModule,
    LotteryModule,
    BlockchainModule,
    DatabaseModule,
    CoreEventsModule,
  ],
  providers: [FoomCashBotService],
  controllers: [FoomCashBotController],
  exports: [FoomCashBotService],
})
export class FoomCashBotModule {}
