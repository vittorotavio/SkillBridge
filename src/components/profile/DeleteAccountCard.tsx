import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Field'
import { useAuthStore } from '../../store/authStore'
import { deleteOwnAccount } from '../../lib/supabase/account'
import { friendlyError } from '../../lib/errors'
import type { AccountType } from '../../types'

const summary: Record<AccountType, string> = {
  student: 'Apaga o seu login e todos os seus dados da SkillBridge. Não dá para desfazer.',
  mentor: 'Apaga o seu login e todos os seus dados da SkillBridge. Não dá para desfazer.',
  company: 'Apaga o seu login de administrador. A empresa e os dados dela continuam com os outros administradores.',
}

const whatIsDeleted: Record<AccountType, string> = {
  student: 'Seu perfil, matrículas, progresso nos cursos, certificados, candidaturas a vagas, mentorias (inclusive as agendadas) e mensagens.',
  mentor: 'Seu perfil de mentor, horários, mentorias (inclusive as agendadas, que somem para os alunos), mensagens, atividades e anotações.',
  company: 'Só o seu acesso ao painel. A empresa, os treinamentos, os cursos e as vagas continuam com os outros administradores.',
}

interface DeleteAccountCardProps {
  accountType: AccountType
  /** Motivo para não deixar excluir agora (ex.: único administrador da empresa). O servidor confere de novo. */
  blockedReason?: string
}

/** Cartão "Excluir conta" do perfil: confirma com a senha e apaga o login e os dados da pessoa. */
export function DeleteAccountCard({ accountType, blockedReason }: DeleteAccountCardProps) {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (busy) return
    setOpen(false)
    setPassword('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      setError('Digite a sua senha para confirmar.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await deleteOwnAccount(password)
    } catch (err) {
      setError(friendlyError(err, 'Não foi possível excluir a conta. Tente novamente.'))
      setBusy(false)
      return
    }
    // O login não existe mais: esquece a sessão só neste navegador e sai do painel na mesma hora
    // (mesma ordem do "Sair" do Topbar, para a rota protegida não redirecionar antes).
    void logout('local')
    navigate('/login', { replace: true, state: { notice: 'Sua conta foi excluída e os seus dados foram apagados da SkillBridge.' } })
  }

  return (
    <>
      <Card className="border-red-100 dark:border-red-500/20">
        <CardHeader className="mb-2">
          <CardTitle>Excluir conta</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">{blockedReason ?? summary[accountType]}</p>
          <Button variant="danger" className="shrink-0" icon={<Trash2 size={15} />} onClick={() => setOpen(true)} disabled={!!blockedReason}>
            Excluir minha conta
          </Button>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={close}
        title="Excluir sua conta?"
        description="Essa ação não pode ser desfeita."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" form="delete-account-form" variant="destructive" disabled={busy || !password}>
              {busy ? 'Excluindo...' : 'Excluir conta'}
            </Button>
          </>
        }
      >
        <form id="delete-account-form" className="space-y-4" onSubmit={handleSubmit}>
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            <p className="font-semibold">O que será apagado</p>
            <p className="mt-1">{whatIsDeleted[accountType]}</p>
          </div>
          <Input
            label="Digite sua senha para confirmar"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            required
          />
          {error && (
            <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </form>
      </Modal>
    </>
  )
}
