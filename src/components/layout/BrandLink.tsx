import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'
import logo from '../../assets/logo.svg'

interface BrandLinkProps {
  className?: string
  /** Sobrescreve a cor do nome (ex: o certificado, que é sempre claro, mesmo no tema escuro). */
  textClassName?: string
  onClick?: () => void
}

/** Logo + nome da plataforma. Em todo lugar em que aparece, leva para a página inicial. */
export function BrandLink({ className, textClassName, onClick }: BrandLinkProps) {
  return (
    <Link
      to="/"
      onClick={onClick}
      title="Ir para a página inicial"
      aria-label="SkillBridge, página inicial"
      className={cn('inline-flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80', className)}
    >
      <img src={logo} alt="" className="h-9 w-auto" />
      <span className={cn('text-lg font-extrabold text-slate-900 dark:text-slate-50', textClassName)}>SkillBridge</span>
    </Link>
  )
}
