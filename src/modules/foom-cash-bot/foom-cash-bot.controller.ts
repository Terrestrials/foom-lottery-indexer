import { Controller, Get, Post, UseGuards } from '@nestjs/common'
import { FoomCashBotService } from './foom-cash-bot.service'
import { AuthGuard } from 'src/modules/blockchain/auth.guard'

@Controller('foom-cash-bot')
export class FoomCashBotController {
  constructor(private readonly foomCashBotService: FoomCashBotService) {}

  @Get('stats')
  stats() {
    return this.foomCashBotService.getStats()
  }

  @Post('trigger-tg-status')
  @UseGuards(AuthGuard)
  async triggerTgStatus() {
    return this.foomCashBotService.postStats()
  }
}
