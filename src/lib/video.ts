/**
 * Como tocar o vídeo de uma aula a partir do link salvo no curso. Só aceita fontes em que dá para
 * acompanhar se o aluno assistiu até o fim: YouTube (API do player) e arquivos de vídeo (https).
 * Players embutidos de outros sites (Vimeo, Internet Archive) não informam o progresso.
 */
export type VideoSource = { kind: 'youtube'; id: string } | { kind: 'file'; src: string }

const FILE_EXTENSIONS = /\.(mp4|m4v|webm|ogv|ogg)$/i
const YOUTUBE_ID = /^[\w-]{11}$/

export function parseVideoSource(value: string | null | undefined): VideoSource | null {
  const raw = value?.trim()
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  const host = url.hostname.replace(/^www\.|^m\./, '')
  const parts = url.pathname.split('/').filter(Boolean)

  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = url.searchParams.get('v') ?? (['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : undefined)
    return id && YOUTUBE_ID.test(id) ? { kind: 'youtube', id } : null
  }
  if (host === 'youtu.be') return parts[0] && YOUTUBE_ID.test(parts[0]) ? { kind: 'youtube', id: parts[0] } : null
  if (FILE_EXTENSIONS.test(url.pathname)) return { kind: 'file', src: url.href }
  return null
}

/** Mensagem do editor para links que o player não aceita. */
export const VIDEO_SOURCE_HINT = 'um link https do YouTube ou de um arquivo de vídeo (.mp4 ou .webm)'
