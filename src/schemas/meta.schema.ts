import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema()
class LastSyncedBlockData {
  /** @dev bigint */
  @Prop()
  number: string
}

@Schema()
class LastSyncedBlock {
  @Prop({ type: LastSyncedBlockData })
  logBetIn: LastSyncedBlockData

  @Prop({ type: LastSyncedBlockData })
  logCancel: LastSyncedBlockData

  @Prop({ type: LastSyncedBlockData })
  logUpdate: LastSyncedBlockData

  @Prop({ type: LastSyncedBlockData })
  logPrayer: LastSyncedBlockData
}

@Schema()
class GenesisBlockData {
  /** @dev bigint */
  @Prop()
  number: string

  /** @dev unix timestamp */
  @Prop()
  timestamp: string

  /** @dev block time in seconds */
  @Prop()
  blockTime: number
}

@Schema()
export class GenesisBlocks {
  @Prop({ type: GenesisBlockData })
  base: GenesisBlockData

  @Prop({ type: GenesisBlockData })
  mainnet: GenesisBlockData
}

@Schema()
export class Period {
  /** @dev bigint */
  @Prop()
  bets: string

  /** @dev bigint */
  @Prop()
  shares: string
}

export const PeriodSchema = SchemaFactory.createForClass(Period)

@Schema({ timestamps: true })
export class Meta extends Document {
  @Prop({ type: LastSyncedBlock })
  lastSyncedBlock: LastSyncedBlock

  @Prop({ type: GenesisBlocks })
  genesisBlocks: GenesisBlocks

  @Prop({ type: Map, of: PeriodSchema })
  periods: Map<string /** @dev number, integer */, Period>
}

export const MetaSchema = SchemaFactory.createForClass(Meta)
