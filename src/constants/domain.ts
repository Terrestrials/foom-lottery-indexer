import { isStaging } from 'src/utils/environment'

const PRIMARY_DOMAIN = isStaging()
  ? 'https://foom-lottery-indexer-staging.degen.pl'
  : 'https://foom-lottery-indexer.degen.pl'

export { PRIMARY_DOMAIN }
