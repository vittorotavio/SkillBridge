import { supabase, supabaseUrl } from '../supabaseClient'
import { userError } from '../errors'
import {
  ownProfileImage,
  profileImagePath,
  PROFILE_IMAGE_BUCKET,
  storageUploadMessage,
  type PreparedImage,
  type ProfileImageKind,
  type StorageErrorLike,
} from '../profileImage'

/**
 * Fotos de perfil e logos no Supabase Storage (bucket público "avatar"). Cada dono grava só na
 * própria pasta: `<id da conta>/` para a foto do aluno ou do mentor e `<id da empresa>/` para o logo
 * (regras do bucket no SQL de fotos de perfil). Os arquivos nunca são sobrescritos: cada envio tem
 * nome novo, então a URL antiga continua válida no cache até o perfil apontar para a nova.
 */

/** Envia a imagem para a pasta do dono e devolve a URL pública dela. */
export async function uploadProfileImage(folder: string, kind: ProfileImageKind, image: PreparedImage): Promise<string> {
  const path = `${folder}/${kind}-${crypto.randomUUID()}.${image.extension}`
  const bucket = supabase.storage.from(PROFILE_IMAGE_BUCKET)
  let error: StorageErrorLike | null
  try {
    ;({ error } = await bucket.upload(path, image.blob, { contentType: image.contentType, cacheControl: '31536000', upsert: false }))
  } catch (err) {
    error = err as StorageErrorLike
  }
  if (error) throw userError(storageUploadMessage(error))
  return bucket.getPublicUrl(path).data.publicUrl
}

/**
 * Apaga do bucket uma imagem que deixou de ser usada. Só mexe em arquivos enviados pelo app e nunca
 * trava a tela: se falhar, no pior caso sobra um arquivo sem uso.
 */
export async function deleteProfileImage(url: string | null | undefined): Promise<void> {
  const parsed = profileImagePath(url, supabaseUrl)
  if (!parsed) return
  try {
    const { error } = await supabase.storage.from(PROFILE_IMAGE_BUCKET).remove([parsed.path])
    if (error) console.warn('Não foi possível apagar a imagem antiga do Storage', error)
  } catch (err) {
    console.warn('Não foi possível apagar a imagem antiga do Storage', err)
  }
}

/** `url_avatar` de um aluno/mentor, se for uma foto enviada pelo próprio dono pelo app. */
export function trustedAvatarUrl(url: string | null | undefined, ownerId: string): string | undefined {
  return ownProfileImage(url, ownerId, supabaseUrl)
}
