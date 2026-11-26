import { supabase } from '../../supabaseClient'
import type { Availability, Mentor } from '../../../types'
import { userError } from '../../errors'
import { trustedAvatarUrl } from '../storage'

interface MentorRow {
  id: string
  nome: string
  email: string
  url_avatar: string | null
  biografia: string
  habilidade: string[]
  preco_sessao: number | null
  nota: number
  total_avaliacao: number
  empresa_id: string | null
  mentor_programa?: { programa_id: string }[]
  disponibilidade?: { id: string; dia_semana: Availability['weekday']; hora_inicio: string; hora_fim: string; reservado: boolean }[]
}

function toMentor(row: MentorRow): Mentor {
  return {
    id: row.id,
    type: 'mentor',
    name: row.nome,
    email: row.email,
    avatarUrl: trustedAvatarUrl(row.url_avatar, row.id),
    bio: row.biografia,
    skills: row.habilidade ?? [],
    pricePerSession: row.preco_sessao ?? 0,
    rating: row.nota,
    reviewsCount: row.total_avaliacao,
    companyId: row.empresa_id ?? undefined,
    programIds: (row.mentor_programa ?? []).map((mp) => mp.programa_id),
    availability: (row.disponibilidade ?? []).map((a) => ({
      id: a.id,
      weekday: a.dia_semana,
      start: a.hora_inicio.slice(0, 5),
      end: a.hora_fim.slice(0, 5),
      booked: a.reservado,
    })),
  }
}

const SELECT = '*, mentor_programa(programa_id), disponibilidade(*)'

export async function fetchMentors(): Promise<Mentor[]> {
  const { data, error } = await supabase.from('mentor').select(SELECT)
  if (error) throw error
  return (data ?? []).map(toMentor)
}

/**
 * Vitrine pública (tela inicial, inclusive para visitantes): só as colunas exibidas. O `*` também
 * trazia o e-mail de todos os mentores públicos para qualquer pessoa sem login.
 */
export async function fetchPublicMentors(): Promise<Mentor[]> {
  const { data, error } = await supabase
    .from('mentor')
    .select('id, nome, url_avatar, biografia, habilidade, preco_sessao, nota, total_avaliacao, empresa_id')
    .is('empresa_id', null)
  if (error) throw error
  return (data ?? []).map((row) => toMentor({ ...row, email: '' }))
}

export async function fetchMentorById(id: string): Promise<Mentor | null> {
  const { data, error } = await supabase.from('mentor').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toMentor(data) : null
}

export async function insertMentorRow(
  id: string,
  input: { name: string; email: string; bio: string; skills: string[]; companyId?: string; pricePerSession?: number }
) {
  const { error } = await supabase.from('mentor').insert({
    id,
    nome: input.name,
    email: input.email,
    biografia: input.bio,
    habilidade: input.skills,
    empresa_id: input.companyId ?? null,
    preco_sessao: input.pricePerSession ?? 0,
  })
  if (error) throw error
}

export async function updateMentorRow(
  id: string,
  patch: Partial<{ bio: string; skills: string[]; pricePerSession: number; companyId: string | null; avatarUrl: string | null }>
) {
  const fields: Record<string, unknown> = {}
  if (patch.bio !== undefined) fields.biografia = patch.bio
  if (patch.avatarUrl !== undefined) fields.url_avatar = patch.avatarUrl
  if (patch.skills !== undefined) fields.habilidade = patch.skills
  if (patch.pricePerSession !== undefined) fields.preco_sessao = patch.pricePerSession
  if (patch.companyId !== undefined) fields.empresa_id = patch.companyId
  if (Object.keys(fields).length === 0) return
  const { error } = await supabase.from('mentor').update(fields).eq('id', id)
  if (error) throw error
}

export async function insertAvailabilityRow(mentorId: string, slot: Pick<Availability, 'weekday' | 'start' | 'end'>) {
  const { error } = await supabase
    .from('disponibilidade')
    .insert({ mentor_id: mentorId, dia_semana: slot.weekday, hora_inicio: slot.start, hora_fim: slot.end })
  if (error) throw error
}

/** Só remove horário livre: um horário reservado pertence a uma sessão agendada. */
export async function deleteAvailabilityRow(id: string) {
  const { data, error } = await supabase.from('disponibilidade').delete().eq('id', id).eq('reservado', false).select('id')
  if (error) throw error
  // Reservado entre o carregamento da tela e o clique: o filtro não apaga nada e antes isso passava como sucesso.
  if (!data?.length) throw userError('Esse horário acabou de ser reservado por um aluno e não pode mais ser removido.')
}
