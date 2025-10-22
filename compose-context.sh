#!/bin/zsh

IS_STAGING=${IS_STAGING:-false}
IS_ETH=${IS_ETH:-false}
AUTH_HEADER=${AUTH_HEADER:-""}

if [ "$IS_STAGING" = "true" ]; then
  export HOST_PORT=1540
  export CONTAINER_NAME="foom-lottery-indexer-staging"
  export COMPOSE_PROJECT_NAME="foom_lottery_indexer_staging"
  export WWW_VOLUME=www
elif [ "$IS_ETH" = "true" ]; then
  export HOST_PORT=1041
  export CONTAINER_NAME="foom-lottery-indexer-eth"
  export COMPOSE_PROJECT_NAME="foom_lottery_indexer_eth"
  export WWW_VOLUME=www-eth
else
  export HOST_PORT=1040
  export CONTAINER_NAME="foom-lottery-indexer"
  export COMPOSE_PROJECT_NAME="foom_lottery_indexer"
  export WWW_VOLUME=www
fi
