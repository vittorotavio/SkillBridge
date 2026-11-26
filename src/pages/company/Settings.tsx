import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { CompanySidebar } from '../../components/layout/CompanySidebar'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Field'
import { Avatar } from '../../components/ui/Avatar'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { PhotoField } from '../../components/profile/PhotoField'
import { useAuthStore } from '../../store/authStore'
import { useDataStore } from '../../store/dataStore'
import { supabase } from '../../lib/supabaseClient'
import { SECTORS } from '../../lib/catalog'
import { friendlyError } from '../../lib/errors'
import { KEEP_PHOTO, type PhotoDraft } from '../../lib/profileImage'
import { cleanName } from '../../lib/validation'
import type { Company } from '../../types'

/** Cartão "Identidade": envio do logo (Storage), salvo à parte dos dados cadastrais. */
function IdentityCard({ company, displayName }: { company: Company; displayName: string }) {
  const updateCompanyProfile = useDataStore((s) => s.updateCompanyProfile)
  const [logo, setLogo] = useState<PhotoDraft>(KEEP_PHOTO)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await updateCompanyProfile(company.id, {}, logo)
      setLogo(KEEP_PHOTO)
      setSaved(true)
    } catch (err) {
      setError(friendlyError(err, 'Não foi possível salvar o logo. Tente novamente.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identidade</CardTitle>
      </CardHeader>
      <div className="rounded-xl bg-primary-50/60 p-5 dark:bg-primary-500/10">
        <PhotoField
          kind="logo"
          layout="stacked"
          name={displayName}
          currentUrl={company.logoUrl}
          draft={logo}
          onChange={(draft) => {
            setLogo(draft)
            setSaved(false)
            setError(null)
          }}
          disabled={saving}
        />
        <div className="mt-4 text-center">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{displayName}</p>
          <p className="text-xs text-slate-400">{company.cnpj}</p>
        </div>
      </div>
      {logo.kind !== 'keep' && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void save()} disabled={saving}>
            {saving ? 'Salvando...' : logo.kind === 'remove' ? 'Remover logo' : 'Salvar logo'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setLogo(KEEP_PHOTO)} disabled={saving}>
            Cancelar
          </Button>
        </div>
      )}
      {saved && <p className="mt-3 text-sm font-semibold text-emerald-600">Logo atualizado!</p>}
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </Card>
  )
}

export default function CompanySettings() {
  const authUser = useAuthStore((s) => s.user)
  const company = authUser?.type === 'company' ? authUser : undefined
  const updateCompanyProfile = useDataStore((s) => s.updateCompanyProfile)
  const addCompanyAdmin = useDataStore((s) => s.addCompanyAdmin)
  const removeCompanyAdmin = useDataStore((s) => s.removeCompanyAdmin)

  const [newAdminName, setNewAdminName] = useState('')
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminRole, setNewAdminRole] = useState('Administrador')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [adminAdded, setAdminAdded] = useState(false)
  const [toRemove, setToRemove] = useState<{ id: string; name: string } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  /** Login de quem está usando o painel: não pode remover o próprio acesso. */
  const [myAdminId, setMyAdminId] = useState<string | null>(null)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setMyAdminId(data.session?.user.id ?? null))
  }, [])

  const [name, setName] = useState(company?.name ?? '')
  const [razaoSocial, setRazaoSocial] = useState(company?.razaoSocial ?? '')
  const [sector, setSector] = useState<string>(company?.sector ?? SECTORS[0])
  const [email, setEmail] = useState(company?.email ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!company) return null

  const admins = company.adminUsers

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminError(null)
    setAdminAdded(false)
    const adminName = cleanName(newAdminName)
    if (!adminName) {
      setAdminError('Informe o nome do administrador.')
      return
    }
    setAddingAdmin(true)
    try {
      await addCompanyAdmin({ name: adminName, email: newAdminEmail.trim().toLowerCase(), password: newAdminPassword, role: newAdminRole.trim() || 'Administrador' })
      setNewAdminName('')
      setNewAdminEmail('')
      setNewAdminPassword('')
      setNewAdminRole('Administrador')
      setAdminAdded(true)
    } catch (err) {
      setAdminError(friendlyError(err, 'Não foi possível adicionar o administrador.'))
    } finally {
      setAddingAdmin(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(false)
    setSaveError(null)
    const cleanFantasia = cleanName(name)
    const cleanRazao = cleanName(razaoSocial)
    if (!cleanFantasia || !cleanRazao) {
      setSaveError('Preencha nome fantasia e razão social.')
      return
    }
    setSaving(true)
    try {
      await updateCompanyProfile(company.id, { name: cleanFantasia, razaoSocial: cleanRazao, sector, email: email.trim() })
      setSaved(true)
    } catch (err) {
      setSaveError(friendlyError(err, 'Não foi possível salvar. Verifique os dados e tente novamente.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout sidebar={<CompanySidebar />} profileTitle="Painel da Empresa">
      <PageHeader title="Configurações da Empresa" description="Dados cadastrais, identidade visual e administradores do painel." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Dados cadastrais</CardTitle>
          </CardHeader>
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Nome fantasia" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input label="CNPJ" defaultValue={company.cnpj} disabled />
            </div>
            <Input label="Razão social" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} required />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="Setor" value={sector} onChange={(e) => setSector(e.target.value)}>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Input label="E-mail corporativo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
              {saved && <span className="text-sm font-semibold text-emerald-600">Salvo!</span>}
              {saveError && <span className="text-sm font-semibold text-red-600 dark:text-red-400">{saveError}</span>}
            </div>
          </form>
        </Card>

        <IdentityCard company={company} displayName={name.trim() || company.name} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Usuários administradores do painel</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {admins.map((admin) => (
            <div key={admin.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-700/60 p-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={admin.name} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {admin.name}
                    {admin.id === myAdminId && <span className="ml-2 text-xs font-normal text-slate-400">(você)</span>}
                  </p>
                  <p className="text-xs text-slate-400">{admin.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 dark:bg-slate-700/60 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{admin.role}</span>
                {myAdminId && admin.id !== myAdminId && (
                  <button
                    onClick={() => setToRemove({ id: admin.id, name: admin.name })}
                    className="text-slate-300 hover:text-red-500"
                    aria-label={`Remover ${admin.name}`}
                    title="Remover acesso"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <form className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-700/60" onSubmit={addAdmin}>
          <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Adicionar administrador</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Nome" value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} placeholder="Nome completo" required />
            <Input label="E-mail" type="email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="email@empresa.com" required />
            <Input label="Cargo" value={newAdminRole} onChange={(e) => setNewAdminRole(e.target.value)} placeholder="Ex: Gerente de RH" />
            <Input
              label="Senha provisória"
              type="password"
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="submit" icon={<Plus size={15} />} disabled={addingAdmin}>
              {addingAdmin ? 'Adicionando...' : 'Adicionar'}
            </Button>
            {adminAdded && <span className="text-sm font-semibold text-emerald-600">Administrador criado! Envie o e-mail e a senha provisória para ele.</span>}
            {adminError && <span className="text-sm font-semibold text-red-600 dark:text-red-400">{adminError}</span>}
          </div>
          <p className="mt-3 text-xs text-slate-400">O novo administrador entra pela aba Empresa com esse e-mail e a senha provisória.</p>
        </form>
      </Card>

      <ConfirmDialog
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={async () => {
          if (toRemove) await removeCompanyAdmin(toRemove.id)
        }}
        title={`Remover ${toRemove?.name ?? ''}?`}
        description="Essa pessoa perde o acesso ao painel da empresa e o login dela é excluído."
        confirmLabel="Remover"
        danger
      />
    </DashboardLayout>
  )
}
