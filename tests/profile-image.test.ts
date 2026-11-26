import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  centerSquare,
  fitWithin,
  MAX_SOURCE_BYTES,
  ownProfileImage,
  PHOTO_UPLOAD_NOT_READY,
  profileImageBaseUrl,
  profileImagePath,
  profilePhotoOf,
  storageUploadMessage,
  validateImageFile,
} from '../src/lib/profileImage.ts'
import type { Company, Student } from '../src/types/index.ts'

const PROJECT = 'https://abcdefgh.supabase.co'
const OWNER = '4f9a2b1c-1d2e-4f5a-8b9c-0123456789ab'
const FILE = 'avatar-0b6c3e1a-9f8d-4c7b-a6e5-d4c3b2a1f0e9.jpg'
const url = (path: string, base = PROJECT) => `${profileImageBaseUrl(base)}${path}`

test('validateImageFile aceita JPG, PNG e WebP e recusa o resto com mensagem para a tela', () => {
  assert.equal(validateImageFile({ type: 'image/jpeg', size: 2_000_000 }), null)
  assert.equal(validateImageFile({ type: 'image/png', size: 1 }), null)
  assert.equal(validateImageFile({ type: 'image/webp', size: MAX_SOURCE_BYTES }), null)
  assert.match(validateImageFile({ type: 'image/gif', size: 10 }) ?? '', /JPG, PNG ou WebP/)
  assert.match(validateImageFile({ type: 'image/svg+xml', size: 10 }) ?? '', /JPG, PNG ou WebP/)
  assert.match(validateImageFile({ type: 'image/heic', size: 10 }) ?? '', /JPG, PNG ou WebP/)
  assert.match(validateImageFile({ type: '', size: 10 }) ?? '', /JPG, PNG ou WebP/)
  assert.match(validateImageFile({ type: 'image/png', size: 0 }) ?? '', /vazio/)
  assert.match(validateImageFile({ type: 'image/jpeg', size: MAX_SOURCE_BYTES + 1 }) ?? '', /15 MB/)
})

test('centerSquare recorta o maior quadrado do centro, em pé ou deitada', () => {
  assert.deepEqual(centerSquare(800, 600), { sx: 100, sy: 0, size: 600 })
  assert.deepEqual(centerSquare(300, 500), { sx: 0, sy: 100, size: 300 })
  assert.deepEqual(centerSquare(400, 400), { sx: 0, sy: 0, size: 400 })
})

test('fitWithin reduz mantendo a proporção e nunca amplia', () => {
  assert.deepEqual(fitWithin(2000, 1000, 512), { width: 512, height: 256 })
  assert.deepEqual(fitWithin(1000, 3000, 512), { width: 171, height: 512 })
  assert.deepEqual(fitWithin(300, 200, 512), { width: 300, height: 200 })
  assert.deepEqual(fitWithin(5000, 2, 512), { width: 512, height: 1 })
})

test('profileImageBaseUrl monta o endereço público igual ao getPublicUrl, com ou sem barra no fim', () => {
  assert.equal(profileImageBaseUrl(PROJECT), 'https://abcdefgh.supabase.co/storage/v1/object/public/avatar/')
  assert.equal(profileImageBaseUrl(`${PROJECT}/`), 'https://abcdefgh.supabase.co/storage/v1/object/public/avatar/')
})

test('profileImagePath só reconhece arquivos que o app grava no bucket', () => {
  assert.deepEqual(profileImagePath(url(`${OWNER}/${FILE}`), PROJECT), { folder: OWNER, path: `${OWNER}/${FILE}` })
  assert.deepEqual(profileImagePath(url(`${OWNER}/logo-0b6c3e1a-9f8d-4c7b-a6e5-d4c3b2a1f0e9.png`), `${PROJECT}/`)?.folder, OWNER)
  // Outro bucket, outro projeto, outro site
  assert.equal(profileImagePath(`${PROJECT}/storage/v1/object/public/outro/${OWNER}/${FILE}`, PROJECT), null)
  assert.equal(profileImagePath(url(`${OWNER}/${FILE}`, 'https://outro.supabase.co'), PROJECT), null)
  assert.equal(profileImagePath(`https://exemplo.com/${OWNER}/${FILE}`, PROJECT), null)
  // Caminhos fora do formato: subpasta, "..", extensão, nome, query string
  assert.equal(profileImagePath(url(`${OWNER}/x/${FILE}`), PROJECT), null)
  assert.equal(profileImagePath(url(`${OWNER}/../${OWNER}/${FILE}`), PROJECT), null)
  assert.equal(profileImagePath(url(`${OWNER}/${FILE.replace('.jpg', '.svg')}`), PROJECT), null)
  assert.equal(profileImagePath(url(`${OWNER}/foto.jpg`), PROJECT), null)
  assert.equal(profileImagePath(url(`${OWNER}/${FILE}?v=2`), PROJECT), null)
  assert.equal(profileImagePath(undefined, PROJECT), null)
  assert.equal(profileImagePath(url(`${OWNER}/${FILE}`), ''), null)
})

test('ownProfileImage só devolve a foto se ela estiver na pasta do próprio dono', () => {
  const photo = url(`${OWNER}/${FILE}`)
  assert.equal(ownProfileImage(photo, OWNER, PROJECT), photo)
  assert.equal(ownProfileImage(photo, OWNER.toUpperCase(), PROJECT), photo)
  assert.equal(ownProfileImage(photo, '11111111-2222-3333-4444-555555555555', PROJECT), undefined)
  assert.equal(ownProfileImage('https://rastreador.exemplo/pixel.png', OWNER, PROJECT), undefined)
  assert.equal(ownProfileImage(null, OWNER, PROJECT), undefined)
})

test('profilePhotoOf usa a foto da pessoa e, na conta de empresa, o logo', () => {
  const student = { type: 'student', id: OWNER, name: 'Ana', email: 'a@b.c', avatarUrl: 'https://x/a.jpg' } as Student
  const company = { type: 'company', id: OWNER, name: 'Empresa', email: 'e@b.c', logoUrl: 'https://x/l.png' } as Company
  assert.equal(profilePhotoOf(student), 'https://x/a.jpg')
  assert.equal(profilePhotoOf(company), 'https://x/l.png')
  assert.equal(profilePhotoOf(null), undefined)
})

test('storageUploadMessage explica os erros do Storage em português', () => {
  assert.equal(storageUploadMessage({ message: 'Bucket not found', statusCode: '404', code: 'NoSuchBucket', status: 400 }), PHOTO_UPLOAD_NOT_READY)
  assert.match(storageUploadMessage({ message: 'new row violates row-level security policy', statusCode: '403', status: 400 }), /permissão/)
  assert.match(storageUploadMessage({ message: 'The object exceeded the maximum allowed size', statusCode: '413' }), /grande demais/)
  assert.match(storageUploadMessage({ message: 'mime type image/gif is not supported', statusCode: '415' }), /Formato/)
  assert.match(storageUploadMessage({ message: 'jwt expired', statusCode: '400' }), /sessão expirou/)
  assert.match(storageUploadMessage({ message: 'Failed to fetch' }), /Sem conexão/)
  assert.match(storageUploadMessage({ message: 'Internal Server Error', status: 500 }), /Não foi possível enviar/)
})
