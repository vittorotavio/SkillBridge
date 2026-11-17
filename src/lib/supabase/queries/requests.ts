import { supabase } from '../../supabaseClient'
import type { EnrollmentRequest, MentorInvite } from '../../../types'

interface RequestRow {
  id: string
  aluno_id: string
  empresa_id: string
  programa_id: string
  status: EnrollmentRequest['status']
  solicitado_em: string
}

function toRequest(row: RequestRow): EnrollmentRequest {
  return {
    id: row.id,
    studentId: row.aluno_id,
    companyId: row.empresa_id,
    programId: row.programa_id,
    status: row.status,
    requestedAt: row.solicitado_em.slice(0, 10),
  }
}

export async function fetchEnrollmentRequests(): Promise<EnrollmentRequest[]> {
  const { data, error } = await supabase.from('solicitacao_matricula').select('*')
  if (error) throw error
  return (data ?? []).map(toRequest)
}

export async function updateEnrollmentRequestStatus(id: string, status: EnrollmentRequest['status']) {
  const { error } = await supabase.from('solicitacao_matricula').update({ status }).eq('id', id)
  if (error) throw error
}

interface InviteRow {
  id: string
  empresa_id: string
  nome: string
  email: string
  status: MentorInvite['status']
  convidado_em: string
}

function toInvite(row: InviteRow): MentorInvite {
  return { id: row.id, companyId: row.empresa_id, name: row.nome, email: row.email, status: row.status, invitedAt: row.convidado_em.slice(0, 10) }
}

export async function fetchMentorInvites(): Promise<MentorInvite[]> {
  const { data, error } = await supabase.from('convite_mentor').select('*')
  if (error) throw error
  return (data ?? []).map(toInvite)
}

export async function insertMentorInviteRow(companyId: string, name: string, email: string) {
  const { error } = await supabase.from('convite_mentor').insert({ empresa_id: companyId, nome: name, email })
  if (error) throw error
}

export async function touchMentorInviteRow(id: string) {
  const { error } = await supabase.from('convite_mentor').update({ convidado_em: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteMentorInviteRow(id: string) {
  const { error } = await supabase.from('convite_mentor').delete().eq('id', id)
  if (error) throw error
}
