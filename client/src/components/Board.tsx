import { useEffect, useMemo, useRef } from 'react'
import {
  COLORS,
  FINISH_PROGRESS,
  IN_BASE,
  SAFE_SQUARES,
  START_INDEX,
  type Color,
  type GameEvent,
  type GameState
} from '@ludo/shared'
import { BASE_ORIGIN, COLOR_HEX, HOME_COLUMN, RING, baseSlot, tokenPoint } from '../lib/geometry'
import { calculateHopTiming, getTokenPath } from '../lib/path'
import { sound } from '../lib/sound'

interface Props {
  state: GameState
  /** Tokens the current human may tap, as "color:index". */
  movable: ReadonlySet<string>
  onTokenClick: (color: Color, tokenIndex: number) => void
  onAnimationComplete?: () => void
}

const IVORY = '#F1E8D2'
const STITCH = '#B9AB84'

function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(3)},${(cy + rad * Math.sin(a)).toFixed(3)}`)
  }
  return `M${pts.join('L')}Z`
}

export default function Board({ state, movable, onTokenClick, onAnimationComplete }: Props) {
  const tokenRefs = useRef<Map<string, SVGGElement>>(new Map())
  const isMountedRef = useRef(false)
  const lastEventsRef = useRef<GameEvent[] | null>(null)

  const startOwner = useMemo(() => {
    const m = new Map<number, Color>()
    for (const c of COLORS) m.set(START_INDEX[c], c)
    return m
  }, [])

  // Place tokens, fanning out any that share a square so none hide another.
  const placed = useMemo(() => {
    const items: { color: Color; index: number; x: number; y: number; key: string }[] = []
    for (const color of state.players) {
      state.tokens[color].forEach((progress, index) => {
        const p = tokenPoint(color, progress, index)
        items.push({ color, index, x: p.x, y: p.y, key: `${color}:${index}` })
      })
    }
    const groups = new Map<string, typeof items>()
    for (const it of items) {
      const k = `${it.x.toFixed(2)},${it.y.toFixed(2)}`
      groups.set(k, [...(groups.get(k) ?? []), it])
    }
    for (const g of groups.values()) {
      if (g.length < 2) continue
      g.forEach((it, i) => {
        const a = (i / g.length) * Math.PI * 2 - Math.PI / 2
        it.x += Math.cos(a) * 0.2
        it.y += Math.sin(a) * 0.2
      })
    }
    return items
  }, [state.tokens, state.players])

  // Hop-by-hop animation effect driven by state.events
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true
      lastEventsRef.current = state.events
      onAnimationComplete?.()
      return
    }

    if (state.events === lastEventsRef.current) return
    lastEventsRef.current = state.events

    const movedEvent = state.events.find(
      (e): e is Extract<GameEvent, { type: 'moved' }> => e.type === 'moved'
    )

    if (!movedEvent) {
      onAnimationComplete?.()
      return
    }

    const tokenKey = `${movedEvent.color}:${movedEvent.move.tokenIndex}`
    const tokenEl = tokenRefs.current.get(tokenKey)

    // Check prefers-reduced-motion
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

    if (reducedMotion || !tokenEl) {
      if (movedEvent.move.captures.length > 0) sound.playCapture()
      else if (movedEvent.move.to === FINISH_PROGRESS) sound.playTokenHome()
      onAnimationComplete?.()
      return
    }

    const steps = getTokenPath(
      movedEvent.color,
      movedEvent.move.from,
      movedEvent.move.to,
      movedEvent.move.tokenIndex
    )
    const { hopMs, totalMs } = calculateHopTiming(steps.length)
    const totalHops = steps.length - 1

    if (totalHops <= 0) {
      if (movedEvent.move.captures.length > 0) sound.playCapture()
      else if (movedEvent.move.to === FINISH_PROGRESS) sound.playTokenHome()
      onAnimationComplete?.()
      return
    }

    const targetItem = placed.find((p) => p.key === tokenKey)
    const captures = movedEvent.move.captures

    // While the attacker is hopping, keep victims held at the square being captured
    if (captures.length > 0) {
      const capturePt = tokenPoint(
        movedEvent.color,
        movedEvent.move.to,
        movedEvent.move.tokenIndex
      )
      for (const victim of captures) {
        const vKey = `${victim.color}:${victim.tokenIndex}`
        const vEl = tokenRefs.current.get(vKey)
        if (vEl) {
          vEl.classList.add('token-animating')
          vEl.setAttribute(
            'transform',
            `translate(${capturePt.x.toFixed(3)}, ${capturePt.y.toFixed(3)})`
          )
        }
      }
    }

    tokenEl.classList.add('token-animating')
    let lastHopIndex = -1
    let rafId: number
    const startTime = performance.now()

    const step = (now: number) => {
      const elapsed = Math.max(0, now - startTime)

      // When the total duration is reached, land at the final destination
      if (elapsed >= totalMs) {
        const finalX = (targetItem?.x ?? steps[steps.length - 1].x).toFixed(3)
        const finalY = (targetItem?.y ?? steps[steps.length - 1].y).toFixed(3)
        tokenEl.setAttribute('transform', `translate(${finalX}, ${finalY})`)
        tokenEl.classList.remove('token-animating')
        sound.playHopTick()

        // If captures happened, animate victim(s) smoothly back to base
        if (captures.length > 0) {
          sound.playCapture()
          const vDuration = 320
          const vStart = performance.now()

          const animateVictims = (vNow: number) => {
            const vElapsed = Math.max(0, vNow - vStart)
            const vt = Math.min(1, vElapsed / vDuration)
            const ease = vt < 0.5 ? 2 * vt * vt : -1 + (4 - 2 * vt) * vt

            for (const victim of captures) {
              const vKey = `${victim.color}:${victim.tokenIndex}`
              const vEl = tokenRefs.current.get(vKey)
              if (!vEl) continue
              const bPt = baseSlot(victim.color, victim.tokenIndex)
              const cPt = tokenPoint(
                movedEvent.color,
                movedEvent.move.to,
                movedEvent.move.tokenIndex
              )
              const vx = (1 - ease) * cPt.x + ease * bPt.x
              const vy = (1 - ease) * cPt.y + ease * bPt.y
              vEl.setAttribute(
                'transform',
                `translate(${vx.toFixed(3)}, ${vy.toFixed(3)})`
              )
            }

            if (vElapsed < vDuration) {
              requestAnimationFrame(animateVictims)
            } else {
              for (const victim of captures) {
                const vKey = `${victim.color}:${victim.tokenIndex}`
                const vEl = tokenRefs.current.get(vKey)
                if (vEl) {
                  vEl.classList.remove('token-animating')
                  const bPt = baseSlot(victim.color, victim.tokenIndex)
                  vEl.setAttribute(
                    'transform',
                    `translate(${bPt.x.toFixed(3)}, ${bPt.y.toFixed(3)})`
                  )
                }
              }
              onAnimationComplete?.()
            }
          }
          requestAnimationFrame(animateVictims)
        } else {
          if (movedEvent.move.to === FINISH_PROGRESS) {
            sound.playTokenHome()
          }
          onAnimationComplete?.()
        }
        return
      }

      // Calculate the current hop index (0 to totalHops - 1)
      const currentHop = Math.min(Math.floor(elapsed / hopMs), totalHops - 1)

      if (currentHop !== lastHopIndex) {
        lastHopIndex = currentHop
        sound.playHopTick()
      }

      // Fractional progress (0.0 to 1.0) within the current hop
      const hopTime = elapsed - currentHop * hopMs
      const t = Math.min(1, Math.max(0, hopTime / hopMs))

      const p0 = steps[currentHop]
      const p1 =
        currentHop === totalHops - 1
          ? (targetItem ?? steps[currentHop + 1])
          : steps[currentHop + 1]

      if (!p0 || !p1) {
        rafId = requestAnimationFrame(step)
        return
      }

      const x = (1 - t) * p0.x + t * p1.x
      const y = (1 - t) * p0.y + t * p1.y
      const arc = 4 * t * (1 - t)
      const arcY = -0.45 * arc
      const scale = 1 + 0.2 * arc

      tokenEl.setAttribute(
        'transform',
        `translate(${x.toFixed(3)}, ${(y + arcY).toFixed(3)}) scale(${scale.toFixed(3)})`
      )

      rafId = requestAnimationFrame(step)
    }

    rafId = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(rafId)
      tokenEl.classList.remove('token-animating')
      for (const victim of captures) {
        const vEl = tokenRefs.current.get(`${victim.color}:${victim.tokenIndex}`)
        vEl?.classList.remove('token-animating')
      }
    }
  }, [state, placed, onAnimationComplete])

  return (
    <svg
      viewBox="-0.5 -0.5 16 16"
      className="board-svg block w-full h-auto"
      role="img"
      aria-label="Ludo board"
      onContextMenu={(e) => e.preventDefault()}
    >
      <defs>
        <pattern id="weave" width="0.25" height="0.25" patternUnits="userSpaceOnUse">
          <rect width="0.25" height="0.25" fill={IVORY} />
          <path d="M0 0.125H0.25M0.125 0V0.25" stroke="#E4D9BC" strokeWidth="0.03" />
        </pattern>
      </defs>

      {/* cloth edge and stitched border */}
      <rect x="-0.5" y="-0.5" width="16" height="16" rx="0.6" fill="#0E1530" />
      <rect x="-0.3" y="-0.3" width="15.6" height="15.6" rx="0.45" fill="url(#weave)" />
      <rect
        x="-0.12"
        y="-0.12"
        width="15.24"
        height="15.24"
        rx="0.3"
        fill="none"
        stroke={STITCH}
        strokeWidth="0.05"
        strokeDasharray="0.22 0.16"
      />

      {/* bases */}
      {COLORS.map((c) => {
        const o = BASE_ORIGIN[c]
        const active = state.players.includes(c)
        return (
          <g key={c} opacity={active ? 1 : 0.35}>
            <rect x={o.x + 0.1} y={o.y + 0.1} width="5.8" height="5.8" rx="0.35" fill={COLOR_HEX[c]} />
            <rect x={o.x + 0.8} y={o.y + 0.8} width="4.4" height="4.4" rx="0.3" fill={IVORY} />
            {[0, 1, 2, 3].map((i) => {
              const s = baseSlot(c, i)
              return (
                <circle key={i} cx={s.x} cy={s.y} r="0.52" fill={COLOR_HEX[c]} opacity="0.22" />
              )
            })}
          </g>
        )
      })}

      {/* shared ring */}
      {RING.map((p, i) => {
        const owner = startOwner.get(i)
        return (
          <g key={i}>
            <rect
              x={p.x - 0.46}
              y={p.y - 0.46}
              width="0.92"
              height="0.92"
              rx="0.12"
              fill={owner ? COLOR_HEX[owner] : IVORY}
              fillOpacity={owner ? 0.85 : 1}
              stroke={STITCH}
              strokeWidth="0.04"
            />
            {SAFE_SQUARES.has(i) && !owner && (
              <path d={starPath(p.x, p.y, 0.3)} fill="#8C7B4F" opacity="0.8" />
            )}
            {owner && <path d={starPath(p.x, p.y, 0.28)} fill="#FFFFFF" opacity="0.9" />}
          </g>
        )
      })}

      {/* home columns */}
      {COLORS.map((c) =>
        HOME_COLUMN[c].map((p, i) => (
          <rect
            key={`${c}${i}`}
            x={p.x - 0.46}
            y={p.y - 0.46}
            width="0.92"
            height="0.92"
            rx="0.12"
            fill={COLOR_HEX[c]}
            fillOpacity="0.55"
            stroke={STITCH}
            strokeWidth="0.04"
          />
        ))
      )}

      {/* centre */}
      <path d="M6 6 L6 9 L7.5 7.5Z" fill={COLOR_HEX.red} />
      <path d="M6 6 L9 6 L7.5 7.5Z" fill={COLOR_HEX.green} />
      <path d="M9 6 L9 9 L7.5 7.5Z" fill={COLOR_HEX.yellow} />
      <path d="M6 9 L9 9 L7.5 7.5Z" fill={COLOR_HEX.blue} />
      <rect x="6" y="6" width="3" height="3" fill="none" stroke={STITCH} strokeWidth="0.05" />

      {/* tokens */}
      {placed.map((t) => {
        const can = movable.has(t.key)
        return (
          <g
            key={t.key}
            ref={(el) => {
              if (el) tokenRefs.current.set(t.key, el)
              else tokenRefs.current.delete(t.key)
            }}
            className={`token ${can ? 'token-movable' : ''}`}
            transform={`translate(${t.x}, ${t.y})`}
            onClick={can ? () => onTokenClick(t.color, t.index) : undefined}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={can ? `Move ${t.color} token ${t.index + 1}` : undefined}
            style={{ outline: 'none', WebkitTapHighlightColor: 'transparent' }}
          >
            {can && <circle r="0.58" className="token-halo" fill="none" stroke="#F2A623" strokeWidth="0.09" />}
            <ellipse cx="0.04" cy="0.14" rx="0.36" ry="0.3" fill="#000" opacity="0.28" />
            <circle r="0.36" fill={COLOR_HEX[t.color]} stroke="#1B2547" strokeWidth="0.06" />
            <circle r="0.22" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.05" />
            <circle cx="-0.1" cy="-0.11" r="0.07" fill="#fff" opacity="0.7" />
          </g>
        )
      })}
    </svg>
  )
}
