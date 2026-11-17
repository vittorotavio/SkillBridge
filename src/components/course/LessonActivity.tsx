import { useState } from 'react'
import { CheckCircle2, ClipboardCheck, XCircle } from 'lucide-react'
import type { ActivityQuestion } from '../../types'
import type { ActivityResult } from '../../lib/activity'
import { friendlyError } from '../../lib/errors'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'

interface LessonActivityProps {
  questions: ActivityQuestion[]
  /** Aprovação já registrada no servidor (e as respostas marcadas na ocasião, se houver). */
  passed: boolean
  passedAnswers?: number[]
  /** Envia as respostas para correção no servidor. */
  onSubmit: (answers: number[]) => Promise<ActivityResult>
  onPass: () => void
}

/**
 * Atividade de múltipla escolha da aula. O aluno não tem o gabarito: as respostas vão para o
 * servidor, que diz quais estão certas e, quando todas estão, registra a aprovação.
 * Use `key` com a aula atual para zerar o estado ao trocar de aula.
 */
export function LessonActivity({ questions, passed, passedAnswers, onSubmit, onPass }: LessonActivityProps) {
  const [answers, setAnswers] = useState<(number | undefined)[]>(() => (passed && passedAnswers ? [...passedAnswers] : []))
  // Resultado da última correção, junto com as respostas corrigidas (trocar a resposta tira a marca de erro).
  const [checked, setChecked] = useState<{ result: ActivityResult; answers: (number | undefined)[] } | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const result = checked?.result
  const done = passed || !!result?.passed
  const allAnswered = questions.every((_, i) => answers[i] !== undefined)

  const choose = (qi: number, oi: number) => {
    if (done || sending) return
    setError(null)
    setAnswers((a) => {
      const next = [...a]
      next[qi] = oi
      return next
    })
  }

  const verify = async () => {
    setSending(true)
    setError(null)
    try {
      const r = await onSubmit(answers as number[])
      setChecked({ result: r, answers: [...answers] })
      if (r.passed) onPass()
    } catch (err) {
      setError(friendlyError(err, 'Não foi possível corrigir agora. Tente novamente.'))
    } finally {
      setSending(false)
    }
  }

  const isWrong = (qi: number) => !!result && !result.passed && !result.correct[qi] && answers[qi] === checked?.answers[qi]
  const wrongCount = questions.filter((_, i) => isWrong(i)).length

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 p-5 dark:border-slate-700" aria-labelledby="atividade-titulo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="atividade-titulo" className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
          <ClipboardCheck size={18} className="text-primary-500" /> Atividade da aula
        </h2>
        {done && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2 size={12} /> Atividade concluída
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Responda com base no material. É preciso acertar todas para concluir a aula.</p>

      <ol className="mt-4 space-y-5">
        {questions.map((q, qi) => {
          const wrong = isWrong(qi)
          const explanation = done ? result?.explanations?.[qi] : undefined
          return (
            <li key={qi}>
              <fieldset>
                <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {qi + 1}. {q.question}
                </legend>
                <div className="mt-2 space-y-2">
                  {q.options.map((option, oi) => {
                    const selected = answers[qi] === oi
                    return (
                      <label
                        key={oi}
                        className={cn(
                          'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                          done && selected
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                            : selected && wrong
                              ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300'
                              : selected
                                ? 'border-primary-300 bg-primary-50 text-primary-800 dark:border-primary-500/40 dark:bg-primary-500/10 dark:text-primary-200'
                                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/40',
                          done && 'cursor-default'
                        )}
                      >
                        <input
                          type="radio"
                          name={`pergunta-${qi}`}
                          className="mt-0.5 accent-primary-600"
                          checked={selected}
                          disabled={done || sending}
                          onChange={() => choose(qi, oi)}
                        />
                        <span>{option}</span>
                      </label>
                    )
                  })}
                </div>
                {wrong && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                    <XCircle size={13} /> Resposta incorreta. Releia o material e tente outra alternativa.
                  </p>
                )}
                {explanation && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{explanation}</p>}
              </fieldset>
            </li>
          )
        })}
      </ol>

      {!done && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button size="sm" disabled={!allAnswered || sending} onClick={verify}>
            {sending ? 'Corrigindo...' : 'Verificar respostas'}
          </Button>
          {wrongCount > 0 && (
            <span className="text-xs font-semibold text-red-600 dark:text-red-400" role="status">
              {wrongCount === 1 ? '1 resposta incorreta.' : `${wrongCount} respostas incorretas.`}
            </span>
          )}
          {!allAnswered && <span className="text-xs text-slate-400">Responda todas as perguntas para verificar.</span>}
        </div>
      )}
      {error && <p className="mt-3 text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
    </section>
  )
}
