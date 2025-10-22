const catchable = async <T, TError = any>(
  reflected: (...p: any) => Promise<T>,
  onError?: (error: TError) => void,
): Promise<T | undefined> => {
  let result: T | undefined

  try {
    result = await reflected()
  } catch (error) {
    console.error(error)

    onError?.(error)
  }

  return result
}

export { catchable }
