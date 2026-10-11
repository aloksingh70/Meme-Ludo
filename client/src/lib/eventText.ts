import type { Color, GameEvent } from '@ludo/shared'
import { COLOR_NAME } from './geometry'

const ordinal = (n: number) => ['', '1st', '2nd', '3rd', '4th'][n] ?? `${n}th`
const who = (c: Color) => COLOR_NAME[c]

export function eventsToText(events: GameEvent[]): string[] {
  const out: string[] = []
  for (const e of events) {
    switch (e.type) {
      case 'rolled':
        out.push(`${who(e.color)} rolled a ${e.value}.`)
        break
      case 'moved':
        if (e.by && e.by !== e.color) {
          if (e.move.from === -1) {
            out.push(`${who(e.by)} rolled and brought partner ${who(e.color)}'s token out of base.`)
          } else {
            const steps = e.move.to - e.move.from
            out.push(`${who(e.by)} rolled and moved partner ${who(e.color)}'s token ${steps} step${steps === 1 ? '' : 's'}.`)
          }
        } else if (e.move.from === -1) {
          out.push(`${who(e.color)} brought a token out of base.`)
        } else {
          const steps = e.move.to - e.move.from
          out.push(`${who(e.color)} moved a token ${steps} step${steps === 1 ? '' : 's'}.`)
        }
        break
      case 'captured':
        out.push(
          `${who(e.by)} sent ${e.victims.map((v) => who(v.color)).join(' and ')} back to base!`
        )
        break
      case 'finishedToken':
        out.push(`${who(e.color)} brought a token home!`)
        break
      case 'noMoves':
        out.push(`${who(e.color)} can't move with a ${e.value}.`)
        break
      case 'forfeit':
        out.push(`Three sixes in a row. ${who(e.color)} loses the turn.`)
        break
      case 'extraTurn':
        if (e.reason === 'six') {
          out.push(`${who(e.color)} rolled a 6! Extra roll.`)
        } else if (e.reason === 'capture') {
          out.push(`${who(e.color)} made a capture! Extra roll.`)
        } else {
          out.push(`${who(e.color)} rolls again.`)
        }
        break
      case 'placed':
        out.push(`${who(e.color)} finished ${ordinal(e.place)}.`)
        break
      case 'gameOver':
        if (e.winningTeam) {
          out.push(
            `Game over! Team ${e.winningTeam} (${e.winningTeam === 'A' ? 'Red & Yellow' : 'Green & Blue'}) wins!`
          )
        } else if (e.placements && e.placements.length > 0) {
          out.push(`Game over! ${who(e.placements[0])} wins!`)
        }
        break
      default:
        break
    }
  }
  return out
}
