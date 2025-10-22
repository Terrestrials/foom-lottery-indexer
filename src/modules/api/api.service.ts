import { Injectable } from '@nestjs/common'
import foomApi from 'src/lib/foomApi'

@Injectable()
export class ApiService {
  async relayFoomPrice() {
    const query = await foomApi.get<{ foomPrice: number }>('/stats/price')

    return query?.data
  }
}
