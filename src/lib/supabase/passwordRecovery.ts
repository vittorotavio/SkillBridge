import { initialAuthRedirect, supabase } from '../supabaseClient'
import { friendlyError, userError } from '../errors'

export const RESET_PASSWORD_PATH = '/redefinir-senha'
export const MIN_PASSWORD_LENGTH = 6

/**
 * A sessão atual veio de um link de redefinição de senha? Vale o "#...type=recovery" lido na
 * abertura do app e também o evento PASSWORD_RECOVERY, que o cliente emite ao abrir essa sessão.
 */
let recoverySession = initialAuthRedirect.isRecovery
const listeners = new Set<() => void>()

const { data: recoveryListener } = supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    recoverySession = true
    listeners.forEach((fn) => fn())
  }
  if (event === 'SIGNED_OUT') recoverySession = false
})
import.meta.hot?.dispose(() => recoveryListener.subscription.unsubscribe())

export function isRecoverySession(): boolean {
  return recoverySession
}

/**
 * A aba que esperava em "Confira seu e-mail" assumiu o link aberto em outra aba (lib/emailLinkHandoff.ts).
 * A sessão já está no localStorage compartilhado; o evento PASSWORD_RECOVERY repassado pelo Supabase
 * pode chegar antes ou depois deste aviso, então a aba marca a sessão por conta própria.
 */
export function markRecoverySession() {
  recoverySession = true
  listeners.forEach((fn) => fn())
}

/** Avisa quando um link de redefinição abre a sessão (para levar o usuário à página de nova senha). */
export function onPasswordRecovery(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Envia o e-mail com o link para criar uma nova senha. Por segurança, o Supabase responde igual
 * existindo ou não uma conta com o e-mail (não dá para descobrir quem está cadastrado).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}${RESET_PASSWORD_PATH}`,
  })
  if (error) throw userError(friendlyError(error, 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.'))
}

/** Grava a nova senha na sessão aberta pelo link do e-mail. */
export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw userError(friendlyError(error, 'Não foi possível salvar a nova senha. Peça um novo link e tente de novo.'))
}
