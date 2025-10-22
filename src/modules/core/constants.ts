import { getChainId, isRemote } from 'src/utils/environment'
import { parseAbiItem } from 'viem'
import { base, baseSepolia, foundry, mainnet } from 'viem/chains'

const PERIOD_TIME_BLOCKS = 2 ** 14
const FOOM_LOTTERY_DEPLOYMENT_BLOCK = {
  [base.id]: 30882673,
  [mainnet.id]: 22832297,
}

const LOG_UPDATE_EVENT = parseAbiItem(
  'event LogUpdate(uint256 index, uint256 newRand, uint256 newRoot)',
)
const LOG_BET_IN_EVENT = parseAbiItem(
  'event LogBetIn(uint256 index, uint256 newHash)',
)

const NATIVE_ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
const WETH_BASE_ADDRESS = '0x4200000000000000000000000000000000000006'

const baseRpcWss = 'wss://base-rpc.publicnode.com'
const mainnetRpcWss = 'wss://ethereum-rpc.publicnode.com'

const baseRpcHttpsPublicnode = 'https://base-rpc.publicnode.com'

const baseRpc = /* 'https://mainnet.base.org' */ baseRpcHttpsPublicnode
const mainnetRpc = 'https://ethereum-rpc.publicnode.com'

const baseSepoliaRpc =
  'https://site1.moralis-nodes.com/base-sepolia/82d5ece212904f4189cbc79bbff2191c'

const foundryRpc = foundry.rpcUrls.default.http[0]
const foundryRpcWebsocket = foundry.rpcUrls.default.webSocket[0]

const chain = isRemote() ? (getChainId() === base.id ? base : mainnet) : foundry
const chainRpc =
  chain.id === base.id
    ? baseRpc
    : chain.id === mainnet.id
      ? mainnetRpc
      : foundryRpc
const chainRpcWebsocket =
  chain.id === base.id
    ? baseRpcWss
    : chain.id === mainnet.id
      ? mainnetRpcWss
      : foundryRpcWebsocket
const chainRpcStreams =
  chain.id === base.id
    ? baseRpcHttpsPublicnode
    : chain.id === mainnet.id
      ? mainnetRpc
      : foundryRpc

export {
  baseRpc,
  baseRpcWss,
  baseSepoliaRpc,
  mainnetRpc,
  chain,
  chainRpc,
  chainRpcWebsocket,
  chainRpcStreams,
  LOG_UPDATE_EVENT,
  LOG_BET_IN_EVENT,
  NATIVE_ETH_ADDRESS,
  WETH_BASE_ADDRESS,
  PERIOD_TIME_BLOCKS,
  FOOM_LOTTERY_DEPLOYMENT_BLOCK
}
