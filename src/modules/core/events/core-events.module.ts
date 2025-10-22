import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { MongooseModule } from '@nestjs/mongoose'
import { DatabaseWatcherService } from './database-watcher.service'
import { LogWin, LogWinSchema } from 'src/schemas/log-win.schema'
import { LogBetIn, LogBetInSchema } from 'src/schemas/log-bet-in.schema'
import { LogUpdate, LogUpdateSchema } from 'src/schemas/log-update.schema'
import { LogCancel, LogCancelSchema } from 'src/schemas/log-cancel.schema'

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      maxListeners: 10,
      delimiter: '.',
    }),
    MongooseModule.forFeature([
      { name: LogWin.name, schema: LogWinSchema },
      { name: LogBetIn.name, schema: LogBetInSchema },
      { name: LogUpdate.name, schema: LogUpdateSchema },
      { name: LogCancel.name, schema: LogCancelSchema },
    ]),
  ],
  providers: [DatabaseWatcherService],
  exports: [DatabaseWatcherService],
})
export class CoreEventsModule {}
