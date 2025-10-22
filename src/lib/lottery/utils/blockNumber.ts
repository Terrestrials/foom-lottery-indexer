import { _log } from 'src/utils/ts'
import type { GenesisBlocks } from 'src/schemas/meta.schema'
import { mainnet, base } from 'viem/chains'

const ETHEREUM_BLOCK_SHIFT_CORRECTION_FACTOR = 1 - 0.000048142759792588336
const ETHEREUM_BLOCK_TIME_CORRECTION_FACTOR = 1 - 0.07138 / 12

export interface IGenesisBlock {
  genesisBlock: number
  genesisTimestamp: number
  blockTime: number
}

export const DEFAULT_GENESIS_BLOCKS = {
  [base.id]: {
    genesisBlock: 32695724,
    genesisTimestamp: 1752180795,
    blockTime: 2,
  },
  [mainnet.id]: {
    genesisBlock: 22891294,
    genesisTimestamp: 1752180851,
    blockTime: 12,
  },
}

export let GENESIS_BLOCKS = { ...DEFAULT_GENESIS_BLOCKS }

/**
 * Update genesis block data from database
 */
export function updateGenesisBlocks(genesisBlocks: GenesisBlocks) {
  for (const [key, value] of Object.entries(genesisBlocks)) {
    if (key === '_id') {
      continue
    }

    const { number, timestamp, blockTime } = value
    const chain = key === 'base' ? base : key === 'mainnet' ? mainnet : null

    GENESIS_BLOCKS[chain.id] = {
      genesisBlock: parseInt(number),
      genesisTimestamp: parseInt(timestamp),
      blockTime,
    }
  }
}

/**
 * Utility to estimate current block number based on chainId and Date.now()
 */
export function getBlockNumberAtTimestamp(
  chainId: number,
  now: number = Date.now() / 1000,
): number {
  const chainData = GENESIS_BLOCKS[chainId]

  if (!chainData) {
    throw new Error('Unsupported chainId for block number estimation')
  }

  const { genesisBlock, genesisTimestamp, blockTime } = chainData

  if (chainId === base.id) {
    return Math.floor(genesisBlock + (now - genesisTimestamp) / blockTime)
  } else if (chainId === mainnet.id) {
    return Math.floor(
      genesisBlock +
        (now - genesisTimestamp) /
          (blockTime / ETHEREUM_BLOCK_TIME_CORRECTION_FACTOR),
    )
  } else {
    throw new Error('Unsupported chainId for block number estimation')
  }
}
