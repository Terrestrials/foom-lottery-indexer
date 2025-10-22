import type { Address, Hash, Hex } from 'viem'

export interface IRawLog {
  address: Address
  blockHash: Hash
  blockNumber: Hex
  data: Hex
  logIndex: Hex
  removed: boolean
  topics: Hex[]
  transactionHash: Hash
  transactionIndex: Hex
}
