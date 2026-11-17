import { supabase } from '../../supabaseClient'
import type { Program } from '../../../types'
import { diffIds } from '../../catalog'

interface ProgramRow {
  id: string
  empresa_id: string
  nome: string
  data_inicio: string
  data_fim: string
  descricao: string | null
  curso_programa?: { curso_id: string }[]
  mentor_programa?: { mentor_id: string }[]
  aluno?: { id: string }[]
}

function toProgram(row: ProgramRow): Program {
  return {
    id: row.id,
    companyId: row.empresa_id,
    name: row.nome,
    startDate: row.data_inicio,
    endDate: row.data_fim,
    description: row.descricao ?? undefined,
    courseIds: (row.curso_programa ?? []).map((cp) => cp.curso_id),
    mentorIds: (row.mentor_programa ?? []).map((mp) => mp.mentor_id),
    studentIds: (row.aluno ?? []).map((s) => s.id),
  }
}

const SELECT = '*, curso_programa(curso_id), mentor_programa(mentor_id), aluno(id)'

export async function fetchPrograms(): Promise<Program[]> {
  const { data, error } = await supabase.from('programa').select(SELECT)
  if (error) throw error
  return (data ?? []).map(toProgram)
}

export async function insertProgramRow(input: Omit<Program, 'id'>): Promise<string> {
  // Id gerado aqui e insert sem .select(): o RETURNING passaria pela política de leitura, cuja função
  // (fn_program_visible) consulta a própria tabela e ainda não enxerga a linha nova — o Postgres recusava o insert.
  const programId = crypto.randomUUID()
  const { error } = await supabase
    .from('programa')
    .insert({
      id: programId,
      empresa_id: input.companyId,
      nome: input.name,
      data_inicio: input.startDate,
      data_fim: input.endDate,
      descricao: input.description ?? null,
    })
  if (error) throw error
  if (input.courseIds.length) {
    const { error: cpErr } = await supabase.from('curso_programa').insert(input.courseIds.map((cid) => ({ curso_id: cid, programa_id: programId })))
    if (cpErr) throw cpErr
  }
  if (input.mentorIds.length) {
    const { error: mpErr } = await supabase.from('mentor_programa').insert(input.mentorIds.map((mid) => ({ mentor_id: mid, programa_id: programId })))
    if (mpErr) throw mpErr
  }
  if (input.studentIds.length) {
    const { error: stErr } = await supabase.from('aluno').update({ empresa_id: input.companyId, programa_id: programId }).in('id', input.studentIds)
    if (stErr) throw stErr
  }
  return programId
}

export async function updateProgramRow(id: string, patch: Partial<Program>) {
  const fields: Record<string, unknown> = {}
  if (patch.name !== undefined) fields.nome = patch.name
  if (patch.startDate !== undefined) fields.data_inicio = patch.startDate
  if (patch.endDate !== undefined) fields.data_fim = patch.endDate
  if (patch.description !== undefined) fields.descricao = patch.description ?? null
  if (Object.keys(fields).length) {
    const { error } = await supabase.from('programa').update(fields).eq('id', id)
    if (error) throw error
  }
  if (patch.courseIds) {
    const { error: delErr } = await supabase.from('curso_programa').delete().eq('programa_id', id)
    if (delErr) throw delErr
    if (patch.courseIds.length) {
      const { error } = await supabase.from('curso_programa').insert(patch.courseIds.map((cid) => ({ curso_id: cid, programa_id: id })))
      if (error) throw error
    }
  }
  if (patch.mentorIds) {
    const { error: delErr } = await supabase.from('mentor_programa').delete().eq('programa_id', id)
    if (delErr) throw delErr
    if (patch.mentorIds.length) {
      const { error } = await supabase.from('mentor_programa').insert(patch.mentorIds.map((mid) => ({ mentor_id: mid, programa_id: id })))
      if (error) throw error
    }
  }
}

/**
 * Deixa no treinamento exatamente os alunos de `studentIds`. Só mexe na diferença: antes desvinculava
 * todos e vinculava de novo, então uma falha no segundo passo deixava o treinamento sem nenhum aluno.
 */
export async function setProgramStudentsRows(programId: string, companyId: string, studentIds: string[], currentIds: string[]) {
  const { toAdd, toRemove } = diffIds(currentIds, studentIds)
  if (toAdd.length) {
    const { error } = await supabase.from('aluno').update({ empresa_id: companyId, programa_id: programId }).in('id', toAdd)
    if (error) throw error
  }
  if (toRemove.length) {
    const { error } = await supabase
      .from('aluno')
      .update({ empresa_id: null, programa_id: null })
      .eq('programa_id', programId)
      .in('id', toRemove)
    if (error) throw error
  }
}
