import { describe, expect, it } from 'vitest'
import { chooseBotMove, createGame, rollDice } from '../src'

describe('bot', () => {
  it('prefers a capture over a plain move', () => {
    const s0 = createGame(['red', 'green'])
    // red token 0 can capture green (square 7); red token 1 has a plain move
    s0.tokens.red = [4, 20, -1, -1]
    s0.tokens.green = [46, -1, -1, -1]
    const s = rollDice(s0, 3)
    expect(s.phase).toBe('move')
    expect(chooseBotMove(s)).toBe(0)
  })
  it('always returns a legal token index', () => {
    const s0 = createGame(['red', 'green'])
    s0.tokens.red = [5, 9, -1, -1]
    const s = rollDice(s0, 2)
    expect(s.legal.map((m) => m.tokenIndex)).toContain(chooseBotMove(s))
  })
})
