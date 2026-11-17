import { supabase } from '../../supabaseClient'
import type { Job, JobApplication } from '../../../types'

interface JobRow {
  id: string
  empresa_id: string
  titulo: string
  descricao: string
  requisito: string[]
  departamento: string
  tipo: Job['type']
  modalidade: Job['mode']
  localizacao: string | null
  status: Job['status']
  total_candidatura: number
  criado_em: string
  vaga_programa?: { programa_id: string }[]
}

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    companyId: row.empresa_id,
    title: row.titulo,
    description: row.descricao,
    requirements: row.requisito ?? [],
    department: row.departamento,
    type: row.tipo,
    mode: row.modalidade,
    location: row.localizacao ?? '',
    programIds: (row.vaga_programa ?? []).map((jp) => jp.programa_id),
    status: row.status,
    applicationsCount: row.total_candidatura,
    createdAt: row.criado_em.slice(0, 10),
  }
}

const SELECT = '*, vaga_programa(programa_id)'

export async function fetchJobs(): Promise<Job[]> {
  const { data, error } = await supabase.from('vaga').select(SELECT)
  if (error) throw error
  return (data ?? []).map(toJob)
}

export async function insertJobRow(input: Omit<Job, 'id' | 'applicationsCount' | 'createdAt'>) {
  // Id gerado aqui e insert sem .select(): o RETURNING passaria pela política de leitura, cuja função
  // (fn_job_visible) consulta a própria tabela e ainda não enxerga a linha nova — o Postgres recusava o insert.
  const jobId = crypto.randomUUID()
  const { error } = await supabase
    .from('vaga')
    .insert({
      id: jobId,
      empresa_id: input.companyId,
      titulo: input.title,
      descricao: input.description,
      requisito: input.requirements,
      departamento: input.department,
      tipo: input.type,
      modalidade: input.mode,
      localizacao: input.location,
      status: input.status,
    })
  if (error) throw error
  if (input.programIds.length) {
    const { error: jpErr } = await supabase.from('vaga_programa').insert(input.programIds.map((pid) => ({ vaga_id: jobId, programa_id: pid })))
    if (jpErr) throw jpErr
  }
}

export async function updateJobRow(id: string, patch: Partial<Job>) {
  const fields: Record<string, unknown> = {}
  if (patch.title !== undefined) fields.titulo = patch.title
  if (patch.description !== undefined) fields.descricao = patch.description
  if (patch.requirements !== undefined) fields.requisito = patch.requirements
  if (patch.department !== undefined) fields.departamento = patch.department
  if (patch.type !== undefined) fields.tipo = patch.type
  if (patch.mode !== undefined) fields.modalidade = patch.mode
  if (patch.location !== undefined) fields.localizacao = patch.location
  if (patch.status !== undefined) fields.status = patch.status
  if (Object.keys(fields).length) {
    const { error } = await supabase.from('vaga').update(fields).eq('id', id)
    if (error) throw error
  }
  if (patch.programIds) {
    const { error: delErr } = await supabase.from('vaga_programa').delete().eq('vaga_id', id)
    if (delErr) throw delErr
    if (patch.programIds.length) {
      const { error } = await supabase.from('vaga_programa').insert(patch.programIds.map((pid) => ({ vaga_id: id, programa_id: pid })))
      if (error) throw error
    }
  }
}

export async function deleteJobRow(id: string) {
  const { error } = await supabase.from('vaga').delete().eq('id', id)
  if (error) throw error
}

interface JobApplicationRow {
  id: string
  vaga_id: string
  aluno_id: string
  status: JobApplication['status']
  candidatado_em: string
}

export async function fetchJobApplications(): Promise<JobApplication[]> {
  const { data, error } = await supabase.from('candidatura').select('*')
  if (error) throw error
  return (data ?? []).map((row: JobApplicationRow) => ({
    id: row.id,
    jobId: row.vaga_id,
    studentId: row.aluno_id,
    status: row.status,
    appliedAt: row.candidatado_em.slice(0, 10),
  }))
}
