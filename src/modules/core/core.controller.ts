import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiResponse } from '@nestjs/swagger'

import { _log } from 'src/utils/ts'
import { CoreService } from './core.service'

@Controller()
export class CoreController {
  constructor(private readonly coreService: CoreService) {}

  @Get()
  @ApiOperation({ summary: 'Get server status' })
  @ApiResponse({
    status: 200,
    description: 'Server info', 
  })
  getStatus(): object {
    return this.coreService.getStatus()
  }
}
