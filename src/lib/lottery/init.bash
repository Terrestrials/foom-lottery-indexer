#!/bin/bash

# setup www repository for merkleTree leafs
mkdir -p www/
rm -rf www/00 www/index.csv www/last.csv www/waiting.csv
mkdir -p www/00/00/
# betIndex,betHash
cp /dev/null www/waiting.csv
# betIndex,leafHash
cp /dev/null www/index.csv
cp /dev/null www/00/index.csv
cp /dev/null www/00/00/index.csv
# nextIndex,blockNumber,lastRoot,lastLeaf
echo '1,0,25439a05239667bccd12fc3bd280a29a02728ed44410446cbd51a27cda333b00,24d599883f039a5cb553f9ec0e5998d58d8816e823bd556164f72aef0ef7d9c0' > www/last.csv
# betIndex,leafHash,betHash,betRand
echo '0,24d599883f039a5cb553f9ec0e5998d58d8816e823bd556164f72aef0ef7d9c0,ce413930404e34f411b5117deff2a1a062c27b1dba271e133a9ffe91eeae520,0' > www/00/00/00.csv
