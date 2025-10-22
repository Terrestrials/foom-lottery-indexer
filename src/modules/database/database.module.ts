import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { LogBetIn, LogBetInSchema } from 'src/schemas/log-bet-in.schema'
import { LogCancel, LogCancelSchema } from 'src/schemas/log-cancel.schema'
import { LogPrayer, LogPrayerSchema } from 'src/schemas/log-prayer.schema'
import { LogUpdate, LogUpdateSchema } from 'src/schemas/log-update.schema'
import { LogWin, LogWinSchema } from 'src/schemas/log-win.schema'
import { Meta, MetaSchema } from 'src/schemas/meta.schema'
import { Mint, MintSchema } from 'src/schemas/mint.schema'
import {
  UserAddressConnection,
  UserAddressConnectionSchema,
} from 'src/schemas/userConnection.schema'
import {
  AirdropBalance,
  AirdropBalanceSchema,
} from 'src/schemas/airdrop-balance.schema'
import { getDbAuth } from 'src/utils/mongo'

const dbStringToSecondary = (dbString: string): string => {
  const currentDb = process.env.DATABASE_URI

  /** @dev is on EVM Ethereum node */
  if (currentDb?.includes('foom-lottery-indexer-eth')) {
    return dbString?.replace('foom-lottery-indexer-eth', 'foom-lottery-indexer')
  }
  /** @dev is on EVM Base node */
  return dbString?.replace('foom-lottery-indexer', 'foom-lottery-indexer-eth')
}
const secondaryDbString = dbStringToSecondary(process.env.DATABASE_URI)

@Module({
  imports: [
    /** @dev uses .pem file paired with default auth as fallback */
    MongooseModule.forRoot(
      process.env.DATABASE_URI,
      getDbAuth(process.env.DATABASE_URI),
    ),
    /** @dev secondary DB connection init */
    MongooseModule.forRoot(secondaryDbString, {
      ...getDbAuth(secondaryDbString),
      connectionName: 'secondary',
    }),
    MongooseModule.forFeature([
      {
        name: LogUpdate.name,
        schema: LogUpdateSchema,
      },
      {
        name: LogBetIn.name,
        schema: LogBetInSchema,
      },
      {
        name: LogCancel.name,
        schema: LogCancelSchema,
      },
      {
        name: LogPrayer.name,
        schema: LogPrayerSchema,
      },
      {
        name: LogWin.name,
        schema: LogWinSchema,
      },
      {
        name: Meta.name,
        schema: MetaSchema,
      },
      {
        name: UserAddressConnection.name,
        schema: UserAddressConnectionSchema,
      },
      {
        name: Mint.name,
        schema: MintSchema,
      },
      {
        name: AirdropBalance.name,
        schema: AirdropBalanceSchema,
      },
    ]),
    /** @dev secondary DB collections */
    MongooseModule.forFeature(
      [
        {
          name: AirdropBalance.name,
          schema: AirdropBalanceSchema,
        },
      ],
      'secondary',
    ),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
