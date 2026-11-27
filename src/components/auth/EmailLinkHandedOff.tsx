import { useId } from 'react'
import { CheckCircle2 } from 'lucide-react'
import type { EmailLinkKind } from '../../lib/emailLinkHandoff'

const texts: Record<EmailLinkKind, { title: string; body: string }> = {
  signup: {
    title: 'E-mail confirmado!',
    body: 'O seu cadastro continuou na aba da SkillBridge em que você o começou. Pode fechar esta aba.',
  },
  recovery: {
    title: 'Link validado!',
    body: 'Crie a sua nova senha na aba da SkillBridge em que você pediu o link. Pode fechar esta aba.',
  },
}

/**
 * Aba aberta por um link do e-mail quando a aba que esperava assumiu (lib/emailLinkHandoff.ts). O site
 * tenta fechar esta aba; quando o navegador não deixa, fica este aviso por cima da página.
 */
export function EmailLinkHandedOff({ kind, onContinueHere }: { kind: EmailLinkKind; onContinueHere: () => void }) {
  const titleId = useId()
  const { title, body } = texts[kind]
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-50 px-6 dark:bg-slate-900"
    >
      <div className="max-w-sm text-center">
        <CheckCircle2 className="mx-auto text-emerald-500" size={44} />
        <h1 id={titleId} className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-slate-50">
          {title}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{body}</p>
        <button type="button" onClick={onContinueHere} className="mt-6 text-sm font-semibold text-primary-600 hover:underline">
          Continuar nesta aba
        </button>
      </div>
    </div>
  )
}
