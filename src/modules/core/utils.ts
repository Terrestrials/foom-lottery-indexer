import { baseRpc, mainnetRpc } from 'src/modules/core/constants'
import { _log } from 'src/utils/ts'
import { base, mainnet } from 'viem/chains'

function getShortenedToUtf8Bytes(input: string, maxBytes: number): string {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const utf8 = encoder.encode(input)
  if (utf8.length <= maxBytes) return input

  let end = maxBytes
  while (end > 0 && (utf8[end] & 0b11000000) === 0b10000000) {
    end--
  }

  let shortened = decoder.decode(utf8.slice(0, end))

  shortened = shortened.trim().replace(/\s+\S*$/, '')

  return shortened
}

function getChainRpc(chain: number) {
  if (chain === base.id) {
    return baseRpc
  } else if (chain === mainnet.id) {
    return mainnetRpc
  }
  return baseRpc
}

export { getShortenedToUtf8Bytes, getChainRpc }
