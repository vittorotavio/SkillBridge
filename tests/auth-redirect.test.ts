import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAuthRedirect } from '../src/lib/authRedirect.ts'

test('parseAuthRedirect reconhece o link de redefinição de senha', () => {
  const hash = '#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=recovery'
  assert.deepEqual(parseAuthRedirect(hash, ''), { isRecovery: true, isSignup: false, error: null })
  assert.deepEqual(parseAuthRedirect('', ''), { isRecovery: false, isSignup: false, error: null })
})

test('parseAuthRedirect reconhece o link de confirmação do cadastro (leva a "Complete seu perfil")', () => {
  const hash = '#access_token=abc&expires_in=3600&refresh_token=def&token_type=bearer&type=signup'
  assert.deepEqual(parseAuthRedirect(hash, ''), { isRecovery: false, isSignup: true, error: null })
  // Link vencido não abre sessão nenhuma: não é tratado como cadastro confirmado.
  const expired = parseAuthRedirect('#error=access_denied&error_code=otp_expired&type=signup', '')
  assert.equal(expired.isSignup, false)
})

test('parseAuthRedirect explica link vencido ou inválido, no hash ou na query string', () => {
  const expired = parseAuthRedirect('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', '')
  assert.match(expired.error ?? '', /expirou ou já foi usado/)
  assert.equal(expired.isRecovery, false)
  const fromQuery = parseAuthRedirect('', '?error=server_error&error_description=Something+went+wrong')
  assert.match(fromQuery.error ?? '', /Não foi possível validar/)
})
