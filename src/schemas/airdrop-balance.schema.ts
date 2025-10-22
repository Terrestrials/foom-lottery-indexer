import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import type { Address } from 'viem'

@Schema({ timestamps: true })
export class AirdropBalance extends Document {
  /** @dev account address */
  @Prop()
  account: Address

  /** @dev balance amount as string (bigint) */
  @Prop()
  balance: string
}

export const AirdropBalanceSchema = SchemaFactory.createForClass(AirdropBalance)
