import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, MailCheck } from 'lucide-react'
import { PublicLayout } from '../layout/PublicLayout'
import { Card } from '../ui/Card'
import { useAuthStore } from '../../store/authStore'
import { listenForSignupConfirmation } from '../../lib/signupHandoff'
import { homePathFor } from '../../lib/routes'
import { cn } from '../../lib/cn'

/**
 * Tela "Confirme seu e-mail" do cadastro. O link do e-mail abre outra aba; se for neste navegador,
 * ela avisa esta aba (lib/signupHandoff.ts) e o cadastro continua aqui, em "Complete seu perfil".
 */
export function EmailConfirmationPending({ email, className }: { email: string; className?: string }) {
  const navigate = useNavigate()
  const refresh = useAuthStore((s) => s.refresh)
  const accountType = useAuthStore((s) => s.accountType)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(
    () =>
      listenForSignupConfirmation(email, () => {
        setConfirmed(true)
        // O Supabase já avisa esta aba do login aberto na outra; o refresh garante, lendo a sessão gravada.
        void refresh()
      }),
    [email, refresh]
  )

  // Com a conta carregada, segue para o painel, que leva a "Complete seu perfil" na primeira vez.
  useEffect(() => {
    if (confirmed && accountType) navigate(homePathFor(accountType), { replace: true })
  }, [confirmed, accountType, navigate])

  return (
    <PublicLayout>
      <div className={cn('mx-auto flex max-w-lg flex-col items-center px-6 py-14', className)}>
        <Card padding="lg" className="w-full text-center">
          {confirmed ? (
            <div role="status">
              <CheckCircle2 className="mx-auto text-emerald-500" size={40} />
              <h1 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-slate-50">E-mail confirmado!</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Abrindo o seu painel...</p>
            </div>
          ) : (
            <>
              <MailCheck className="mx-auto text-primary-600" size={40} />
              <h1 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-slate-50">Confirme seu e-mail</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Enviamos um link de confirmação para <strong>{email}</strong>. Abra o link no e-mail: assim que a conta for confirmada, o
                cadastro continua aqui nesta aba.
              </p>
            </>
          )}
          <Link to="/login" className="mt-6 inline-block font-semibold text-primary-600 hover:underline">
            Ir para o login
          </Link>
        </Card>
      </div>
    </PublicLayout>
  )
}
