import { HttpCode, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import axios from 'axios'
import Moralis from 'moralis'
import {
  createPublicClient,
  decodeEventLog,
  formatEther,
  http,
  parseEther,
  toEventSelector,
  webSocket,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem'
import { decodeFunctionData } from 'viem'
import { base, mainnet } from 'viem/chains'
const {
  createConfig,
  http: wagmiHttp,
  Config,
  getTransaction,
  getPublicClient,
} = require('@wagmi/core')

import {
  FOOM,
  LOTTERY_EVENT_NAMES,
  AIRDROP1_TOKEN,
} from './../../lib/contracts/addresses'
import type { MoralisWalletTransactionMock } from 'src/constants/mock/moralisEvents'
import {
  MoralisFunctionCallStreamMock,
  MoralisTransferEventStreamMock,
} from 'src/constants/mock/moralisStreams'
import LOTTERY_ABI from 'src/lib/contracts/abis/FoomLotteryAbi'
import { LOTTERY } from 'src/lib/contracts/addresses'
import { CACHE_DIR, syncFoomcashTree } from 'src/lib/lottery/foomcash'
import { decodePrayer } from 'src/lib/lottery/utils/decoders'
import { calculateLogWinData } from 'src/lib/lottery/utils/logWinMath'
import { getEvent } from 'src/lib/utils/evm'
import { updateGenesisBlocks } from 'src/lib/lottery/utils/blockNumber'
import {
  chain,
  chainRpc,
  chainRpcWebsocket,
  FOOM_LOTTERY_DEPLOYMENT_BLOCK,
  PERIOD_TIME_BLOCKS,
} from 'src/modules/core/constants'
import { LogBetIn } from 'src/schemas/log-bet-in.schema'
import { LogCancel } from 'src/schemas/log-cancel.schema'
import { LogPrayer } from 'src/schemas/log-prayer.schema'
import { LogUpdate } from 'src/schemas/log-update.schema'
import { LogWin } from 'src/schemas/log-win.schema'
import { Meta } from 'src/schemas/meta.schema'
import { UserAddressConnection } from 'src/schemas/userConnection.schema'
import { AirdropBalance } from 'src/schemas/airdrop-balance.schema'
import type { IRawLog } from 'src/types/evm'
import {
  isDevelopment,
  isEth,
  isRemote,
  isTreeExternal,
} from 'src/utils/environment'
import { compareHex, topicToAddress } from 'src/utils/evm'
import { sleep } from 'src/utils/node'
import { RegexUtils } from 'src/utils/regex'
import { _error, _log, _warn, lowercaseFirstLetter } from 'src/utils/ts'
import { LOTTERY_EVENTS, type NewWinEventData } from 'src/modules/core/events'
import redis from 'src/utils/redis'
import { ApiService } from 'src/modules/api/api.service'

const MORALIS_FN_STREAM_ID = '8669b24d-bad1-4e76-8d2e-2a83e64a6f14'
const FOOM_LOTTERY_FN_COLLECT_SIGNATURE = '0x1611224f'
const FOOM_LOTTERY_FN_PAYOUT_SIGNATURE = '0xda333ca6'
const FOOM_LOTTERY_EVENT_LOGWIN_SIGNATURE = toEventSelector(
  'LogWin(uint256,uint256,address)',
)
const FIRST_JACKPOT_FOOM_GROSS = 1024_000_000_000_000_000_000_000_000n

type TEvents = LogUpdate | LogCancel | LogBetIn | LogPrayer

export const DEFAULT_START_BLOCK =
  /* @dev FoomLottery.sol deplpyment block on Base mainnet */ /* 30882673n */ /* @dev first event block */ isRemote()
    ? 30899833n
    : 0n

@Injectable()
export class BlockchainService {
  private logger: Logger
  private pastEventsSynced = false

  private blockchainConfig: typeof Config /** NestJS ESM fix */
  public publicClient: ReturnType<typeof getPublicClient> /** NestJS ESM fix */
  public publicClientWebsocket: ReturnType<
    typeof getPublicClient
  > /** NestJS ESM fix */

  /** @dev duplicate TX log last fromBlock tracker */
  private _lastDuplicateTxFromBlock: bigint | null = null
  /** @dev track last fromBlock for live watch */
  private _lastLiveWatchFromBlock: bigint | null = null
  private _lastTreeSyncBlockRange: string | null = null

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @InjectModel(LogBetIn.name)
    private readonly logBetInModel: Model<LogBetIn>,
    @InjectModel(LogUpdate.name)
    private readonly logUpdateModel: Model<LogUpdate>,
    @InjectModel(LogCancel.name)
    private readonly logCancelModel: Model<LogCancel>,
    @InjectModel(LogPrayer.name)
    private readonly logPrayerModel: Model<LogPrayer>,
    @InjectModel(LogWin.name)
    private readonly logWinModel: Model<LogWin>,
    @InjectModel(Meta.name)
    private readonly metaModel: Model<Meta>,
    @InjectModel(UserAddressConnection.name)
    private readonly userAddressConnectionModel: Model<UserAddressConnection>,
    @InjectModel(AirdropBalance.name)
    private readonly airdropBalanceModel: Model<AirdropBalance>,
    @InjectModel(AirdropBalance.name, 'secondary')
    private readonly airdropBalanceModelSecondary: Model<AirdropBalance>,
    private readonly apiService: ApiService,
  ) {
    this.logger = new Logger(BlockchainService.name)

    this.publicClient = createPublicClient({
      transport: http(chainRpc),
      chain: chain,
    })
    this.publicClientWebsocket = createPublicClient({
      transport: webSocket(chainRpcWebsocket),
      chain: chain,
    })
    this.blockchainConfig = createConfig({
      chains: [chain as any],
      transports: {
        [chain.id]: http(chainRpc),
      },
    })

    /** @dev trigger logs sync */
    if (process.env.PAUSE_LOGS_SYNC !== 'true') {
      void this.initializeService()
    } else {
      _log('BlockchainService: Logs sync is paused.')
    }

    /** @dev trigger remote tree sync */
    ;(async () => {
      if (isDevelopment()) {
        _log('`isDev`, skipping initial remote tree sync.')
        return
      }

      if (isTreeExternal()) {
        _log(`Syncing tree using remote… (${CACHE_DIR})`)
        await syncFoomcashTree(true)
        _log('Remote tree synced.')
      }
    })()

    // /** @dev stats posting debug */
    // setTimeout(() => {
    //   _log('Getting stats…')
    //   this.retrieveStatistics()
    // }, 1000)

    // /** @dev past logwin sync debug */
    // setTimeout(() => {
    //   _log('About to sync log wins…')
    //   this.syncPastLogWins({
    //     limit: 1,
    //   })
    // }, 1000)

    // /** @dev LogWin data extraction debug */
    // setTimeout(() => {
    //   _log('About to extract LogWin data…')
    //   void this.handleCollectFunctionCallMoralisStream(
    //     MoralisFunctionCallStreamMock,
    //   )
    // }, 1000)
  }

  private async initializeService() {
    /** @dev initialize genesis blocks from database */
    await this.initializeGenesisBlocks()

    /** @dev retrieve past */
    await this.syncAllPastLogs()
    this.pastEventsSynced = true

    /** @dev note: LogWin events have a different store */
    /** @dev start retrieving current */
    void this.watchLogStream()
  }

  async getEvents() {
    return {
      logBetIn: await this.logBetInModel.find(),
    }
  }

  private async initializeGenesisBlocks() {
    try {
      const meta = await this.metaModel.findOne()
      if (meta?.genesisBlocks) {
        updateGenesisBlocks(meta.toObject().genesisBlocks)
        this.logger.log('Genesis blocks initialized from database')
      } else {
        this.logger.log('No genesis blocks found in database, using defaults')
      }
    } catch (error) {
      this.logger.error('Failed to initialize genesis blocks:', error)
    }
  }

  private async syncAllPastLogs() {
    await this.syncPastLogs()

    /** @dev Check if the second pass is necessary (closing the gap between realtime) */
    const meta = await this.metaModel.findOne()
    const lastSyncedBlocks = Object.fromEntries(
      Object.entries(LOTTERY_EVENT_NAMES)
        .filter(([key, value]) => value !== LOTTERY_EVENT_NAMES.Transfer)
        .map(([key, value]) => [
          value,
          BigInt(
            meta?.lastSyncedBlock?.[lowercaseFirstLetter(value)]?.number ?? 0n,
          ),
        ]),
    )

    const latestBlock = await this.publicClient.getBlockNumber()
    const needsSecondPass = Object.values(lastSyncedBlocks).some(
      lastSyncedBlock => lastSyncedBlock < latestBlock,
    )

    if (needsSecondPass) {
      _log('pastLogs: Triggering second pass for past logs sync…')
      await this.syncPastLogs()
    }
  }

  /**
   * @dev blockchain -> [database (you are here)] -> watcher
   */
  private async syncPastLogs() {
    const collections = [
      { model: this.logBetInModel, eventName: LOTTERY_EVENT_NAMES.LogBetIn },
      { model: this.logUpdateModel, eventName: LOTTERY_EVENT_NAMES.LogUpdate },
      { model: this.logCancelModel, eventName: LOTTERY_EVENT_NAMES.LogCancel },
      { model: this.logPrayerModel, eventName: LOTTERY_EVENT_NAMES.LogPrayer },
    ]

    const meta = await this.metaModel.findOne()
    _log('pastLogs: metadata:', meta)
    const lastSyncedBlocks = collections.reduce(
      (acc, { eventName }) => {
        acc[eventName] = BigInt(
          meta?.lastSyncedBlock?.[lowercaseFirstLetter(eventName)]?.number ??
            0n,
        )
        return acc
      },
      {} as Record<string, bigint>,
    )

    const latestBlock = await this.publicClient.getBlockNumber()

    const validBlocks = Object.values(lastSyncedBlocks).filter(
      block => block > 0n,
    )
    let fromBlock =
      validBlocks.length > 0
        ? validBlocks.reduce((min, block) => (block < min ? block : min))
        : BigInt(DEFAULT_START_BLOCK)

    if (fromBlock === BigInt(DEFAULT_START_BLOCK)) {
      const metaMinBlock = Object.values(lastSyncedBlocks).reduce(
        (min, block) => (block < min ? block : min),
        BigInt(DEFAULT_START_BLOCK),
      )
      fromBlock = metaMinBlock > 0n ? metaMinBlock : fromBlock
    }

    _log('pastLogs: Sync starting from block:', fromBlock)

    while (fromBlock < latestBlock) {
      const toBlock =
        fromBlock + 99n < latestBlock ? fromBlock + 99n : latestBlock

      this.logger.verbose(
        `fetching blocks: from ${Number(fromBlock)} to ${Number(toBlock)}`,
      )

      await this.fetchLogs(fromBlock, toBlock, collections)

      for (const { eventName } of collections) {
        await this.noteLastSyncedBlock(
          eventName as keyof typeof LOTTERY_EVENT_NAMES,
          toBlock,
        )
      }

      fromBlock = toBlock + 1n
    }

    _warn(`Fetched all past logs. Last synced block: ${fromBlock}.`)
  }

  private async fetchLogs(
    fromBlock: bigint,
    toBlock: string | bigint,
    collections: Array<{
      model: Model<any>
      eventName: keyof typeof LOTTERY_EVENT_NAMES
    }>,
    isLive?: boolean,
  ) {
    let logs: any[] = []
    let attempts = 0
    const maxAttempts = Infinity
    const receivedEventNames = new Set<string>()

    while (attempts < maxAttempts) {
      try {
        logs = await this.fetchAndProcessLogs(
          fromBlock,
          toBlock === 'latest' ? 'latest' : BigInt(toBlock),
        )

        logs.sort((a: any, b: any) => {
          const indexA = BigInt(`${a.args.index}`)
          const indexB = BigInt(`${b.args.index}`)

          return indexA < indexB ? -1 : indexA > indexB ? 1 : 0
        })

        for (const log of logs) {
          const txHash = log.transactionHash

          const eventRecord = {
            blockNumber: log.blockNumber,
            txHash,
            data: log.args,
            meta: log.meta,
          }

          const collection = collections.find(
            ({ eventName }) => eventName === log.eventName,
          )?.model

          if (log.eventName) {
            receivedEventNames.add(log.eventName)
          }

          if (!collection) {
            this.logger.warn(
              `No collection found for event: ${log.eventName}, skipping…`,
            )
            continue
          }

          const exists = await collection
            .findOne({
              txHash: {
                $regex: RegexUtils.insensitive(txHash),
              },
            })
            .exec()

          if (exists) {
            if (!isLive) {
              this.logger.warn('Duplicate TX skipped')
            }
            this._lastDuplicateTxFromBlock = fromBlock
            continue
          }

          const userAddress = log.meta?.user
          const analiseUser = await this.analiseWallet(userAddress)

          const createdLog = new collection(eventRecord)
          await createdLog.save()
        }

        /** TODO: Refactor */
        for (const { eventName, model: collection } of collections) {
          let blockNumber: bigint
          if (toBlock === 'latest') {
            const lastEvent = await collection.findOne().sort({
              createdAt: -1,
            })
            blockNumber = lastEvent ? BigInt(lastEvent.blockNumber) : 0n
          } else {
            blockNumber = BigInt(toBlock)
          }
          await this.noteLastSyncedBlock(
            eventName as keyof typeof LOTTERY_EVENT_NAMES,
            blockNumber,
          )
        }

        break
      } catch (error) {
        attempts++
        _warn(
          `getLogs failed (attempt ${attempts}/${maxAttempts}) for blocks ${fromBlock} to ${toBlock}: ${error}`,
        )
        _error(error)
        await sleep(4000)

        if (attempts >= maxAttempts) {
          _warn(
            `getLogs failed after ${maxAttempts} attempts for blocks ${fromBlock} to ${toBlock}. Skipping batch.`,
          )
          logs = []
          break
        }
      } finally {
        await sleep(1000)
      }
    }

    return Array.from(receivedEventNames)
  }

  /**
   * @dev sync live via polling
   */
  private async watchLogStream() {
    _log('Watching events (live) using manual get_logs method…')

    const collections = [
      { model: this.logBetInModel, eventName: LOTTERY_EVENT_NAMES.LogBetIn },
      { model: this.logUpdateModel, eventName: LOTTERY_EVENT_NAMES.LogUpdate },
      { model: this.logCancelModel, eventName: LOTTERY_EVENT_NAMES.LogCancel },
      { model: this.logPrayerModel, eventName: LOTTERY_EVENT_NAMES.LogPrayer },
    ]

    let isRefetching = false

    const refetch = async () => {
      const lastSyncedBlockNumber = await this.getLastSyncedBlockNumber()

      if (isRefetching) {
        return
      }

      isRefetching = true
      try {
        const toBlock = 'latest'

        const meta = await this.metaModel.findOne()
        const lastSyncedBlocks = collections.reduce(
          (acc, { eventName }) => {
            acc[eventName] = BigInt(
              meta?.lastSyncedBlock?.[lowercaseFirstLetter(eventName)]
                ?.number ?? 0n,
            )
            return acc
          },
          {} as Record<string, bigint>,
        )

        const validBlocks = Object.values(lastSyncedBlocks).filter(
          block => block > 0n,
        )
        const fromBlock =
          lastSyncedBlockNumber ||
          (chain.id === base.id ? BigInt(DEFAULT_START_BLOCK) : 0n)

        /** @dev this triggers only after the fromBlock changes */
        if (
          !this._lastLiveWatchFromBlock ||
          this._lastLiveWatchFromBlock !== fromBlock
        ) {
          this.logger.verbose(
            `Watching live (polled) events: blocks from ${Number(fromBlock)} to ${toBlock}…`,
          )
          this._lastLiveWatchFromBlock = fromBlock
        }

        const eventsReceived = await this.fetchLogs(
          fromBlock,
          toBlock,
          collections,
          true /** @dev isLive */,
        )

        /**
         * @dev trigger remote tree sync if enabled,
         * and if it's not been synced during this block-scan-range yet
         */
        const currentBlockRange = `${fromBlock.toString()}-${toBlock.toString()}`

        /** @dev log */
        if (
          isTreeExternal() &&
          eventsReceived.includes(LOTTERY_EVENT_NAMES.LogUpdate)
        ) {
          _log(
            'Tree sync status:',
            this._lastTreeSyncBlockRange,
            currentBlockRange,
          )
        }

        if (
          isTreeExternal() &&
          eventsReceived.includes(LOTTERY_EVENT_NAMES.LogUpdate)
        ) {
          _log(`Syncing tree using remote… (${CACHE_DIR}) (in 10 secs)`)
          /** @dev await buffer for cross-server sync */
          await sleep(10_000)

          await syncFoomcashTree()
          _log('Remote tree synced.')
        }
      } catch (error) {
        _error('Error during refetch:', error)
      } finally {
        isRefetching = false
      }
    }

    setInterval(refetch, 4000)
  }

  /**
   * This appends custom props to arguments and changes existing ones to shape these scanned events for further processing.
   * @param fromBlock
   * @param toBlock
   * @returns altered/improved events
   */
  private async fetchAndProcessLogs(
    fromBlock: bigint,
    toBlock: bigint | 'latest',
  ): Promise<any[]> {
    const query = await axios.post(
      chainRpc,
      {
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [
          {
            address: [FOOM[chain.id], LOTTERY[chain.id]],
            topics: [
              [
                toEventSelector(
                  getEvent(LOTTERY_ABI, LOTTERY_EVENT_NAMES.LogBetIn),
                ),
                toEventSelector(
                  getEvent(LOTTERY_ABI, LOTTERY_EVENT_NAMES.LogUpdate),
                ),
                toEventSelector(
                  getEvent(LOTTERY_ABI, LOTTERY_EVENT_NAMES.LogCancel),
                ),
                toEventSelector(
                  getEvent(LOTTERY_ABI, LOTTERY_EVENT_NAMES.Transfer),
                ),
                toEventSelector(
                  getEvent(LOTTERY_ABI, LOTTERY_EVENT_NAMES.LogPrayer),
                ),
              ],
            ],
            fromBlock: `0x${fromBlock.toString(16)}`,
            toBlock:
              toBlock === 'latest' ? 'latest' : `0x${toBlock.toString(16)}`,
          },
        ],
        id: 1,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
    const result_ = query?.data?.result as IRawLog[]

    if (!result_) {
      _log('Failed query:', query.data, query.status, query.statusText)
      throw new Error(
        /** @dev TODO: Switch RPCs if any fails, and other the way round. Use 3 RPCs. */
        'Empty response object from RPC! `result_` is empty. Retrying.',
      )
    }
    return this.processLogs(result_)
  }

  /**
   * @returns an array of decoded valid events
   */
  private async processLogs(result_: IRawLog[]): Promise<any[]> {
    // filter results for `Transfer` events
    // `from` must be the msg.sender of the LogBetIn event
    // `to` must be the FoomLottery contract
    // no ETH transfer will be ever emitted because ETH is routed inside the FoomLottery contract into FOOM
    //
    // topics: [
    //   '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    //   '0x000000000000000000000000d58ec15470c664a76f13ceb2430b06d56797b054',
    //   '0x000000000000000000000000db203504ba1fea79164af3ceffba88c59ee8aafd'
    // ]
    // ^ topics[1] is the sender    [aka from] (msg.sender of LogBetIn event)
    // ^ topics[2] is the recipient [aka to]   (FoomLottery contract address)
    const groupedLogs = result_.reduce(
      (acc, log) => {
        const txHash = log.transactionHash
        if (!acc[txHash]) {
          acc[txHash] = []
        }
        acc[txHash].push(log)
        return acc
      },
      {} as Record<string, IRawLog[]>,
    )

    const decodedLogs = Object.values(groupedLogs).flatMap(group => {
      const transferSignature = toEventSelector(
        getEvent(LOTTERY_ABI, LOTTERY_EVENT_NAMES.Transfer),
      )

      const filteredLogs = group.filter(log => {
        const signature = log?.topics?.[0]

        if (compareHex(signature, transferSignature)) {
          const from = topicToAddress(log?.topics?.[1])
          const to = topicToAddress(log?.topics?.[2])
          const isCorrectTransfer = compareHex(to, LOTTERY[chain.id])

          return isCorrectTransfer
        }

        return true
      })

      const decoded = filteredLogs.map((log: any) => {
        try {
          const decoded = decodeEventLog({
            abi: LOTTERY_ABI,
            data: log.data,
            topics: log.topics,
          })
          return {
            ...log,
            args: decoded.args,
            eventName: decoded.eventName,
          }
        } catch (error) {
          this.logger.warn(`Failed to decode log: ${error}`)
          return log
        }
      })

      const prayerEvent = decoded.find(log =>
        compareHex(log.eventName, LOTTERY_EVENT_NAMES.LogPrayer),
      )
      if (prayerEvent) {
        const prayer = decodePrayer(prayerEvent?.args?.prayer)
        prayerEvent.args.prayer = prayer
        prayerEvent.args.index = prayerEvent.args.betId
        delete prayerEvent.args.betId
      }

      const logBetInEvent = decoded.find(log =>
        compareHex(log.eventName, LOTTERY_EVENT_NAMES.LogBetIn),
      )
      if (logBetInEvent) {
        const transferEvent = decoded.find(log =>
          compareHex(log.eventName, LOTTERY_EVENT_NAMES.Transfer),
        )
        if (transferEvent) {
          logBetInEvent.meta = {
            ...logBetInEvent.meta,
            user: transferEvent.args.from,
            amount: transferEvent.args.value,
            prayer: prayerEvent?.args?.prayer || undefined,
          }
        }
      }

      return decoded.filter(
        log => !compareHex(log.eventName, LOTTERY_EVENT_NAMES.Transfer),
      )
    })

    /** @dev array of decoded valid events */
    // _log(`Decoded events:`, decodedLogs)
    return decodedLogs
  }

  private async getLastSyncedBlockNumber(): Promise<bigint> {
    const lastSyncedBlock = await this.metaModel.findOne({})
    const lastSyncedBlocks = Object.values(LOTTERY_EVENT_NAMES).map(eventName =>
      BigInt(
        lastSyncedBlock?.lastSyncedBlock?.[lowercaseFirstLetter(eventName)]
          ?.number ?? 0n,
      ),
    )
    return lastSyncedBlocks.length > 0
      ? lastSyncedBlocks.reduce((max, block) => (block > max ? block : max), 0n)
      : 0n
  }

  /** TODO: Refactor to accept bulk data too (event -> [event, ...]) */
  private async noteLastSyncedBlock(
    event: keyof typeof LOTTERY_EVENT_NAMES,
    blockNumber: bigint | number,
  ) {
    const lastSyncedBlock = await this.metaModel.findOne({})
    const eventLastSyncedBlock = BigInt(
      lastSyncedBlock?.lastSyncedBlock?.[lowercaseFirstLetter(event)]?.number ??
        0n,
    )
    if (blockNumber <= eventLastSyncedBlock) {
      return
    }

    await this.metaModel.updateOne(
      {},
      {
        $set: {
          [`lastSyncedBlock.${lowercaseFirstLetter(event)}`]: {
            number: `${blockNumber}`,
          },
        },
      },
      { upsert: true },
    )
  }

  public async handleCollectFunctionCallMoralisStream(
    data: typeof MoralisFunctionCallStreamMock,
  ) {
    const collectTxs = data.txs.filter(tx =>
      tx.input.startsWith(FOOM_LOTTERY_FN_COLLECT_SIGNATURE),
    )
    const collectLogs = data.logs.filter(
      log => log.topic0 === FOOM_LOTTERY_EVENT_LOGWIN_SIGNATURE,
    )
    const tx = collectTxs?.[0]
    const log = collectLogs?.[0]

    if (!tx || !log) {
      return
    }

    const decodedTransactionInput = decodeFunctionData({
      abi: LOTTERY_ABI,
      data: tx.input as Hex,
    })

    const decodedEventLog = decodeEventLog({
      abi: LOTTERY_ABI,
      data: log.data as Hex,
      topics: [
        log.topic0 as Hex,
        log.topic1 as Hex,
        log.topic2 as Hex,
        log.topic3 as Hex,
      ],
      eventName: 'LogWin',
    })

    _log('Streamed Collect TX and corresponding LogWin Log:', {
      decodedTransactionInput,
      decodedEventLog,
    })

    /** @dev insert streamed `collect`() into database by txHash – do not create duplicates and do not overwrite existing entries. */
    const existingLog = await this.logWinModel.findOne({
      txHash: RegexUtils.insensitive(tx.hash),
    })
    if (existingLog) {
      _log('LogWin already exists, skipping…')
      return
    }

    const logArgs = decodedEventLog.args as any as {
      nullifierHash: Hex
      reward: bigint
      recipient: Address
    }

    const { data: logWinData, meta } = calculateLogWinData({
      decodedTxInput: decodedTransactionInput,
      logArgs,
    })

    const logWin = new this.logWinModel({
      data: logWinData,
      meta: {
        ...meta,
        txBlockIndex: Number(tx.transactionIndex),
      },
      blockNumber: data.block.number,
      sender: tx.fromAddress as Address,
      txHash: tx.hash as Hex,
    })
    await logWin.save()
  }

  public async setLastSyncedBlocks(blockNumber: bigint) {
    await this.metaModel.updateOne(
      {},
      {
        $set: {
          [`lastSyncedBlock.${lowercaseFirstLetter(LOTTERY_EVENT_NAMES.LogBetIn)}`]:
            {
              number: `${blockNumber}`,
            },
          [`lastSyncedBlock.${lowercaseFirstLetter(LOTTERY_EVENT_NAMES.LogUpdate)}`]:
            {
              number: `${blockNumber}`,
            },
          [`lastSyncedBlock.${lowercaseFirstLetter(LOTTERY_EVENT_NAMES.LogCancel)}`]:
            {
              number: `${blockNumber}`,
            },
          [`lastSyncedBlock.${lowercaseFirstLetter(LOTTERY_EVENT_NAMES.LogPrayer)}`]:
            {
              number: `${blockNumber}`,
            },
        },
      },
      { upsert: true },
    )
    process.exit(0) /** @dev Docker instance reboot */
  }

  async onModuleInit() {
    await Moralis.start({
      apiKey: process.env.MORALIS_API_KEY,
    })
  }

  async saveUserConnection(data): Promise<UserAddressConnection> {
    const created = new this.userAddressConnectionModel(data)
    return created.save()
  }

  async analiseWallet(address: string): Promise<object> {
    if (!address) {
      return {
        error: 'Address is required',
      }
    }

    const userConnection = await this.userAddressConnectionModel.findOne({
      userAddress: address,
    })
    if (userConnection) {
      // userAlreadyAnalised
      return userConnection
    }

    const data = await this.scoreWallet(address)
    await this.saveUserConnection({
      userAddress: address,
      ...data,
    })
    return data
  }
  /*
   */
  async scoreWallet(address: string): Promise<object> {
    const chains = ['0x1', '0x2105']
    const transactionsEth = (await this.getTransactions(
      address,
      chains[0],
    )) as Array<typeof MoralisWalletTransactionMock>
    const transactionsBase = (await this.getTransactions(
      address,
      chains[1],
    )) as Array<typeof MoralisWalletTransactionMock>

    const transactions = [...transactionsEth, ...transactionsBase].sort(
      (a, b) => {
        const timestampA = new Date(a?.blockTimestamp)?.getTime()
        const timestampB = new Date(b?.blockTimestamp)?.getTime()

        return timestampB - timestampA

        /** @dev NOTE: do not sort further – Moralis auto-sorts txes and this would mix them between networks */
        // if (timestampA !== timestampB) {
        //   return timestampA - timestampB
        // }
        // /** @dev (impl.): if this is the same block, sort by `transactionIndex` */
        // return a.transactionIndex - b.transactionIndex
      },
    )

    if (transactions && transactions[0]) {
      const firstTransaction = transactions[transactions.length - 1] as any
      const firstTransactionFromAddress = firstTransaction.fromAddress._value
      const timeOfFirstTransaction = firstTransaction.blockTimestamp
      const transactionsLength = transactions.length

      let freshWallet = false

      const onlyNativeTransfers = transactions.filter((tx: any) => {
        return tx.nativeTransfers.length > 0 && tx.erc20Transfers.length === 0
      })

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

      const { parents, children } =
        this.extractParentsAndChildren(onlyNativeTransfers)

      if (
        transactionsLength < 3 ||
        new Date(timeOfFirstTransaction).getTime() <
          new Date(oneDayAgo).getTime()
      ) {
        freshWallet = true
      }
      return {
        firstTransaction,
        firstTransactionFromAddress,
        timeOfFirstTransaction,
        transactionsLength,
        parents,
        children,
        freshWallet,
      }
    } else {
      return {
        firstTransaction: {},
        firstTransactionFromAddress: '',
        timeOfFirstTransaction: '',
        transactionsLength: 0,
        parents: [],
        children: [],
        freshWallet: true,
      }
    }
  }

  /** TODO: Limit recursive calls. If wallet younger than 5 mths,  */
  async getTransactions(
    address: string,
    chain = '0x1',
    cursor: string = '',
    result: object[] = [],
  ): Promise<object[]> {
    try {
      const response = await Moralis.EvmApi.wallets.getWalletHistory({
        chain: chain,
        order: 'DESC',
        address: address,
        cursor: cursor,
      })

      result.push(...response.response.result)

      if (response.response.cursor) {
        return await this.getTransactions(
          address,
          chain,
          response.response.cursor,
          result,
        )
      }

      return result
    } catch (e) {
      console.error(e)
    }
  }

  extractParentsAndChildren(transactions) {
    const parents = new Set()
    const children = new Set()

    for (const tx of transactions) {
      const from = tx.fromAddress?._value
      const to = tx.toAddress?._value

      if (from) parents.add(from)
      if (to) children.add(to)
    }

    return {
      parents: Array.from(parents),
      children: Array.from(children),
    }
  }

  public async countUniquePlayers(): Promise<number> {
    const result = await this.logBetInModel
      .aggregate([
        {
          $group: {
            _id: '$meta.user',
          },
        },
        {
          $count: 'uniqueUsers',
        },
      ])
      .exec()

    return result[0]?.uniqueUsers || 0
  }

  subtractBlocks(currentBlockHex: string, blocksToSubtract: number): string {
    const currentBlock = parseInt(currentBlockHex, 16)

    const newBlock = currentBlock - blocksToSubtract

    return '0x' + newBlock.toString(16)
  }

  async retrieveLotteryLiquidity() {
    const cacheKey = `lottery_liquidity:${chain.id}`
    const cacheExpirationSeconds = /** @dev 6 hrs */ 6 * 60 * 60

    try {
      const cachedValue = await redis.get(cacheKey)
      if (cachedValue) {
        return cachedValue
      }
    } catch (error) {
      this.logger.warn(
        `Failed to retrieve lottery liquidity from cache: ${error}`,
      )
    }

    const response = await Moralis.EvmApi.token.getWalletTokenBalances({
      chain: isEth() ? '0x1' : '0x2105',
      address: LOTTERY[chain.id],
      tokenAddresses: [FOOM[chain.id]],
    } as any)

    const liquidityValue = response.result[0].value

    try {
      await redis.set(cacheKey, liquidityValue, 'EX', cacheExpirationSeconds)
    } catch (error) {
      this.logger.warn(`Failed to cache lottery liquidity: ${error}`)
    }

    return liquidityValue
  }

  calculateVolFromLastXDays(Bets: Array<LogBetIn>, days = 1) {
    const daysInBlocks = (chain.id === base.id ? 43200 : 7200) * days //  1 * days in blocks on Base/Ethereum

    const blockAgo = this.subtractBlocks(
      Bets[Bets.length - 1]?.blockNumber,
      daysInBlocks,
    )

    const resultArray = Bets.filter(bet => {
      return Number(bet.blockNumber) > Number(blockAgo)
    })
    const result = resultArray.reduce((acc, bet) => {
      return acc + Number(bet.meta.amount) / 10 ** 18
    }, 0)

    return result
  }

  async retrieveStatistics() {
    const foomPrice = (await this.apiService.relayFoomPrice())?.foomPrice

    const Bets = await this.logBetInModel.find({}).sort({
      createdAt: 1,
    })
    const uniquePlayers = await this.countUniquePlayers()
    const lotteryLiquidity = await this.retrieveLotteryLiquidity()

    const totalVolumeAgg = await this.logBetInModel
      .aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: { $toDouble: '$meta.amount' } },
          },
        },
      ])
      .exec()

    const totalVolumeFoom = totalVolumeAgg[0]?.total
      ? totalVolumeAgg[0].total / 10 ** 18
      : 0

    const totalVolUSD = Number(totalVolumeFoom) * foomPrice
    const lotteryLiquidityBaseUSD = Number(lotteryLiquidity) * foomPrice

    const dayVolume = this.calculateVolFromLastXDays(Bets)
    const $7dayVolume = this.calculateVolFromLastXDays(Bets, 7)

    const dayVolumeUsd = Number(dayVolume) * foomPrice
    const $7dayVolumeUsd = Number($7dayVolume) * foomPrice

    const _$7dayApr =
      ((dayVolumeUsd * 0.04 * 365) / 7 / lotteryLiquidityBaseUSD) * 100

    const APR = ((totalVolUSD * 0.04) / lotteryLiquidityBaseUSD) * 100

    const data = {
      foomPrice: foomPrice,
      uniquePlayers: uniquePlayers,
      lotteryLiquidityBase: lotteryLiquidity,
      lotteryLiquidityBaseUSD: Number(lotteryLiquidity) * foomPrice,
      APR: APR,

      totalVolume: totalVolumeFoom,
      calculateVolFromLastDays: dayVolume,
      totalVolFromLast3Days: $7dayVolume,

      totalVolUSD: totalVolUSD,
      calculateVolUSDFromLastDays: dayVolumeUsd,
      totalVolUSDFromLast3Days: $7dayVolumeUsd,

      APR_from3DaysVol: _$7dayApr,
    }

    return {
      baseStats: data,
    }
  }

  /**
   * Safely gets nested object values with fallback
   */
  private safeGet(obj: any, path: string[], fallback: number = 0): number {
    return path.reduce((current, key) => current?.[key], obj) ?? fallback
  }

  private combineHolderChange(ethereumStats: any, baseStats: any) {
    const timeRanges = ['5min', '1h', '6h', '24h', '3d', '7d', '30d']

    return timeRanges.reduce(
      (acc, timeRange) => {
        const ethChange = this.safeGet(ethereumStats, [
          'holderChange',
          timeRange,
          'change',
        ])
        const baseChange = this.safeGet(baseStats, [
          'holderChange',
          timeRange,
          'change',
        ])
        const ethChangePercent = this.safeGet(ethereumStats, [
          'holderChange',
          timeRange,
          'changePercent',
        ])
        const baseChangePercent = this.safeGet(baseStats, [
          'holderChange',
          timeRange,
          'changePercent',
        ])

        acc[timeRange] = {
          change: ethChange + baseChange,
          changePercent: (ethChangePercent + baseChangePercent) / 2,
        }
        return acc
      },
      {} as Record<string, { change: number; changePercent: number }>,
    )
  }

  private combineHolderDistribution(ethereumStats: any, baseStats: any) {
    const distributionTypes = [
      'whales',
      'sharks',
      'dolphins',
      'fish',
      'octopus',
      'crabs',
      'shrimps',
    ]

    return distributionTypes.reduce(
      (acc, type) => {
        const ethCount = this.safeGet(ethereumStats, [
          'holderDistribution',
          type,
        ])
        const baseCount = this.safeGet(baseStats, ['holderDistribution', type])
        acc[type] = ethCount + baseCount
        return acc
      },
      {} as Record<string, number>,
    )
  }

  /**
   * Returns token holders and stats from all supported chains
   * @returns Object containing holders array and airdrop token stats
   */
  public async getTokenHolders() {
    const [primaryBalances, secondaryBalances] = await Promise.all([
      this.airdropBalanceModel.aggregate([
        { $match: { balance: { $ne: '0' } } },
        { $project: { _id: 0, account: 1, balance: 1 } },
      ]),
      this.airdropBalanceModelSecondary.aggregate([
        { $match: { balance: { $ne: '0' } } },
        { $project: { _id: 0, account: 1, balance: 1 } },
      ]),
    ])

    const mergedMap = new Map<string, bigint>()
    for (const b of primaryBalances) {
      mergedMap.set(b.account, BigInt(b.balance))
    }
    for (const b of secondaryBalances) {
      const prev = BigInt(mergedMap.get(b.account) || 0)
      mergedMap.set(b.account, prev + BigInt(b.balance))
    }

    const holders = Array.from(mergedMap.entries())
      .map(([address, amount]) => ({
        address,
        amount: Number(formatEther(amount)),
      }))
      .filter(h => h.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    const totalHolders = holders.length
    const distribution = {
      whales: holders.filter(h => h.amount >= 100_000).length,
      sharks: holders.filter(h => h.amount >= 25_000 && h.amount < 100_000)
        .length,
      dolphins: holders.filter(h => h.amount >= 5_000 && h.amount < 25_000)
        .length,
      fish: holders.filter(h => h.amount >= 1_000 && h.amount < 5_000).length,
      octopus: holders.filter(h => h.amount >= 250 && h.amount < 1_000).length,
      crabs: holders.filter(h => h.amount >= 50 && h.amount < 250).length,
      shrimps: holders.filter(h => h.amount > 0 && h.amount < 50).length,
    }

    return {
      holders,
      airdropTokenStats: {
        totalHolders,
        holderDistribution: distribution,
      },
    }
  }

  public async handleAirdropTransferStream(
    data: typeof MoralisTransferEventStreamMock,
  ) {
    for (const transfer of data.erc20Transfers) {
      _log('Streamed Airdrop Transfer:', transfer)
      try {
        const { from, to, value } = transfer
        const transferValue = BigInt(value)

        /** @dev update balances for both accounts */
        await this.updateAirdropBalance(
          from as Address,
          transferValue,
          'subtract',
        )
        await this.updateAirdropBalance(to as Address, transferValue, 'add')

        _log('Processed airdrop transfer:', {
          from,
          to,
          value: transferValue.toString(),
          txHash: transfer.transactionHash,
        })
      } catch (error) {
        _warn(`Error processing airdrop transfer: ${error}`)
      }
    }
  }

  private async updateAirdropBalance(
    account: Address,
    value: bigint,
    operation: 'add' | 'subtract',
  ) {
    if (account === zeroAddress) {
      return
    }

    const existingBalance = await this.airdropBalanceModel.findOne({
      account: account.toLowerCase(),
    })

    if (existingBalance) {
      const currentBalance = BigInt(existingBalance.balance)
      const newBalance =
        operation === 'add' ? currentBalance + value : currentBalance - value

      /** @dev make abs */
      const finalBalance = newBalance < 0n ? 0n : newBalance

      await this.airdropBalanceModel.updateOne(
        { account: account.toLowerCase() },
        { balance: finalBalance.toString() },
      )
    } else {
      const initialBalance = operation === 'add' ? value : 0n
      const airdropBalance = new this.airdropBalanceModel({
        account: account.toLowerCase(),
        balance: initialBalance.toString(),
      })
      await airdropBalance.save()
    }
  }

  /**
   * @dev after each streamed `collect()`, the tree is synced for later use by `fetchRewardStats`, ensuring minimal external API calls.
   * if >= 2**14 blocks have passed since the last share period this syncs the tree. Fetches the last share period from lottery contracts
   * last D state from Redis by key `lastQueriedPeriod:${chainId}:stats:D`.
   */
  @OnEvent(LOTTERY_EVENTS.NEW_WIN)
  async handleNewWinEvent(event: NewWinEventData) {
    const { blockNumber } = event
    const redisKey = `lastQueriedPeriod:${chain.id}:stats:D`

    let lastPeriodRaw: string | null = null
    try {
      lastPeriodRaw = await redis.get(redisKey)
    } catch (err) {
      this.logger.warn(`Failed to fetch ${redisKey} from Redis: ${err}`)
      return
    }

    if (!lastPeriodRaw) {
      this.logger.warn(`No last period found in Redis for key: ${redisKey}`)
      return
    }

    let lastPeriod: [
      string,
      string,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ]
    try {
      lastPeriod = JSON.parse(lastPeriodRaw)
    } catch (err) {
      this.logger.warn(
        `Failed to parse last period data (\`LotteryContract.sol['D']\`) retrieved from Redis store: ${err}`,
      )
      return
    }

    const periodStartBlock = Number(lastPeriod[0])
    if (isNaN(periodStartBlock)) {
      this.logger.warn(`Invalid periodStartBlock: ${lastPeriod[0]}`)
      return
    }

    /** @dev prevent redundant tree syncs for the same period block number (identifier) */
    const treeSyncKey = `treeSyncDone:${chain.id}:${periodStartBlock}`

    let alreadySynced = false
    try {
      alreadySynced = Boolean(await redis.get(treeSyncKey))
    } catch (err) {
      this.logger.warn(`Failed to fetch ${treeSyncKey} from Redis: ${err}`)
    }

    if (alreadySynced) {
      this.logger.log(
        `Tree sync already performed for period starting at block ${periodStartBlock}. Skipping.`,
      )
      return
    }

    if (Number(blockNumber) - periodStartBlock >= PERIOD_TIME_BLOCKS) {
      this.logger.log(
        `[On new LogWin]: More than 2**14 blocks since last period share saved (${periodStartBlock}) were passed — a new share period data is available. Triggering tree sync…`,
      )
      await syncFoomcashTree()

      /** @dev mark this period as synced, 1-day-throwaway */
      try {
        await redis.set(treeSyncKey, '1', 'EX', 86400)
      } catch (err) {
        this.logger.warn(`Failed to set ${treeSyncKey} in Redis: ${err}`)
      }
    }
  }

  /**
   * Retrieves LogWin + collect() data.
   * Fetches past LogWin events by scanning FoomLottery.sol contract events starting from the block number specified backwards,
   * skipping the already existing events (+ other data related to them) (skips duplicates that are saved to database already).
   * Adjusts the scanned entries' createdAt timestamps to match the block timestamp. If there are multiple entries in a single block
   * then eventIndex can be used for further ordering.
   * @param startBlock if undefined, scan is started from the current (latest) block
   * @dev Upon an event match, the whole block is fetched for search of the matching transaction collect() arguments.
   */
  async syncPastLogWins({
    startBlock,
    batch = {
      size: 1000,
      interval: 3000,
    },
    limit,
  }: {
    startBlock?: number
    batch?: {
      size: number
      interval: number
    }
    limit?: number
  } = {}) {
    const deploymentBlock = FOOM_LOTTERY_DEPLOYMENT_BLOCK[chain.id]
    const _startBlock = startBlock ?? (await this.publicClient.getBlockNumber())
    let totalSynced = 0

    let currentBlock = BigInt(_startBlock)

    this.logger.log(
      `Starting LogWin sync from block ${currentBlock} down to deployment block ${deploymentBlock}`,
    )

    /** @dev scan up until the lottery deployment date */
    while (currentBlock > deploymentBlock) {
      const { fromBlock, toBlock } = this.calculateBlockRange(
        currentBlock,
        batch.size,
        deploymentBlock,
      )

      const logs = await this.fetchLogWinEvents(
        fromBlock,
        toBlock,
        batch.interval,
      )

      /** @dev skip batch if no logs found */
      if (logs?.length > 0) {
        const processedCount = await this.processLogWinBatch(
          logs,
          batch.interval,
          limit,
          totalSynced,
        )
        totalSynced += processedCount

        if (limit && totalSynced >= limit) {
          this.logger.log(
            `Reached limit of ${limit} LogWin events. Stopping sync.`,
          )
          return
        }
      }

      currentBlock -= BigInt(batch.size)
      await sleep(batch.interval)
    }

    this.logger.log(
      `Completed all LogWin events sync. Reached block no. ${currentBlock}. Total entries synced: ${totalSynced}.`,
    )
  }

  /**
   * Calculates the block range for the current batch
   */
  private calculateBlockRange(
    currentBlock: bigint,
    batchSize: number,
    deploymentBlock: bigint,
  ): { fromBlock: bigint; toBlock: bigint } {
    const toBlock = currentBlock
    const fromBlock =
      currentBlock - BigInt(batchSize) + 1n > deploymentBlock
        ? currentBlock - BigInt(batchSize) + 1n
        : deploymentBlock

    return { fromBlock, toBlock }
  }

  /**
   * Fetches LogWin events for a specific block range with infinite retry
   */
  private async fetchLogWinEvents(
    fromBlock: bigint,
    toBlock: bigint,
    batchInterval: number,
  ): Promise<IRawLog[]> {
    this.logger.verbose(
      `Fetching LogWin events from ${fromBlock} to ${toBlock}…`,
    )

    let fetchSuccessful = false
    let logs: IRawLog[] = []

    while (!fetchSuccessful) {
      try {
        const query = await axios.post(
          chainRpc,
          {
            jsonrpc: '2.0',
            method: 'eth_getLogs',
            params: [
              {
                address: LOTTERY[chain.id],
                topics: [[toEventSelector(getEvent(LOTTERY_ABI, 'LogWin'))]],
                fromBlock: `0x${fromBlock.toString(16)}`,
                toBlock: `0x${toBlock.toString(16)}`,
              },
            ],
            id: 1,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )

        logs = query?.data?.result as IRawLog[]

        if (!logs) {
          this.logger.warn(
            `Empty response from RPC for blocks ${fromBlock}-${toBlock}. Retrying in ${batchInterval}ms...`,
          )
          await sleep(batchInterval)
          continue
        }

        this.logger.verbose(
          `Found ${logs.length} LogWin events in range ${fromBlock}-${toBlock}`,
        )
        fetchSuccessful = true
      } catch (err) {
        this.logger.warn(
          `Failed to fetch logs for blocks ${fromBlock}-${toBlock}: ${err}. Retrying in ${batchInterval}ms...`,
        )
        await sleep(batchInterval)
      }
    }

    return logs
  }

  /**
   * Processes a batch of LogWin events by fetching TX data for all of them
   * and parsing them and storing in DB
   */
  private async processLogWinBatch(
    logs: IRawLog[],
    batchInterval: number,
    limit?: number,
    currentCount: number = 0,
  ): Promise<number> {
    let processedInBatch = 0

    for (const log of logs) {
      if (limit && currentCount + processedInBatch >= limit) {
        this.logger.log(
          `Reached limit of ${limit} LogWin events during batch processing. Stopping.`,
        )
        return processedInBatch
      }

      const txHash = log.transactionHash

      const exists = await this.logWinModel.findOne({
        txHash: RegexUtils.insensitive(txHash),
      })
      /** @dev skip if DB has this event (and so the TX) scanned and saved already */
      if (exists) {
        this.logger.verbose(
          `LogWin with txHash ${txHash} already exists, skipping`,
        )
        continue
      }

      await this.processLogWinWithRetry(log, batchInterval)
      processedInBatch++
    }

    return processedInBatch
  }

  /**
   * Processes a single LogWin event with infinite retry logic
   */
  private async processLogWinWithRetry(
    log: IRawLog,
    batchInterval: number,
  ): Promise<void> {
    const txHash = log.transactionHash
    /** @dev success handler for retry */
    let logProcessed = false

    while (!logProcessed) {
      try {
        const logWinData = await this.extractLogWinData(log)

        await this.saveLogWin(logWinData, log)
        /** @dev trip success */
        logProcessed = true

        this.logger.verbose(
          `Saved LogWin for TX ${txHash} at block ${log.blockNumber}`,
        )
      } catch (err) {
        _error(`For TX: ${txHash}`, err)
        this.logger.warn(
          `Failed to process LogWin for TX ${txHash}. Retrying in ${batchInterval}ms...`,
        )

        await sleep(batchInterval)
      }
    }
  }

  /**
   * Extracts and decodes LogWin data from blockchain
   */
  private async extractLogWinData(log: IRawLog) {
    const txHash = log.transactionHash

    const blockData = await this.publicClient.getBlock({
      blockHash: log.blockHash,
    })

    const txData = await this.publicClient.getTransaction({
      hash: txHash,
    })

    const decodedEventLog = decodeEventLog({
      abi: LOTTERY_ABI,
      data: log.data,
      topics: log.topics as [Hex, ...Hex[]],
      eventName: 'LogWin',
    })

    const decodedTxInput = decodeFunctionData({
      abi: LOTTERY_ABI,
      data: txData.input,
    })

    const logArgs = decodedEventLog.args as any as {
      nullifierHash: Hex
      reward: bigint
      recipient: Address
    }

    return {
      blockData,
      txData,
      decodedTxInput,
      logArgs,
    }
  }

  /**
   * Saves LogWin data to database
   */
  private async saveLogWin(
    data: {
      blockData: any
      txData: any
      decodedTxInput: any
      logArgs: { nullifierHash: Hex; reward: bigint; recipient: Address }
    },
    log: IRawLog,
  ): Promise<void> {
    const { blockData, txData, decodedTxInput, logArgs } = data
    const txHash = log.transactionHash

    const { data: logWinData, meta } = calculateLogWinData({
      decodedTxInput,
      logArgs,
    })

    const createdAt = new Date(Number(blockData.timestamp) * 1000)
    const logWin = new this.logWinModel({
      data: logWinData,
      meta: {
        ...meta,
        txBlockIndex: Number(log.transactionIndex),
      },
      blockNumber: log.blockNumber,
      sender: txData.from,
      txHash: txHash,
      createdAt,
    })

    await logWin.save()
  }
}
