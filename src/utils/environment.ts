import { Address } from 'viem'
import { base, mainnet } from 'viem/chains'

const isStaging = () => process.env.IS_STAGING === 'true'
const isProduction = () => process.env.NODE_ENV === 'production' && !isStaging()
const isDevelopment = () => !isProduction() && !isStaging()
const isRemote = () =>
  process.env.NODE_REMOTE === 'true' || process.env.FORCE_REMOTE === 'true'
const isLocal = () => !isRemote()
const isTreeExternal = () => process.env.IS_TREE_EXTERNAL === 'true'
const isEth = () => process.env.CHAIN === '1'
const isBase = () => process.env.CHAIN === '8453'
const getChainId = () =>
  parseInt(process.env.CHAIN || `${base.id}`, 10) as
    | typeof base.id
    | typeof mainnet.id

const developers: Address[] = [
  '0x83f668DD7137aE3ABE8f5d5f5bd6534Be9Bf657d',
  ...JSON.parse(process.env.DEVELOPER_ADDRESSES || '[]'),
]
const isDeveloper = (user: Address | string) =>
  developers.map(item => item.toLowerCase()).includes(`${user}`.toLowerCase())

export {
  isDeveloper,
  isDevelopment,
  isLocal,
  isProduction,
  isRemote,
  isStaging,
  isTreeExternal,
  isEth,
  isBase,
  getChainId
}
