import { supabase } from '../../supabaseClient'
import type { ActivityPass, LessonProgress } from '../../../types'

interface ActivityPassRow {
  aluno_id: string
  curso_id: string
  indice_modulo: number
  indice_aula: number
  respostas: number[]
}

/** Atividades aprovadas (o RLS devolve as do aluno logado; para o admin, as dos cursos da empresa). */
export async function fetchActivityPasses(): Promise<ActivityPass[]> {
  const { data, error } = await supabase.from('aprovacao_atividade_aula').select('aluno_id, curso_id, indice_modulo, indice_aula, respostas')
  // Tabela ainda não criada no banco: sem aprovações registradas.
  if (error?.code === 'PGRST205') return []
  if (error) throw error
  return (data ?? []).map((row: ActivityPassRow) => ({
    studentId: row.aluno_id,
    courseId: row.curso_id,
    moduleIndex: row.indice_modulo,
    lessonIndex: row.indice_aula,
    answers: row.respostas ?? [],
  }))
}

interface LessonProgressRow {
  aluno_id: string
  curso_id: string
  indice_modulo: number
  indice_aula: number
}

export async function fetchLessonProgress(): Promise<LessonProgress[]> {
  const { data, error } = await supabase.from('progresso_aula').select('aluno_id, curso_id, indice_modulo, indice_aula')
  if (error) throw error
  return (data ?? []).map((row: LessonProgressRow) => ({
    studentId: row.aluno_id,
    courseId: row.curso_id,
    moduleIndex: row.indice_modulo,
    lessonIndex: row.indice_aula,
  }))
}
