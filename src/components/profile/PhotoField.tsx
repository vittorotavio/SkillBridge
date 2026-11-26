import { useEffect, useId, useRef, useState } from 'react'
import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'
import { friendlyError } from '../../lib/errors'
import { ACCEPTED_IMAGE_INPUT, KEEP_PHOTO, prepareProfileImage, type PhotoDraft, type ProfileImageKind } from '../../lib/profileImage'

interface PhotoFieldProps {
  /** Nome usado nas iniciais enquanto não há imagem. */
  name: string
  /** Imagem já salva no perfil. */
  currentUrl?: string
  draft: PhotoDraft
  onChange: (draft: PhotoDraft) => void
  /** `avatar`: foto da pessoa (recortada em quadrado). `logo`: logo da empresa (inteiro). */
  kind?: ProfileImageKind
  /** `stacked` centraliza tudo em coluna (cartões estreitos). */
  layout?: 'row' | 'stacked'
  disabled?: boolean
}

const texts = {
  avatar: {
    label: 'Foto de perfil',
    hint: 'JPG, PNG ou WebP, até 15 MB. A foto é recortada em formato quadrado.',
    choose: 'Escolher foto',
    change: 'Trocar foto',
    pickAria: 'Escolher foto de perfil',
  },
  logo: {
    label: 'Logo da empresa',
    hint: 'JPG, PNG ou WebP, até 15 MB. O fundo transparente do PNG é mantido.',
    choose: 'Enviar logo',
    change: 'Trocar logo',
    pickAria: 'Escolher o logo da empresa',
  },
}

/**
 * Campo de foto de um formulário de perfil. A imagem escolhida é reduzida na hora e fica só como
 * prévia: quem envia ao Storage é o "Salvar" do formulário (dataStore, saveWithPhoto).
 */
export function PhotoField({ name, currentUrl, draft, onChange, kind = 'avatar', layout = 'row', disabled }: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const hintId = useId()
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const t = texts[kind]
  const isLogo = kind === 'logo'
  const busy = disabled || preparing

  // A prévia é uma URL blob: criada na escolha; libera a memória ao trocar de foto ou sair da tela.
  useEffect(() => {
    if (draft.kind !== 'new') return
    const url = draft.previewUrl
    return () => URL.revokeObjectURL(url)
  }, [draft])

  const shown = draft.kind === 'new' ? draft.previewUrl : draft.kind === 'remove' ? undefined : currentUrl
  const hasImage = !!shown

  const pick = () => {
    if (!busy) inputRef.current?.click()
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Limpa o campo: escolher o mesmo arquivo de novo precisa disparar o evento outra vez.
    e.target.value = ''
    if (!file) return
    setError(null)
    setPreparing(true)
    try {
      const image = await prepareProfileImage(file, kind)
      onChange({ kind: 'new', image, previewUrl: URL.createObjectURL(image.blob) })
    } catch (err) {
      setError(friendlyError(err, 'Não foi possível usar essa imagem. Tente outra.'))
    } finally {
      setPreparing(false)
    }
  }

  const remove = () => {
    setError(null)
    onChange(currentUrl ? { kind: 'remove' } : KEEP_PHOTO)
  }

  const stacked = layout === 'stacked'

  return (
    <div className={cn('flex gap-4 sm:gap-5', stacked ? 'flex-col items-center text-center' : 'items-center')}>
      {/* Clicar na prévia também abre a escolha; pelo teclado, o caminho é o botão ao lado. */}
      <label htmlFor={inputId} className={cn('relative shrink-0', busy ? 'cursor-default' : 'cursor-pointer')}>
        <Avatar
          name={name}
          src={shown}
          size="xl"
          fit={isLogo ? 'contain' : 'cover'}
          className={cn(isLogo && 'rounded-2xl', preparing && 'opacity-60')}
        />
        <span
          aria-hidden="true"
          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-soft ring-4 ring-white dark:ring-slate-800"
        >
          <Camera size={15} />
        </span>
      </label>

      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t.label}</p>
        <p id={hintId} className="mt-0.5 text-xs text-slate-400">
          {t.hint}
        </p>
        <div className={cn('mt-2.5 flex flex-wrap gap-2', stacked && 'justify-center')}>
          <Button type="button" size="sm" variant="secondary" icon={<ImagePlus size={15} />} onClick={pick} disabled={busy} aria-describedby={hintId}>
            {preparing ? 'Preparando...' : hasImage ? t.change : t.choose}
          </Button>
          {hasImage && (
            <Button type="button" size="sm" variant="ghost" icon={<Trash2 size={15} />} onClick={remove} disabled={busy}>
              Remover
            </Button>
          )}
        </div>
        {draft.kind === 'remove' && <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">A imagem atual será removida ao salvar.</p>}
        {error && (
          <p role="alert" className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_IMAGE_INPUT}
        className="hidden"
        tabIndex={-1}
        aria-label={t.pickAria}
        disabled={busy}
        onChange={(e) => void handleFile(e)}
      />
    </div>
  )
}
