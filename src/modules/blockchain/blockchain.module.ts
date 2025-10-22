import { Module } from '@nestjs/common'

import { DatabaseModule } from 'src/modules/database/database.module'
import { SignatureModule } from 'src/modules/signature/signature.module'
import { SignatureService } from 'src/modules/signature/signature.service'
import { CoreEventsModule } from 'src/modules/core/events/core-events.module'
import { BlockchainController } from './blockchain.controller'
import { BlockchainService } from './blockchain.service'
import { GenesisBlocksService } from './genesis-blocks.service'
import { ApiModule } from 'src/modules/api/api.module'

@Module({
  imports: [SignatureModule, DatabaseModule, CoreEventsModule, ApiModule],
  providers: [BlockchainService, GenesisBlocksService, SignatureService],
  controllers: [BlockchainController],
  exports: [BlockchainService, GenesisBlocksService],
})
export class BlockchainModule {
  constructor() {}
}
