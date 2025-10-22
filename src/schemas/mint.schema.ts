import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import type { Hex } from 'viem'

@Schema({ timestamps: true })
export class Mint extends Document {
  @Prop({ required: true })
  data: Hex

  @Prop({ required: true })
  hash: Hex
}

export const MintSchema = SchemaFactory.createForClass(Mint)
