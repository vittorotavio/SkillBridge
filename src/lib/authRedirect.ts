/**
 * Lê o retorno de um link de e-mail do Supabase Auth. O link de redefinição de senha chega como
 * "#access_token=...&type=recovery"; link vencido ou já usado chega como
 * "#error=access_denied&error_code=otp_expired&error_description=..." (às vezes na query string).
 */
export interface AuthRedirect {
  isRecovery: boolean
  /** Mensagem pronta para a tela quando o link veio com erro. */
  error: string | null
}

export function parseAuthRedirect(hash: string, search: string): AuthRedirect {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const query = new URLSearchParams(search.replace(/^\?/, ''))
  const get = (key: string) => params.get(key) ?? query.get(key)

  const errorCode = get('error_code')
  const errorDescription = get('error_description')
  let error: string | null = null
  if (errorCode === 'otp_expired' || /expired|invalid/i.test(errorDescription ?? '')) {
    error = 'Este link de redefinição expirou ou já foi usado. Peça um novo abaixo.'
  } else if (errorCode || errorDescription || get('error')) {
    error = 'Não foi possível validar o link de redefinição. Peça um novo abaixo.'
  }
  return { isRecovery: get('type') === 'recovery', error }
}
