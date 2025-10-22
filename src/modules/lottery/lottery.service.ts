import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { exec } from 'child_process'
import { promises as fs } from 'fs'
import { Model, PaginateModel } from 'mongoose'
import mongoosePaginate from 'mongoose-paginate-v2'
import { join } from 'path'
import { FOOM, LOTTERY, LOTTERY_EVENT_NAMES } from 'src/lib/contracts/addresses'
import { putLeaves } from 'src/lib/lottery/putLeaves'
import { bigintToHexRaw } from 'src/lib/lottery/utils/bigint'
import {
  findBet,
  getPath,
  readFees,
  readLast,
  readRand,
} from 'src/lib/lottery/utils/mimcMerkleTree'
import { Pagination } from 'src/lib/utils/pagination.interface'
import { BlockchainService } from 'src/modules/blockchain/blockchain.service'
import { LogBetIn } from 'src/schemas/log-bet-in.schema'
import { LogCancel } from 'src/schemas/log-cancel.schema'
import type { LogPrayer } from 'src/schemas/log-prayer.schema'
import { LogUpdate, LogUpdateSchema } from 'src/schemas/log-update.schema'
import { Mint } from 'src/schemas/mint.schema'
import { RegexUtils } from 'src/utils/regex'
import { _log } from 'src/utils/ts'
import { promisify } from 'util'
import { createPublicClient, erc20Abi, http, type Hex } from 'viem'
import { base } from 'viem/chains'
import { chain } from 'src/modules/core/constants'
import { getChainRpc } from 'src/modules/core/utils'
import { PaginationDto } from './dto/pagination.dto'
import {
  GENESIS_BLOCKS,
  type IGenesisBlock,
} from 'src/lib/lottery/utils/blockNumber'

const execAsync = promisify(exec)

@Injectable()
export class LotteryService {
  private leafQueue: Array<() => Promise<void>> = []
  private isProcessingQueue = false

  constructor(
    @InjectModel(LogUpdate.name)
    private readonly logUpdateModel: PaginateModel<LogUpdate>,
    @InjectModel(LogBetIn.name)
    private readonly logBetInModel: Model<LogBetIn>,
    @InjectModel(LogCancel.name)
    private readonly logCancelModel: Model<LogCancel>,
    @InjectModel(Mint.name)
    private readonly mintModel: Model<Mint>,
    private blockchainService: BlockchainService,
  ) {
    LogUpdateSchema.plugin(mongoosePaginate)
    this.watchEventsCollections(this.logUpdateModel, 'LogUpdate')
    this.watchEventsCollections(this.logBetInModel, 'LogBetIn')
    this.watchEventsCollections(this.logCancelModel, 'LogCancel')
  }

  public async getStartIndex(hash: string): Promise<number | null> {
    const [startIndex] = findBet(hash, 0)

    return startIndex !== undefined ? startIndex : null
  }

  public async getFees() {
    return readFees()
  }

  /**
   * Get the FOOM token balance of the lottery contract
   * @param chainId - The chain ID to query (defaults to current chain)
   * @returns The FOOM balance as a bigint
   */
  public async getFoomBalance(chainId: number = chain.id): Promise<bigint> {
    if (!FOOM[chainId]) {
      throw new Error(`Invalid chain ID: ${chainId}`)
    }

    const client = createPublicClient({
      transport: http(getChainRpc(chainId)),
    })

    const foomBalance = await client.readContract({
      address: FOOM[chainId],
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [LOTTERY[chainId]],
    })

    return foomBalance as bigint
  }

  /** @returns [nextIndex, blockNumber, lastRoot, lastLeaf] */
  public getLastLeaf() {
    return readLast()
  }

  public async getPath(index: number, nextIndex?: number) {
    const [nextIndexGlobal] = this.getLastLeaf()

    /** @dev MimcMerkleTree.getPath(index, nextIndex) */
    const path = await getPath(index, nextIndex || nextIndexGlobal)
    return path
  }

  public async findLeaf(
    hash: string,
    /** @dev if no start index is passed in, it's auto-determined here instead */
    startIndex: number = 0,
  ): Promise<
    | [
        /** @dev ?leafs startIndex (leaf index) */ number,
        /** @dev leaf random */ bigint,
        /** @dev leafs nextIndex (index of a leaf that will be inserted into the tree the earliest now) */ number,
      ]
    | null
  > {
    _log(
      `Looking up a leaf using ${startIndex ? 'index' : 'hash'}:`,
      startIndex || hash,
    )

    const bet = findBet(hash, startIndex)
    return bet !== undefined ? bet : null
  }

  public async findLeaves(
    hashes: string[],
    /** @dev if no start index is passed in, it's auto-determined here instead */
    indices: number[],
  ): Promise<
    (
      | [
          /** @dev ?leafs startIndex (leaf index) */ number,
          /** @dev leaf random */ bigint,
          /** @dev leafs nextIndex (index of a leaf that will be inserted into the tree the earliest now) */ number,
        ]
      | null
    )[]
  > {
    const results = []

    const length = Math.max(hashes?.length || 0, indices?.length || 0)
    for (let i = 0; i < length; i++) {
      const hash = hashes?.[i]
      const startIndex = indices?.[i] || 0
      // _log(
      //   `Looking up a leaf using ${startIndex ? 'index' : 'hash'}:`,
      //   startIndex || hash,
      // )

      const bet = findBet(hash, startIndex)
      results.push(bet !== undefined ? bet : null)
    }

    return results
  }

  /**
   * Appends cleaned hex arguments (without leading 0x00) to www/waiting.csv.
   * @param arg1 string (hex, e.g., "0x000ab")
   * @param arg2 string (hex, e.g., "0x00def")
   */
  public async writeWaitingCsv(arg1: string, arg2: string): Promise<void> {
    const cleanHex = (hex: string): string => hex.replace(/^0x0*/, '') || '0'

    const cleanedArg1 = cleanHex(arg1)
    const cleanedArg2 = cleanHex(arg2)

    const line = `${cleanedArg1},${cleanedArg2}\n`
    const filePath = join(process.cwd(), 'www', 'waiting.csv')

    await fs.appendFile(filePath, line, 'utf8')
  }

  /**
   * Executes putLeaves with arguments and returns its stdout as a string.
   * @param newIndex number (hex or decimal)
   * @param newRand string (hex)
   * @param newRoot string (hex)
   * @param blockNumber number (hex or decimal)
   */
  public async runPutLeavesScript(
    newIndex: number,
    newRand: string,
    newRoot: string,
    blockNumber: number,
  ): Promise<string> {
    try {
      const newIndexHex = '0x' + newIndex.toString(16)
      const blockNumberHex = '0x' + blockNumber.toString(16)

      // const execAsync = promisify(exec)

      const args = [newIndexHex, newRand, newRoot, blockNumberHex]

      const out = await putLeaves(newIndexHex, newRand, newRoot, blockNumberHex)

      // const scriptPath = join(
      //   process.cwd(),
      //   'src',
      //   'lib',
      //   'lottery',
      //   'putLeaves.ts',
      // )
      // const cmd = `node ${scriptPath} ${args.join(' ')}`

      // const out_ = await execAsync(cmd, {
      //   cwd: process.cwd(),
      // }).catch(error => {
      //   throw new Error(`${error.stdout} ${error.stderr}`)
      // })

      _log('putLeaves executed with args:', args)
      _log('putLeaves output:', /** out_.stdout */ out)

      // return out_.stdout
      return out
    } catch (error) {
      throw new Error(`putLeaves failed: ${error}`)
    }
  }

  private async processQueue() {
    if (this.isProcessingQueue) {
      return
    }

    this.isProcessingQueue = true
    while (this.leafQueue.length > 0) {
      const task = this.leafQueue.shift()
      if (task) {
        try {
          await task()
        } catch (error) {
          _log('Error processing leaf queue task:', error)
        }
      }
    }
    this.isProcessingQueue = false
  }

  private async updateProcessedField(
    id: string,
    model: Model<any>,
  ): Promise<void> {
    try {
      await model.updateOne(
        { _id: id },
        { $set: { isProcessed: true } },
        { writeConcern: { w: 0 } },
      )
    } catch (error) {
      _log(
        `Error updating isProcessed field for document with ID ${id}:`,
        error,
      )
    }
  }

  /**
   * Watches the given model for changes and processes events for leaves info retrieval.
   * @dev blockchain -> database -> [watcher (you are here)]
   * @param model Mongoose model to watch
   * @param label Event label for watching
   */
  private watchEventsCollections(
    model: Model<LogUpdate | LogBetIn | LogCancel | any>,
    label: string,
  ) {
    model
      .watch([], { fullDocument: 'updateLookup' })
      .on('change', async change => {
        const _document = change.fullDocument as
          | undefined
          | LogBetIn
          | LogUpdate
          | LogCancel
        if (!_document?.data) {
          return
        }

        /** @dev document update guard – the event is stale or updated only. */
        if (change.operationType !== 'insert') {
          return
        }

        /** @dev when a leaf is added, e.g. after `play()`, `playETH()` */
        const isLogBetIn = label === LOTTERY_EVENT_NAMES.LogBetIn

        /** @dev when leaves are updated, e.g. after `reveal()` */
        const isLogUpdate = label === LOTTERY_EVENT_NAMES.LogUpdate

        /** @dev when a CANCEL leaf is added */
        const isLogCancel = label === LOTTERY_EVENT_NAMES.LogCancel

        /** @dev update waiting list on "new leaf" event – add leaf to waitlist */
        if (isLogBetIn) {
          const document = _document as LogBetIn
          this.leafQueue.push(async () => {
            _log(`LogBetIn:`, document, '\n')
            _log('Adding leaf to waiting list...')
            const data = document.data
            const index = data.index
            const _newHash = data.newHash
            const newHashHex = BigInt(`${_newHash}`).toString(16)
            _log(`Writing to \`waiting.csv\`: ${index}, ${newHashHex}`)
            try {
              await this.writeWaitingCsv(bigintToHexRaw(index), newHashHex)
              _log(`Leaf ${index}, ${newHashHex} written.`)
              await this.updateProcessedField(document._id as string, model)
            } catch (err) {
              _log(`Error writing to \`waiting.csv\`:`, err)
            }
          })
          this.processQueue()
        }

        /** @dev update waiting list on "new (cancellation) leaf" event – add leaf to waitlist */
        if (isLogCancel) {
          const document = _document as LogCancel
          this.leafQueue.push(async () => {
            _log(`LogCancel:`, document, '\n')
            _log('Adding [cancellation] leaf to waiting list...')
            const data = document.data
            const index = data.index
            const newHash = '0x20'
            _log(`Writing to \`waiting.csv\`: ${index}, ${newHash}`)
            try {
              await this.writeWaitingCsv(index, newHash)
              _log(`Leaf ${index}, ${newHash} written.`)
              await this.updateProcessedField(document._id as string, model)
            } catch (err) {
              _log(`Error writing to \`waiting.csv\`:`, err)
            }
          })
          this.processQueue()
        }

        /** @dev update leaves (tree) on "update" event – add currently waiting leaves to tree. NOTE: This automatically cleans up wating.csv */
        if (isLogUpdate) {
          const document = _document as LogUpdate
          this.leafQueue.push(async () => {
            _log(`LogUpdate:`, document, '\n')
            _log('Adding [waiting] leaves to tree...')
            const data = document.data
            const newIndex = Number(data.index)
            const newRand = data.newRand
            const newRoot = data.newRoot
            const blockNumber = Number(document.blockNumber)
            _log(
              `Running putLeaves with index: ${newIndex}, rand: ${newRand}, root: ${newRoot}, blockNumber: ${blockNumber}`,
            )
            try {
              const stdout = await this.runPutLeavesScript(
                newIndex,
                newRand,
                newRoot,
                blockNumber,
              )
              _log(`\`putLeaves\` result: ${stdout}`)
              await this.updateProcessedField(document._id as string, model)
            } catch (err) {
              _log(
                `Error running \`putLeaves\` via TX ${document.txHash}:`,
                err,
              )
            }
          })
          this.processQueue()
        }
      })
  }

  public async getLogs(
    pagination: PaginationDto,
  ): Promise<Pagination<LogUpdate | LogBetIn | LogCancel>> {
    const logUpdates = await this.logUpdateModel.find().exec()
    const logBetIns = await this.logBetInModel.find().exec()
    const logCancels = await this.logCancelModel.find().exec()

    const allLogs = [...logUpdates, ...logBetIns, ...logCancels]
    const logs = allLogs.sort(
      (a, b) => Number(b.blockNumber) - Number(a.blockNumber),
    )

    const startIndex = (pagination.page - 1) * pagination.limit
    const paginatedLogs = logs.slice(startIndex, startIndex + pagination.limit)
    const pages = Math.ceil(logs.length / pagination.limit)
    return {
      data: paginatedLogs,
      page: pagination.page,
      pages,
    }
  }

  /** TODO: Return from both dbs (Eth + Base) [query 2 dbs for 5 if limit is 5 and return 5, discarding the other 5 results after JS sorting] */
  public async getPlays(
    pagination: PaginationDto,
    filter?: string,
  ): Promise<Pagination<LogBetIn>> {
    let query = {}
    if (filter) {
      /** @dev filter by all */
      const fields = Object.keys(this.logBetInModel.schema.paths)

      const stringFields = [
        ...fields.filter(field => {
          const pathType = this.logBetInModel.schema.paths[field].instance
          return !['_id', '__v'].includes(field) && pathType === 'String'
        }),
        'meta.prayer',
        'meta.amount',
        'meta.user',
        'data.index',
        'data.newHash',
      ]

      const orConditions = stringFields.map(field => ({
        [field]: { $regex: RegexUtils.insensitiveInexact(filter) },
      }))
      query = { $or: orConditions }
    }

    const logBetIns = await this.logBetInModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .exec()

    const totalLogs = await this.logBetInModel.countDocuments(query).exec()
    const logs = logBetIns.sort(
      (a, b) => Number(b.blockNumber) - Number(a.blockNumber),
    )
    const pages = Math.ceil(totalLogs / pagination.limit)
    return {
      data: logs,
      page: pagination.page,
      pages,
    }
  }

  public async getPrayers(
    pagination: PaginationDto,
  ): Promise<Pagination<LogPrayer>> {
    const prayers = await this.logBetInModel
      .find({ 'meta.prayer': { $exists: true, $ne: '' } })
      .sort({ createdAt: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .exec()

    const totalPrayers = await this.logBetInModel
      .countDocuments({
        'meta.prayer': {
          $exists: true,
          $ne: '',
        },
      })
      .exec()

    const pages = Math.ceil(totalPrayers / pagination.limit)

    return {
      data: prayers as any as LogPrayer[],
      page: pagination.page,
      pages,
    }
  }

  /**
   * Saves a mint result to the Mint collection.
   * @param body Object containing data and hash
   */
  async saveMintResult(body: { data: Hex; hash: Hex }) {
    await this.mintModel.create({
      data: body.data,
      hash: body.hash,
    })

    return true
  }

  /**
   * Returns the most recent random values from the rand.csv file structure.
   * @param lastIndex The last index to start reading from.
   * @param numRand The number of random values to retrieve.
   * @returns An array of strings in the format "index,rand".
   */
  public async getRandRange(
    lastIndex: number,
    numRand: number,
  ): Promise<string[]> {
    return readRand(lastIndex, numRand)
  }

  /**
   * Returns the time since the last LogUpdate (commit) event in seconds.
   * Calculates based on Date.now() and the timestamp of the 0-th block for the chain.
   * @returns Promise<number | null> - Time in seconds since last commit, or null if no commits found
   */
  public async getTimeSinceLastCommit(): Promise<{
    timeSinceLastCommit: number | null
    lastCommit: unknown
  }> {
    try {
      const lastCommit = await this.logUpdateModel
        .findOne()
        .sort({ createdAt: -1 })
        .exec()

      if (!lastCommit) {
        return null
      }

      /**
       * @dev stable, real reference blocks and timestamps
       * fetched via CURL from publicnode.com for Eth/Base
       */
      const reference = GENESIS_BLOCKS[chain.id] as IGenesisBlock

      if (!reference) {
        throw new Error(`No GENESIS_BLOCKS entry for chainId: ${chain.id}`)
      }

      const lastCommitBlock = Number(lastCommit.blockNumber)
      const estimatedTimestamp =
        reference.genesisTimestamp +
        (lastCommitBlock - reference.genesisBlock) * reference.blockTime

      const nowSeconds = Math.floor(Date.now() / 1000)
      const timeSinceLastCommit = nowSeconds - estimatedTimestamp

      return { timeSinceLastCommit, lastCommit }
    } catch (error) {
      _log('Error calculating time since last commit:', error)
      return null
    }
  }
}
