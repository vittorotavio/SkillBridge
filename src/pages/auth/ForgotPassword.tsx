import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { PublicLayout } from '../../components/layout/PublicLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { requestPasswordReset } from '../../lib/supabase/passwordRecovery'
import { friendlyError } from '../../lib/errors'

/** Intervalo mínimo entre dois envios para o mesmo e-mail (o Supabase recusa antes de 60 s). */
const RESEND_SECONDS = 60

export default function ForgotPassword() {
  // A tela de login passa o e-mail já digitado.
  const initialEmail = (useLocation().state as { email?: string } | null)?.email ?? ''
  const [email, setEmail] = useState(initialEmail)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const send = async (target: string) => {
    setSending(true)
    setError(null)
    try {
      await requestPasswordReset(target)
      setSentTo(target.trim())
      setCooldown(RESEND_SECONDS)
    } catch (err) {
      setError(friendlyError(err, 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <PublicLayout>
      <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-6 py-14">
        <Card padding="lg" className="w-full max-w-md">
          {sentTo ? (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
                <MailCheck size={28} />
              </div>
              <h1 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-slate-50">Confira seu e-mail</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400" role="status">
                Se existir uma conta com <strong className="text-slate-700 dark:text-slate-200">{sentTo}</strong>, enviamos um link para criar uma nova
                senha. O link vale por tempo limitado. Se não encontrar a mensagem, confira a caixa de spam.
              </p>
              {error && <p className="mt-4 text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
              <div className="mt-6 flex flex-col gap-3">
                <Button variant="secondary" fullWidth disabled={cooldown > 0 || sending} onClick={() => send(sentTo)}>
                  {sending ? 'Enviando...' : cooldown > 0 ? `Reenviar em ${cooldown} s` : 'Reenviar e-mail'}
                </Button>
                <button type="button" className="text-sm font-semibold text-primary-600 hover:underline" onClick={() => setSentTo(null)}>
                  Usar outro e-mail
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">Esqueceu sua senha?</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Informe o e-mail da sua conta. Vamos enviar um link para você criar uma nova senha.
              </p>
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  void send(email)
                }}
              >
                <Input
                  label="E-mail"
                  type="email"
                  placeholder="voce@email.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
                <Button type="submit" fullWidth size="lg" disabled={sending}>
                  {sending ? 'Enviando...' : 'Enviar link de redefinição'}
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Lembrou a senha?{' '}
            <Link to="/login" className="font-semibold text-primary-600 hover:underline">
              Voltar para o login
            </Link>
          </p>
        </Card>
      </div>
    </PublicLayout>
  )
}
