import { ServerApiVersion } from 'mongodb'
import mongoose from 'mongoose'

const tryParseMongoId = (id: string) => {
  try {
    mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null
  } catch {
    return null
  }
}

const isPemAuth = (token: string | undefined) => token?.includes('MONGODB-X509')

const getDbAuth = (database?: string | undefined) => {
  return isPemAuth(database)
    ? {
        tlsCertificateKeyFile: process.env.DATABASE_AUTH_URI,
        serverApi: ServerApiVersion.v1,
      }
    : undefined
}

export { getDbAuth, isPemAuth, tryParseMongoId }
