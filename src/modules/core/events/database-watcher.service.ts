import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import type { Address, Hex } from 'viem'

import { LogWin } from 'src/schemas/log-win.schema'
import { LogBetIn } from 'src/schemas/log-bet-in.schema'
import { LogUpdate } from 'src/schemas/log-update.schema'
import { LogCancel } from 'src/schemas/log-cancel.schema'
import { _log, _warn, _error } from 'src/utils/ts'
import {
  LOTTERY_EVENTS,
  type NewWinEventData,
  type NewBetEventData,
  type NewUpdateEventData,
  type NewCancelEventData,
} from './lottery-events.interface'
import type { BSON } from 'mongodb'

@Injectable()
export class DatabaseWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseWatcherService.name)
  private changeStreams: any[] = []

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @InjectModel(LogWin.name)
    private readonly logWinModel: Model<LogWin>,
    @InjectModel(LogBetIn.name)
    private readonly logBetInModel: Model<LogBetIn>,
    @InjectModel(LogUpdate.name)
    private readonly logUpdateModel: Model<LogUpdate>,
    @InjectModel(LogCancel.name)
    private readonly logCancelModel: Model<LogCancel>,
  ) {}

  async onModuleInit() {
    try {
      await this.setupDatabaseWatchers()
      this.logger.log('Database watchers initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize database watchers:', error)
    }
  }

  /** @dev closes all change streams */
  async onModuleDestroy() {
    for (const stream of this.changeStreams) {
      try {
        await stream.close()
      } catch (error) {
        this.logger.warn('Error closing change stream:', error)
      }
    }
    this.changeStreams = []
    this.logger.log('Database watchers destroyed')
  }

  private isDocumentRecent(document: BSON.Document): boolean {
    const createdAt = new Date(document.createdAt || Date.now())
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    const isRecent = createdAt >= fiveMinutesAgo
    !isRecent &&
      this.logger.debug(`Skipping event update emit for ${document._id}`)

    return isRecent
  }

  private async setupDatabaseWatchers() {
    /** @dev emitted by all collect()s */
    const logWinStream = this.logWinModel.collection.watch(
      [{ $match: { operationType: 'insert' } }],
      { fullDocument: 'updateLookup' },
    )

    logWinStream.on('change', change => {
      try {
        if (change.operationType === 'insert' && change.fullDocument) {
          if (!this.isDocumentRecent(change.fullDocument)) {
            return
          }

          this.handleNewWin(change.fullDocument)
        }
      } catch (error) {
        this.logger.error('Error handling LogWin change:', error)
      }
    })

    logWinStream.on('error', error => {
      this.logger.error('LogWin change stream error:', error)
    })

    this.changeStreams.push(logWinStream)

    const logBetInStream = this.logBetInModel.collection.watch(
      [{ $match: { operationType: 'insert' } }],
      { fullDocument: 'updateLookup' },
    )

    logBetInStream.on('change', change => {
      try {
        if (change.operationType === 'insert' && change.fullDocument) {
          if (!this.isDocumentRecent(change.fullDocument)) {
            return
          }

          this.handleNewBet(change.fullDocument)
        }
      } catch (error) {
        this.logger.error('Error handling LogBetIn change:', error)
      }
    })

    logBetInStream.on('error', error => {
      this.logger.error('LogBetIn change stream error:', error)
    })

    this.changeStreams.push(logBetInStream)

    const logUpdateStream = this.logUpdateModel.collection.watch(
      [{ $match: { operationType: 'insert' } }],
      { fullDocument: 'updateLookup' },
    )

    logUpdateStream.on('change', change => {
      try {
        if (change.operationType === 'insert' && change.fullDocument) {
          if (!this.isDocumentRecent(change.fullDocument)) {
            return
          }

          this.handleNewUpdate(change.fullDocument)
        }
      } catch (error) {
        this.logger.error('Error handling LogUpdate change:', error)
      }
    })

    logUpdateStream.on('error', error => {
      this.logger.error('LogUpdate change stream error:', error)
    })

    this.changeStreams.push(logUpdateStream)

    const logCancelStream = this.logCancelModel.collection.watch(
      [{ $match: { operationType: 'insert' } }],
      { fullDocument: 'updateLookup' },
    )

    logCancelStream.on('change', change => {
      try {
        if (change.operationType === 'insert' && change.fullDocument) {
          if (!this.isDocumentRecent(change.fullDocument)) {
            return
          }

          this.handleNewCancel(change.fullDocument)
        }
      } catch (error) {
        this.logger.error('Error handling LogCancel change:', error)
      }
    })

    logCancelStream.on('error', error => {
      this.logger.error('LogCancel change stream error:', error)
    })

    this.changeStreams.push(logCancelStream)

    _log('Database change streams initialized')
  }

  private handleNewWin(document: any) {
    try {
      const eventData: NewWinEventData = {
        txHash: document.txHash as Hex,
        blockNumber: document.blockNumber,
        recipient: document.data.recipient as Address,
        reward: document.data.reward,
        nullifierHash: document.data.nullifierHash,
        rewardGross: document.meta.rewardGross,
        invested: document.meta.invested,
        refund: document.meta.refund,
        feeGenerator: document.meta.feeGenerator,
        feeInvestors: document.meta.feeInvestors,
        feeRelayer: document.meta.feeRelayer,
        timestamp: new Date(document.createdAt || Date.now()),
      }

      this.eventEmitter.emit(LOTTERY_EVENTS.NEW_WIN, eventData)
    } catch (error) {
      _error('Error processing new win event:', error)
    }
  }

  private handleNewBet(document: any) {
    try {
      const eventData: NewBetEventData = {
        txHash: document.txHash as Hex,
        blockNumber: document.blockNumber,
        index: document.data?.index || '0',
        user: document.meta?.user as Address,
        amount: document.meta?.amount || '0',
        bettor: document.meta?.user as Address,
        timestamp: new Date(document.createdAt || Date.now()),
      }

      this.eventEmitter.emit(LOTTERY_EVENTS.NEW_BET, eventData)
    } catch (error) {
      _error('Error processing new bet event:', error)
    }
  }

  private handleNewUpdate(document: any) {
    try {
      const eventData: NewUpdateEventData = {
        txHash: document.txHash as Hex,
        blockNumber: document.blockNumber,
        index: document.data?.index || '0',
        timestamp: new Date(document.createdAt || Date.now()),
      }

      this.eventEmitter.emit(LOTTERY_EVENTS.NEW_UPDATE, eventData)
    } catch (error) {
      _error('Error processing new update event:', error)
    }
  }

  private handleNewCancel(document: any) {
    try {
      const eventData: NewCancelEventData = {
        txHash: document.txHash as Hex,
        blockNumber: document.blockNumber,
        index: document.data?.index || '0',
        timestamp: new Date(document.createdAt || Date.now()),
      }

      this.eventEmitter.emit(LOTTERY_EVENTS.NEW_CANCEL, eventData)
    } catch (error) {
      _error('Error processing new cancel event:', error)
    }
  }
}
