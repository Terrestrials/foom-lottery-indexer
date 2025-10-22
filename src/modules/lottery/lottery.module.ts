import { Module } from '@nestjs/common'
import { DatabaseModule } from 'src/modules/database/database.module'
import { LotteryController } from './lottery.controller'
import { LotteryService } from './lottery.service'
import { BlockchainModule } from 'src/modules/blockchain/blockchain.module'

@Module({
  imports: [DatabaseModule, BlockchainModule],
  providers: [LotteryService],
  controllers: [LotteryController],
  exports: [LotteryService],
})
export class LotteryModule {}
