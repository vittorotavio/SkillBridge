import type { AccountType } from '../types'
import { accountTypeForPath, homePathFor } from './routes'

/**
 * Tela "Complete seu perfil", mostrada uma vez para quem acabou de criar a conta. O cadastro grava
 * `profile_setup: 'pending'` nos metadados do login (Supabase Auth, user_metadata); "Agora não" e
 * "Salvar e continuar" trocam a marca para 'skipped'/'done'. Contas criadas antes desta tela (e as
 * criadas pela empresa, pela Edge Function) não têm a marca e nunca a veem.
 */
export const PROFILE_SETUP_PATH = '/completar-perfil'
export const PROFILE_SETUP_KEY = 'profile_setup'

export type ProfileSetupOutcome = 'done' | 'skipped'

/** Metadados do cadastro de uma conta nova: entra já com a tela pendente. */
export const PROFILE_SETUP_PENDING = { [PROFILE_SETUP_KEY]: 'pending' } as const

export function isProfileSetupPending(metadata: unknown): boolean {
  return typeof metadata === 'object' && metadata !== null && (metadata as Record<string, unknown>)[PROFILE_SETUP_KEY] === 'pending'
}

/**
 * Para onde seguir depois da tela: a página do painel que a pessoa tentou abrir (se for do próprio
 * tipo de conta e do próprio app) ou o início do painel.
 */
export function afterProfileSetupPath(from: unknown, type: AccountType): string {
  const internal = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
  return internal && accountTypeForPath(from) === type ? from : homePathFor(type)
}
