export function isExternalMenuUrl(url: string): boolean {
  return (
    /^(https?:)?\/\//i.test(url) ||
    url.startsWith('mailto:') ||
    url.startsWith('tel:')
  )
}
