import { Injectable, NestMiddleware } from '@nestjs/common'
import { NextFunction, Request, Response } from 'express'
import { isEth } from 'src/utils/environment'

@Injectable()
export class RedirectMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.url === '/') {
      res.redirect(isEth() ? '/v1-eth' : '/v1' + req.url)
    } else {
      next()
    }
  }
}
