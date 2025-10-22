import type { Abi, AbiEvent } from 'viem'
import { LOTTERY_EVENT_NAMES } from '../contracts/addresses'

export const getEvent = (
  abi: Abi,
  eventName: keyof typeof LOTTERY_EVENT_NAMES | 'LogWin',
) => {
  return (abi as AbiEvent[]).find(
    item => item.name === eventName && item.type === 'event',
  ) as AbiEvent
}
