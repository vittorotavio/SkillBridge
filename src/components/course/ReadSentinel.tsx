import { useEffect, useRef } from 'react'

/** Marcador invisível no fim do material: avisa uma vez quando o aluno rola até o final do texto. */
export function ReadSentinel({ onSeen }: { onSeen: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const onSeenRef = useRef(onSeen)
  useEffect(() => {
    onSeenRef.current = onSeen
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      onSeenRef.current()
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        onSeenRef.current()
        observer.disconnect()
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return <div ref={ref} aria-hidden className="h-px" />
}
