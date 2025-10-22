export const MoralisTransferEventStreamMock = {
  confirmed: true,
  chainId: '0x2105',
  abi: [
    {
      name: 'Transfer',
      type: 'event',
      anonymous: false,
      inputs: [
        {
          type: 'address',
          name: 'from',
          indexed: true,
        },
        {
          type: 'address',
          name: 'to',
          indexed: true,
        },
        {
          type: 'uint256',
          name: 'value',
          indexed: false,
        },
      ],
    },
  ],
  streamId: 'test',
  tag: 'foom-airdrop-mint-base',
  retries: 0,
  block: {
    number: '33453005',
    hash: '0x8845234c5ac39f260d263e34612eea5bb26cbe027c4b4e995ef2abe64f6faba2',
    timestamp: '1753695357',
  },
  logs: [
    {
      logIndex: '65',
      transactionHash:
        '0x503ae549ee9fb0042d7f989e7628e0bf306da5db38cece987390c642def1cca2',
      address: '0x5fcc57700974dc4f1017b34696e6b3db99434d65',
      data: '0x0000000000000000000000000000000000000000000000056bc75e2d63100000',
      topic0:
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      topic1:
        '0x000000000000000000000000c85e9d6ea262443057621141ff9c2a147c69ec38',
      topic2:
        '0x00000000000000000000000098668bc5bbfacfc20e7673abc3aed007117455b6',
      topic3: null,
      triggered_by: ['0x5fcc57700974dc4f1017b34696e6b3db99434d65'],
    },
    {
      logIndex: '66',
      transactionHash:
        '0x503ae549ee9fb0042d7f989e7628e0bf306da5db38cece987390c642def1cca2',
      address: '0x5fcc57700974dc4f1017b34696e6b3db99434d65',
      data: '0x000000000000000000000000000000000000000000000002b5e3af16b1880000',
      topic0:
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      topic1:
        '0x000000000000000000000000c85e9d6ea262443057621141ff9c2a147c69ec38',
      topic2:
        '0x00000000000000000000000098668bc5bbfacfc20e7673abc3aed007117455b6',
      topic3: null,
      triggered_by: ['0x5fcc57700974dc4f1017b34696e6b3db99434d65'],
    },
  ],
  txs: [],
  txsInternal: [],
  erc20Transfers: [
    {
      transactionHash:
        '0x503ae549ee9fb0042d7f989e7628e0bf306da5db38cece987390c642def1cca2',
      logIndex: '65',
      contract: '0x5fcc57700974dc4f1017b34696e6b3db99434d65',
      triggered_by: ['0x5fcc57700974dc4f1017b34696e6b3db99434d65'],
      from: '0xc85e9d6ea262443057621141ff9c2a147c69ec38',
      to: '0x98668bc5bbfacfc20e7673abc3aed007117455b6',
      value: '100000000000000000000',
      tokenName: 'F00M.Cash Points',
      tokenSymbol: 'Foom Points',
      tokenDecimals: '18',
      possibleSpam: false,
      valueWithDecimals: '100',
    },
    {
      transactionHash:
        '0x503ae549ee9fb0042d7f989e7628e0bf306da5db38cece987390c642def1cca2',
      logIndex: '66',
      contract: '0x5fcc57700974dc4f1017b34696e6b3db99434d65',
      triggered_by: ['0x5fcc57700974dc4f1017b34696e6b3db99434d65'],
      from: '0xc85e9d6ea262443057621141ff9c2a147c69ec38',
      to: '0x98668bc5bbfacfc20e7673abc3aed007117455b6',
      value: '50000000000000000000',
      tokenName: 'F00M.Cash Points',
      tokenSymbol: 'Foom Points',
      tokenDecimals: '18',
      possibleSpam: false,
      valueWithDecimals: '50',
    },
  ],
  erc20Approvals: [],
  nftTokenApprovals: [],
  nftApprovals: {
    ERC721: [],
    ERC1155: [],
  },
  nftTransfers: [],
  nativeBalances: [],
}

export const MoralisFunctionCallStreamMock = {
  confirmed: true,
  chainId: '0x1',
  abi: [],
  streamId: '8669b24d-bad1-4e76-8d2e-2a83e64a6f14',
  tag: '',
  retries: 0,
  block: {
    number: '22945004',
    hash: '0x4be4eac71abede786e0feed5300c38cfa13e2214ec4f716603789b2ead6b3345',
    timestamp: '1752828671',
  },
  logs: [
    {
      logIndex: '923',
      transactionHash:
        '0x89cf10175fd86768d5cafccb7ae551d21180a67ec69e3a98d4f3cc03c480d368',
      address: '0xd0d56273290d339aaf1417d9bfa1bb8cfe8a0933',
      data: '0x000000000000000000000000000000000000000034f22e77ead9021b42000000',
      topic0:
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      topic1:
        '0x0000000000000000000000007e15c0998d1cf9ea616c435092087cf8cabe6224',
      topic2:
        '0x000000000000000000000000239af915abcd0a5dcb8566e863088423831951f8',
      topic3: null,
      triggered_by: null,
    },
    {
      logIndex: '924',
      transactionHash:
        '0x89cf10175fd86768d5cafccb7ae551d21180a67ec69e3a98d4f3cc03c480d368',
      address: '0xd0d56273290d339aaf1417d9bfa1bb8cfe8a0933',
      data: '0x0000000000000000000000000000000000000004c23949f5bdd2761d7e000000',
      topic0:
        '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
      topic1:
        '0x0000000000000000000000007e15c0998d1cf9ea616c435092087cf8cabe6224',
      topic2:
        '0x000000000000000000000000239af915abcd0a5dcb8566e863088423831951f8',
      topic3: null,
      triggered_by: null,
    },
    {
      logIndex: '925',
      transactionHash:
        '0x89cf10175fd86768d5cafccb7ae551d21180a67ec69e3a98d4f3cc03c480d368',
      address: '0x239af915abcd0a5dcb8566e863088423831951f8',
      data: '0x',
      topic0:
        '0x67024112d4ff1b7b177f96a8d0a53bb255e6f8eb3e7b1c9e9400d7f0de991a56',
      topic1:
        '0x000000000000000000000000000000000000000000000000000000000000053a',
      topic2:
        '0x099e9a927bda434082ad86229dc1ceaa59001d693e7842cdad35ecf96506b16f',
      topic3: null,
      triggered_by: null,
    },
  ],
  txs: [
    {
      hash: '0x89cf10175fd86768d5cafccb7ae551d21180a67ec69e3a98d4f3cc03c480d368',
      gas: '58417',
      gasPrice: '5256061010',
      nonce: '156',
      input:
        '0x7bc49a95099e9a927bda434082ad86229dc1ceaa59001d693e7842cdad35ecf96506b160000000000000000000000000000000000000000000000000000000000000000e',
      transactionIndex: '350',
      fromAddress: '0x7e15c0998d1cf9ea616c435092087cf8cabe6224',
      toAddress: '0x239af915abcd0a5dcb8566e863088423831951f8',
      value: '0',
      type: '0x2',
      v: '0x1',
      r: '0x65e5cf61753cfee2c630cf7df8336631952accbffd4c03267604aa912bcfe49d',
      s: '0x2453e81cd29aec5ef84f86fc9395365c4b4b3b3dc9dfa858799be0a86be94b84',
      receiptCumulativeGasUsed: '36109823',
      receiptGasUsed: '58417',
      receiptContractAddress: null,
      receiptRoot: null,
      receiptStatus: '0x1',
      triggered_by: [Array],
    },
  ],
  txsInternal: [],
  erc20Transfers: [
    {
      transactionHash:
        '0x89cf10175fd86768d5cafccb7ae551d21180a67ec69e3a98d4f3cc03c480d368',
      logIndex: '923',
      contract: '0xd0d56273290d339aaf1417d9bfa1bb8cfe8a0933',
      triggered_by: null,
      from: '0x7e15c0998d1cf9ea616c435092087cf8cabe6224',
      to: '0x239af915abcd0a5dcb8566e863088423831951f8',
      value: '16386000000000000000000000000',
      tokenName: 'FOOM',
      tokenSymbol: 'FOOM',
      tokenDecimals: '18',
      valueWithDecimals: '16386000000',
      possibleSpam: false,
    },
  ],
  erc20Approvals: [
    {
      transactionHash:
        '0x89cf10175fd86768d5cafccb7ae551d21180a67ec69e3a98d4f3cc03c480d368',
      logIndex: '924',
      contract: '0xd0d56273290d339aaf1417d9bfa1bb8cfe8a0933',
      triggered_by: null,
      owner: '0x7e15c0998d1cf9ea616c435092087cf8cabe6224',
      spender: '0x239af915abcd0a5dcb8566e863088423831951f8',
      value: '377022000000000000000000000000',
      tokenName: 'FOOM',
      tokenSymbol: 'FOOM',
      tokenDecimals: '18',
      valueWithDecimals: '377022000000',
      possibleSpam: false,
    },
  ],
  nftTokenApprovals: [],
  nftApprovals: { ERC721: [], ERC1155: [] },
  nftTransfers: [],
  nativeBalances: [],
}
