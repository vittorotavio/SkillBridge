import { parseMaterial, splitBold } from '../../lib/material'

/** Material da aula renderizado como elementos React (nada de HTML cru): o texto salvo não injeta marcação. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((part, i) =>
        part.bold ? (
          <strong key={i} className="font-semibold text-slate-800 dark:text-slate-100">
            {part.text}
          </strong>
        ) : (
          part.text
        )
      )}
    </>
  )
}

export function LessonMaterial({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      {parseMaterial(text).map((seg, i) => {
        if (seg.kind === 'h') {
          return (
            <h3 key={i} className="pt-1 text-base font-bold text-slate-900 dark:text-slate-50">
              <Inline text={seg.lines[0]} />
            </h3>
          )
        }
        if (seg.kind === 'ul' || seg.kind === 'ol') {
          const List = seg.kind
          return (
            <List key={i} className={`${seg.kind === 'ul' ? 'list-disc' : 'list-decimal'} space-y-1 pl-5 marker:text-primary-400`}>
              {seg.lines.map((line, j) => (
                <li key={j}>
                  <Inline text={line} />
                </li>
              ))}
            </List>
          )
        }
        return (
          <p key={i}>
            <Inline text={seg.lines.join(' ')} />
          </p>
        )
      })}
    </div>
  )
}
