import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserAddressConnectionDocument = UserAddressConnection & Document;

@Schema()
export class UserAddressConnection {
  @Prop({ required: true, unique: true }) 
  userAddress: string;   

  @Prop({ required: true })
  freshWallet: string; 

  @Prop({ required: true }) 
  firstTransactionFromAddress: string;

  @Prop({ required: true })
  timeOfFirstTransaction: Date;

  @Prop({ required: true })
  transactionsLength: number;

  @Prop([String])
  parents: string[];

  @Prop([String])
  children: string[];
}

export const UserAddressConnectionSchema = SchemaFactory.createForClass(UserAddressConnection);
