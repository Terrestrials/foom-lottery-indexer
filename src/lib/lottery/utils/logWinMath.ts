import { _log } from 'src/utils/ts'
import type { Address, Hex } from 'viem'

const ONE_OVER_REWARD_FEES = 1_0526_315_789_473_684n
const ONE_OVER_REWARD_FEES_ACCURACY_ERROR = 10n ** 27n
const FIRST_JACKPOT_FOOM_NET = 972_800_000_000_000_000_000_000_000n
const MIN_LOG_WIN_REWARD = 10_000_000n * 10n ** 18n

export interface LogWinCalculationInput {
  decodedTxInput: {
    args: readonly any[]
  }
  logArgs: {
    nullifierHash: Hex
    reward: bigint
    recipient: Address
  }
}

export interface LogWinCalculationResult {
  data: {
    root: string
    nullifierHash: string
    recipient: string
    relayer: string
    fee: string
    refund: string
    rewardbits: string
    invest: string
    reward: string
  }
  meta: {
    rewardGross: string
    rewardNet: string
    invested: string
    feeGenerator: string
    feeInvestors: string
    feeRelayer: string
    refund: string
  }
}

/**
 * Calculates reward amount in FOOM based on rewardbits given
 */
const getGrossReward = (rewardbits: bigint): bigint => {
  const rewards = [2n ** 10n, 2n ** 16n, 2n ** 22n, 0n]
  let reward = 0n

  for (let i = 0; i < rewards.length; i++) {
    const bit = 1n << BigInt(i)
    if ((rewardbits & bit) !== 0n) {
      reward += rewards[i]
    }
  }

  return reward
}

/**
 * Calculates LogWin data structure with reward gross, fees, and meta fields
 */
export function calculateLogWinData({
  decodedTxInput,
  logArgs,
}: LogWinCalculationInput): LogWinCalculationResult {
  const data = {
    root: `${decodedTxInput.args[3]}`,
    nullifierHash: `${decodedTxInput.args[4]}`,
    recipient: `${decodedTxInput.args[5]}`,
    relayer: `${decodedTxInput.args[6]}`,
    fee: `${decodedTxInput.args[7]}`,
    refund: `${decodedTxInput.args[8]}`,
    rewardbits: `${decodedTxInput.args[9]}`,
    invest: `${decodedTxInput.args[10]}`,
    reward: `${logArgs.reward}`,
  }

  const _rewardGrossBase = (decodedTxInput.args[10] as bigint) + logArgs.reward
  const rewardGrossBase =
    _rewardGrossBase > FIRST_JACKPOT_FOOM_NET
      ? _rewardGrossBase - MIN_LOG_WIN_REWARD
      : _rewardGrossBase
  const rewardGrossInferred =
    (rewardGrossBase * ONE_OVER_REWARD_FEES +
      ONE_OVER_REWARD_FEES_ACCURACY_ERROR) /
    10n ** 16n
  const rewardGross =
    getGrossReward(BigInt(data.rewardbits)) *
    10n ** 6n /* @dev million FOOM multiplier */ *
    10n ** 18n

  return {
    data,
    meta: {
      rewardGross: `${rewardGross}`,
      rewardNet: `${logArgs.reward}`,
      invested: `${decodedTxInput.args[10]}`,
      feeGenerator: `${(rewardGross * 1n) / 100n}`,
      feeInvestors: `${(rewardGross * 4n) / 100n}`,
      feeRelayer: `${decodedTxInput.args[7]}`,
      refund: `${decodedTxInput.args[8]}`,
    },
  }
}
