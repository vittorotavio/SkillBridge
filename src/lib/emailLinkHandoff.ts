/**
 * Os links que o Supabase manda por e-mail (confirmar o cadastro, redefinir a senha) sempre abrem numa
 * aba nova: quem decide isso é o app de e-mail e o navegador, não o site. Para não ficar com duas
 * SkillBridge abertas, a aba aberta pelo link avisa a aba que ficou esperando ("Confirme seu e-mail"
 * no cadastro, "Confira seu e-mail" no esqueci a senha). Se ela responder, o fluxo continua lá e a aba
 * nova pode ser fechada. As duas abas já dividem a sessão: o Supabase grava o login no localStorage e
 * avisa as outras abas.
 *
 * Sem resposta (link aberto em outro navegador ou no celular, ou a aba que esperava já foi fechada),
 * a aba do link segue sozinha, como antes.
 */
const CHANNEL = 'skillbridge-link-email'

/** `signup`: confirmação do cadastro. `recovery`: redefinição de senha. */
export type EmailLinkKind = 'signup' | 'recovery'

interface HandoffMessage {
  type: 'opened' | 'continuing'
  kind: EmailLinkKind
  email: string
}

const sameEmail = (a: unknown, b: string) => typeof a === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase()
const matches = (data: unknown, type: HandoffMessage['type'], kind: EmailLinkKind, email: string) => {
  const msg = data as Partial<HandoffMessage> | null
  return msg?.type === type && msg.kind === kind && sameEmail(msg.email, email)
}

/** Aba que espera o link: avisa quando ele for aberto em outra aba. Devolve a função que para de esperar. */
export function listenForEmailLink(kind: EmailLinkKind, email: string, onOpened: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const channel = new BroadcastChannel(CHANNEL)
  channel.onmessage = (event: MessageEvent) => {
    if (!matches(event.data, 'opened', kind, email)) return
    channel.postMessage({ type: 'continuing', kind, email } satisfies HandoffMessage)
    onOpened()
  }
  return () => channel.close()
}

/** Aba aberta pelo link: `true` se a aba que esperava respondeu e vai continuar de lá. */
export function handOffEmailLink(kind: EmailLinkKind, email: string, timeoutMs = 1000): Promise<boolean> {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve(false)
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(CHANNEL)
    const finish = (handedOff: boolean) => {
      clearTimeout(timer)
      channel.close()
      resolve(handedOff)
    }
    const timer = setTimeout(() => finish(false), timeoutMs)
    channel.onmessage = (event: MessageEvent) => {
      if (matches(event.data, 'continuing', kind, email)) finish(true)
    }
    channel.postMessage({ type: 'opened', kind, email } satisfies HandoffMessage)
  })
}
