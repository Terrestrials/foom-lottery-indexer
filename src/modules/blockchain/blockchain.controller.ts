import { _log, _warn } from 'src/utils/ts'
import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
  NotFoundException,
} from '@nestjs/common'
import { ApiOperation, ApiResponse } from '@nestjs/swagger'

import { BlockchainService } from 'src/modules/blockchain/blockchain.service'
import { AuthGuard } from './auth.guard'
import { isBase, isEth } from 'src/utils/environment'
import type {
  MoralisFunctionCallStreamMock,
  MoralisTransferEventStreamMock,
} from 'src/constants/mock/moralisStreams'
import { decodeEventLog, toEventSelector, type Hex } from 'viem'
import { decodeFunctionData } from 'viem'
import { parseAbi } from 'viem/utils'
import LOTTERY_ABI from 'src/lib/contracts/abis/FoomLotteryAbi'

const MORALIS_FN_STREAM_ID = '8669b24d-bad1-4e76-8d2e-2a83e64a6f14'
const MORALIS_AIRDROP_STREAM_ID_BASE = '88585629-6c46-48c2-b11d-c26ae36b6bf6'
const FOOM_LOTTERY_FN_COLLECT_SIGNATURE = '0x1611224f'
const FOOM_LOTTERY_FN_PAYOUT_SIGNATURE = '0xda333ca6'
const FOOM_LOTTERY_EVENT_LOGWIN_SIGNATURE = toEventSelector(
  'LogWin(uint256,uint256,address)',
)

@Controller('blockchain')
export class BlockchainController {
  private logger: Logger

  constructor(private readonly blockchainService: BlockchainService) {
    this.logger = new Logger(BlockchainController.name)
  }

  @Get('events')
  async getEvents() {
    return await this.blockchainService.getEvents()
  }

  //analise wallet => event => score + save to db
  //score wallet => frontend => score

  @Get('scoreWallet/:address')
  @ApiResponse({
    status: 200,
    description: 'Analise wallet',
  })
  async scoreWallet(@Param('address') address: string): Promise<object> {
    return this.blockchainService.scoreWallet(address)
  }

  @Post('skipEventsSync')
  @UseGuards(AuthGuard)
  async skipEventsSync(
    @Query('fromBlocks') fromBlocks?: string | bigint | number,
  ) {
    this.logger.warn(
      `==== Setting events sync [fromBlock] to =====: ${fromBlocks}`,
    )
    return await this.blockchainService.setLastSyncedBlocks(BigInt(fromBlocks))
  }

  /**
   * Processes all FoomLottery.sol's function calls
   * @param data
   * @returns
   */
  @Post('streamNativeCalls')
  async streamNativeCalls(@Body() data: typeof MoralisFunctionCallStreamMock) {
    if (!isEth() || data.chainId !== '0x1') {
      return
    }
    if (data.streamId !== MORALIS_FN_STREAM_ID) {
      _warn(
        `Invalid stream ID ${data?.streamId} tried invoking the streaming callback!`,
      )
      return
    }

    try {
      await this.blockchainService.handleCollectFunctionCallMoralisStream(data)
    } catch (error) {
      _warn(`Error while processing Moralis function call stream: ${error}`)
    }
    return HttpCode(200)
  }

  @Get('statistics')
  @ApiResponse({
    status: 200,
    description: 'Statistics',
  })
  async retrieveStatistics(): Promise<object> {
    return this.blockchainService.retrieveStatistics()
  }

  @Get('airdropHolders')
  @ApiResponse({
    status: 200,
    description: 'Airdrop holders',
  })
  async getAirdropHolders() {
    return this.blockchainService.getTokenHolders()
  }

  @Post('streamAirdropTransfers')
  async streamAirdropTransfers(
    @Body() data: typeof MoralisTransferEventStreamMock,
  ) {
    if (isBase() && data.streamId !== MORALIS_AIRDROP_STREAM_ID_BASE) {
      _warn(
        `Invalid airdrop stream ID ${data?.streamId} tried invoking the streaming callback!`,
      )
      return
    }

    try {
      await this.blockchainService.handleAirdropTransferStream(data)
    } catch (error) {
      _warn(`Error while processing Moralis airdrop transfer stream: ${error}`)
    }
    return HttpCode(200)
  }

  @Post('streamPastLogWinEvents')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Sync past LogWin events from blockchain' })
  @ApiResponse({
    status: 200,
    description: 'Past LogWin events sync started successfully',
  })
  async syncPastLogWins(
    @Body()
    body: {
      startBlock?: number
      batch?: {
        size: number
        interval: number
      }
      limit?: number
    } = {},
  ) {
    try {
      const { startBlock, batch, limit } = body
      void this.blockchainService.syncPastLogWins({
        startBlock,
        batch: {
          size: Number(batch?.size) || 1000,
          interval: Number(batch?.interval) || 3000,
        },
        limit,
      })

      this.logger.log(
        `Started syncing past LogWin events from block ${startBlock || 'latest'}`,
      )
      return {
        success: true,
        message: 'Past LogWin events sync started successfully',
        startBlock: startBlock || 'latest',
        batchSize: batch?.size || 1000,
        batchInterval: batch?.interval || 3000,
      }
    } catch (error) {
      this.logger.error('Error starting past LogWin events sync:', error)
      throw error
    }
  }
}
