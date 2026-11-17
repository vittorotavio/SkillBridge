import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accountTypeFromDb, DB_ACCOUNT_TYPE } from '../src/lib/accountType.ts'

test('accountTypeFromDb aceita os valores novos (perfil.tipo_conta) e os antigos dos metadados', () => {
  assert.equal(accountTypeFromDb('aluno'), 'student')
  assert.equal(accountTypeFromDb('student'), 'student')
  assert.equal(accountTypeFromDb('mentor'), 'mentor')
  assert.equal(accountTypeFromDb('administrador_empresa'), 'company')
  assert.equal(accountTypeFromDb('company_admin'), 'company')
  assert.equal(accountTypeFromDb(undefined), null)
  assert.equal(accountTypeFromDb('admin'), null)
})

test('o cadastro grava os valores em português, os mesmos de perfil.tipo_conta', () => {
  assert.deepEqual(DB_ACCOUNT_TYPE, { student: 'aluno', mentor: 'mentor', company: 'administrador_empresa' })
  for (const [type, value] of Object.entries(DB_ACCOUNT_TYPE)) assert.equal(accountTypeFromDb(value), type)
})
