import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Footer } from './Footer'
import { BrandLink } from './BrandLink'
import { ButtonLink } from '../ui/Button'
import { ThemeToggle } from '../ui/ThemeToggle'
import { useAuthStore } from '../../store/authStore'
import { homePathFor } from '../../lib/routes'
import { RESET_PASSWORD_PATH } from '../../lib/supabase/passwordRecovery'
import { cn } from '../../lib/cn'

/** Layout para telas públicas/institucionais (Landing, Login, Cadastro). Sempre fecha com Footer. */
export function PublicLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const sessionLoading = useAuthStore((s) => s.loading)
  const accountType = useAuthStore((s) => s.accountType)
  // Quem já entrou vê um botão de volta ao próprio painel no lugar de "Entrar"/"Criar conta". Na troca
  // de senha pelo link do e-mail a sessão serve só para isso (no fim a tela desconecta), então ali o
  // cabeçalho continua o de visitante.
  const panelPath = accountType && pathname !== RESET_PASSWORD_PATH ? homePathFor(accountType) : null

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-primary-100/70 bg-surface/90 backdrop-blur dark:border-slate-800">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <BrandLink />

          <nav className="hidden items-center gap-8 md:flex">
            <Link to="/#cursos" className="text-sm font-semibold text-slate-600 hover:text-primary-700 dark:text-slate-300 dark:hover:text-primary-300">
              Cursos
            </Link>
            <Link to="/#mentoria" className="text-sm font-semibold text-slate-600 hover:text-primary-700 dark:text-slate-300 dark:hover:text-primary-300">
              Mentoria
            </Link>
            <Link to="/#empresas" className="text-sm font-semibold text-slate-600 hover:text-primary-700 dark:text-slate-300 dark:hover:text-primary-300">
              Para empresas
            </Link>
            <Link to="/#depoimentos" className="text-sm font-semibold text-slate-600 hover:text-primary-700 dark:text-slate-300 dark:hover:text-primary-300">
              Depoimentos
            </Link>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            {panelPath ? (
              <ButtonLink to={panelPath} variant="cta" size="sm" icon={<LayoutDashboard size={16} />}>
                Voltar ao painel
              </ButtonLink>
            ) : (
              // Enquanto a sessão é restaurada (F5), os botões de visitante ocupam o lugar sem aparecer:
              // assim quem está logado não vê "Entrar" piscar antes do botão do painel.
              <div className={cn('flex items-center gap-2', sessionLoading && 'invisible')}>
                <ButtonLink to="/login" variant="ghost" size="sm">
                  Entrar
                </ButtonLink>
                <ButtonLink to="/cadastro" variant="cta" size="sm">
                  Criar conta grátis
                </ButtonLink>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <button className="p-2 text-slate-600 dark:text-slate-300" onClick={() => setOpen((v) => !v)} aria-label="Abrir menu">
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="space-y-1 border-t border-primary-100/70 px-6 py-4 md:hidden dark:border-slate-800">
            <Link to="/#cursos" onClick={() => setOpen(false)} className="block py-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Cursos
            </Link>
            <Link to="/#mentoria" onClick={() => setOpen(false)} className="block py-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Mentoria
            </Link>
            <Link to="/#empresas" onClick={() => setOpen(false)} className="block py-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Para empresas
            </Link>
            <Link to="/#depoimentos" onClick={() => setOpen(false)} className="block py-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Depoimentos
            </Link>
            {panelPath ? (
              <div className="mt-3">
                <ButtonLink to={panelPath} variant="cta" size="sm" fullWidth icon={<LayoutDashboard size={16} />}>
                  Voltar ao painel
                </ButtonLink>
              </div>
            ) : (
              <div className="mt-3 flex gap-3">
                <ButtonLink to="/login" className="flex-1" variant="secondary" size="sm" fullWidth>
                  Entrar
                </ButtonLink>
                <ButtonLink to="/cadastro" className="flex-1" variant="cta" size="sm" fullWidth>
                  Criar conta
                </ButtonLink>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
