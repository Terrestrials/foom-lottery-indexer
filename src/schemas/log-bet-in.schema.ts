import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import type { Address } from 'viem'

@Schema()
class LogBetInData {
  /** @dev bet index; bigint */
  @Prop()
  index: string

  /** @dev new hash value; bigint */
  @Prop()
  newHash: string
}

@Schema()
class LogBetInMeta {
  /** msg.sender Address */
  @Prop()
  user: Address

  /** @dev bet FOOM amount in wei; bigint */
  @Prop()
  amount: string

  /** @dev prayer */
  @Prop()
  prayer: string
}

/**
 * This combines LogPrayer and Trasfer events.
 */
@Schema({ timestamps: true })
export class LogBetIn extends Document {
  @Prop()
  data: LogBetInData

  @Prop()
  meta: LogBetInMeta

  /** @dev block id; bigint */
  @Prop()
  blockNumber: string

  /** @dev msg.sender */
  @Prop()
  sender: Address

  /** @dev transaction hash */
  @Prop()
  txHash: string

  @Prop({ default: false })
  isProcessed: boolean
}

export const LogBetInSchema = SchemaFactory.createForClass(LogBetIn)
