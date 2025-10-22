import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import type { Address } from 'viem'

@Schema()
class LogPrayerData {
  /** @dev bet index (aka `betId`); bigint */
  @Prop()
  index: string

  /** @dev decoded prayer */
  @Prop()
  prayer: string
}

@Schema({ timestamps: true })
export class LogPrayer extends Document {
  @Prop()
  data: LogPrayerData

  /** @dev block number where bet or update occurred */
  @Prop()
  blockNumber: string

  /** @dev msg.sender (from tx.origin of bet) */
  @Prop()
  sender: Address

  /** @dev transaction hash */
  @Prop()
  txHash: string

  @Prop({ default: false })
  isProcessed: boolean
}

export const LogPrayerSchema = SchemaFactory.createForClass(LogPrayer)
