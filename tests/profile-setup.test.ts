import { test } from 'node:test'
import assert from 'node:assert/strict'
import { afterProfileSetupPath, isProfileSetupPending, PROFILE_SETUP_KEY, PROFILE_SETUP_PATH, PROFILE_SETUP_PENDING } from '../src/lib/profileSetup.ts'
import { accountTypeForPath } from '../src/lib/routes.ts'

test('só conta nova (marcada no cadastro) vê "Complete seu perfil"', () => {
  assert.equal(isProfileSetupPending(PROFILE_SETUP_PENDING), true)
  assert.equal(isProfileSetupPending({ account_type: 'aluno', name: 'Ana', [PROFILE_SETUP_KEY]: 'pending' }), true)
  assert.equal(isProfileSetupPending({ [PROFILE_SETUP_KEY]: 'done' }), false)
  assert.equal(isProfileSetupPending({ [PROFILE_SETUP_KEY]: 'skipped' }), false)
  // Contas antigas (sem a marca), metadados vazios ou ausentes
  assert.equal(isProfileSetupPending({ account_type: 'student', name: 'Rafael' }), false)
  assert.equal(isProfileSetupPending({}), false)
  assert.equal(isProfileSetupPending(null), false)
  assert.equal(isProfileSetupPending(undefined), false)
})

test('depois da tela, segue para a página pedida se for do próprio painel', () => {
  assert.equal(afterProfileSetupPath('/aluno/cursos/123?aula=0-1', 'student'), '/aluno/cursos/123?aula=0-1')
  assert.equal(afterProfileSetupPath('/empresa/configuracoes', 'company'), '/empresa/configuracoes')
  // Painel de outro tipo de conta, a própria tela, site externo ou nada: início do painel
  assert.equal(afterProfileSetupPath('/mentor/horarios', 'student'), '/aluno')
  assert.equal(afterProfileSetupPath(PROFILE_SETUP_PATH, 'mentor'), '/mentor')
  assert.equal(afterProfileSetupPath('//exemplo.com/aluno', 'student'), '/aluno')
  assert.equal(afterProfileSetupPath('https://exemplo.com/aluno', 'student'), '/aluno')
  assert.equal(afterProfileSetupPath(undefined, 'company'), '/empresa')
  assert.equal(afterProfileSetupPath(42, 'mentor'), '/mentor')
})

test('a rota da tela não pertence a nenhum painel (qualquer conta logada entra)', () => {
  assert.equal(accountTypeForPath(PROFILE_SETUP_PATH), undefined)
})
