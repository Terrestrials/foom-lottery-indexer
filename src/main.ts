import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'
import { json, urlencoded } from 'express'
import session from 'express-session'
import MongoStore from 'connect-mongo'

import { RedirectMiddleware } from 'src/middlewares/redirect.middleware'
import { isEth, isLocal } from 'src/utils/environment'
import { _log } from 'src/utils/ts'
import { CoreModule } from './modules/core/core.module'

import 'src/utils/node'
import { generateUUID } from 'src/utils/uuid'
import { getDbAuth } from 'src/utils/mongo'

async function bootstrap() {
  const app = await NestFactory.create(CoreModule, { rawBody: true })

  app.setGlobalPrefix(isEth() ? '/v1-eth' : '/v1')
  app.use(new RedirectMiddleware().use)
  app.useGlobalPipes(new ValidationPipe())
  app.enableCors({
    origin: true,
    credentials: true,
  })

  const limit = '50mb'
  app.use(json({ limit }))
  app.use(urlencoded({ limit, extended: true }))

  app.use(cookieParser())
  app.use(
    session({
      secret: process.env.SESSION_SECRET || generateUUID(),
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: process.env.DATABASE_URI,
        mongoOptions: getDbAuth(process.env.DATABASE_URI),
        collectionName: 'sessions',
      }),
      /** @dev HTTPS for remote (e.g. production), http for local (development) */
      cookie: { secure: isLocal() ? false : true },
    }),
  )

  await app.listen(process.env.PORT ?? 80)
}

bootstrap()
