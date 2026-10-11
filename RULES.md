# Ludo rules (as implemented in `shared/src/rules.ts`)

These are the rules the game enforces. They live in one place, `shared/src/rules.ts`, and the same code runs for pass-and-play, play-the-computer, and online games.

---

## 1. Quick summary

Roll the die and race your four tokens around the board and into the centre. A 6 brings a token out of base. Landing on an opponent sends them back to base. The first player to bring all four tokens home wins.

| Item | Rule |
|---|---|
| **Players** | 2 to 4 |
| **Tokens** | 4 per player |
| **Die** | One six-sided die |
| **Leave base** | Roll a **6** |
| **Roll a 6** | Roll again |
| **Three 6s in a row** | Turn is lost |
| **Capture** | Opponent goes to base, you roll again |
| **Safe squares** | 8 squares where nobody can be captured |
| **Block** | Two of your tokens on one square. Opponents cannot land on or pass it |
| **Finish** | Roll must be exactly or less than the distance left (strict exact count) |
| **Single active token** | **Plays automatically** if only 1 token is out of base (including on a 6) |
| **Only one legal move** | **Plays automatically** (identical tokens count as one move) |
| **No legal move** | Turn passes (even on a 6) |
| **Win** | First to bring all 4 tokens home |

---

## 2. The board

The board has a shared track of 52 squares that everyone walks clockwise. Each colour also has a private home column of 5 squares leading to the centre, which only that colour can enter.

### Colours and turn order

Play goes clockwise: red, green, yellow, blue.

| Players | Colours used |
|---|---|
| 2 | Red and Yellow (opposite each other) |
| 3 | Red, Green, Yellow |
| 4 | Red, Green, Yellow, Blue |

### Entry squares

Each colour enters the shared track on its own entry square.

| Colour | Entry square (0 to 51, clockwise) |
|---|---|
| Red | 0 |
| Green | 13 |
| Yellow | 26 |
| Blue | 39 |

### Safe squares

There are 8 safe squares: the 4 entry squares and the 4 star squares, each 8 steps after an entry square.

`0, 8, 13, 21, 26, 34, 39, 47`

- A token on a safe square can never be captured.
- Tokens of different colours may share a safe square.

### How far a token travels

Each token counts its own progress relative to its colour's entry square:

| Progress | Where the token is |
|---|---|
| `-1` | In base (not on the board) |
| `0` to `50` | On the shared track. `0` is its own entry square |
| `51` to `55` | In its private home column |
| `56` | Home (finished) |

A token travels **56 steps** from its entry square to finish.

---

## 3. Taking a turn

1. Roll the die.
2. Move one token the number rolled (see section 4 for limits).
3. If you rolled a 6, or captured a token, you roll again. Otherwise the turn passes to the next player.

### Choosing and automatic moves
- If you have more than one choice, you pick the token.
- If you have exactly one legal move, the game plays it for you.
- Tokens in the same position count as one choice. For example, with all four tokens in base and a 6, the game brings one out automatically.
- **Single active token**: If a player has only 1 token out of base (3 in base or finished), that active token moves automatically on any roll (including a 6) to keep play smooth and responsive.

### No legal move
If you cannot move any token, the turn passes. This applies even if you rolled a 6, so a 6 that cannot be used gives no extra roll.

---

## 4. Moving

### Leaving base
A token leaves base only on a 6, and moves onto your entry square (progress 0). You roll again after the 6.

### Moving on the track
Move a token forward by the number rolled, clockwise. After its 50th step on the track it turns into its private home column.

### Capturing
If your token lands exactly on a square holding an opponent's token, that token is sent back to base, and you roll again.

- You cannot capture on a safe square. Both tokens stay.
- You cannot capture in a home column. Those squares are private.
- Passing over an opponent does nothing. Only landing counts.
- If an opponent token on your entry square is on a safe square, bringing a token out does not capture it.

### Passing tokens
Tokens pass other tokens freely along the track. No pieces block or freeze opponents from moving. Multiple tokens can share squares, and landing on an opponent token on an open track square captures it.

### Rolling sixes
- A 6 gives you another roll.
- Three 6s in a row lose your turn. On the third 6 you do not move at all.
- Any roll that is not a 6 resets the count.

---

## 5. Finishing (strict exact count)

To bring a token home it must reach the centre by exact count. A roll is legal for a token only if it is less than or equal to the steps that token still has to go.

| Token is | Roll | Result |
|---|---|---|
| 3 steps from home | 3 | Token finishes |
| 3 steps from home | 2 | Moves 2, now 1 step away |
| 3 steps from home | 5 | Cannot move. Another token may move, or turn passes |

Finishing a token does not give an extra turn.

---

## 6. Winning

The first player to bring all four tokens home wins.

- **2 players**: The game ends when the first player finishes.
- **3 or 4 players**: The game continues until only one player is left. Finishers take 1st, 2nd, and 3rd in the order they finish, and the last player is placed automatically.

---

## 7. Worked examples

### Capture
| Step | Red token | Green token | What happens |
|---|---|---|---|
| **Before** | Progress 4 (square 4) | Progress 46 (square 7) | Red rolls a 3 |
| **Move** | 4 + 3 = 7 | On square 7, not safe | Red lands on green |
| **After** | Progress 7 | Sent to base | Red rolls again |

### Safe square
| Step | Red token | Green token | What happens |
|---|---|---|---|
| **Before** | Progress 5 (square 5) | Progress 47 (square 8, a star) | Red rolls a 3 |
| **Move** | 5 + 3 = 8 | On square 8, safe | Both tokens stay |
| **After** | Square 8 | Square 8 | No capture, turn passes |

### Block
Green has two tokens on square 7. Red's token is on square 3 and rolls a 5. The path is squares 4, 5, 6, 7, 8 and crosses green's block on 7, so the move is not allowed.

### Exact count
| Token progress | Steps left | Roll | Legal? | New progress |
|---|---|---|---|---|
| 53 | 3 | 4 | No | Stays 53 |
| 53 | 3 | 2 | Yes | 55 |
| 53 | 3 | 3 | Yes | 56 (home) |

### Three sixes
| Roll | Result |
|---|---|
| 6 | Move a token, roll again |
| 6 | Move a token, roll again |
| 6 | Turn lost. No move, play passes |

### A short turn sequence
| # | Player | Roll | Situation | Outcome |
|---|---|---|---|---|
| 1 | Red | 4 | All tokens in base | No legal move, turn passes |
| 2 | Green | 6 | All tokens in base | Auto: one token enters, Green rolls again |
| 3 | Green | 3 | One token on board, three in base | Auto-moves 3, turn passes |
| 4 | Yellow | 6 | All in base | Auto-enters, rolls again |
| 5 | Yellow | 2 | One token on board | Auto-moves 2, turn passes |

---

## 8. Online play

- The server rolls the dice and checks that it is your turn, so rolls cannot be faked.
- Refresh or lose signal and you rejoin your seat. While you are away the computer plays your turns.
- If a player chooses to leave during a game, the computer takes over their colour for the rest of the game.

---

## 9. Differences from other house rules

Ludo has many house variations. These are the choices this game makes:

| Topic | This game |
|---|---|
| Leaving base | Needs a 6 |
| Extra turn on capture | Yes |
| Extra turn on finishing a token | No |
| Overshooting the finish | Not allowed (strict exact count) |
| Blocks | None (tokens pass opponent pieces freely) |
| A 6 with no legal move | Turn passes, no extra roll |
| Three 6s in a row | Turn lost |
| Safe squares | 8 (4 entry squares and 4 stars) |

---

## 10. Smart dice algorithm (`smartRollDie`)

The engine incorporates adaptive dice mechanics to keep games dynamic, fun, and fast-paced:

1. **Pity / First-turn 6**: When all tokens are in base, rolling a 6 is favored on turn 1 (50%), turn 2 (70%), and guaranteed by turn 3 (88%) so no player sits trapped in base. This rule resets if a single token gets out.
2. **Dynamic captures ("Kills")**: If an opponent token is vulnerable within 1..6 steps on an open track square, the algorithm grants a boosted chance (~55%) to roll that number for exciting comebacks.
3. **Home stretch assistance**: When in the private home column, rolls are biased (~65%) towards the exact finish number to avoid tedious endgame stalling.

---

## 11. For developers

- **Pure functions** in `shared/src/rules.ts`: `createGame`, `rollDice(state, value)`, `chooseMove(state, tokenIndex)`, `getLegalMoves`, `smartRollDie(state, rng)`.
- The rules engine is deterministic when the die value is supplied, making it easily testable without mocking global state.
- **Constants** (entry squares, safe squares, finish progress) reside in `shared/src/constants.ts`.
- **Tests** in `shared/tests/rules.test.ts` cover leaving base, single/identical token auto-moves, captures, safe squares, blocks, strict finishing, three sixes, win placements, and smart dice behavior.
