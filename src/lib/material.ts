/**
 * Formato do material de uma aula, digitado pela empresa: blocos separados por linha em branco;
 * "- " = item de lista; "1. " = item numerado; "### " = subtítulo; o resto é parágrafo.
 * Linhas consecutivas do mesmo tipo formam um segmento, então um rótulo seguido de lista funciona
 * mesmo sem linha em branco entre eles.
 */
export type MaterialSegment = { kind: 'p' | 'ul' | 'ol' | 'h'; lines: string[] }

const ORDERED = /^\d+[.)]\s+/

function kindOf(line: string): MaterialSegment['kind'] {
  if (line.startsWith('### ')) return 'h'
  if (line.startsWith('- ')) return 'ul'
  if (ORDERED.test(line)) return 'ol'
  return 'p'
}

function strip(line: string, kind: MaterialSegment['kind']) {
  if (kind === 'ul') return line.slice(2)
  if (kind === 'ol') return line.replace(ORDERED, '')
  if (kind === 'h') return line.slice(4)
  return line
}

export function parseMaterial(text: string): MaterialSegment[] {
  const segments: MaterialSegment[] = []
  for (const block of text.replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
    let current: MaterialSegment | null = null
    for (const raw of block.split('\n')) {
      const line = raw.trim()
      if (!line) continue
      const kind = kindOf(line)
      if (!current || current.kind !== kind || kind === 'h') {
        current = { kind, lines: [] }
        segments.push(current)
      }
      current.lines.push(strip(line, kind))
    }
  }
  return segments
}

/** Divide um texto em trechos normais e trechos **em negrito**. */
export function splitBold(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => (part.length > 4 && part.startsWith('**') && part.endsWith('**') ? { text: part.slice(2, -2), bold: true } : { text: part, bold: false }))
}
