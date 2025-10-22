import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import type { Address } from 'viem'

@Schema()
class LogCancelData {
  /** @dev bet index */
  @Prop()
  index: string
}

@Schema({ timestamps: true })
export class LogCancel extends Document {
  @Prop()
  data: LogCancelData

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

export const LogCancelSchema = SchemaFactory.createForClass(LogCancel)
