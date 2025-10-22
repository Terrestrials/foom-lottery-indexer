import { Model } from 'mongoose'
import sprintfjs from 'sprintf-js'
import { _log } from 'src/utils/ts'
import { formatEther, formatUnits } from 'viem'
import { base } from 'viem/chains'

import LOTTERY_ABI from 'src/lib/contracts/abis/FoomLotteryAbi'
import { FOOM, LOTTERY } from 'src/lib/contracts/addresses'
import { getBlockNumberAtTimestamp } from 'src/lib/lottery/utils/blockNumber'
import { chain } from 'src/modules/core/constants'
import type { LotteryService } from 'src/modules/lottery/lottery.service'
import { Meta } from 'src/schemas/meta.schema'
import redis from 'src/utils/redis'
import { getLines, readLast } from './utils/mimcMerkleTree'
import { sleep } from 'src/utils/node'

/**
 * Fetches period data from the FoomLottery contract
 */
async function fetchContractPeriod(
  client: any /** @dev ReturnType<typeof getPublicClient> */,
  chainId: number,
  periodNumber: number,
): Promise<{ bets: string; shares: string } | null> {
  try {
    const result = await client.readContract({
      address: LOTTERY[chainId],
      abi: LOTTERY_ABI,
      functionName: 'periods',
      args: [BigInt(periodNumber)],
    })

    return {
      bets: result[0].toString(),
      shares: result[1].toString(),
    }
  } catch (error) {
    _log(`Error fetching period ${periodNumber} from contract:`, error)
    return null
  }
}

/**
 * Syncs missing periods from the contract to DB
 */
async function syncMissingPeriods(
  blockchainClient: any /** @dev ReturnType<typeof getPublicClient> */,
  metaModel: Model<Meta>,
  chainId: number,
  maxPeriodFromCsv: number,
): Promise<void> {
  /** @dev Redis sync lock to prevent syncing multiple times at once and overwhelming the RPC (eg attack) */
  const lockKey = `periods-sync-lock:${chainId}`

  try {
    const lockAcquired = await redis.set(lockKey, 'locked', 'PX', 300000, 'NX')
    if (!lockAcquired) {
      _log('Periods sync already running in another instance, skipping...')
      return
    }

    let meta = await metaModel.findOne()
    if (!meta) {
      meta = new metaModel({
        lastSyncedBlock: {},
        periods: new Map(),
      })
    }

    if (!meta.periods) {
      meta.periods = new Map()
    }

    const existingPeriods = Array.from(meta.periods.keys()).map(Number)
    const maxExistingPeriod =
      existingPeriods.length > 0 ? Math.max(...existingPeriods) : 0

    const startPeriod = 1
    const endPeriod = maxPeriodFromCsv

    _log(`Syncing periods from ${startPeriod} to ${endPeriod}...`)

    const missingPeriods = []
    for (let i = startPeriod; i <= endPeriod; i++) {
      if (!meta.periods.has(i.toString())) {
        missingPeriods.push(i)
      }
    }

    if (missingPeriods.length > 0) {
      _log(`Found ${missingPeriods.length} missing periods:`, missingPeriods)

      const batchSize = 1
      for (let i = 0; i < missingPeriods.length; i += batchSize) {
        const batch = missingPeriods.slice(i, i + batchSize)

        const promises = batch.map(periodNum =>
          fetchContractPeriod(blockchainClient, chainId, periodNum),
        )

        const results = await Promise.all(promises)

        results.forEach((periodData, index) => {
          if (periodData) {
            const periodNum = batch[index]
            meta.periods.set(periodNum.toString(), periodData)
            _log(
              `Stored period ${periodNum}: bets=${periodData.bets}, shares=${periodData.shares}`,
            )
          }
        })

        await meta.save()

        await sleep(1500) /** @dev 1.5 seconds RPC call buffer */
      }

      _log(`Successfully synced ${missingPeriods.length} periods to database`)
    } else {
      _log('All periods up to date in database')
    }

    /** @dev release the lock on full sync completion only. */
    try {
      await redis.del(lockKey)
    } catch (lockError) {
      _log('Error releasing Redis lock:', lockError)
    }
  } catch (error) {
    _log('Error syncing missing periods:', error)
  }
}

export async function fetchRewardStats(
  lotteryService: LotteryService,
  metaModel: Model<Meta>,
  blockchainClient?: any /** @dev ReturnType<typeof getPublicClient> */,
  chainId: number = chain.id,
) {
  const redisKey = `lastQueriedPeriod:${chainId}`

  if (!FOOM[chainId]) {
    throw new Error('Invalid chain')
  }

  /** @dev get latest period number from CSV */
  const lines = getLines('www/period.csv')
  const [lastCompletePeriodStr] = lines[lines.length - 1].split(',')
  const lastCompletePeriodIndex = parseInt(lastCompletePeriodStr)

  await syncMissingPeriods(
    blockchainClient,
    metaModel,
    chainId,
    lastCompletePeriodIndex,
  )

  const meta = await metaModel.findOne()
  if (!meta || !meta.periods) {
    throw new Error('Failed to load periods data from database')
  }

  /** @dev retrieve main FoomLottery.sol state cache */
  let validCache: unknown = null
  const lastPeriodCached = await redis.get(redisKey)
  if (lastPeriodCached === lastCompletePeriodStr) {
    const cache = await redis.get(`${redisKey}:stats:D`)
    validCache = cache ? JSON.parse(cache) : null
  }

  const foomBalance = await lotteryService.getFoomBalance(chainId)
  const foomBalanceM = Number(formatEther(foomBalance)) / 1_000_000

  const [nextIndex] = readLast()
  const stats = {
    foomBalanceM,
    totalTickets: nextIndex,
    periods: [] as any[],
    periodInfo: null as any,
  }

  const blocksPerMinute = 60 / (chainId === base.id ? 2 : 12)

  const allPeriods = Array.from(meta.periods.entries())
    .map(([periodStr, periodData]) => ({
      period: parseInt(periodStr),
      bets: periodData.bets,
      shares: periodData.shares,
    }))
    .filter(periodData => periodData.period > 0)
    .sort((a, b) => Number(a.period) - Number(b.period))

  /** @dev Push one last period – the yet unfinished one – always fetched from the contract,
   * but with a buffer to limit the updates per minute – this will have a limit of "one per hour". */
  const lastPeriod = lastCompletePeriodIndex ? lastCompletePeriodIndex + 1 : 1
  const currentPeriodCacheKey = `current-period:${chainId}:${lastPeriod}`

  let periodData = null
  const cachedCurrentPeriod = await redis.get(currentPeriodCacheKey)

  if (cachedCurrentPeriod) {
    periodData = JSON.parse(cachedCurrentPeriod)
    _log(`Using cached data for current period ${lastPeriod}`)
  } else {
    const _periodData = await fetchContractPeriod(
      blockchainClient,
      chainId,
      lastPeriod,
    )
    if (_periodData) {
      periodData = _periodData

      await redis.setex(
        currentPeriodCacheKey,
        3600,
        JSON.stringify(_periodData),
      )
      _log(
        `Fetched and cached current (unfinished, yet to change) period (no. ${lastPeriod}) from contract.`,
      )
    }
  }

  const currentBlock = getBlockNumberAtTimestamp(chainId)

  const D =
    validCache ??
    (await blockchainClient.readContract({
      address: LOTTERY[chainId],
      abi: LOTTERY_ABI,
      functionName: 'D',
      args: [],
    }))

  const periodStartBlock = Number(D[0])
  const periodEndBlock = periodStartBlock + 16384

  const blocksLeft = periodEndBlock - Number(currentBlock)

  const minutesLeft = blocksLeft / blocksPerMinute
  const hours = Math.floor(minutesLeft / 60)
  const minutes = Math.floor(minutesLeft % 60)

  stats.periodInfo = {
    blocksLeft,
    hours,
    minutes,
  }

  /** @dev debug info */
  stats['_'] = {
    currentBlock,
    periodStartBlock,
    periodEndBlock,
    currentPeriod: lastCompletePeriodIndex + 1,
  }

  /** @dev set cache variables */
  await redis.set(redisKey, lastCompletePeriodIndex.toString())
  await redis.set(`${redisKey}:stats:D`, JSON.stringify(D))

  /** @dev fill in the bets amount to 100% to estimate final APY/APR values, as the period is unfinished for the last period yet */
  const backfillPercentage = ((periodEndBlock - currentBlock) / 16384) * 100
  const backfillPercentageBigint = BigInt(Math.floor(backfillPercentage))
  const backfilledBets =
    (BigInt(periodData.bets) * 100n) / (100n - backfillPercentageBigint)
  _log('have backfilledBets', backfilledBets, 'from', periodData.bets)

  if (periodData) {
    allPeriods.push({
      period: lastPeriod,
      bets: `${backfilledBets}`,
      shares: periodData.shares,
    })
  }

  for (const periodData of allPeriods) {
    const bets = Math.floor(
      Number(formatUnits(BigInt(periodData.bets), 18)) / 1_000_000,
    )
    const shares = Math.floor(
      Number(formatUnits(BigInt(periodData.shares), 18)) / 1_000_000,
    )
    let apy: number | null = null
    let apr: number | null = null
    if (bets < shares) {
      apy =
        (1.0 + 0.04 * (bets / shares)) **
          ((blocksPerMinute * 60 * 24 * 365) / 16384) -
        1
      apr = 0.04 * (bets / shares) * ((blocksPerMinute * 60 * 24 * 365) / 16384)
    }
    stats.periods.push({
      period: periodData.period.toString(),
      bets,
      shares,
      apy: apy !== null ? Number(sprintfjs.sprintf('%.2f', apy * 100)) : null,
      apr: apr !== null ? Number(sprintfjs.sprintf('%.2f', apr * 100)) : null,
    })
  }

  return stats
}
