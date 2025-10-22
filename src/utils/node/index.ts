import { Buffer } from 'buffer'

declare global {
  interface BigInt {
    toJSON(): number
  }
}
import { stringify } from 'viem'

import { _log } from 'src/utils/ts'

/* @ts-ignore */
BigInt.prototype.toJSON = function () {
  return this.toString()
}

const intToBuffer = (
  value: bigint,
  length: number = 8,
  offset: number = 0,
): Buffer => {
  const buffer = (Buffer as any).alloc(length)
  buffer.writeBigUInt64LE(value, offset)
  return buffer
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const tryStringify = (value: any): string => {
  try {
    return stringify(value)
  } catch {}

  return ''
}

const tryParse = <T = object>(value: any): T | undefined => {
  try {
    return JSON.parse(value)
  } catch {}

  return undefined
}

const nFormatter = (number?: number | bigint | string) => {
  const formatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
  })

  return number === undefined ? undefined : formatter.format(Number(number))
}

export { intToBuffer, nFormatter, sleep, tryParse, tryStringify }
