export const LogBetInRawEventMock = {
  eventName: 'LogBetIn',
  args: {
    index: 0n,
    newHash:
      5830730410484677323135938457349698867014480012952733190564065746678058771744n,
  },
  address: '0x610178da211fef7d417bc0e6fed39f05609ad788',
  topics: [
    '0x67024112d4ff1b7b177f96a8d0a53bb255e6f8eb3e7b1c9e9400d7f0de991a56',
    '0x0000000000000000000000000000000000000000000000000000000000000000',
    '0x0ce413930404e34f411b5117deff2a1a062c27b1dba271e133a9ffe91eeae520',
  ],
  data: '0x',
  blockHash:
    '0xbecccdcb15a080ddc7bc1dff300b19c25400932671519152524958dbd44c40ec',
  blockNumber: 8n,
  blockTimestamp: '0x6834287c',
  transactionHash:
    '0x1d3ace5971efb11b250abe35cc53e71e21b19264ab92b9c28ed7a7b639505420',
  transactionIndex: 0,
  logIndex: 0,
  removed: false,
}

/**
 * (LogUpdate, LogBetIn, LogCancel)
 */
const eventsCurl = `➜  ~ curl -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_getLogs",
    "params": [
      {
        "address": "0xdb203504ba1fea79164AF3CeFFBA88C59Ee8aAfD",
        "topics": [
          ["0x67024112d4ff1b7b177f96a8d0a53bb255e6f8eb3e7b1c9e9400d7f0de991a56", "0x66cf275a29b4a265a7935f0bd46ad204e66eb78f7393eec37cdb9e70f4e32fd8", "0x841b99624b405c6696e2048734f0ae288117f34a1d1219e144ca39687715ab0c"]
        ],
        "fromBlock": "0x1d97a32",
        "toBlock": "0x1d97a33"
      }
    ],
    "id": 1
  }'
{"jsonrpc":"2.0","result":[{"address":"0xdb203504ba1fea79164af3ceffba88c59ee8aafd","blockHash":"0xc0c7d699567da96798a1f8852bfa72501e9d48d73c49abcb6845e45beb4a1f89","blockNumber":"0x1d97a32","data":"0x","logIndex":"0x0","removed":false,"topics":["0x841b99624b405c6696e2048734f0ae288117f34a1d1219e144ca39687715ab0c","0x0000000000000000000000000000000000000000000000000000000000000004","0x000000000000000000000000000000002b2dfce702c6c40000b6425d10a605e8","0x16cc23194664ca94d4750a0cf52e0187e99e66cd9cea35734daaeccebafcae7f"],"transactionHash":"0xe8a116e20637c5e3a4e24234721750d42ca0c0f7004bead761ea121f9015e564","transactionIndex":"0x1"}],"id":1}
➜  ~ curl -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_getLogs",
    "params": [
      {
        "address": "0xdb203504ba1fea79164AF3CeFFBA88C59Ee8aAfD",
        "topics": [
          ["0x67024112d4ff1b7b177f96a8d0a53bb255e6f8eb3e7b1c9e9400d7f0de991a56", "0x66cf275a29b4a265a7935f0bd46ad204e66eb78f7393eec37cdb9e70f4e32fd8", "0x841b99624b405c6696e2048734f0ae288117f34a1d1219e144ca39687715ab0c"]
        ],
        "fromBlock": "0x1d77e79",
        "toBlock": "0x1d77e7a"
      }
    ],
    "id": 1
  }'
{"jsonrpc":"2.0","result":[{"address":"0xdb203504ba1fea79164af3ceffba88c59ee8aafd","blockHash":"0x08638f34b8cb322b5357f2a117fb2dd4006eba056f788b79e60fc04acc42a150","blockNumber":"0x1d77e79","data":"0x","logIndex":"0x3f","removed":false,"topics":["0x67024112d4ff1b7b177f96a8d0a53bb255e6f8eb3e7b1c9e9400d7f0de991a56","0x0000000000000000000000000000000000000000000000000000000000000001","0x28d1c7f2eb457da5464f8da7411e6b0550d03b66b8a7ce668ae53b1e191dff81"],"transactionHash":"0x886a8ebaa0b283fe5d16b4e4b7b8640ec5d470e710a4f8ead3dd19459658f661","transactionIndex":"0x15"}],"id":1}
➜  ~ curl -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_getLogs",
    "params": [
      {
        "address": "0xdb203504ba1fea79164AF3CeFFBA88C59Ee8aAfD",
        "topics": [
          ["0x67024112d4ff1b7b177f96a8d0a53bb255e6f8eb3e7b1c9e9400d7f0de991a56", "0x66cf275a29b4a265a7935f0bd46ad204e66eb78f7393eec37cdb9e70f4e32fd8", "0x841b99624b405c6696e2048734f0ae288117f34a1d1219e144ca39687715ab0c"]
        ],
        "fromBlock": "0x1db0691",
        "toBlock": "0x1db0692"
      }
    ],
    "id": 1
  }'
{"jsonrpc":"2.0","result":[{"address":"0xdb203504ba1fea79164af3ceffba88c59ee8aafd","blockHash":"0xe118eed375c0da34e38ac7a38833ddd8f61935449225432c19f27c94ba7f379d","blockNumber":"0x1db0691","data":"0x","logIndex":"0x1","removed":false,"topics":["0x66cf275a29b4a265a7935f0bd46ad204e66eb78f7393eec37cdb9e70f4e32fd8","0x0000000000000000000000000000000000000000000000000000000000000009"],"transactionHash":"0xec4e5e203d1744c6db6dddc99ceae7a04a6cd69bae52d843f5af168b60d0ca02","transactionIndex":"0x1"}],"id":1}`
