import { supabase } from '../../supabaseClient'
import type { MentorActivity } from '../../../types'

interface MentorActivityRow {
  id: string
  mentor_id: string
  aluno_id: string
  titulo: string
  descricao: string | null
  prazo: string | null
  status: MentorActivity['status']
  criado_em: string
  resposta: string | null
  url_resposta: string | null
  entregue_em: string | null
  comentario: string | null
  avaliado_em: string | null
}

function toActivity(row: MentorActivityRow): MentorActivity {
  return {
    id: row.id,
    mentorId: row.mentor_id,
    studentId: row.aluno_id,
    title: row.titulo,
    description: row.descricao ?? undefined,
    dueDate: row.prazo ?? undefined,
    status: row.status,
    createdAt: row.criado_em,
    submission: row.resposta ?? undefined,
    submissionUrl: row.url_resposta ?? undefined,
    submittedAt: row.entregue_em ?? undefined,
    feedback: row.comentario ?? undefined,
    reviewedAt: row.avaliado_em ?? undefined,
  }
}

export async function fetchMentorActivities(): Promise<MentorActivity[]> {
  const { data, error } = await supabase.from('atividade_mentoria').select('*').order('criado_em', { ascending: false })
  if (error) throw error
  return (data ?? []).map(toActivity)
}

export async function insertActivityRow(input: { mentorId: string; studentId: string; title: string; description?: string; dueDate?: string }) {
  const { error } = await supabase.from('atividade_mentoria').insert({
    mentor_id: input.mentorId,
    aluno_id: input.studentId,
    titulo: input.title,
    descricao: input.description || null,
    prazo: input.dueDate || null,
  })
  if (error) throw error
}

export async function updateActivityStatusRow(id: string, status: MentorActivity['status']) {
  const { error } = await supabase.from('atividade_mentoria').update({ status }).eq('id', id)
  if (error) throw error
}

/** Revisão do mentor: aprovar (concluida) ou pedir ajustes (pendente), com comentário opcional. */
export async function reviewActivityRow(id: string, status: Extract<MentorActivity['status'], 'pendente' | 'concluida'>, feedback?: string) {
  const { error } = await supabase
    .from('atividade_mentoria')
    .update({ status, comentario: feedback?.trim() || null, avaliado_em: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteActivityRow(id: string) {
  const { error } = await supabase.from('atividade_mentoria').delete().eq('id', id)
  if (error) throw error
}
