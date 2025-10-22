import { RegexUtils } from 'src/utils/regex'
import type { Address, Hex } from 'viem'

export const compareHex = (a: string | Hex, b: string | Hex): boolean =>
  RegexUtils.insensitive(a).test(b)

export const topicToAddress = (topic: string | Hex): Address => {
  return `0x${topic.slice(-40)}`
}
