import type { LoggedUser } from '../types'
import { userError } from './errors'

/**
 * Foto de perfil (aluno/mentor) e logo da empresa: validação do arquivo escolhido, redução no
 * navegador antes do envio e reconhecimento das URLs do bucket do Storage. O envio em si fica em
 * lib/supabase/storage.ts; as funções puras daqui são testadas em tests/profile-image.test.ts.
 */

/** Bucket público do Storage com as fotos de perfil e os logos das empresas. */
export const PROFILE_IMAGE_BUCKET = 'avatar'

/** Foto de pessoa é recortada em quadrado; logo de empresa só é reduzido, sem cortar nada. */
export type ProfileImageKind = 'avatar' | 'logo'

export const ACCEPTED_IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']
/** Valor do `accept` do <input type="file">. */
export const ACCEPTED_IMAGE_INPUT = ACCEPTED_IMAGE_TYPES.join(',')
/** Limite do arquivo escolhido, antes da redução: foto de celular passa de 5 MB com facilidade. */
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024
/** Lado da foto de perfil enviada (quadrada) e lado máximo do logo. */
export const AVATAR_SIZE = 400
export const LOGO_MAX_SIZE = 512

/** Imagem pronta para envio: já reduzida e convertida no navegador. */
export interface PreparedImage {
  blob: Blob
  contentType: 'image/jpeg' | 'image/png'
  extension: 'jpg' | 'png'
}

/**
 * Foto em edição num formulário: manter a atual, trocar por uma nova ou remover. A nova só vai
 * para o Storage quando o formulário é salvo (até lá existe só a prévia, uma URL blob:).
 */
export type PhotoDraft = { kind: 'keep' } | { kind: 'new'; image: PreparedImage; previewUrl: string } | { kind: 'remove' }

export const KEEP_PHOTO: PhotoDraft = { kind: 'keep' }

/** Mensagem para a tela se o arquivo escolhido não serve, ou null se ele pode ser usado. */
export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Escolha uma imagem JPG, PNG ou WebP.'
  if (file.size === 0) return 'Esse arquivo está vazio. Escolha outra imagem.'
  if (file.size > MAX_SOURCE_BYTES) return 'A imagem passa de 15 MB. Escolha uma menor.'
  return null
}

/** Maior quadrado centralizado da imagem (recorte da foto de perfil). */
export function centerSquare(width: number, height: number): { sx: number; sy: number; size: number } {
  const size = Math.min(width, height)
  return { sx: Math.round((width - size) / 2), sy: Math.round((height - size) / 2), size }
}

/** Dimensões que cabem em `max`×`max` mantendo a proporção, sem ampliar imagem pequena. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
/** `<pasta do dono>/<avatar|logo>-<uuid>.<jpg|png>`: o único formato que o app grava no bucket. */
const OBJECT_PATH = new RegExp(`^(${UUID})/(?:avatar|logo)-${UUID}\\.(?:jpg|png)$`, 'i')

/**
 * Endereço público dos arquivos do bucket, montado como o cliente Supabase monta o do getPublicUrl
 * (`new URL('storage/v1', projeto)`), para as duas URLs baterem letra por letra.
 */
export function profileImageBaseUrl(supabaseUrl: string): string {
  const root = new URL(supabaseUrl.endsWith('/') ? supabaseUrl : `${supabaseUrl}/`)
  return new URL(`storage/v1/object/public/${PROFILE_IMAGE_BUCKET}/`, root).href
}

/**
 * Caminho no bucket de uma URL pública de imagem enviada pelo app, com a pasta (id do dono: a
 * conta, na foto; a empresa, no logo). Null para qualquer outra URL.
 */
export function profileImagePath(url: string | null | undefined, supabaseUrl: string): { folder: string; path: string } | null {
  if (!url || !supabaseUrl) return null
  let base: string
  try {
    base = profileImageBaseUrl(supabaseUrl)
  } catch {
    return null
  }
  if (!url.startsWith(base)) return null
  const match = OBJECT_PATH.exec(url.slice(base.length))
  return match ? { folder: match[1].toLowerCase(), path: match[0] } : null
}

/**
 * A foto só aparece se for uma imagem enviada pelo próprio dono, pelo app. A coluna aceita qualquer
 * texto pela API: sem esse filtro, uma URL externa viraria <img> na tela de quem abre o card (e o
 * dono daquele servidor ficaria sabendo de cada visita), ou alguém poderia usar a foto de outra pessoa.
 */
export function ownProfileImage(url: string | null | undefined, ownerId: string, supabaseUrl: string): string | undefined {
  const parsed = profileImagePath(url, supabaseUrl)
  return parsed && url && parsed.folder === ownerId.toLowerCase() ? url : undefined
}

/** Formato dos erros do Storage (StorageApiError/StorageUnknownError do cliente Supabase). */
export interface StorageErrorLike {
  message?: string
  status?: number
  statusCode?: string
  code?: string
}

export const PHOTO_UPLOAD_NOT_READY = 'O envio de fotos ainda não está disponível: falta aplicar uma atualização no servidor.'

/**
 * Texto para a tela a partir de um erro de envio ao Storage. "Bucket not found" é o servidor ainda
 * sem o SQL das fotos; o resto segue o código HTTP que o Storage devolve no corpo (statusCode).
 */
export function storageUploadMessage(err: StorageErrorLike): string {
  const message = err.message ?? ''
  const status = String(err.statusCode ?? err.status ?? '')
  if (err.code === 'NoSuchBucket' || /bucket not found/i.test(message)) return PHOTO_UPLOAD_NOT_READY
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.'
  }
  if (/jwt|exp claim|invalid signature/i.test(message)) return 'Sua sessão expirou. Entre novamente.'
  if (status === '413' || /maximum allowed size|too large/i.test(message)) return 'A imagem ficou grande demais. Tente outra foto.'
  if (status === '415' || /mime type/i.test(message)) return 'Formato de imagem não aceito. Use JPG, PNG ou WebP.'
  if (status === '403' || /row-level security|unauthorized/i.test(message)) return 'Você não tem permissão para enviar essa imagem.'
  return 'Não foi possível enviar a imagem. Tente novamente.'
}

/** Imagem mostrada no topo do painel: a foto da pessoa ou, na conta de empresa, o logo. */
export function profilePhotoOf(user: LoggedUser | null | undefined): string | undefined {
  if (!user) return undefined
  return user.type === 'company' ? user.logoUrl : user.avatarUrl
}

function canvasToBlob(canvas: HTMLCanvasElement, type: PreparedImage['contentType'], quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(userError('Seu navegador não conseguiu preparar a imagem. Tente outra.'))), type, quality)
  })
}

/**
 * Reduz a imagem escolhida antes do envio: a foto de perfil vira um JPG quadrado de até 400 px
 * (recorte central) e o logo, um PNG de até 512 px sem cortes, mantendo o fundo transparente.
 * Uma foto de celular de vários MB vira algumas dezenas de KB. A orientação da câmera (EXIF) é
 * respeitada porque a imagem é desenhada como o navegador a exibe.
 */
export async function prepareProfileImage(file: File, kind: ProfileImageKind): Promise<PreparedImage> {
  const problem = validateImageFile(file)
  if (problem) throw userError(problem)

  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    try {
      await img.decode()
    } catch {
      throw userError('Não foi possível abrir essa imagem. Tente outra foto (JPG, PNG ou WebP).')
    }
    const width = img.naturalWidth
    const height = img.naturalHeight
    if (!width || !height) throw userError('Não foi possível abrir essa imagem. Tente outra foto (JPG, PNG ou WebP).')

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw userError('Seu navegador não conseguiu preparar a imagem. Tente outra.')

    if (kind === 'avatar') {
      const { sx, sy, size } = centerSquare(width, height)
      const side = Math.min(AVATAR_SIZE, size)
      canvas.width = side
      canvas.height = side
      ctx.imageSmoothingQuality = 'high'
      // JPG não tem transparência: sem o fundo branco, um PNG transparente ficaria com fundo preto.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, side, side)
      ctx.drawImage(img, sx, sy, size, size, 0, 0, side, side)
      return { blob: await canvasToBlob(canvas, 'image/jpeg', 0.86), contentType: 'image/jpeg', extension: 'jpg' }
    }

    const target = fitWithin(width, height, LOGO_MAX_SIZE)
    canvas.width = target.width
    canvas.height = target.height
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, target.width, target.height)
    return { blob: await canvasToBlob(canvas, 'image/png'), contentType: 'image/png', extension: 'png' }
  } finally {
    URL.revokeObjectURL(url)
  }
}
