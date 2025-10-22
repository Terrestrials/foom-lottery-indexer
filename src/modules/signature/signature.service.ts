import { BadRequestException, Injectable } from '@nestjs/common'
import { keccak256, toBytes } from 'viem'

import { _log } from 'src/utils/ts'

/** TODO: Use this when on prod, instead of the blockchain module */
@Injectable()
export class SignatureService {
  verifySignature(request: Request, secret: string): void {
    const providedSignature = request.headers['x-signature']

    if (typeof providedSignature !== 'string') {
      throw new BadRequestException('Signature not provided')
    }

    const bodyString = JSON.stringify(request.body)
    const messageBytes = toBytes(bodyString + secret)
    const generatedSignature = keccak256(messageBytes)

    if (generatedSignature !== providedSignature) {
      throw new BadRequestException('Invalid Signature')
    }
  }
}
