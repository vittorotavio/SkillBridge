import type { ActivityQuestion } from '../types'

/** Resultado da correção: quais perguntas estão certas, se a atividade foi concluída e as explicações. */
export interface ActivityResult {
  correct: boolean[]
  passed: boolean
  /** Só depois do acerto (várias explicações entregariam a resposta). */
  explanations?: (string | null)[]
}

/** O gabarito está disponível no navegador? (só para o admin da empresa ou dados antigos.) */
export function hasAnswerKey(questions: ActivityQuestion[]): boolean {
  return questions.length > 0 && questions.every((q) => Number.isInteger(q.correct))
}

/**
 * Correção local, usada só quando o gabarito está no navegador e a correção no servidor ainda não
 * existe. `answers[i]` = índice da alternativa marcada na pergunta i (undefined = sem resposta).
 */
export function gradeActivity(questions: ActivityQuestion[], answers: (number | undefined)[]): ActivityResult {
  const correct = questions.map((q, i) => q.correct !== undefined && answers[i] === q.correct)
  const passed = questions.length > 0 && correct.every(Boolean)
  return { correct, passed, explanations: passed ? questions.map((q) => q.explanation ?? null) : undefined }
}

/**
 * Limpa uma atividade digitada no editor: tira espaços, descarta alternativas vazias e devolve
 * um erro legível quando a pergunta não pode ser salva.
 */
export function normalizeQuestion(q: ActivityQuestion): { question?: ActivityQuestion; error?: string } {
  const text = q.question.trim()
  const filled = q.options.map((o) => o.trim())
  if (!text && filled.every((o) => !o)) return {}
  if (!text) return { error: 'escreva o enunciado da pergunta' }
  const options = filled.filter(Boolean)
  if (options.length < 2) return { error: `a pergunta "${text}" precisa de pelo menos 2 alternativas` }
  const correctText = q.correct === undefined ? undefined : filled[q.correct]
  if (!correctText) return { error: `marque qual alternativa está certa em "${text}"` }
  if (new Set(options).size !== options.length) return { error: `há alternativas repetidas em "${text}"` }
  return { question: { question: text, options, correct: options.indexOf(correctText), explanation: q.explanation?.trim() || undefined } }
}
