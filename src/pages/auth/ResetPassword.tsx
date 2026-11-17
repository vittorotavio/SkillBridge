import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, LinkIcon } from 'lucide-react'
import { PublicLayout } from '../../components/layout/PublicLayout'
import { Card } from '../../components/ui/Card'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { initialAuthRedirect, supabase } from '../../lib/supabaseClient'
import { isRecoverySession, MIN_PASSWORD_LENGTH, onPasswordRecovery, updatePassword } from '../../lib/supabase/passwordRecovery'
import { friendlyError } from '../../lib/errors'
import { useAuthStore } from '../../store/authStore'

type ViewState = { kind: 'checking' } | { kind: 'invalid'; message: string } | { kind: 'form'; email?: string }

/**
 * Página aberta pelo link do e-mail de redefinição. O link abre uma sessão temporária de
 * recuperação; aqui a pessoa define a nova senha e volta para o login.
 */
export default function ResetPassword() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const [view, setView] = useState<ViewState>({ kind: 'checking' })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const decide = async () => {
      if (initialAuthRedirect.error) {
        setView({ kind: 'invalid', message: initialAuthRedirect.error })
        return
      }
      // getSession espera o cliente terminar de ler o link (#access_token=...) da URL.
      const { data } = await supabase.auth.getSession()
      if (!alive) return
      if (data.session && isRecoverySession()) {
        setView({ kind: 'form', email: data.session.user.email })
      } else {
        setView({
          kind: 'invalid',
          message: data.session
            ? 'Para criar uma nova senha, abra o link que enviamos para o seu e-mail.'
            : 'Este link de redefinição não é válido ou expirou. Peça um novo abaixo.',
        })
      }
    }
    void decide()
    const off = onPasswordRecovery(() => void decide())
    return () => {
      alive = false
      off()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }
    if (password !== confirm) {
      setError('As duas senhas não são iguais.')
      return
    }
    setSaving(true)
    try {
      await updatePassword(password)
      // Encerra a sessão do link: a pessoa entra de novo, já com a senha nova e escolhendo o tipo de conta.
      await logout()
      navigate('/login', { replace: true, state: { notice: 'Senha alterada. Entre com a sua nova senha.' } })
    } catch (err) {
      setError(friendlyError(err, 'Não foi possível salvar a nova senha. Tente novamente.'))
      setSaving(false)
    }
  }

  return (
    <PublicLayout>
      <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-6 py-14">
        <Card padding="lg" className="w-full max-w-md">
          {view.kind === 'checking' && (
            <div className="flex flex-col items-center py-8 text-center" role="status">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Validando o link...</p>
            </div>
          )}

          {view.kind === 'invalid' && (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                <LinkIcon size={26} />
              </div>
              <h1 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-slate-50">Link indisponível</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{view.message}</p>
              <div className="mt-6 flex flex-col gap-3">
                <ButtonLink to="/esqueci-senha" fullWidth>
                  Pedir um novo link
                </ButtonLink>
                <ButtonLink to="/login" variant="ghost" fullWidth>
                  Voltar para o login
                </ButtonLink>
              </div>
            </div>
          )}

          {view.kind === 'form' && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
                <KeyRound size={24} />
              </div>
              <h1 className="mt-4 text-2xl font-extrabold text-slate-900 dark:text-slate-50">Criar nova senha</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {view.email ? (
                  <>
                    Defina a nova senha da conta <strong className="text-slate-700 dark:text-slate-200">{view.email}</strong>.
                  </>
                ) : (
                  'Defina a nova senha da sua conta.'
                )}
              </p>
              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <Input
                  label="Nova senha"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  hint={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres.`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Input
                  label="Confirmar nova senha"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
                {error && (
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400" role="alert">
                    {error}
                  </p>
                )}
                <Button type="submit" fullWidth size="lg" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar nova senha'}
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </PublicLayout>
  )
}
