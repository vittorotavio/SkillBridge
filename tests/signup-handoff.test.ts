import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handOffSignupConfirmation, listenForSignupConfirmation } from '../src/lib/signupHandoff.ts'

test('a aba do cadastro que espera o mesmo e-mail assume a confirmação', async () => {
  let confirmed = 0
  const stop = listenForSignupConfirmation('Ana@Email.com', () => confirmed++)
  try {
    assert.equal(await handOffSignupConfirmation(' ana@email.com', 500), true)
    assert.equal(confirmed, 1)
  } finally {
    stop()
  }
})

test('sem aba esperando, a aba do link segue sozinha', async () => {
  assert.equal(await handOffSignupConfirmation('ana@email.com', 50), false)
})

test('aba esperando outro e-mail não assume a confirmação', async () => {
  let confirmed = 0
  const stop = listenForSignupConfirmation('bruno@email.com', () => confirmed++)
  try {
    assert.equal(await handOffSignupConfirmation('ana@email.com', 50), false)
    assert.equal(confirmed, 0)
  } finally {
    stop()
  }
})

test('depois de parar de esperar, a aba do cadastro não responde mais', async () => {
  const stop = listenForSignupConfirmation('ana@email.com', () => {})
  stop()
  assert.equal(await handOffSignupConfirmation('ana@email.com', 50), false)
})
