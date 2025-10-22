export const isSupportedAssetProtocol = (resourceUri: string) =>
  resourceUri?.startsWith('ipfs://') || resourceUri?.startsWith('https://')
