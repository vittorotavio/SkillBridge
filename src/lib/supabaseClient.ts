import { createClient } from '@supabase/supabase-js'
import { parseAuthRedirect } from './authRedirect'

export const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env (e reinicie `npm run dev`).'
  )
}

/**
 * Retorno de link de e-mail (ex.: redefinição de senha) lido ANTES de criar o cliente: ao abrir a
 * sessão do link, o cliente apaga o "#access_token=..." da URL.
 */
export const initialAuthRedirect =
  typeof window === 'undefined' ? parseAuthRedirect('', '') : parseAuthRedirect(window.location.hash, window.location.search)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
