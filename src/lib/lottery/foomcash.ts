import { _log } from 'src/utils/ts'
import axios from 'axios'
import * as fs from 'fs/promises'
import * as path from 'path'
import { isEth } from 'src/utils/environment'

const REMOTE_DIR = `https://foom.cash/files/${isEth() ? 'ethereum' : 'base'}/`
export const CACHE_DIR = path.resolve(__dirname, '../../../www/cache')

const ROOT_DIRECTORY_FILES = [
  'fees.csv',
  'lastbet.csv',
  'last.csv',
  'logs.csv',
  'period.csv',
  'prayers.csv',
  'reveallock.csv',
  'waiting.csv',
]

/** @dev this tracks ongoing syncs operation, if any */
let ongoingSyncPromise: Promise<void> | null = null

/**
 * Syncs cached tree with https://foom.cash (from).
 * Overwrites local files with new ones.
 * Downloads known files and recursively downloads the '00' directory.
 * Ensures only one sync operation can run at a time - concurrent calls will await the ongoing operation.
 */
export async function syncFoomcashTree(noLimit = false) {
  /** @dev do not allow concurrent invocations */
  if (ongoingSyncPromise) {
    _log('Sync already in progress, waiting for it to complete...')
    await ongoingSyncPromise
    return
  }

  ongoingSyncPromise = performSync(noLimit)

  try {
    await ongoingSyncPromise
  } finally {
    ongoingSyncPromise = null
  }
}

/**
 * This performs actual Lottery tree sync operation.
 */
async function performSync(noLimit = false) {
  const localWwwDir = CACHE_DIR

  try {
    await fs.mkdir(localWwwDir, { recursive: true })
  } catch (error) {
    throw error
  }

  await downloadKnownFiles(REMOTE_DIR, localWwwDir)

  /** @dev check 00 to ff before empty (404) */
  for (let i = 0; i < 256; i++) {
    const hexDir = i.toString(16).padStart(2, '0')
    const remoteHexDir = REMOTE_DIR + hexDir + '/'
    const localHexDir = path.join(localWwwDir, hexDir)

    try {
      _log(`Querying directory: ${remoteHexDir}`)
      await axios.get(remoteHexDir)
      await fetchAndDownloadDir(
        remoteHexDir,
        localHexDir,
        noLimit ? undefined : 6,
      )
    } catch (error) {
      if (error.response && error.response.status === 404) {
        _log(`Directory not found (404): ${remoteHexDir}`)
        break
      } else {
        _log(`Error checking directory: ${remoteHexDir}`)
      }
    }
  }
}

async function downloadKnownFiles(remoteDir: string, localDir: string) {
  for (const file of ROOT_DIRECTORY_FILES) {
    const fileUrl = remoteDir + file
    const localPath = path.join(localDir, file)

    try {
      _log(`Downloading known file: ${fileUrl}`)
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' })
      await fs.writeFile(localPath, response.data)
    } catch (error) {
      _log(`Failed to download: ${fileUrl}`)
    }
  }
}

/**
 * Recursively downloads all files/subdirs from a dir
 * Downloads at least the last 6 items, but if there are gaps in the sequence, downloads more to fill the gap.
 */
async function fetchAndDownloadDir(
  remoteDir: string,
  localDir: string,
  limitLastN?: number,
) {
  let html
  try {
    _log(`Querying directory listing: ${remoteDir}`)
    const { data } = await axios.get(remoteDir)
    html = data
  } catch (error) {
    _log(`Failed to list directory: ${remoteDir}`)
    return
  }
  let links = Array.from(html.matchAll(/href="([^\"]+)"/g))
    .map(match => match[1])
    .filter(href => href && href !== '../')

  /** @dev sort links by their numeric value (hex) if possible, otherwise lexicographically */
  const parseHex = (name: string) => {
    const m = name.match(/^([0-9a-fA-F]{2})/)
    return m ? parseInt(m[1], 16) : NaN
  }
  links.sort((a, b) => {
    const na = parseHex(a)
    const nb = parseHex(b)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return a.localeCompare(b)
  })

  /** @dev get last 6 files and more if a gap is detected, unless no limit */
  let toDownload: string[] = []
  if (links.length > 0) {
    if (!limitLastN) {
      toDownload = links
    } else {
      let idx = links.length - limitLastN
      if (idx < 0) idx = 0
      toDownload = links.slice(idx)

      /** @dev check for gaps */
      let i = idx - 1
      while (i >= 0) {
        const currNum = parseHex(links[i + 1])
        const prevNum = parseHex(links[i])

        if (!isNaN(currNum) && !isNaN(prevNum) && prevNum !== currNum - 1) {
          toDownload.unshift(links[i])
          i--
        } else {
          break
        }
      }
    }
  }

  for (const link of toDownload) {
    if (link.endsWith('/')) {
      const subRemote = remoteDir + link
      const subLocal = path.join(localDir, link)

      await fs.mkdir(subLocal, { recursive: true })
      await fetchAndDownloadDir(subRemote, subLocal, limitLastN)
    } else {
      const fileUrl = remoteDir + link
      const localPath = path.join(localDir, link)

      try {
        _log(`Downloading file: ${fileUrl}`)
        const response = await axios.get(fileUrl, {
          responseType: 'arraybuffer',
        })
        await fs.writeFile(localPath, response.data)

        if (link.endsWith('.csv.gz')) {
          const csvPath = localPath.replace(/\.gz$/, '')
          try {
            await fs.unlink(csvPath)
          } catch (error) {}
        }
      } catch (error) {
        _log(`Failed to download: ${fileUrl}`)
      }
    }
  }
}
