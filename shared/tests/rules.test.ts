import { describe, expect, it } from 'vitest'
import {
  SAFE_SQUARES,
  absoluteSquare,
  chooseMove,
  createGame,
  currentColor,
  getActingColor,
  getLegalMoves,
  partnerOf,
  rollDice,
  smartRollDie,
  teamOf,
  type Color,
  type GameMode,
  type GameState
} from '../src'

function setup(
  players: Color[],
  pos: Partial<Record<Color, number[]>>,
  mode: GameMode = 'solo'
): GameState {
  const s = createGame(players, mode)
  for (const c of Object.keys(pos) as Color[]) s.tokens[c] = [...pos[c]!]
  return s
}

describe('board model', () => {
  it('has 8 safe squares', () => expect(SAFE_SQUARES.size).toBe(8))
  it('maps relative progress to absolute squares', () => {
    expect(absoluteSquare('red', 0)).toBe(0)
    expect(absoluteSquare('green', 0)).toBe(13)
    expect(absoluteSquare('blue', 13)).toBe(0) // wraps around
    expect(absoluteSquare('red', 51)).toBeNull() // home column is private
  })
})

describe('leaving base', () => {
  it('a non-six with everything in base passes the turn', () => {
    const s = rollDice(createGame(['red', 'green']), 4)
    expect(s.events.some((e) => e.type === 'noMoves')).toBe(true)
    expect(currentColor(s)).toBe('green')
  })
  it('a six with 4 tokens in base auto-enters one and gives an extra roll', () => {
    const s = rollDice(createGame(['red', 'green']), 6)
    expect(s.tokens.red).toEqual([0, -1, -1, -1])
    expect(currentColor(s)).toBe('red')
    expect(s.phase).toBe('roll')
    expect(s.dice).toBe(6)
  })
})

describe('auto-move when only one move is possible', () => {
  it('1 token on board, 3 in base, non-six: moves automatically', () => {
    const s = rollDice(setup(['red', 'green'], { red: [5, -1, -1, -1] }), 3)
    expect(s.tokens.red[0]).toBe(8)
    expect(currentColor(s)).toBe('green')
    expect(s.dice).toBe(3)
  })
  it('3 tokens home, last one on board: moves automatically', () => {
    const s = rollDice(setup(['red', 'green'], { red: [56, 56, 56, 10] }), 2)
    expect(s.tokens.red[3]).toBe(12)
    expect(s.dice).toBe(2)
  })
  it('two real choices waits for the player', () => {
    const s = rollDice(setup(['red', 'green'], { red: [5, 9, -1, -1] }), 2)
    expect(s.phase).toBe('move')
    expect(s.legal).toHaveLength(2)
    const after = chooseMove(s, 1)
    expect(after.tokens.red).toEqual([5, 11, -1, -1])
  })
})

describe('capturing', () => {
  it('captures on a normal square and grants an extra turn', () => {
    // green progress 46 -> absolute square 7 (not safe)
    const s = rollDice(setup(['red', 'green'], { red: [4, -1, -1, -1], green: [46, -1, -1, -1] }), 3)
    expect(s.tokens.green[0]).toBe(-1)
    expect(currentColor(s)).toBe('red')
    expect(s.events.some((e) => e.type === 'extraTurn')).toBe(true)
  })
  it('does not capture on a safe square', () => {
    // green progress 47 -> absolute square 8 (star)
    const s = rollDice(setup(['red', 'green'], { red: [5, -1, -1, -1], green: [47, -1, -1, -1] }), 3)
    expect(s.tokens.green[0]).toBe(47)
    expect(currentColor(s)).toBe('green')
  })
})

describe('movement', () => {
  it('can pass opponent tokens on track', () => {
    // two green tokens on absolute square 7
    const s = rollDice(setup(['red', 'green'], { red: [3, -1, -1, -1], green: [46, 46, -1, -1] }), 5)
    expect(s.tokens.red[0]).toBe(8)
  })
})

describe('strict finish (exact or smaller)', () => {
  it('a roll bigger than the distance left cannot move', () => {
    const s = setup(['red', 'green'], { red: [53, -1, -1, -1] })
    expect(getLegalMoves(s, 4)).toHaveLength(0)
  })
  it('exact roll finishes the token', () => {
    const s = rollDice(setup(['red', 'green'], { red: [53, -1, -1, -1] }), 3)
    expect(s.tokens.red[0]).toBe(56)
  })
  it('a smaller roll still moves forward', () => {
    const s = rollDice(setup(['red', 'green'], { red: [53, -1, -1, -1] }), 2)
    expect(s.tokens.red[0]).toBe(55)
  })
})

describe('sixes', () => {
  it('three sixes in a row forfeits the turn', () => {
    let s = setup(['red', 'green'], { red: [0, -1, -1, -1] })
    s = rollDice(s, 6)
    s = chooseMove(s, 0)
    s = rollDice(s, 6)
    s = chooseMove(s, 0)
    expect(s.tokens.red[0]).toBe(12)
    s = rollDice(s, 6)
    expect(s.events.some((e) => e.type === 'forfeit')).toBe(true)
    expect(s.tokens.red[0]).toBe(12)
    expect(currentColor(s)).toBe('green')
  })
})

describe('winning', () => {
  it('last token home ends a 2-player game with placements', () => {
    const s = rollDice(setup(['red', 'green'], { red: [56, 56, 56, 53] }), 3)
    expect(s.phase).toBe('over')
    expect(s.placements).toEqual(['red', 'green'])
  })
  it('4-player game continues after the first finisher', () => {
    const s = rollDice(
      setup(['red', 'green', 'yellow', 'blue'], { red: [56, 56, 56, 53] }),
      3
    )
    expect(s.phase).toBe('roll')
    expect(s.placements).toEqual(['red'])
    expect(currentColor(s)).toBe('green')
  })
})

describe('rolling a 6 with tokens in base and on board', () => {
  it('allows player to choose between advancing active token and bringing another out of base', () => {
    const s = rollDice(setup(['red', 'green'], { red: [4, -1, -1, -1] }), 6)
    // Red has a choice: advance token 0 or bring a token out of base
    expect(s.phase).toBe('move')
    expect(s.legal).toHaveLength(2)
    // If player chooses to bring a new token out of base
    const afterNewToken = chooseMove(s, 1)
    expect(afterNewToken.tokens.red[0]).toBe(4)
    expect(afterNewToken.tokens.red[1]).toBe(0)
    expect(afterNewToken.phase).toBe('roll')
    expect(currentColor(afterNewToken)).toBe('red')
  })

  it('when 2 tokens are on board, player still chooses', () => {
    const s = rollDice(setup(['red', 'green'], { red: [4, 10, -1, -1] }), 6)
    expect(s.phase).toBe('move')
    expect(s.legal).toHaveLength(3) // 2 track tokens + 1 base entry
  })
})

describe('smartRollDie algorithm', () => {
  it('applies pity 6 chances when all tokens are in base (turn 1: 50%, turn 2: 70%, turn 3: 88%)', () => {
    const s = createGame(['red', 'green'])

    // Turn 1 (turnsWithoutSix = 0): 50% chance
    s.turnsWithoutSix = { red: 0, green: 0, yellow: 0, blue: 0 }
    expect(smartRollDie(s, () => 0.45)).toBe(6)
    expect(smartRollDie(s, () => 0.55)).not.toBe(6)

    // Turn 2 (turnsWithoutSix = 1): 70% chance
    s.turnsWithoutSix = { red: 1, green: 0, yellow: 0, blue: 0 }
    expect(smartRollDie(s, () => 0.65)).toBe(6)
    expect(smartRollDie(s, () => 0.75)).not.toBe(6)

    // Turn 3 (turnsWithoutSix = 2): 88% chance
    s.turnsWithoutSix = { red: 2, green: 0, yellow: 0, blue: 0 }
    expect(smartRollDie(s, () => 0.85)).toBe(6)
    expect(smartRollDie(s, () => 0.92)).not.toBe(6)

    // Turn 4+ (turnsWithoutSix >= 3): 100% guaranteed
    s.turnsWithoutSix = { red: 3, green: 0, yellow: 0, blue: 0 }
    expect(smartRollDie(s, () => 0.99)).toBe(6)
  })

  it('resets pity 6 counter as soon as a token leaves base', () => {
    let s = createGame(['red', 'green'])
    s.turnsWithoutSix = { red: 2, green: 0, yellow: 0, blue: 0 }

    // Red rolls 6: with all in base, single legal move auto-plays to bring a token out
    s = rollDice(s, 6)

    // Token 0 left base to progress 0, and pity counter for red is reset to 0
    expect(s.tokens.red[0]).toBe(0)
    expect(s.turnsWithoutSix?.red).toBe(0)

    // And while a token is out of base, pity 6 does not apply
    // (with rng 0.8, which would trigger on turn 3, it won't trigger because allInBase is false)
    expect(smartRollDie(s, () => 0.8)).not.toBe(6)
  })

  it('tracks lastRoller on GameState across turns', () => {
    let s = createGame(['red', 'green'])
    expect(s.lastRoller).toBeNull()

    // Red rolls 4 (no legal moves since all in base, turn advances to green)
    s = rollDice(s, 4)
    expect(s.lastRoller).toBe('red')
    expect(s.dice).toBe(4)
    expect(s.players[s.turn]).toBe('green') // green's turn now

    // When green rolls, lastRoller updates to green
    s = rollDice(s, 5)
    expect(s.lastRoller).toBe('green')
    expect(s.dice).toBe(5)
  })

  it('biases towards capture roll when opponent is vulnerable', () => {
    // Red at 4, Green at 46 (which is absolute square 7, vulnerable). Distance is 3 steps.
    const s = setup(['red', 'green'], { red: [4, -1, -1, -1], green: [46, -1, -1, -1] })
    // With rng returning 0.1 (< 0.55 capture bias chance)
    const roll = smartRollDie(s, () => 0.1)
    expect(roll).toBe(3)
  })

  it('biases towards winning finish roll when token is in home stretch', () => {
    // Red token at 53 (needs 3 to reach 56)
    const s = setup(['red', 'green'], { red: [53, -1, -1, -1] })
    const roll = smartRollDie(s, () => 0.1)
    expect(roll).toBe(3)
  })
})

describe('RULES.md worked examples & edge cases', () => {
  it('tokens on entry square do not stop opponent from leaving base on a 6', () => {
    // Red has 2 tokens on square 13 (Green's entry square)
    const s = rollDice(setup(['green', 'red'], { green: [-1, -1, -1, -1], red: [13, 13, -1, -1] }), 6)
    expect(s.tokens.green[0]).toBe(0)
  })

  it('bringing a token out onto entry square does not capture an opponent token on it', () => {
    // Green at progress 39 is on absolute square 0 (Red entry square, which is safe)
    const s = rollDice(setup(['red', 'green'], { red: [-1, -1, -1, -1], green: [39, -1, -1, -1] }), 6)
    expect(s.tokens.red[0]).toBe(0)
    expect(s.tokens.green[0]).toBe(39) // remains on square 0, not captured
  })

  it('plays the exact short turn sequence from RULES.md section 7', () => {
    let s = createGame(['red', 'green', 'yellow', 'blue'])
    // 1. Red rolls 4 with all in base -> no legal move, turn passes
    s = rollDice(s, 4)
    expect(currentColor(s)).toBe('green')
    expect(s.tokens.red.every((p) => p === -1)).toBe(true)

    // 2. Green rolls 6 with all in base -> auto-enters token 0 to 0, rolls again
    s = rollDice(s, 6)
    expect(s.tokens.green).toEqual([0, -1, -1, -1])
    expect(currentColor(s)).toBe('green')
    expect(s.phase).toBe('roll')

    // 3. Green rolls 3 with 1 token on board -> auto-moves 3 steps to progress 3, passes to yellow
    s = rollDice(s, 3)
    expect(s.tokens.green).toEqual([3, -1, -1, -1])
    expect(currentColor(s)).toBe('yellow')

    // 4. Yellow rolls 6 with all in base -> auto-enters, rolls again
    s = rollDice(s, 6)
    expect(s.tokens.yellow).toEqual([0, -1, -1, -1])
    expect(currentColor(s)).toBe('yellow')
    expect(s.phase).toBe('roll')

    // 5. Yellow rolls 2 with 1 token on board -> auto-moves 2 steps to progress 2, passes to blue
    s = rollDice(s, 2)
    expect(s.tokens.yellow).toEqual([2, -1, -1, -1])
    expect(currentColor(s)).toBe('blue')
  })
})

describe('Team rules (2 v 2)', () => {
  const players: Color[] = ['red', 'green', 'yellow', 'blue']

  it('assigns partners and alternating turn order (A, B, A, B)', () => {
    expect(teamOf('red')).toBe('A')
    expect(teamOf('yellow')).toBe('A')
    expect(teamOf('green')).toBe('B')
    expect(teamOf('blue')).toBe('B')
    expect(partnerOf('red')).toBe('yellow')
    expect(partnerOf('green')).toBe('blue')

    const s = createGame(players, 'teams')
    expect(s.mode).toBe('teams')
    expect(s.players).toEqual(['red', 'green', 'yellow', 'blue'])
  })

  it('partners can share a square and never capture each other', () => {
    // Red token at progress 4 (absolute square 4).
    // Yellow token at progress 33 (absolute square (26 + 33) % 52 = 7).
    // Square 7 is not a safe square.
    // Red rolls 3 -> lands on square 7.
    const s = rollDice(
      setup(
        players,
        {
          red: [4, -1, -1, -1],
          yellow: [33, -1, -1, -1]
        },
        'teams'
      ),
      3
    )

    // Red lands on progress 7 (absolute square 7)
    expect(s.tokens.red[0]).toBe(7)
    // Partner Yellow remains unharmed on progress 33 (absolute square 7)
    expect(s.tokens.yellow[0]).toBe(33)
    // No capture occurred, turn passed to Green
    expect(currentColor(s)).toBe('green')
  })

  it('a capture of an opponent still works and gives an extra roll', () => {
    // Red token at progress 4 (absolute square 4).
    // Green token (opponent, Team B) at progress 46 (absolute square (13 + 46) % 52 = 7).
    // Red rolls 3 -> lands on square 7.
    const s = rollDice(
      setup(
        players,
        {
          red: [4, -1, -1, -1],
          green: [46, -1, -1, -1]
        },
        'teams'
      ),
      3
    )

    expect(s.tokens.red[0]).toBe(7)
    // Opponent Green is captured and sent back to base
    expect(s.tokens.green[0]).toBe(-1)
    // Red gets an extra roll!
    expect(currentColor(s)).toBe('red')
    expect(s.phase).toBe('roll')
    expect(s.events.some((e) => e.type === 'extraTurn' && e.reason === 'capture')).toBe(true)
  })

  it('a mixed-colour block (one red, one yellow) stops opponents landing on or passing it, and lets partners through', () => {
    // Red token at square 20 (progress 20)
    // Yellow token at square 20 (progress (20 - 26 + 52) % 52 = 46)
    // Green at square 17 (progress (17 - 13 + 52) % 52 = 4)
    const sGreen = setup(
      players,
      {
        red: [20, -1, -1, -1],
        yellow: [46, -1, -1, -1],
        green: [4, -1, -1, -1]
      },
      'teams'
    )
    sGreen.turn = 1 // Green's turn

    // Green rolls 5 (tries to pass through square 20 to 22) -> BLOCKED
    expect(getLegalMoves(sGreen, 5)).toEqual([])

    // Green rolls 3 (tries to land on square 20) -> BLOCKED
    expect(getLegalMoves(sGreen, 3)).toEqual([])

    // Partner Red at square 17 (progress 17):
    const sRed = setup(
      players,
      {
        red: [17, -1, -1, -1],
        yellow: [46, -1, -1, -1]
      },
      'teams'
    )
    // Red rolls 5 (passes square 20 to 22) -> ALLOWED for partner
    const redMoves = getLegalMoves(sRed, 5)
    expect(redMoves.length).toBe(1)
    expect(redMoves[0].to).toBe(22)
  })

  it('a team block on an opponent entry square stops that opponent bringing a token out on a 6', () => {
    // Red and Yellow both on square 13 (Green's entry square)
    // Red is at progress 13. Yellow is at progress (13 - 26 + 52) % 52 = 39.
    const s = setup(
      players,
      {
        red: [13, -1, -1, -1],
        yellow: [39, -1, -1, -1],
        green: [-1, -1, -1, -1]
      },
      'teams'
    )
    s.turn = 1 // Green's turn

    // Green rolls a 6 but cannot leave base because Team A blocks square 13
    const greenMoves = getLegalMoves(s, 6)
    expect(greenMoves).toEqual([])

    // Rolling passes turn to yellow
    const afterRoll = rollDice(s, 6)
    expect(currentColor(afterRoll)).toBe('yellow')
    expect(afterRoll.tokens.green[0]).toBe(-1)
  })

  it("a finished player's roll moves a partner token, and is not skipped", () => {
    // Red has brought all 4 tokens home.
    // Yellow has 1 token on the track at progress 10.
    const s = setup(
      players,
      {
        red: [56, 56, 56, 56],
        yellow: [10, -1, -1, -1]
      },
      'teams'
    )
    expect(currentColor(s)).toBe('red')
    expect(getActingColor(s)).toBe('yellow')

    // Red rolls 4: moves Yellow's token from 10 to 14
    const next = rollDice(s, 4)
    expect(next.tokens.yellow[0]).toBe(14)
    expect(next.tokens.red).toEqual([56, 56, 56, 56])
    // Turn passes to green
    expect(currentColor(next)).toBe('green')
  })

  it("a finished player cannot move a partner's token before finishing", () => {
    // Red has 3 tokens home, 1 token on track at progress 20.
    // Yellow has tokens on track at progress 10.
    const s = setup(
      players,
      {
        red: [56, 56, 56, 20],
        yellow: [10, -1, -1, -1]
      },
      'teams'
    )
    expect(currentColor(s)).toBe('red')
    expect(getActingColor(s)).toBe('red')

    const moves = getLegalMoves(s, 4)
    // Only Red's token moves, Yellow cannot be moved yet
    expect(moves.length).toBe(1)
    expect(moves[0].from).toBe(20)
    expect(moves[0].to).toBe(24)
  })

  it('no legal partner move passes the turn, and exactly one legal move auto-plays', () => {
    // Red has all 4 home. Yellow has only base tokens.
    const s = setup(
      players,
      {
        red: [56, 56, 56, 56],
        yellow: [-1, -1, -1, -1]
      },
      'teams'
    )
    // Red rolls 4 -> no legal move for Yellow's base tokens, turn passes to Green
    const afterRoll = rollDice(s, 4)
    expect(currentColor(afterRoll)).toBe('green')

    // Now Yellow has 1 token on track at 53 (needs 3 to finish)
    const s2 = setup(
      players,
      {
        red: [56, 56, 56, 56],
        yellow: [53, -1, -1, -1]
      },
      'teams'
    )
    // Red rolls 3 -> exactly 1 legal move, auto-plays to 56
    const afterFinish = rollDice(s2, 3)
    expect(afterFinish.tokens.yellow[0]).toBe(56)
  })

  it('a team wins only when all 8 tokens are home, and the game ends immediately', () => {
    // Red has 4 home. Yellow has 3 home and 1 at progress 54.
    const s = setup(
      players,
      {
        red: [56, 56, 56, 56],
        yellow: [56, 56, 56, 54]
      },
      'teams'
    )
    // Not won yet with 7 tokens home
    expect(s.phase).toBe('roll')
    expect(s.winningTeam).toBeNull()

    // Red rolls 2 and moves Yellow's last token home
    const won = rollDice(s, 2)
    expect(won.tokens.yellow[3]).toBe(56)
    expect(won.phase).toBe('over')
    expect(won.winningTeam).toBe('A')
    expect(won.events.some((e) => e.type === 'gameOver' && e.winningTeam === 'A')).toBe(true)
  })
})
