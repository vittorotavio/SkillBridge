import { supabase } from '../../supabaseClient'
import type { MentorMessage } from '../../../types'

interface MentorMessageRow {
  id: string
  mentor_id: string
  aluno_id: string
  remetente_id: string
  conteudo: string
  lido: boolean
  criado_em: string
}

function toMessage(row: MentorMessageRow): MentorMessage {
  return {
    id: row.id,
    mentorId: row.mentor_id,
    studentId: row.aluno_id,
    senderId: row.remetente_id,
    body: row.conteudo,
    read: row.lido,
    createdAt: row.criado_em,
  }
}

export async function fetchMentorMessages(): Promise<MentorMessage[]> {
  const { data, error } = await supabase.from('mensagem_mentoria').select('*').order('criado_em', { ascending: true })
  if (error) throw error
  return (data ?? []).map(toMessage)
}

export async function insertMessageRow(mentorId: string, studentId: string, senderId: string, body: string) {
  const { error } = await supabase
    .from('mensagem_mentoria')
    .insert({ mentor_id: mentorId, aluno_id: studentId, remetente_id: senderId, conteudo: body })
  if (error) throw error
}

/** Marca como lidas as mensagens da conversa que não foram enviadas por quem está lendo. */
export async function markThreadReadRows(mentorId: string, studentId: string, viewerId: string) {
  const { error } = await supabase
    .from('mensagem_mentoria')
    .update({ lido: true })
    .eq('mentor_id', mentorId)
    .eq('aluno_id', studentId)
    .neq('remetente_id', viewerId)
    .eq('lido', false)
  if (error) throw error
}
