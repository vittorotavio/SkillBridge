import { useId } from 'react'
import { CheckCircle2 } from 'lucide-react'

/**
 * Aba aberta pelo link de confirmação quando a aba do cadastro assumiu (lib/signupHandoff.ts). O site
 * tenta fechar esta aba; quando o navegador não deixa, fica este aviso por cima da página.
 */
export function SignupHandedOff({ onContinueHere }: { onContinueHere: () => void }) {
  const titleId = useId()
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
          E-mail confirmado!
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          O seu cadastro continuou na aba da SkillBridge em que você o começou. Pode fechar esta aba.
        </p>
        <button type="button" onClick={onContinueHere} className="mt-6 text-sm font-semibold text-primary-600 hover:underline">
          Continuar nesta aba
        </button>
      </div>
    </div>
  )
}
