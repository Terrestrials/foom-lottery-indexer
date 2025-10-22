import { Module } from '@nestjs/common'

import { SignatureService } from 'src/modules/signature/signature.service'

@Module({
  providers: [SignatureService],
})
export class SignatureModule {}
