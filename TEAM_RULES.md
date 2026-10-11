# Ludo team rules (2 v 2)

Status: **Implemented.** This document describes the team mode of the game. Everything not mentioned here follows the standard rules in `RULES.md`.

## 1. Quick summary

Four players form two teams of two. Partners sit opposite each other. A team wins when **all eight of its tokens** (four from each partner) are home. Once a player has brought their own four tokens home, they keep rolling and use their rolls to **move their partner's tokens**.

| Item | Rule |
|---|---|
| Players | Exactly 4 |
| Teams | 2 teams of 2 |
| Partners | Sit opposite: red and yellow, green and blue |
| Winning | First team to bring all 8 tokens home |
| Capturing | Opponents only. Never a partner |
| Sharing squares | Partners may share any square freely |
| Blocks | Two tokens of the same team on a square form a block |
| Helping | After finishing your own 4 tokens, your rolls move your partner's tokens |

## 2. Teams and seating

| Team | Players | Colours |
|---|---|---|
| Team A | Seat 1 and seat 3 | Red and yellow |
| Team B | Seat 2 and seat 4 | Green and blue |

- Turn order is the normal clockwise order: red, green, yellow, blue. Because partners sit opposite, turns **alternate between teams**: A, B, A, B.
- Team mode needs **exactly four seats**. Any seat can be a computer player. A team can be two people, a person and a computer, or two computers.
- In an online room, the host chooses "Team (2 v 2)" before starting. Seats 1 and 3 are partners, as are seats 2 and 4. Players can swap seats in the lobby before the host starts.

## 3. Taking a turn

Your turn works exactly as in the standard game: roll, move a token, roll again on a 6 or a capture, lose the turn on three 6s in a row. What changes is **which tokens you may move**.

### While you still have tokens to bring home

You move **only your own tokens**, as in the standard game.

### After all four of your tokens are home

You are **not skipped**. You keep taking turns, and your roll moves **your partner's tokens**.

- Partner tokens obey every normal rule: a 6 is needed to leave base, strict exact count to finish, blocks, safe squares.
- Your rolls keep their normal effects: a 6 gives another roll, three 6s in a row lose the turn, and a capture gives another roll.
- If exactly one legal move exists for the partner's tokens, it is played automatically. If none exists, the turn passes.
- If both partners have finished, the team has already won.

### Before you have finished

You may **not** move a partner's token while you still have tokens of your own to bring home.

## 4. Capturing

- Landing exactly on a token of the **other team** sends it back to base, and you roll again. Safe squares still protect.
- You **never capture a partner**. Partner tokens simply share the square.
- Passing over any token does nothing. Only landing counts.

## 5. Safe squares

The same 8 safe squares apply: the four entry squares and the four star squares. A token on a safe square cannot be captured.

## 6. Blocks

A **team block** is formed when **two or more tokens of the same team** are on one track square. The tokens can belong to either partner, for example one red and one yellow.

- Opponents **cannot land on** a team block.
- Opponents **cannot pass** a team block.
- Both partners' tokens can land on and pass their own team's blocks.
- A team block on an opponent's entry square stops that opponent bringing a token out.

## 7. Finishing and winning

- Finishing a token follows the strict exact-count rule from `RULES.md`: the roll must be less than or equal to the steps left.
- Finishing a token gives **no extra turn**.
- A team **wins when all eight tokens are home**. The game ends immediately.
- There are no second or third places. The result is "Team A wins" or "Team B wins".
