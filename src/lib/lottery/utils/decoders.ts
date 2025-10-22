export function decodePrayer(prayerArray: string[]): string {
  const hexString = prayerArray.map(s => s.slice(2)).join('')

  const bytes = new Uint8Array(
    hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)),
  )

  const endIndex = bytes.indexOf(0x00)
  const trimmedBytes = endIndex === -1 ? bytes : bytes.slice(0, endIndex)

  const decoder = new TextDecoder()
  return decoder.decode(trimmedBytes)
}
