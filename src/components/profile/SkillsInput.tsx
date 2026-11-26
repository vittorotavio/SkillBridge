import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '../ui/Button'

/** Especialidades do mentor em "etiquetas": digita, Enter (ou "Adicionar") e remove no X. */
export function SkillsInput({ skills, onChange, disabled }: { skills: string[]; onChange: (skills: string[]) => void; disabled?: boolean }) {
  const [newSkill, setNewSkill] = useState('')

  const addSkill = () => {
    const skill = newSkill.trim()
    if (!skill) return
    if (!skills.some((s) => s.toLowerCase() === skill.toLowerCase())) onChange([...skills, skill])
    setNewSkill('')
  }

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Especialidades / skills</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span key={skill} className="flex items-center gap-1.5 rounded-full bg-primary-50 dark:bg-primary-500/10 px-3 py-1.5 text-xs font-semibold text-primary-600">
            {skill}
            <button
              type="button"
              onClick={() => onChange(skills.filter((x) => x !== skill))}
              disabled={disabled}
              className="text-primary-300 hover:text-red-500"
              aria-label={`Remover ${skill}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {skills.length === 0 && <span className="text-xs text-slate-400">Nenhuma especialidade ainda.</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={newSkill}
          onChange={(e) => setNewSkill(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
          placeholder="Adicionar especialidade"
          aria-label="Nova especialidade"
          maxLength={40}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3.5 py-2.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
        />
        <Button type="button" variant="secondary" icon={<Plus size={15} />} onClick={addSkill} disabled={disabled}>
          Adicionar
        </Button>
      </div>
    </div>
  )
}
