/**
 * Acompanha quanto de um vídeo foi assistido de verdade: o ponto "assistido até" só avança com
 * reprodução contínua. Pulos para a frente (arrastar a barra) não contam e podem ser desfeitos.
 */
export interface WatchState {
  /** Até onde (em segundos) o aluno assistiu sem pular. */
  watchedUntil: number
  /** Última posição lida, para medir o avanço entre duas leituras. */
  lastTime: number
}

/**
 * Maior avanço entre duas leituras que ainda conta como reprodução normal. As leituras chegam a cada
 * ~0,25 s (vídeo) ou 0,5 s (YouTube); 3 s cobre velocidade 2x com folga e barra acelerações absurdas.
 */
export const MAX_PLAYBACK_STEP = 3

export function advanceWatch(state: WatchState, currentTime: number): WatchState {
  const step = currentTime - state.lastTime
  const playing = step > 0 && step <= MAX_PLAYBACK_STEP
  return { watchedUntil: playing && currentTime > state.watchedUntil ? currentTime : state.watchedUntil, lastTime: currentTime }
}

/** O aluno tentou ir além do que já assistiu? (a folga absorve o intervalo entre leituras.) */
export function isSkippingAhead(watchedUntil: number, target: number, tolerance = MAX_PLAYBACK_STEP): boolean {
  return target > watchedUntil + tolerance
}

/** Chegou ao fim assistindo tudo? (a folga cobre a última leitura antes do fim.) */
export function isFullyWatched(watchedUntil: number, duration: number, tolerance = MAX_PLAYBACK_STEP): boolean {
  return Number.isFinite(duration) && duration > 0 && watchedUntil >= duration - tolerance
}

export function watchedPercent(watchedUntil: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0
  return Math.max(0, Math.min(100, Math.floor((watchedUntil / duration) * 100)))
}
