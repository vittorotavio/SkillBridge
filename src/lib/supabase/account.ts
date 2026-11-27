import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { userError } from '../errors'

/**
 * "Excluir minha conta". Apagar o próprio login exige a chave de serviço, então passa pela Edge
 * Function `delete-account`, que confere a senha no servidor e apaga o login (o banco remove em
 * cascata perfil, aluno/mentor/administrador e os dados ligados a eles) e as fotos do Storage.
 */
const messages: Record<string, string> = {
  invalid_input: 'Digite a sua senha para confirmar.',
  wrong_password: 'Senha incorreta.',
  last_admin: 'Você é o único administrador da empresa. Adicione outro administrador antes de excluir a sua conta.',
  unauthorized: 'Sua sessão expirou. Entre novamente e tente de novo.',
  rate_limited: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.',
}

export async function deleteOwnAccount(password: string): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { body: { password } })
  if (!error) return
  if (error instanceof FunctionsHttpError) {
    if (error.context.status === 404) throw userError('A exclusão de conta ainda não foi publicada no servidor.')
    const payload = await error.context.json().catch(() => null)
    throw userError(messages[payload?.error] ?? 'Não foi possível excluir a conta. Tente novamente.')
  }
  // No navegador, função não publicada aparece aqui (o preflight CORS recebe 404), não como 404.
  throw userError('Não foi possível acessar o serviço de exclusão de conta. Verifique sua conexão; se continuar, a função "delete-account" ainda não foi publicada no servidor.')
}
