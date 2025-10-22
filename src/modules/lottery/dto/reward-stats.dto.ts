import { ApiProperty } from '@nestjs/swagger'

export class PeriodStatsDto {
  @ApiProperty()
  period: string

  @ApiProperty()
  bets: number

  @ApiProperty()
  shares: number

  @ApiProperty({ type: Number, nullable: true })
  apy: number | null
}

export class RewardStatsDto {
  @ApiProperty()
  foomBalanceM: number

  @ApiProperty()
  totalTickets: number

  @ApiProperty({ type: [PeriodStatsDto] })
  periods: PeriodStatsDto[]
}
