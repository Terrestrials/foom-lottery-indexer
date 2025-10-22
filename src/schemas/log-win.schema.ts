import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import type { Address } from 'viem'

@Schema()
class LogWinData {
  /** @dev Hex; bet nullifier emitted, bet redemption identifier */
  @Prop()
  nullifierHash: string

  @Prop()
  /** @dev Address; receiver of the reward (FOOMs) and refund (ETHs) */
  recipient: string

  /**
   * @dev bigint; reward net, after fees
   * @dev FOOM transferred to user, part of the reward; reward deducted by investment amount
   * @example if reward was 1024M (first jackpot tier) and investment amount was 972.8M FOOM (95% of the 100% reward), then this is 10M FOOM.
   * @dev NOTE: max invest amount is 100% - 5% - 10M FOOM
   * @dev NOTE: at least 10M FOOM is always transferred to user, even if investment amount is +inf
   */
  @Prop()
  reward: string

  @Prop()
  /** @dev Hex; tx data */
  root: string

  @Prop()
  /** @dev Address; tx data */
  relayer: string

  @Prop()
  /** @dev bigint; tx data */
  fee: string

  @Prop()
  /** @dev bigint; tx data */
  refund: string

  @Prop()
  /** @dev bigint; tx data */
  rewardbits: string

  @Prop()
  /** @dev bigint; tx data */
  invest: string
}

@Schema()
class LogWinMeta {
  /** @dev bigint; reward 100%, before fee deduction: LogWin + collect() + (result >= first jackpot ? -10M : 0) */
  @Prop()
  rewardGross: string

  /** @dev bigint; FOOM actually invested */
  @Prop()
  invested: string

  /** @dev bigint; amount FOOM transferred to generator (fee, revenue) (1% of `rewardGross`) */
  @Prop()
  feeGenerator: string

  /** @dev bigint; amount FOOM transferred to investors (revenue <not a fee as anyone can be an Investor>) (4% of `rewardGross`) */
  @Prop()
  feeInvestors: string

  /** @dev bigint; FOOM fee amount (minimum) for the relayer requested (revenue <not a fee as anyone can be a Relayer>) */
  @Prop()
  feeRelayer: string

  /** @dev bigint; ETH refund (maximum) for the recipient requested */
  @Prop()
  refund: string

  /** @dev sorting helper */
  @Prop()
  txBlockIndex: number
}

/**
 * This combines LogPrayer and Trasfer events.
 */
@Schema({ timestamps: true })
export class LogWin extends Document {
  @Prop()
  data: LogWinData

  @Prop()
  meta: LogWinMeta

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

export const LogWinSchema = SchemaFactory.createForClass(LogWin)
