import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Model } from 'mongoose'
import { updateGenesisBlocks } from 'src/lib/lottery/utils/blockNumber'
import { Meta } from 'src/schemas/meta.schema'
import { _warn } from 'src/utils/ts'
import { createPublicClient, http } from 'viem'
import { base, mainnet } from 'viem/chains'

@Injectable()
export class GenesisBlocksService implements OnModuleInit {
  private readonly logger = new Logger(GenesisBlocksService.name)

  constructor(
    @InjectModel(Meta.name)
    private readonly metaModel: Model<Meta>,
  ) {}

  async onModuleInit() {
    await this.initializeGenesisBlocks()
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateGenesisBlocks() {
    this.logger.log('Starting daily genesis blocks update...')

    try {
      await this.updateGenesisBlocksWithRetry()
      this.logger.log('Genesis blocks updated successfully')
    } catch (error) {
      this.logger.error('Failed to update genesis blocks:', error)
    }
  }

  private async updateGenesisBlocksWithRetry(
    maxRetries = 10,
    baseDelay = 5000,
  ) {
    let attempt = 1

    while (attempt <= maxRetries) {
      try {
        return await this.fetchAndUpdateGenesisBlocks()
      } catch (error) {
        _warn(
          `Attempt ${attempt}/${maxRetries} failed:`,
          error.message,
        )

        if (attempt === maxRetries) {
          throw new Error(
            `Failed to update genesis blocks after ${maxRetries} attempts`,
          )
        }

        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 300000)
        const jitter = Math.random() * 1000

        this.logger.log(`Retrying in ${Math.round(delay + jitter)}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay + jitter))
        attempt++
      }
    }
  }

  private async fetchAndUpdateGenesisBlocks() {
    const baseClient = createPublicClient({
      chain: base,
      transport: http(base.rpcUrls.default.http[0]),
    })

    const mainnetClient = createPublicClient({
      chain: mainnet,
      transport: http(mainnet.rpcUrls.default.http[0]),
    })

    const [baseBlock, mainnetBlock] = await Promise.all([
      baseClient.getBlock({ blockTag: 'latest' }),
      mainnetClient.getBlock({ blockTag: 'latest' }),
    ])

    const updatedMeta = await this.metaModel.findOneAndUpdate(
      {},
      {
        $set: {
          'genesisBlocks.base': {
            number: baseBlock.number.toString(),
            timestamp: baseBlock.timestamp.toString(),
            blockTime: 2,
          },
          'genesisBlocks.mainnet': {
            number: mainnetBlock.number.toString(),
            timestamp: mainnetBlock.timestamp.toString(),
            blockTime: 12,
          },
        },
      },
      { upsert: true, new: true },
    )

    if (updatedMeta?.genesisBlocks) {
      updateGenesisBlocks(updatedMeta.toObject().genesisBlocks)
    }

    this.logger.log(
      `Updated genesis blocks - Base: ${baseBlock.number}, Mainnet: ${mainnetBlock.number}`,
    )
  }

  async getGenesisBlocks() {
    const meta = await this.metaModel.findOne()

    return meta?.genesisBlocks || null
  }

  async initializeGenesisBlocks() {
    const meta = await this.metaModel.findOne()

    await this.updateGenesisBlocksWithRetry()
  }
}
