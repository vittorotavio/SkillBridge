import { useEffect, useRef, useState } from 'react'
import { parseVideoSource } from '../../lib/video'
import { advanceWatch, isFullyWatched, isSkippingAhead, watchedPercent, type WatchState } from '../../lib/watch'

interface LessonVideoProps {
  url: string
  title: string
  credit?: string
  /** Chave no navegador para retomar o vídeo e lembrar que ele já foi assistido inteiro. */
  storageKey: string
  /** true = o aluno ainda precisa assistir: não deixa adiantar além do que já viu. */
  locked: boolean
  onProgress: (percent: number) => void
  onWatched: () => void
}

interface Tracker {
  startAt: number
  /** Nova posição lida. Devolve para onde voltar se o aluno tentou pular, ou null. */
  onTime: (currentTime: number, duration: number) => number | null
  onEnded: (duration: number) => void
}

function readSaved(key: string): { watchedUntil: number; done: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null')
    return { watchedUntil: Number(saved?.watchedUntil) || 0, done: saved?.done === true }
  } catch {
    return { watchedUntil: 0, done: false }
  }
}

function writeSaved(key: string, value: { watchedUntil: number; done: boolean }) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* sem armazenamento (aba anônima etc.): só não retoma depois */
  }
}

/** Estado do acompanhamento num ref (muda a cada leitura, não precisa re-renderizar). */
function useWatchTracker({ storageKey, locked, onProgress, onWatched }: Pick<LessonVideoProps, 'storageKey' | 'locked' | 'onProgress' | 'onWatched'>): Tracker {
  const callbacks = useRef({ locked, onProgress, onWatched })
  useEffect(() => {
    callbacks.current = { locked, onProgress, onWatched }
  })

  const [tracker] = useState<Tracker & { done: boolean }>(() => {
    const saved = readSaved(storageKey)
    let state: WatchState = { watchedUntil: saved.watchedUntil, lastTime: saved.watchedUntil }
    let lastPercent = -1
    let lastSavedAt = saved.watchedUntil
    const t = {
      done: saved.done,
      startAt: saved.done ? 0 : saved.watchedUntil,
      onTime(currentTime: number, duration: number) {
        if (callbacks.current.locked && !t.done && isSkippingAhead(state.watchedUntil, currentTime)) return state.watchedUntil
        state = advanceWatch(state, currentTime)
        const percent = t.done ? 100 : Math.min(99, watchedPercent(state.watchedUntil, duration))
        if (percent !== lastPercent) {
          lastPercent = percent
          callbacks.current.onProgress(percent)
        }
        if (Math.abs(state.watchedUntil - lastSavedAt) >= 5) {
          lastSavedAt = state.watchedUntil
          writeSaved(storageKey, { watchedUntil: state.watchedUntil, done: t.done })
        }
        return null
      },
      onEnded(duration: number) {
        if (t.done || !isFullyWatched(state.watchedUntil, duration)) return
        t.done = true
        writeSaved(storageKey, { watchedUntil: state.watchedUntil, done: true })
        callbacks.current.onProgress(100)
        callbacks.current.onWatched()
      },
    }
    return t
  })

  // Já assistido em outra visita (salvo no navegador).
  useEffect(() => {
    if (tracker.done) {
      callbacks.current.onProgress(100)
      callbacks.current.onWatched()
    }
  }, [tracker])

  return tracker
}

function FileVideo({ src, title, tracker }: { src: string; title: string; tracker: Tracker }) {
  // Só corrige a posição com o salto já concluído (seeked) ou durante a reprodução: mudar currentTime
  // no meio de um salto em andamento às vezes deixava o vídeo travado sem carregar.
  const handleTime = (v: HTMLVideoElement) => {
    if (v.seeking) return
    const back = tracker.onTime(v.currentTime, v.duration)
    if (back !== null) v.currentTime = back
  }
  return (
    <video
      src={src}
      controls
      preload="metadata"
      className="h-full w-full"
      aria-label={`Vídeo da aula: ${title}`}
      onLoadedMetadata={(e) => {
        const v = e.currentTarget
        if (tracker.startAt > 1 && tracker.startAt < v.duration - 5) v.currentTime = tracker.startAt
      }}
      onTimeUpdate={(e) => handleTime(e.currentTarget)}
      onSeeked={(e) => handleTime(e.currentTarget)}
      onEnded={(e) => tracker.onEnded(e.currentTarget.duration)}
    />
  )
}

// API do player do YouTube (https://developers.google.com/youtube/iframe_api_reference), só o que é usado.
interface YouTubePlayer {
  getCurrentTime(): number
  getDuration(): number
  seekTo(seconds: number, allowSeekAhead: boolean): void
  destroy(): void
}
interface YouTubeApi {
  Player: new (
    el: HTMLElement,
    options: {
      videoId: string
      host?: string
      width?: string
      height?: string
      playerVars?: Record<string, number>
      events?: { onStateChange?: (e: { data: number }) => void; onError?: () => void }
    }
  ) => YouTubePlayer
  PlayerState: { ENDED: number }
}
declare global {
  interface Window {
    YT?: YouTubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

let youTubeApi: Promise<YouTubeApi> | null = null
function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  youTubeApi ??= new Promise<YouTubeApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT) resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      youTubeApi = null
      reject(new Error('Não foi possível carregar o player do YouTube.'))
    }
    document.head.appendChild(script)
  })
  return youTubeApi
}

function YouTubeVideo({ id, title, tracker }: { id: string; title: string; tracker: Tracker }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let player: YouTubePlayer | null = null
    let timer: number | undefined
    let cancelled = false
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return
        const el = document.createElement('div')
        hostRef.current.appendChild(el)
        const created = new YT.Player(el, {
          videoId: id,
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, playsinline: 1, start: Math.floor(tracker.startAt) },
          events: {
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.ENDED) tracker.onEnded(created.getDuration())
            },
            onError: () => setFailed(true),
          },
        })
        player = created
        // O YouTube não avisa a cada avanço: lê a posição a cada meio segundo.
        timer = window.setInterval(() => {
          if (typeof created.getCurrentTime !== 'function') return
          const back = tracker.onTime(created.getCurrentTime(), created.getDuration())
          if (back !== null) created.seekTo(back, true)
        }, 500)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (timer) window.clearInterval(timer)
      player?.destroy()
    }
  }, [id, tracker])

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-white/80">
        Não foi possível carregar o vídeo do YouTube. Verifique sua conexão e recarregue a página.
      </div>
    )
  }
  return <div ref={hostRef} title={`Vídeo da aula: ${title}`} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full" />
}

/** Player da aula. Use `key` por aula: o acompanhamento recomeça a cada aula. */
export function LessonVideo({ url, title, credit, storageKey, locked, onProgress, onWatched }: LessonVideoProps) {
  const source = parseVideoSource(url)
  const tracker = useWatchTracker({ storageKey, locked, onProgress, onWatched })
  if (!source) return null

  return (
    <div>
      <div className="aspect-video w-full bg-black">
        {source.kind === 'youtube' ? (
          <YouTubeVideo id={source.id} title={title} tracker={tracker} />
        ) : (
          <FileVideo src={source.src} title={title} tracker={tracker} />
        )}
      </div>
      {credit && <p className="border-b border-slate-100 px-6 py-2 text-[11px] text-slate-400 dark:border-slate-700/60">{credit}</p>}
    </div>
  )
}
