import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseVideoSource, YOUTUBE_CAPTION_VARS } from '../src/lib/video.ts'
import { parseMaterial, splitBold } from '../src/lib/material.ts'
import { gradeActivity, hasAnswerKey, normalizeQuestion } from '../src/lib/activity.ts'
import { advanceWatch, isFullyWatched, isSkippingAhead, watchedPercent } from '../src/lib/watch.ts'

test('advanceWatch só conta reprodução contínua, nunca pulos', () => {
  let s = { watchedUntil: 0, lastTime: 0 }
  for (let t = 0.25; t <= 10; t += 0.25) s = advanceWatch(s, t)
  assert.equal(s.watchedUntil, 10)
  s = advanceWatch(s, 60) // arrastou a barra para 1 min
  assert.equal(s.watchedUntil, 10)
  s = advanceWatch(s, 5) // voltou para rever
  s = advanceWatch(s, 5.5)
  assert.equal(s.watchedUntil, 10)
  assert.equal(isSkippingAhead(10, 12), false)
  assert.equal(isSkippingAhead(10, 30), true)
})

test('isFullyWatched exige chegar ao fim e watchedPercent fica entre 0 e 100', () => {
  assert.equal(isFullyWatched(118.5, 120), true)
  assert.equal(isFullyWatched(60, 120), false)
  assert.equal(isFullyWatched(10, Number.NaN), false)
  assert.equal(watchedPercent(30, 120), 25)
  assert.equal(watchedPercent(500, 120), 100)
  assert.equal(watchedPercent(10, 0), 0)
})

test('gradeActivity só aprova com todas as respostas certas e só então libera as explicações', () => {
  const qs = [
    { question: 'A?', options: ['x', 'y'], correct: 1, explanation: 'porque y' },
    { question: 'B?', options: ['x', 'y', 'z'], correct: 0 },
  ]
  assert.deepEqual(gradeActivity(qs, [1, 0]), { correct: [true, true], passed: true, explanations: ['porque y', null] })
  assert.deepEqual(gradeActivity(qs, [1, 2]), { correct: [true, false], passed: false, explanations: undefined })
  assert.equal(gradeActivity(qs, [1]).passed, false)
  assert.equal(gradeActivity([], []).passed, false)
  // Sem gabarito no navegador (aluno), nada é dado como certo.
  assert.equal(gradeActivity([{ question: 'C?', options: ['x', 'y'] }], [0]).passed, false)
  assert.equal(hasAnswerKey([{ question: 'C?', options: ['x', 'y'] }]), false)
  assert.equal(hasAnswerKey(qs), true)
})

test('normalizeQuestion descarta alternativas vazias, reindexa a certa e aponta erros', () => {
  assert.deepEqual(normalizeQuestion({ question: ' Qual? ', options: ['a', '', 'c', ''], correct: 2, explanation: ' ' }), {
    question: { question: 'Qual?', options: ['a', 'c'], correct: 1, explanation: undefined },
  })
  assert.deepEqual(normalizeQuestion({ question: '', options: ['', '', '', ''], correct: 0 }), {})
  assert.match(normalizeQuestion({ question: 'Qual?', options: ['a', '', '', ''], correct: 0 }).error ?? '', /2 alternativas/)
  assert.match(normalizeQuestion({ question: 'Qual?', options: ['a', 'b', '', ''], correct: 3 }).error ?? '', /marque/)
  assert.match(normalizeQuestion({ question: 'Qual?', options: ['a', 'a', '', ''], correct: 0 }).error ?? '', /repetidas/)
  assert.match(normalizeQuestion({ question: '', options: ['a', 'b', '', ''], correct: 0 }).error ?? '', /enunciado/)
})

test('parseMaterial separa parágrafos, listas, listas numeradas e subtítulos', () => {
  const text = 'Intro em\nduas linhas.\n\n**Internas:**\n- Core bancário\n- CRM\n\n### Na prática\n1. Defina\n2. Meça'
  assert.deepEqual(parseMaterial(text), [
    { kind: 'p', lines: ['Intro em', 'duas linhas.'] },
    { kind: 'p', lines: ['**Internas:**'] },
    { kind: 'ul', lines: ['Core bancário', 'CRM'] },
    { kind: 'h', lines: ['Na prática'] },
    { kind: 'ol', lines: ['Defina', 'Meça'] },
  ])
  assert.deepEqual(splitBold('a **b** c'), [
    { text: 'a ', bold: false },
    { text: 'b', bold: true },
    { text: ' c', bold: false },
  ])
})

test('parseVideoSource reconhece os formatos de link do YouTube', () => {
  const yt = { kind: 'youtube', id: 'dQw4w9WgXcQ' }
  assert.deepEqual(parseVideoSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), yt)
  assert.deepEqual(parseVideoSource('https://youtu.be/dQw4w9WgXcQ'), yt)
  assert.deepEqual(parseVideoSource('https://m.youtube.com/shorts/dQw4w9WgXcQ'), yt)
  assert.deepEqual(parseVideoSource('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'), yt)
  assert.equal(parseVideoSource('https://www.youtube.com/watch?v=curto'), null)
})

test('o player do YouTube abre com a legenda em português ligada', () => {
  assert.equal(YOUTUBE_CAPTION_VARS.cc_load_policy, 1)
  assert.equal(YOUTUBE_CAPTION_VARS.cc_lang_pref, 'pt')
  assert.equal(YOUTUBE_CAPTION_VARS.hl, 'pt-BR')
})

test('parseVideoSource aceita arquivos de vídeo e recusa players que não informam o progresso', () => {
  const file = 'https://upload.wikimedia.org/wikipedia/commons/0/0b/What_is_Design_Thinking.webm'
  assert.deepEqual(parseVideoSource(file), { kind: 'file', src: file })
  const transcoded = 'https://upload.wikimedia.org/wikipedia/commons/transcoded/1/17/Scam_Watch_1280x720.ogv/Scam_Watch_1280x720.ogv.480p.vp9.webm'
  assert.equal(parseVideoSource(transcoded)?.kind, 'file')
  assert.equal(parseVideoSource('https://archive.org/download/a11ynyc0823/a11ynyc0823.ia.mp4')?.kind, 'file')
  assert.equal(parseVideoSource('https://vimeo.com/76979871'), null)
  assert.equal(parseVideoSource('https://archive.org/details/a11ynyc0823'), null)
})

test('parseVideoSource recusa http, javascript: e sites desconhecidos como iframe', () => {
  assert.equal(parseVideoSource('http://example.com/aula.mp4'), null)
  assert.equal(parseVideoSource('javascript:alert(1)'), null)
  assert.equal(parseVideoSource('https://example.com/pagina-com-video'), null)
  assert.equal(parseVideoSource(''), null)
  assert.equal(parseVideoSource(undefined), null)
})
