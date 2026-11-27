/**
 * O link de confirmação do cadastro sempre abre numa aba nova: quem decide isso é o app de e-mail e o
 * navegador, não o site. Para não ficar com duas SkillBridge abertas, a aba aberta pelo link avisa a
 * aba do cadastro (que ficou em "Confirme seu e-mail"). Se ela responder, o cadastro continua lá e a
 * aba nova pode ser fechada. As duas abas já dividem a sessão: o Supabase grava o login no
 * localStorage e avisa as outras abas.
 *
 * Sem resposta (link aberto em outro navegador ou no celular, ou a aba do cadastro já foi fechada),
 * a aba do link segue sozinha, como antes.
 */
const CHANNEL = 'skillbridge-confirmacao-cadastro'

type HandoffMessage = { type: 'confirmed'; email: string } | { type: 'continuing'; email: string }

const sameEmail = (a: unknown, b: string) => typeof a === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase()

/** Aba do cadastro: espera a confirmação do e-mail informado. Devolve a função que para de esperar. */
export function listenForSignupConfirmation(email: string, onConfirmed: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const channel = new BroadcastChannel(CHANNEL)
  channel.onmessage = (event: MessageEvent<HandoffMessage>) => {
    if (event.data?.type !== 'confirmed' || !sameEmail(event.data.email, email)) return
    channel.postMessage({ type: 'continuing', email } satisfies HandoffMessage)
    onConfirmed()
  }
  return () => channel.close()
}

/** Aba aberta pelo link: `true` se a aba do cadastro respondeu e vai continuar de lá. */
export function handOffSignupConfirmation(email: string, timeoutMs = 1000): Promise<boolean> {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve(false)
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(CHANNEL)
    const finish = (handedOff: boolean) => {
      clearTimeout(timer)
      channel.close()
      resolve(handedOff)
    }
    const timer = setTimeout(() => finish(false), timeoutMs)
    channel.onmessage = (event: MessageEvent<HandoffMessage>) => {
      if (event.data?.type === 'continuing' && sameEmail(event.data.email, email)) finish(true)
    }
    channel.postMessage({ type: 'confirmed', email } satisfies HandoffMessage)
  })
}
