const insensitive = (content: string) => new RegExp(`^${content}$`, 'i')
const insensitiveInexact = (content: string) =>
  new RegExp(`.*${content}.*`, 'i')

export const RegexUtils = {
  insensitive,
  insensitiveInexact,
}
