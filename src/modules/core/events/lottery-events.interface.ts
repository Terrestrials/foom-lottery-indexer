import type { LogWin } from 'src/schemas/log-win.schema'
import type { LogBetIn } from 'src/schemas/log-bet-in.schema'
import type { LogUpdate } from 'src/schemas/log-update.schema'
import type { LogCancel } from 'src/schemas/log-cancel.schema'

export const LOTTERY_EVENTS = {
  NEW_WIN: 'lottery.new_win',
  NEW_BET: 'lottery.new_bet',
  NEW_UPDATE: 'lottery.new_update',
  NEW_CANCEL: 'lottery.new_cancel',
} as const

export type LotteryEventType =
  (typeof LOTTERY_EVENTS)[keyof typeof LOTTERY_EVENTS]

type LogWinData = LogWin['data']
type LogWinMeta = LogWin['meta']
type LogBetInData = LogBetIn['data']
type LogBetInMeta = LogBetIn['meta']
type LogUpdateData = LogUpdate['data']
type LogCancelData = LogCancel['data']

export interface NewWinEventData
  extends Pick<LogWin, 'txHash' | 'blockNumber'>,
    Pick<LogWinData, 'recipient' | 'reward' | 'nullifierHash'>,
    Pick<
      LogWinMeta,
      | 'rewardGross'
      | 'invested'
      | 'refund'
      | 'feeGenerator'
      | 'feeInvestors'
      | 'feeRelayer'
    > {
  timestamp?: Date
}

export interface NewBetEventData
  extends Pick<LogBetIn, 'txHash' | 'blockNumber'>,
    Pick<LogBetInData, 'index'>,
    Pick<LogBetInMeta, 'user' | 'amount'> {
  bettor: LogBetInMeta['user']
  timestamp?: Date
}

export interface NewUpdateEventData
  extends Pick<LogUpdate, 'txHash' | 'blockNumber'>,
    Pick<LogUpdateData, 'index'> {
  timestamp?: Date
}

export interface NewCancelEventData
  extends Pick<LogCancel, 'txHash' | 'blockNumber'>,
    Pick<LogCancelData, 'index'> {
  timestamp?: Date
}
