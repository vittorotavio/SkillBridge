import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { BrandLink } from '../../components/layout/BrandLink'
import { Footer } from '../../components/layout/Footer'
import { ThemeToggle } from '../../components/ui/ThemeToggle'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Textarea } from '../../components/ui/Field'
import { PhotoField } from '../../components/profile/PhotoField'
import { SkillsInput } from '../../components/profile/SkillsInput'
import { useAuthStore } from '../../store/authStore'
import { useCurrentMentor, useCurrentStudent, useDataStore } from '../../store/dataStore'
import { afterProfileSetupPath, type ProfileSetupOutcome } from '../../lib/profileSetup'
import { KEEP_PHOTO, type PhotoDraft } from '../../lib/profileImage'
import { friendlyError } from '../../lib/errors'
import { cleanName } from '../../lib/validation'
import type { AccountType, Company, Mentor, Student } from '../../types'

const intro: Record<AccountType, { title: string; description: string; laterIn: string }> = {
  student: {
    title: 'Complete seu perfil',
    description: 'Adicione uma foto e conte um pouco sobre você. Seu nome, sua foto e sua bio aparecem para os mentores e para as empresas dos treinamentos em que você estiver.',
    laterIn: 'Meu perfil',
  },
  mentor: {
    title: 'Complete seu perfil',
    description: 'Adicione uma foto e revise o que os alunos veem no seu card quando escolhem um mentor: sua bio e suas especialidades.',
    laterIn: 'Meu perfil',
  },
  company: {
    title: 'Complete o perfil da empresa',
    description: 'Envie o logo da empresa: ele aparece no topo do painel, ao lado do nome.',
    laterIn: 'Configurações da empresa',
  },
}

interface SetupFormProps {
  /** Sai da tela: grava a marca no login e segue para o painel. */
  onFinish: (outcome: ProfileSetupOutcome) => void
  laterIn: string
}

/** Rodapé comum: "Agora não" (pula a etapa) e "Salvar e continuar". */
function SetupActions({ saving, error, onSkip, laterIn }: { saving: boolean; error: string | null; onSkip: () => void; laterIn: string }) {
  return (
    <div className="space-y-4 border-t border-slate-100 pt-5 dark:border-slate-700/60">
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" onClick={onSkip} disabled={saving}>
          Agora não
        </Button>
        <Button type="submit" disabled={saving} iconRight={saving ? undefined : <ArrowRight size={16} />}>
          {saving ? 'Salvando...' : 'Salvar e continuar'}
        </Button>
      </div>
      <p className="text-center text-xs text-slate-400 sm:text-left">Prefere deixar para depois? Você pode editar tudo isso mais tarde em {laterIn}.</p>
    </div>
  )
}

function StudentSetup({ student, onFinish, laterIn }: SetupFormProps & { student: Student }) {
  const updateStudentProfile = useDataStore((s) => s.updateStudentProfile)
  const [photo, setPhoto] = useState<PhotoDraft>(KEEP_PHOTO)
  const [name, setName] = useState(student.name)
  const [bio, setBio] = useState(student.bio ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const cleanedName = cleanName(name)
    if (!cleanedName || cleanedName.length < 3) {
      setError('Informe seu nome completo.')
      return
    }
    const unchanged = photo.kind === 'keep' && cleanedName === student.name && bio.trim() === (student.bio ?? '')
    setSaving(true)
    try {
      if (!unchanged) await updateStudentProfile(student.id, { name: cleanedName, bio: bio.trim() }, photo)
      onFinish('done')
    } catch (err) {
      setError(friendlyError(err, 'Não foi possível salvar o perfil. Tente novamente.'))
      setSaving(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <PhotoField name={name.trim() || student.name} currentUrl={student.avatarUrl} draft={photo} onChange={setPhoto} disabled={saving} />
      <Input label="Nome completo" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={80} autoComplete="name" disabled={saving} />
      <Textarea
        label="Bio"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        maxLength={280}
        placeholder="Conte em poucas linhas o que você estuda e onde quer chegar"
        hint={`${bio.length}/280 caracteres`}
        disabled={saving}
      />
      <SetupActions saving={saving} error={error} onSkip={() => onFinish('skipped')} laterIn={laterIn} />
    </form>
  )
}

function MentorSetup({ mentor, onFinish, laterIn }: SetupFormProps & { mentor: Mentor }) {
  const updateMentorProfile = useDataStore((s) => s.updateMentorProfile)
  const [photo, setPhoto] = useState<PhotoDraft>(KEEP_PHOTO)
  const [bio, setBio] = useState(mentor.bio)
  const [skills, setSkills] = useState<string[]>(mentor.skills)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!bio.trim()) {
      setError('Escreva uma bio: ela aparece para os alunos no seu card.')
      return
    }
    const sameSkills = skills.length === mentor.skills.length && skills.every((s, i) => s === mentor.skills[i])
    const unchanged = photo.kind === 'keep' && bio.trim() === mentor.bio && sameSkills
    setSaving(true)
    try {
      if (!unchanged) await updateMentorProfile(mentor.id, { bio: bio.trim(), skills }, photo)
      onFinish('done')
    } catch (err) {
      setError(friendlyError(err, 'Não foi possível salvar o perfil. Tente novamente.'))
      setSaving(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <PhotoField name={mentor.name} currentUrl={mentor.avatarUrl} draft={photo} onChange={setPhoto} disabled={saving} />
      <Textarea
        label="Bio"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        required
        placeholder="Conte sua experiência e como você pode ajudar os alunos"
        disabled={saving}
      />
      <SkillsInput skills={skills} onChange={setSkills} disabled={saving} />
      <SetupActions saving={saving} error={error} onSkip={() => onFinish('skipped')} laterIn={laterIn} />
    </form>
  )
}

function CompanySetup({ company, onFinish, laterIn }: SetupFormProps & { company: Company }) {
  const updateCompanyProfile = useDataStore((s) => s.updateCompanyProfile)
  const [logo, setLogo] = useState<PhotoDraft>(KEEP_PHOTO)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      if (logo.kind !== 'keep') await updateCompanyProfile(company.id, {}, logo)
      onFinish('done')
    } catch (err) {
      setError(friendlyError(err, 'Não foi possível salvar o logo. Tente novamente.'))
      setSaving(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <PhotoField kind="logo" name={company.name} currentUrl={company.logoUrl} draft={logo} onChange={setLogo} disabled={saving} />
      <SetupActions saving={saving} error={error} onSkip={() => onFinish('skipped')} laterIn={laterIn} />
    </form>
  )
}

/**
 * Primeira tela depois de criar a conta (ver lib/profileSetup.ts): foto e dados básicos do perfil,
 * com "Agora não" para pular. Aparece uma vez; depois, tudo é editado na página de perfil.
 */
export default function CompleteProfile() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const pending = useAuthStore((s) => s.profileSetupPending)
  const finishProfileSetup = useAuthStore((s) => s.finishProfileSetup)
  // Registros mais recentes do dataStore (a cópia do login serve enquanto eles não chegam).
  const student = useCurrentStudent(user?.type === 'student' ? user.id : undefined)
  const mentor = useCurrentMentor(user?.type === 'mentor' ? user.id : undefined)

  if (!user) return null
  const from = (location.state as { from?: unknown } | null)?.from
  const text = intro[user.type]

  const finish = (outcome: ProfileSetupOutcome) => {
    // finishProfileSetup tira a pendência na hora (antes do primeiro await); só depois navega,
    // senão a rota de destino ainda veria a tela pendente e mandaria de volta para cá.
    void finishProfileSetup(outcome)
    navigate(afterProfileSetupPath(from, user.type), { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-primary-100/70 dark:border-slate-800">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <BrandLink />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <Card padding="none" className="mx-auto w-full max-w-xl p-6 sm:p-8">
          {pending && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 size={14} /> Conta criada
            </span>
          )}
          <h1 className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-slate-50">{text.title}</h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{text.description}</p>

          <div className="mt-6">
            {user.type === 'student' && <StudentSetup student={student ?? user} onFinish={finish} laterIn={text.laterIn} />}
            {user.type === 'mentor' && <MentorSetup mentor={mentor ?? user} onFinish={finish} laterIn={text.laterIn} />}
            {user.type === 'company' && <CompanySetup company={user} onFinish={finish} laterIn={text.laterIn} />}
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  )
}
