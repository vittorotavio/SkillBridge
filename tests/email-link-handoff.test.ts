import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handOffEmailLink, listenForEmailLink } from '../src/lib/emailLinkHandoff.ts'

test('a aba que espera o mesmo e-mail assume o link (cadastro e senha)', async () => {
  for (const kind of ['signup', 'recovery'] as const) {
    let opened = 0
    const stop = listenForEmailLink(kind, 'Ana@Email.com', () => opened++)
    try {
      assert.equal(await handOffEmailLink(kind, ' ana@email.com', 500), true, kind)
      assert.equal(opened, 1, kind)
    } finally {
      stop()
    }
  }
})

test('sem aba esperando, a aba do link segue sozinha', async () => {
  assert.equal(await handOffEmailLink('signup', 'ana@email.com', 50), false)
})

test('aba esperando outro e-mail não assume o link', async () => {
  let opened = 0
  const stop = listenForEmailLink('signup', 'bruno@email.com', () => opened++)
  try {
    assert.equal(await handOffEmailLink('signup', 'ana@email.com', 50), false)
    assert.equal(opened, 0)
  } finally {
    stop()
  }
})

test('aba esperando a confirmação do cadastro não assume o link de nova senha', async () => {
  let opened = 0
  const stop = listenForEmailLink('signup', 'ana@email.com', () => opened++)
  try {
    assert.equal(await handOffEmailLink('recovery', 'ana@email.com', 50), false)
    assert.equal(opened, 0)
  } finally {
    stop()
  }
})

test('depois de parar de esperar, a aba não responde mais', async () => {
  const stop = listenForEmailLink('recovery', 'ana@email.com', () => {})
  stop()
  assert.equal(await handOffEmailLink('recovery', 'ana@email.com', 50), false)
})
