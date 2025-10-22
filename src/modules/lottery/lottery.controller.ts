import { _log } from 'src/utils/ts'
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import type { Hex } from 'viem'
import { ApiOkResponse } from '@nestjs/swagger'
import { plainToInstance } from 'class-transformer'

import { fetchRewardStats } from 'src/lib/lottery/stats'
import { PaginationDto } from './dto/pagination.dto'
import { RewardStatsDto } from './dto/reward-stats.dto'
import { LotteryService } from './lottery.service'
import { Meta } from 'src/schemas/meta.schema'
import { BlockchainService } from '../blockchain/blockchain.service'
import { AuthGuard } from 'src/modules/blockchain/auth.guard'

@Controller('lottery')
export class LotteryController {
  constructor(
    @InjectModel(Meta.name)
    private readonly metaModel: Model<Meta>,

    private readonly lotteryService: LotteryService,
    private readonly blockchainService: BlockchainService,
  ) {}

  @Post('mint')
  async mint(@Body() body: { data: Hex; hash: Hex }) {
    return this.lotteryService.saveMintResult(body)
  }

  @Get('last-leaf')
  async getLastLeaf() {
    return this.lotteryService.getLastLeaf()
  }

  @Get('fees')
  async getFees() {
    return this.lotteryService.getFees()
  }

  /**
   * @dev Returns Merkle path for a leaf with given index.
   * @param index index of the leaf in the tree
   * @param nextIndex if not provided, last global leaf's next index is used
   */
  @Get('proof-path')
  async getPath(
    @Query('index') index: number,
    @Query('nextIndex') nextIndex?: number,
  ) {
    return this.lotteryService.getPath(index, nextIndex)
  }

  @Get('leaf')
  async findLeafByHash(
    @Query('hash') hash: string,
    @Query('startIndex') startIndex: number,
  ) {
    return this.lotteryService.findLeaf(hash, startIndex)
  }

  /**
   * Looks up the leaf given its hash only if a hash is given. Looks up the leaf by index if it's given otherwise.
   * @param hash bet secret's hash
   * @param index bet's contract-emitted index
   * @returns leaf
   */
  @Get('leaf-pro')
  async findLeaf(@Query('hash') hash?: string, @Query('index') index?: number) {
    return this.lotteryService.findLeaf(hash, index)
  }

  @Get('leaves')
  async findLeaves(
    @Query('hashes') hashes?: string[],
    @Query('indices') indices?: number[],
  ) {
    return this.lotteryService.findLeaves(hashes, indices)
  }

  @Get('start-index')
  async getStartIndex(@Query('hash') hash: string): Promise<number | null> {
    return this.lotteryService.getStartIndex(hash)
  }

  @Get('logs')
  async getLogs(@Query() pagination_: PaginationDto) {
    const pagination = plainToInstance(PaginationDto, pagination_)

    return this.lotteryService.getLogs(pagination)
  }

  @Get('plays')
  async getPlays(
    @Query() pagination_: PaginationDto,
    @Query('filter') filter?: string,
  ) {
    const pagination = plainToInstance(PaginationDto, pagination_)

    return this.lotteryService.getPlays(pagination, filter)
  }

  @Get('prayers')
  async getPrayers(@Query() pagination_: PaginationDto) {
    const pagination = plainToInstance(PaginationDto, pagination_)

    return this.lotteryService.getPrayers(pagination)
  }

  /**
   * Returns the most recent random values from the rand.csv file structure.
   * @query lastIndex The last index to start reading from.
   * @query numRand The number of random values to retrieve.
   * @returns An array of strings in the format "index,rand".
   */
  @Get('rand-range')
  async getRandRange(
    @Query('lastIndex') lastIndex: number,
    @Query('numRand') numRand: number,
  ) {
    return this.lotteryService.getRandRange(lastIndex, numRand)
  }

  /**
   * Returns reward stats for the lottery (FOOM balance, ticket count, period stats).
   */
  @Get('reward-stats')
  @ApiOkResponse({ type: RewardStatsDto })
  async getRewardStats() {
    return fetchRewardStats(
      this.lotteryService,
      this.metaModel,
      this.blockchainService.publicClient,
    )
  }

  /**
   * Returns current round time of the running Lottery, in seconds.
   * Calculates based on block numbers and appropriate block time for the chain.
   * @returns Time in seconds since last commit, or null if no commits found
   */
  @Get('round-time')
  async getTimeSinceLastCommit(): Promise<{
    seconds: number | null
    lastCommit: unknown
  }> {
    const result = await this.lotteryService.getTimeSinceLastCommit()
    return {
      seconds: result?.timeSinceLastCommit,
      lastCommit: result?.lastCommit,
    }
  }

  /**
   * Schedules the indexer service restart.
   */
  @Post('reboot')
  @UseGuards(AuthGuard)
  async rebootIndexer() {
    process.exit(0) /** @dev Docker instance reboot */
  }
}
