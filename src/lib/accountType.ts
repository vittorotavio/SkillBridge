import type { AccountType } from '../types'

/**
 * Valor de perfil.tipo_conta (tipo_conta_enum) para cada tipo de conta do app. É também o que o
 * signUp grava em user_metadata.account_type (o trigger handle_new_user aceita os dois formatos).
 */
export const DB_ACCOUNT_TYPE: Record<AccountType, string> = {
  student: 'aluno',
  mentor: 'mentor',
  company: 'administrador_empresa',
}

/**
 * Tipo de conta do app a partir do valor do banco ou dos metadados do cadastro. Contas criadas antes
 * da tradução dos nomes têm 'student' / 'company_admin' em user_metadata.account_type.
 */
export function accountTypeFromDb(value: unknown): AccountType | null {
  switch (value) {
    case 'aluno':
    case 'student':
      return 'student'
    case 'mentor':
      return 'mentor'
    case 'administrador_empresa':
    case 'company_admin':
      return 'company'
    default:
      return null
  }
}
