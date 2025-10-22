const preserveNumber = (num: number | string) =>
  typeof num === 'string' ? num : num.toFixed(10)

export { preserveNumber }

export function formatNumber(number, showDecimals = true) {
  if (typeof number !== 'number' || isNaN(number)) return '—'
  const formatted = number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return showDecimals ? formatted : formatted.slice(0, -3)
}

export function trimToMeaningfulDecimals(
  num: number | string,
  meaningfulDigits: number,
): string {
  const str = typeof num === 'string' ? num : num.toString()

  const [intPart, decimalPart = ''] = str.split('.')

  if (!decimalPart) {
    return str
  }

  let resultDecimal = ''
  let count = 0
  let foundFirstNonZero = false

  for (const digit of decimalPart) {
    if (digit !== '0') {
      foundFirstNonZero = true
    }

    if (foundFirstNonZero) {
      resultDecimal += digit
      count++
      if (count >= meaningfulDigits) break
    } else {
      resultDecimal += digit
    }
  }

  const resultStr = `${intPart}.${resultDecimal}`
  return resultStr
}
