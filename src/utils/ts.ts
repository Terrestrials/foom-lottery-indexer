const _log = (...msg: any) => console.info(`\x1b[33m[Logger]:\x1b[0m`, ...msg)
const _warn = (...msg: any) =>
  console.warn(`\x1b[33m[/!\\ Warn]:\x1b[0m`, ...msg)
const _error = (...msg: any) =>
  console.error(`\x1b[31m[/!\\ Error]:\x1b[0m`, ...msg)

function createStringEnum<T extends object>(
  enumObj: T,
): { [K in keyof T as T[K] extends number ? K : never]: string } {
  return Object.keys(enumObj)
    .filter(key => isNaN(Number(key)))
    .reduce((acc, key) => {
      acc[key as keyof T] = key
      return acc
    }, {} as any)
}

const lowercaseFirstLetter = (str: string): string => {
  if (typeof str !== 'string' || str.length === 0) {
    return str
  }
  return str.charAt(0).toLowerCase() + str.slice(1)
}

export { _error, _log, _warn, createStringEnum, lowercaseFirstLetter }
