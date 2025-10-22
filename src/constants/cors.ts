import { PRIMARY_DOMAIN } from 'src/constants/domain'
import { isDevelopment } from 'src/utils/environment'

export const ALLOWED_HOSTS: string[] = [
  ...(isDevelopment()
    ? [
        'http://localhost:3000',
        'http://192.168.236.248:3000',
        'http://10.0.2.2:3000',
        'http://0.0.0.0:3000',
      ]
    : ['https://foom.cash', 'https://foom-lottery.hashup.it']),
  PRIMARY_DOMAIN,
]
