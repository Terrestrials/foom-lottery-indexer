import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import type { Address } from 'viem'
import mongoosePaginate from 'mongoose-paginate-v2';

@Schema()
class LogUpdateData {
  /** @dev bet index; bigint */
  @Prop()
  index: string

  /** @dev new hash value (from LogBetIn); bigint */
  @Prop()
  newHash: string

  /** @dev new randomness value (from LogUpdate); bigint */
  @Prop()
  newRand: string

  /** @dev calculated leaf value (optional) */
  @Prop()
  leaf?: string

  /** @dev new Merkle root from LogUpdate */
  @Prop()
  newRoot: string
}

@Schema({ timestamps: true })
export class LogUpdate extends Document {
  @Prop()
  data: LogUpdateData

  /** @dev block number where bet or update occurred; bigint */
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

export const LogUpdateSchema = SchemaFactory.createForClass(LogUpdate)
LogUpdateSchema.plugin(mongoosePaginate);
