import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Cron } from '@nestjs/schedule'
import { OnEvent } from '@nestjs/event-emitter'
import { Model } from 'mongoose'
import axios from 'axios'
import { fetchRewardStats } from 'src/lib/lottery/stats'
import { formatNumber, trimToMeaningfulDecimals } from 'src/lib/utils/math'
import { isDevelopment, isEth, isLocal, isRemote } from 'src/utils/environment'
import { _log, _warn } from 'src/utils/ts'
import { formatEther } from 'viem'
import { ApiService } from '../api/api.service'
import { LotteryService } from '../lottery/lottery.service'
import { BlockchainService } from '../blockchain/blockchain.service'
import { Meta } from 'src/schemas/meta.schema'
import { LogWin } from 'src/schemas/log-win.schema'
import type { LogBetIn } from 'src/schemas/log-bet-in.schema'
import { nFormatter } from 'src/utils/node'
import {
  LOTTERY_EVENTS,
  type NewWinEventData,
} from '../core/events/lottery-events.interface'

@Injectable()
export class FoomCashBotService {
  constructor(
    private readonly apiService: ApiService,
    private readonly lotteryService: LotteryService,
    private readonly blockchainService: BlockchainService,
    @InjectModel(Meta.name)
    private readonly metaModel: Model<Meta>,
    @InjectModel(LogWin.name)
    private readonly logWinModel: Model<LogWin>,
  ) {
    _log('FoomCashBotService initialized, `isDev` is set to', isDevelopment())

    // /** @dev CRON TG status debug */
    // setTimeout(() => {
    //   this.postStats()
    // }, 1000)

    /** @dev Winner TG status debug */
    // setTimeout(() => {
    //   this.handleNewWin({
    //     txHash:
    //       '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    //     blockNumber: '18500000',
    //     recipient: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
    //     reward: '950000000000000000000',
    //     nullifierHash:
    //       '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
    //     rewardGross: '1000000000000000000000',
    //     invested: '50000000000000000000',
    //     refund: '0',
    //     feeGenerator: '10000000000000000000',
    //     feeInvestors: '30000000000000000000',
    //     feeRelayer: '10000000000000000000',
    //     timestamp: new Date(),
    //   })
    // }, 1000)
  }
  @Cron('0 16 * * *')
  async handleCron() {
    /** @dev only secondary instance should handle the bot atm (Ethereum) */
    if (!isEth()) {
      return
    }

    _log('Firing foom cash bot cron…')
    await this.postStats()
  }

  private constructStatsMessage(params: {
    depositFoom?: number
    withdrawFoom?: number
    foomBalance?: number
    foomPrice?: string | number
    stakedFoom?: number
    staked?: number
    revenueFoom?: number
    revenue?: number
    costFoom?: number
    cost?: number
    aprPeriod?: number
    aprAll?: number
  }): string {
    const {
      depositFoom,
      withdrawFoom,
      foomBalance,
      foomPrice,
      stakedFoom,
      staked,
      revenueFoom,
      revenue,
      costFoom,
      cost,
      aprPeriod,
      aprAll,
    } = params

    const lines: string[] = [
      `<b>💼 <a href="https://foom.cash">Foom.Cash</a> Investor Status</b>\n\n`,
      depositFoom !== undefined &&
        `➕ <b>Deposits:</b> $${formatNumber(depositFoom)}\n`,
      withdrawFoom !== undefined &&
        `➖ <b>Withdrawals:</b> $${formatNumber(withdrawFoom)}\n`,
      foomBalance !== undefined &&
        `Ξ <b>Current FOOM Balance:</b> $${formatNumber(foomBalance)}\n\n`,
      foomPrice !== undefined &&
        `🪙 <b>$FOOM Price:</b> $${trimToMeaningfulDecimals(foomPrice, 4)}\n`,
      revenue !== undefined &&
        `💸 <b>Investors' Revenue:</b> ${nFormatter(revenueFoom)} FOOM ~ $${formatNumber(revenue)}\n`,
      costFoom !== undefined &&
        `📄 <b>Relayers' Revenue:</b> ${nFormatter(costFoom)} FOOM ~ $${formatNumber(cost)}\n\n`,
      (aprPeriod !== undefined || aprAll !== undefined) &&
        `📈 <b>APR (2¼ days – period):</b> ${aprPeriod !== undefined ? `${formatNumber(aprPeriod)}%` : '-'} | 📈 <b>Average APR (all time):</b> ${aprAll !== undefined ? `${formatNumber(aprAll)}` : '-'}%\n`,
    ].filter(Boolean) as string[]
    return lines.join('')
  }

  public async postStats(): Promise<object | undefined> {
    const apiKey = process.env.FOOM_CASH_BOT_API_KEY
    if (!apiKey) {
      _warn('FOOM_CASH_BOT_API_KEY is not defined!')
      return
    }
    const foomPriceQuery = await this.apiService.relayFoomPrice()
    const foomPrice = foomPriceQuery?.foomPrice

    const chatIds = this.getChatIds()
    const stats = await this.getStats()
    const data = {
      depositFoom: stats.depositFoom * foomPrice,
      withdrawFoom: stats.withdrawFoom * foomPrice,
      foomBalance: stats.foomBalance * foomPrice,
      foomPrice: stats.foomPrice,
      stakedFoom: stats.stakedFoom,
      staked: stats.stakedFoom * foomPrice,
      costFoom: stats.costFoom,
      cost: stats.costFoom * foomPrice,
      revenue: stats.revenue * foomPrice,
      revenueFoom: stats.revenueFoom,
      aprPeriod: stats.aprPeriod,
      aprAll: stats.aprAverage,
    }
    const text = this.constructStatsMessage(data)

    try {
      await this.publishOnTelegramChats(apiKey, chatIds, text)

      return {
        result: data,
        status: 200,
      }
    } catch (error: any) {
      throw new Error(
        `Failed to send message: ${error?.response?.data?.description || error.message}`,
      )
    }
  }

  public async getStats() {
    const foomPriceQuery = await this.apiService.relayFoomPrice()
    const foomBalance = await this.lotteryService.getFoomBalance()
    const rewardStats = await fetchRewardStats(
      this.lotteryService,
      this.metaModel,
      this.blockchainService.publicClient,
    )
    const periods = rewardStats.periods || []
    const lastPeriod = periods.length > 0 ? periods.at(-1) : null
    const foomPrice = foomPriceQuery?.foomPrice

    const hour = 18 - (isRemote() ? 2 : 0)
    const depositFoomFormatted = await this.getDepositFoomUntilHour(hour)
    const logWins = await this.getLogWinsUntilHour(hour)
    const withdrawFoomFormatted = this.calculateWithdrawFoomFromLogWins(logWins)
    const costFoomFormatted = this.calculateCostFoomFromLogWins(logWins)
    const revenueFoomFormatted = (4 / 100) * depositFoomFormatted
    const investedFoomFormatted = this.calculateInvestedFoomFromLogWins(logWins)

    return {
      /** @dev [.play...()] sum */
      depositFoom: depositFoomFormatted,
      /** @dev [.payOut...(), .collect()] sum */
      withdrawFoom: withdrawFoomFormatted,
      /** @dev contract state view call (ERC20) */
      foomBalance: Number(formatEther(foomBalance)),
      /** @dev contract state view call (Uniswap) */
      foomPrice:
        foomPrice && typeof foomPrice === 'number'
          ? foomPrice.toLocaleString('en-US', {
              useGrouping: false,
              minimumFractionDigits: 18,
            })
          : foomPrice,
      /** @dev calculated based on .collect events `invest` values; TBD: Moralis-stream these .collects with their values for that */
      stakedFoom: investedFoomFormatted,
      /** @dev fees for Generator (1% of withdraws gross) */
      costFoom: costFoomFormatted,
      /** @dev revenue: 5% of all gross rewards */
      revenueFoom: revenueFoomFormatted,
      revenue: revenueFoomFormatted,
      /** @dev current APR from /stats */
      aprPeriod: lastPeriod?.apr,
      /** @dev average APR from last 7 periods */
      aprAverage:
        periods?.map(p => p.apr ?? 0)?.reduce((a, b) => a + b, 0) /
        (periods.length || 1),
    }
  }

  private async getDepositFoomUntilHour(hour: number = 18): Promise<number> {
    const { yesterdayAtHour, todayAtHour } = this.getTimeRangeUntilHour(hour)

    _log(
      'Fetching bet amounts for ranges:',
      JSON.stringify(
        {
          since: yesterdayAtHour,
          until: todayAtHour,
        },
        null,
        2,
      ),
    )

    const logBetIns = await this.lotteryService['logBetInModel'].find(
      {
        createdAt: {
          $gte: yesterdayAtHour,
          $lt: todayAtHour,
        },
      },
      {
        _id: 0,
        'meta.amount': 1,
      },
    )

    return this.calculateDepositFoomFromLogBetIns(logBetIns)
  }

  private async getLogWinsUntilHour(hour: number = 18): Promise<LogWin[]> {
    const { yesterdayAtHour, todayAtHour } = this.getTimeRangeUntilHour(hour)

    _log(
      'Fetching win entries for ranges:',
      JSON.stringify(
        {
          since: yesterdayAtHour,
          until: todayAtHour,
        },
        null,
        2,
      ),
    )

    const logWins = await this.logWinModel.find(
      {
        createdAt: {
          $gte: yesterdayAtHour,
          $lt: todayAtHour,
        },
      },
      {
        _id: 0,
      },
    )

    return logWins
  }

  private calculateWithdrawFoomFromLogWins(logWins: LogWin[]): number {
    const withdrawFoom = logWins.reduce<bigint>((sum, win) => {
      return sum + BigInt(win.meta.rewardGross || '0')
    }, 0n)

    return Number(formatEther(withdrawFoom))
  }

  private calculateCostFoomFromLogWins(logWins: LogWin[]): number {
    const costFoom = logWins.reduce<bigint>((sum, win) => {
      return sum + BigInt(win.meta.feeGenerator || '0')
    }, 0n)

    /** @dev 1% = * 1n / 100n */
    // const costFoom = totalRewardGross / 100n

    return Number(formatEther(costFoom))
  }

  private calculateInvestedFoomFromLogWins(logWins: LogWin[]): number {
    const investedFoom = logWins.reduce<bigint>((sum, win) => {
      return sum + BigInt(win.meta.invested || '0')
    }, 0n)

    return Number(formatEther(investedFoom))
  }

  private calculateDepositFoomFromLogBetIns(logBetIns: LogBetIn[]): number {
    const depositFoom = logBetIns.reduce<bigint>((sum, bet) => {
      return sum + BigInt(bet.meta.amount || '0')
    }, 0n)

    return Number(formatEther(depositFoom))
  }

  private getTimeRangeUntilHour(hour: number = 18): {
    yesterdayAtHour: Date
    todayAtHour: Date
  } {
    const todayAtHour = new Date()
    todayAtHour.setUTCHours(hour, 0, 0, 0)

    const yesterdayAtHour = new Date(todayAtHour)
    yesterdayAtHour.setUTCDate(todayAtHour.getUTCDate() - 1)

    return { yesterdayAtHour, todayAtHour }
  }

  @OnEvent(LOTTERY_EVENTS.NEW_WIN)
  async handleNewWin(eventData: NewWinEventData) {
    try {
      const foomPriceQuery = await this.apiService.relayFoomPrice()
      const foomPrice = foomPriceQuery?.foomPrice || 0

      const rewardNetFoom = Number(formatEther(BigInt(eventData.reward)))
      const rewardGrossFoom = Number(formatEther(BigInt(eventData.rewardGross)))

      const rewardNetUsd = rewardNetFoom * foomPrice
      const rewardGrossUsd = rewardGrossFoom * foomPrice

      const message = this.constructWinMessage({
        recipient: eventData.recipient,
        rewardNetFoom,
        rewardGrossFoom,
        rewardNetUsd,
        rewardGrossUsd,
        txHash: eventData.txHash,
      })

      await this.sendTelegramMessage(message)
    } catch (error) {
      _warn('❌ Failed to handle new win event:', error)
    }
  }

  private constructWinMessage(params: {
    recipient: string
    rewardNetFoom: number
    rewardGrossFoom: number
    rewardNetUsd: number
    rewardGrossUsd: number
    txHash: string
  }): string {
    const { rewardGrossUsd, txHash } = params

    return [
      '🎉 CONGRATULATIONS! 🎉',
      'New WINNER of the FOOM.Cash Lottery!',
      '',
      `💰Prize: <b>$${formatNumber(rewardGrossUsd)}</b> in FOOM`,
      `TX: <a href="https://etherscan.io/tx/${txHash}"><b>${txHash}</b></a>`,
      '',
      '🌐 Visit <a href="https://foom.cash"><b>FOOM.Cash</b></a> – The Anonymous Lottery in crypto. Trustless. Fully decentralized.',
      '🚀 Join the next round and multiply your chances!',
    ].join('\n')
  }

  private async sendTelegramMessage(message: string): Promise<void> {
    const apiKey = process.env.FOOM_CASH_BOT_API_KEY
    if (!apiKey) {
      _warn(
        'FOOM_CASH_BOT_API_KEY is not defined! Cannot send Telegram message.',
      )
      return
    }

    const chatIds = this.getChatIds()
    if (chatIds.length === 0) {
      _warn('No chat IDs defined! Cannot send Telegram message.')
      return
    }

    try {
      await this.publishOnTelegramChats(apiKey, chatIds, message, true)
    } catch (error: any) {
      throw new Error(
        `Failed to send Telegram message: ${error?.response?.data?.description || error.message}`,
      )
    }
  }

  private getChatIds = () => {
    const chatIds = [
      process.env.FOOM_CASH_BOT_CHANNEL,
      !isDevelopment() ? process.env.FOOM_CASH_BOT_CHANNEL_2 : null,
    ].filter(Boolean) as string[]
    return chatIds
  }

  private async publishOnTelegramChats(
    apiKey: string,
    chatIds: string[],
    message: string,
    disableWebPagePreview?: boolean,
  ): Promise<void> {
    _log(`Sending message to ${chatIds.length} chat(s): ${chatIds.join(', ')}`)

    for (const [i, chatId] of chatIds.entries()) {
      try {
        await this.postToTelegramApi(
          apiKey,
          chatId,
          message,
          disableWebPagePreview,
        )
        _log(`✅ Successfully sent message to chat: ${chatId}`)

        /** @dev NOTE rate limiting: wait 1 second between API calls to avoid hitting Telegram limits
         * Telegram allows 30 messages per second per bot; conservative approach */
        if (i < chatIds.length - 1 /** @dev if past the first invocation */) {
          _log(
            '⏰ Waiting 1 second before sending to next chat (rate limiting)...',
          )
          await new Promise(resolve => setTimeout(resolve, 1_000))
        }
      } catch (error: any) {
        _warn(
          `❌ Failed to send message to chat ${chatId}:`,
          error?.response?.data?.description || error.message,
        )
      }
    }
  }

  private async postToTelegramApi(
    apiKey: string,
    chatId: string,
    message: string,
    disableWebPagePreview?: boolean,
  ): Promise<void> {
    _log('About to post Telegram Status:', message)

    const telegramApiUrl = `https://api.telegram.org/bot${apiKey}/sendMessage`

    const params = new URLSearchParams({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    })

    if (disableWebPagePreview) {
      params.append('disable_web_page_preview', 'true')
    }

    const response = await axios.post(telegramApiUrl, params)
  }
}
