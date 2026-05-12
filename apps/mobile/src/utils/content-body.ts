import type { ContentBody } from '@/api/types'

export function bodyFromText(text: string): ContentBody {
  const blocks = text
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ type: 'paragraph' as const, text: line }))
  return { version: 1, blocks: blocks.length ? blocks : [{ type: 'paragraph', text: '' }] }
}

export function textFromBody(body: unknown): string {
  if (!body || typeof body !== 'object') {
    return ''
  }
  const maybe = body as { blocks?: Array<{ type?: string; text?: string; caption?: string }> }
  if (!Array.isArray(maybe.blocks)) {
    return ''
  }
  return maybe.blocks
    .map((block) => block.text || block.caption || '')
    .filter(Boolean)
    .join('\n\n')
}

export function firstText(body: unknown, fallback = '暂无正文') {
  const text = textFromBody(body).trim()
  return text || fallback
}
