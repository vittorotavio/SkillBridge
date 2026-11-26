import { useState } from 'react'
import { cn } from '../../lib/cn'

interface AvatarProps {
  name: string
  /** Foto (ou logo). Sem foto, ou se ela não carregar, aparecem as iniciais do nome. */
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** `contain` mostra a imagem inteira sobre fundo branco (logo de empresa); `cover` recorta (foto). */
  fit?: 'cover' | 'contain'
  className?: string
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-24 w-24 text-3xl',
}

const palette = [
  'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300',
  'bg-cta-100 text-cta-700 dark:bg-cta-500/20 dark:text-cta-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
]

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** Só http(s) e a prévia local (blob:) da foto escolhida viram <img>. */
function imageSrc(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const { protocol } = new URL(raw)
    return protocol === 'https:' || protocol === 'http:' || protocol === 'blob:' ? raw : null
  } catch {
    return null
  }
}

export function Avatar({ name, src, size = 'md', fit = 'cover', className }: AvatarProps) {
  const colorIndex = name.length % palette.length
  const image = imageSrc(src)
  // Guarda qual URL falhou: trocar de foto tenta carregar de novo.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = !!image && failedSrc !== image

  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-full font-bold shrink-0',
        sizeClasses[size],
        showImage ? (fit === 'contain' ? 'bg-white ring-1 ring-slate-200 dark:ring-slate-600' : 'bg-slate-100 dark:bg-slate-700') : palette[colorIndex],
        className
      )}
    >
      {showImage ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailedSrc(image)}
          className={cn('h-full w-full', fit === 'contain' ? 'object-contain p-[8%]' : 'object-cover')}
        />
      ) : (
        initials(name)
      )}
    </div>
  )
}
