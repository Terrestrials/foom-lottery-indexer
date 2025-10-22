import { buildMimcSponge } from 'circomlibjs'
import { MerkleTree } from 'fixed-merkle-tree'
import { leBufferToBigint, hexToBigint, bigintToHex } from './bigint'
import { _log } from 'src/utils/ts'
import { openSync, readFileSync, closeSync, existsSync } from 'fs'
import sprintfjs from 'sprintf-js'
import zlib from 'zlib'
import { isTreeExternal } from 'src/utils/environment'
import type { Address } from 'viem'
const MERKLE_TREE_HEIGHT = 32

const zeros = [
  '0x24d599883f039a5cb553f9ec0e5998d58d8816e823bd556164f72aef0ef7d9c0',
  '0x0e5c230fa94b937789a1980f91b9de6233a7d0315f037c7d4917cba089e0042a',
  '0x255da7d5316310ad81de31bfd5b8272b30ce70c742685ac9696446f618399317',
  '0x1dd4b847fd5bdd5d53a661d8268eb5dd6629669922e8a0dcbbeedc8d6a966aaf',
]

/**
 * @dev NOTE: Indexer reads www data based on the env it is in, e.g. either
 * www is mounted to /home/www or www-eth is mounted to the same /home/www
 * dir, hence no need to switch the /www paths here in the script.
 */
function getLines(_path) {
  const path = isTreeExternal() ? `www/cache${_path.slice(3)}` : _path

  let fileold
  let textold
  try {
    if (existsSync(path)) {
      fileold = openSync(path, 'r')
      textold = readFileSync(fileold, 'utf8')
    } else if (existsSync(path + '.gz')) {
      fileold = openSync(path + '.gz', 'r') // decompress the file
      textold = zlib.gunzipSync(readFileSync(fileold)).toString()
    } else {
      return []
    }
    closeSync(fileold)
  } catch (e) {
    return []
  }
  if (textold.length == 0) {
    return []
  }
  // remove empty lines
  return textold.split('\n').filter(line => line.trim() !== '')
}

/** @returns [nextIndex, blockNumber, lastRoot, lastLeaf] */
function readLast(): [number, number, bigint, bigint] {
  const lines = getLines('www/last.csv')
  const [nextIndex, blockNumber, lastRoot, lastLeaf] = lines[0].split(',')

  return [
    parseInt(nextIndex, 16),
    parseInt(blockNumber, 16),
    hexToBigint(lastRoot),
    hexToBigint(lastLeaf),
  ]
}

function getIndexRand(hashstr?: string, betIndex?: number): [number, bigint] {
  const path = sprintfjs.sprintf('%06x', betIndex >> 8)

  const path1 = path.slice(0, 2)
  const path2 = path.slice(2, 4)
  const path3 = path.slice(4, 6)
  const filePath = 'www/' + path1 + '/' + path2 + '/' + path3 + '.csv'
  // _log(`Trying path: ${filePath}…`)

  const lines = getLines(filePath)

  for (let i = 0; i < lines.length; i++) {
    const [index, _, hash, myrand] = lines[i].split(',')
    // _log('lines read:', index, hash, myrand)

    /** @dev `slice` call avoids the '0'/'1' bet hash last char diff issue */
    if (
      hash?.slice(0, -1) == hashstr?.slice(0, -1) ||
      /** @dev return the index-th item if hash is empty */
      ((hashstr === '' || hashstr === undefined) &&
        index == (betIndex & 0xff).toString(16))
    ) {
      //console.log(hash);
      const newIndex = (betIndex & 0xffffff00) + parseInt(index, 16)
      //console.log(newIndex.toString(16),index);
      return [newIndex, hexToBigint(myrand)]
    }
  }
  return [0, 0n]
}

function getIndexWaiting(hashstr): [number, bigint] {
  const lines = getLines('www/waiting.csv')
  for (let i = 0; i < lines.length; i++) {
    const [index, hash] = lines[i].split(',')
    if (hash == hashstr) {
      return [parseInt(index, 16), 0n]
    }
  }
  return [0, 0n]
}



/**
 * Supports finding by hash if provided, otherwise by index only.
 * @returns [betIndex (startIndex), betRand, nextIndex]
 */
function findBet(inHash: string, startindex: number): [number, bigint, number] {
  // _log('findBet:', inHash, startindex)

  const [nextIndex, blockNumber, lastRoot, lastLeaf]: [
    number,
    number,
    bigint,
    bigint,
  ] = readLast()
  // _log('readLasts next index', nextIndex)
  const hashstr: string = inHash?.replace(/^0x0*/, '')
  // _log('inHash replaced:', hashstr)

  /** @dev find by hash - if present and non-zero */
  if (!!inHash && inHash !== '0x' && inHash !== '0x0' && inHash !== '0') {
    let iterationCount: number = 0
    /** TODO: "This is an old bet, please provide betIndex!"; make 16 be max. */
    const maxIterations: number = 10_000
    for (; (startindex & 0xffffff00) < nextIndex; startindex += 0xff) {
      if (iterationCount++ > maxIterations) {
        throw new Error('findBet loop exceeded maximum iterations')
      }

      // _log(`in loop (iter ${iterationCount}), start index incremented:`, startindex)
      // _log('calling getIndexRand with:', hashstr, startindex)
      // _log('getIndexRand called with:', hashstr, startindex)
      const [betIndex, betRand]: [number, bigint] = getIndexRand(
        hashstr,
        startindex,
      )

      /** @dev tried last path */
      if (((startindex + 0xff) & 0xffffff00) >= nextIndex || !!betIndex) {
        const path = sprintfjs.sprintf('%06x', betIndex >> 8)
        const path1 = path.slice(0, 2)
        const path2 = path.slice(2, 4)
        const path3 = path.slice(4, 6)
        const filePath = 'www/' + path1 + '/' + path2 + '/' + path3 + '.csv'
        _log(`Tried last path: ${filePath}…`, '(max index searched for):', ((startindex + 0xff) & 0xffffff00), ', (real max index):', nextIndex)
      }

      // _log('getIndexRand returned:', betIndex, betRand)
      if (betIndex > 0) {
        return [betIndex, betRand, nextIndex]
      }

      // _log(`Past loop iteration ${iterationCount}`)
    }
    // _log('Exited with loop condition:', startindex, (startindex & 0xffffff00), nextIndex)

    /** @dev return waiting list info */
    const [waitIndex, waitRand] = getIndexWaiting(hashstr)
    if (waitIndex > 0) {
      return [waitIndex, waitRand, nextIndex]
    }

    /** @dev bet not found */
    return [0, 0n, 0]
  }

  // If no hash provided, find by index only
  if (startindex < 0 || startindex >= nextIndex) {
    return [0, 0n, 0]
  }
  const path = sprintfjs.sprintf('%06x', startindex >> 8)
  const path1 = path.slice(0, 2)
  const path2 = path.slice(2, 4)
  const path3 = path.slice(4, 6)
  const filePath = `www/${path1}/${path2}/${path3}.csv`
  let lines = getLines(filePath)
  if (lines.length === 0) {
    lines = getLines(`www/${path1}/${path2}/index.csv`)
    if (lines.length === 0) {
      lines = getLines(`www/${path1}/index.csv`)
      if (lines.length === 0) {
        lines = getLines('www/index.csv')
      }
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const [index, _unused, _hash, myrand] = lines[i].split(',')
    if (parseInt(index, 16) === (startindex & 0xff)) {
      return [startindex, hexToBigint(myrand), nextIndex]
    }
  }
  return [0, 0n, 0]
}

function getWaitingList(nextIndex: number, hashesLength: number): bigint[] {
  const lines: string[] = getLines('www/waiting.csv')
  const hashes: bigint[] = new Array(hashesLength)
  lines.forEach((line: string) => {
    if (!line) {
      return
    }

    const parts: string[] = line.split(',')
    const [index, hash]: [string, string] = [parts[0], parts[1]]

    const indexnum: number = parseInt(index, 16)
    if (indexnum >= nextIndex && indexnum < nextIndex + hashesLength) {
      hashes[indexnum - nextIndex] = hexToBigint(hash)
    }
  })
  return hashes
}

function getLeaves(path) {
  const lines = getLines(path)
  const leaves = lines.map(line => {
    const [index, hash] = line.split(',')
    return hexToBigint(hash)
  })
  return [leaves]
}

function readFees(): [
  /** @dev formatted full-precision number */ string,
  /** @dev formatted full-precision number */ string,
  Address | '',
] {
  const lines = getLines('www/fees.csv')
  if (lines.length === 0) {
    return ['0', '0', '']
  }
  const [fee_in_FOOM, refund_in_ETH, relayer_address] = lines[0].split(',')
  return [fee_in_FOOM, refund_in_ETH, relayer_address]
}

async function getLastPath(lastIndex) {
  const path = sprintfjs.sprintf('%08x', lastIndex)
  const path1 = path.slice(0, 2)
  const path1i = parseInt(path1, 16)
  const path2 = path.slice(2, 4)
  const path2i = parseInt(path2, 16)
  const path3 = path.slice(4, 6)
  const path3i = parseInt(path3, 16)
  const path4 = path.slice(6, 8)
  const path4i = parseInt(path4, 16)
  //console.log(path);

  const [leaves1] = getLeaves('www/index.csv')
  const [leaves2] = getLeaves('www/' + path1 + '/index.csv')
  const [leaves3] = getLeaves('www/' + path1 + '/' + path2 + '/index.csv')
  const [leaves4] = getLeaves(
    'www/' + path1 + '/' + path2 + '/' + path3 + '.csv',
  )

  const tree4 = await mimicMerkleTree(hexToBigint(zeros[0]), leaves4, 8)
  const mpath4 = tree4.path(path4i)
  const root4 = tree4.root
  //console.log(bigintToHex(root4));
  if (leaves3.length == path3i) {
    //console.log(path3i);
    leaves3.push(root4)
  }
  const tree3 = await mimicMerkleTree(hexToBigint(zeros[1]), leaves3, 8)
  const root3 = tree3.root
  const mpath3 = tree3.path(path3i)
  if (leaves2.length == path2i) {
    leaves2.push(root3)
  }
  const tree2 = await mimicMerkleTree(hexToBigint(zeros[2]), leaves2, 8)
  const root2 = tree2.root
  const mpath2 = tree2.path(path2i)
  if (leaves1.length == path1i) {
    leaves1.push(root2)
  }
  const tree1 = await mimicMerkleTree(hexToBigint(zeros[3]), leaves1, 8)
  const newroot = tree1.root
  const mpath1 = tree1.path(path1i)
  const pathElements = [
    ...mpath4.pathElements,
    ...mpath3.pathElements,
    ...mpath2.pathElements,
    ...mpath1.pathElements,
  ]
  return [...pathElements, newroot]
}

async function getPath(index, nextIndex) {
  const path = sprintfjs.sprintf('%08x', index)
  const path1 = path.slice(0, 2)
  const path1i = parseInt(path1, 16)
  const path2 = path.slice(2, 4)
  const path2i = parseInt(path2, 16)
  const path3 = path.slice(4, 6)
  const path3i = parseInt(path3, 16)
  const path4 = path.slice(6, 8)
  const path4i = parseInt(path4, 16)
  const npath = sprintfjs.sprintf('%08x', nextIndex)
  const npath1 = npath.slice(0, 2)
  const npath1i = parseInt(npath1, 16)
  const npath2 = npath.slice(2, 4)
  const npath2i = parseInt(npath2, 16)
  const npath3 = npath.slice(4, 6)
  const npath3i = parseInt(npath3, 16)

  const [leaves1] = getLeaves('www/index.csv')
  const [leaves2] = getLeaves('www/' + path1 + '/index.csv')
  const [leaves3] = getLeaves('www/' + path1 + '/' + path2 + '/index.csv')
  const [leaves4] = getLeaves(
    'www/' + path1 + '/' + path2 + '/' + path3 + '.csv',
  )

  let tree4 = await mimicMerkleTree(hexToBigint(zeros[0]), leaves4, 8)
  const mpath4 = tree4.path(path4i)
  if ((index & 0xffffff00) != (nextIndex & 0xffffff00)) {
    const [nleaves4] = getLeaves(
      'www/' + npath1 + '/' + npath2 + '/' + npath3 + '.csv',
    )
    tree4 = await mimicMerkleTree(hexToBigint(zeros[0]), nleaves4, 8)
  }
  const root4 = tree4.root
  leaves3.push(root4)
  let tree3 = await mimicMerkleTree(hexToBigint(zeros[1]), leaves3, 8)
  const mpath3 = tree3.path(path3i)
  if ((index & 0xffff0000) != (nextIndex & 0xffff0000)) {
    const [nleaves3] = getLeaves('www/' + npath1 + '/' + npath2 + '/index.csv')
    tree3 = await mimicMerkleTree(hexToBigint(zeros[1]), nleaves3, 8)
  }
  const root3 = tree3.root
  leaves2.push(root3)
  let tree2 = await mimicMerkleTree(hexToBigint(zeros[2]), leaves2, 8)
  const mpath2 = tree2.path(path2i)
  const root2 = tree2.root
  if ((index & 0xff000000) != (nextIndex & 0xff000000)) {
    const [nleaves2] = getLeaves('www/' + npath1 + '/index.csv')
    tree2 = await mimicMerkleTree(hexToBigint(zeros[2]), nleaves2, 8)
  }
  leaves1.push(root2)
  const tree1 = await mimicMerkleTree(hexToBigint(zeros[3]), leaves1, 8)
  const newroot = tree1.root
  const mpath1 = tree1.path(path1i)
  const pathElements = [
    ...mpath4.pathElements,
    ...mpath3.pathElements,
    ...mpath2.pathElements,
    ...mpath1.pathElements,
  ]
  return [...pathElements, newroot]
}

async function getNewRoot(nextIndex, newLeaves) {
  const path = sprintfjs.sprintf('%08x', nextIndex - 1)
  const path1 = path.slice(0, 2)
  const path2 = path.slice(2, 4)
  const path3 = path.slice(4, 6)

  const [leaves1] = getLeaves('www/index.csv')
  const [leaves2] = getLeaves('www/' + path1 + '/index.csv')
  const [leaves3] = getLeaves('www/' + path1 + '/' + path2 + '/index.csv')
  const [leaves4] = getLeaves(
    'www/' + path1 + '/' + path2 + '/' + path3 + '.csv',
  )

  const roots = new Array(2)

  const leaves2length = leaves2.length
  const leaves3length = leaves3.length
  const leaves4length = leaves4.length
  leaves4.push(...newLeaves)
  if (leaves4.length > 256) {
    const tree4a = await mimicMerkleTree(
      hexToBigint(zeros[0]),
      leaves4.slice(0, 256),
      8,
    )
    roots[0] = tree4a.root
    const tree4b = await mimicMerkleTree(
      hexToBigint(zeros[0]),
      leaves4.slice(256, leaves4.length),
      8,
    )
    roots[1] = tree4b.root
  } else {
    const tree4a = await mimicMerkleTree(hexToBigint(zeros[0]), leaves4, 8)
    roots[0] = tree4a.root
    roots[1] = hexToBigint(zeros[1])
  }
  if (leaves4length == 256) {
    leaves3.push(roots[1])
  } else {
    leaves3.push(...roots)
  }
  if (leaves3.length > 256) {
    const tree3a = await mimicMerkleTree(
      hexToBigint(zeros[1]),
      leaves3.slice(0, 256),
      8,
    )
    roots[0] = tree3a.root
    const tree3b = await mimicMerkleTree(
      hexToBigint(zeros[1]),
      leaves3.slice(256, leaves3.length),
      8,
    )
    roots[1] = tree3b.root
  } else {
    const tree3a = await mimicMerkleTree(hexToBigint(zeros[1]), leaves3, 8)
    roots[0] = tree3a.root
    roots[1] = hexToBigint(zeros[2])
  }
  if (leaves3length == 256) {
    leaves2.push(roots[1])
  } else {
    leaves2.push(...roots)
  }
  if (leaves2.length > 256) {
    const tree2a = await mimicMerkleTree(
      hexToBigint(zeros[2]),
      leaves2.slice(0, 256),
      8,
    )
    roots[0] = tree2a.root
    const tree2b = await mimicMerkleTree(
      hexToBigint(zeros[2]),
      leaves2.slice(256, leaves2.length),
      8,
    )
    roots[1] = tree2b.root
  } else {
    const tree2a = await mimicMerkleTree(hexToBigint(zeros[2]), leaves2, 8)
    roots[0] = tree2a.root
    roots[1] = hexToBigint(zeros[3])
  }
  if (leaves2length == 256) {
    leaves1.push(roots[1])
  } else {
    leaves1.push(...roots)
  }
  const tree1 = await mimicMerkleTree(hexToBigint(zeros[3]), leaves1, 8)
  const newRoot = tree1.root
  return newRoot
}

async function mimicMerkleTree(zero, leaves = [], hight = MERKLE_TREE_HEIGHT) {
  const mimcsponge = await buildMimcSponge()
  const mimcspongeMultiHash = (left, right) =>
    leBufferToBigint(
      mimcsponge.F.fromMontgomery(mimcsponge.multiHash([left, right])),
    )
  return new MerkleTree(hight, leaves, {
    // @ts-expect-error TS error
    hashFunction: mimcspongeMultiHash,
    zeroElement: zero,
  })
}

/**
 * Reads the most recent random values from the rand.csv file structure.
 * @param lastIndex The last index to start reading from.
 * @param numRand The number of random values to retrieve.
 * @returns An array of strings in the format "index,rand".
 */
function readRand(lastIndex: number, numRand: number): string[] {
  const lastpath = sprintfjs.sprintf('%04x', (lastIndex - numRand) >> 16)
  const path1 = lastpath.slice(0, 2)
  const path2 = lastpath.slice(2, 4)
  const lines = getLines(`www/${path1}/${path2}/rand.csv`)
  const rands: string[] = []
  for (let i = lines.length - 1; i >= 0; i--) {
    const [lastIndexStr, newIndexStr, newRand] = lines[i].split(',')
    const lastIndexNum = parseInt(lastIndexStr, 16)
    const newIndexNum = parseInt(newIndexStr, 16)
    for (let j = newIndexNum - 1; j >= lastIndexNum; j--) {
      rands.push(sprintfjs.sprintf('%x,%s', j, newRand))
      if (rands.length >= numRand) {
        return rands
      }
    }
  }
  return rands
}

export {
  readFees,
  mimicMerkleTree,
  readLast,
  getLeaves,
  getPath,
  getLastPath,
  getIndexWaiting,
  getIndexRand,
  findBet,
  getNewRoot,
  getWaitingList,
  getLines,
  readRand,
}
