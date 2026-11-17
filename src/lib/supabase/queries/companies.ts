import { supabase } from '../../supabaseClient'
import type { Company } from '../../../types'

interface CompanyRow {
  id: string
  nome: string
  razao_social: string
  cnpj: string
  email: string
  setor: string
  url_logo: string | null
  administrador_empresa?: { id: string; nome: string; email: string; cargo: string }[]
}

function toCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    type: 'company',
    name: row.nome,
    email: row.email,
    cnpj: row.cnpj,
    razaoSocial: row.razao_social,
    logoUrl: row.url_logo ?? undefined,
    sector: row.setor,
    adminUsers: (row.administrador_empresa ?? []).map((a) => ({ id: a.id, name: a.nome, email: a.email, role: a.cargo })),
  }
}

const SELECT = '*, administrador_empresa(id, nome, email, cargo)'

export async function fetchCompanies(): Promise<Company[]> {
  const { data, error } = await supabase.from('empresa').select(SELECT)
  if (error) throw error
  return (data ?? []).map(toCompany)
}

export async function fetchCompanyById(id: string): Promise<Company | null> {
  const { data, error } = await supabase.from('empresa').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toCompany(data) : null
}

export async function insertCompanyRow(
  id: string,
  input: { name: string; razaoSocial: string; cnpj: string; email: string; sector: string }
) {
  const { error } = await supabase.from('empresa').insert({
    id,
    nome: input.name,
    razao_social: input.razaoSocial,
    cnpj: input.cnpj,
    email: input.email,
    setor: input.sector,
  })
  if (error) throw error
}

export async function insertCompanyAdminRow(id: string, companyId: string, name: string, email: string, role = 'Admin Plataforma') {
  const { error } = await supabase.from('administrador_empresa').insert({ id, empresa_id: companyId, nome: name, email, cargo: role })
  if (error) throw error
}

export async function updateCompanyRow(
  id: string,
  patch: Partial<{ name: string; razaoSocial: string; sector: string; email: string; logoUrl: string }>
) {
  const fields: Record<string, unknown> = {}
  if (patch.name !== undefined) fields.nome = patch.name
  if (patch.razaoSocial !== undefined) fields.razao_social = patch.razaoSocial
  if (patch.sector !== undefined) fields.setor = patch.sector
  if (patch.email !== undefined) fields.email = patch.email
  if (patch.logoUrl !== undefined) fields.url_logo = patch.logoUrl
  if (Object.keys(fields).length === 0) return
  const { error } = await supabase.from('empresa').update(fields).eq('id', id)
  if (error) throw error
}
