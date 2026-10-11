import { FINISH_PROGRESS, IN_BASE, START_INDEX, TRACK_LENGTH, type Color } from '@ludo/shared'

/** Points are in board grid units (the board is a 15 x 15 grid), at cell centres. */
export interface Pt {
  x: number
  y: number
}
const cell = (row: number, col: number): Pt => ({ x: col + 0.5, y: row + 0.5 })

export const COLOR_HEX: Record<Color, string> = {
  red: '#D2402E',
  green: '#2F8F5B',
  yellow: '#EBB021',
  blue: '#2D6FC4'
}
export const COLOR_NAME: Record<Color, string> = {
  red: 'Red',
  green: 'Green',
  yellow: 'Yellow',
  blue: 'Blue'
}

/** The 52 shared squares in clockwise order. Index 0 is red's entry square. */
function buildRing(): Pt[] {
  const ring: Pt[] = []
  for (let c = 1; c <= 5; c++) ring.push(cell(6, c)) // left arm, top lane
  for (let r = 5; r >= 0; r--) ring.push(cell(r, 6)) // top arm, left lane
  ring.push(cell(0, 7)) // top cap
  for (let r = 0; r <= 5; r++) ring.push(cell(r, 8)) // top arm, right lane
  for (let c = 9; c <= 14; c++) ring.push(cell(6, c)) // right arm, top lane
  ring.push(cell(7, 14)) // right cap
  for (let c = 14; c >= 9; c--) ring.push(cell(8, c)) // right arm, bottom lane
  for (let r = 9; r <= 14; r++) ring.push(cell(r, 8)) // bottom arm, right lane
  ring.push(cell(14, 7)) // bottom cap
  for (let r = 14; r >= 9; r--) ring.push(cell(r, 6)) // bottom arm, left lane
  for (let c = 5; c >= 0; c--) ring.push(cell(8, c)) // left arm, bottom lane
  ring.push(cell(7, 0)) // left cap
  ring.push(cell(6, 0))
  if (ring.length !== TRACK_LENGTH) throw new Error('ring must have 52 squares')
  return ring
}
export const RING = buildRing()

/** The five private home-column squares (progress 51..55) for each colour. */
export const HOME_COLUMN: Record<Color, Pt[]> = {
  red: [1, 2, 3, 4, 5].map((c) => cell(7, c)),
  green: [1, 2, 3, 4, 5].map((r) => cell(r, 7)),
  yellow: [13, 12, 11, 10, 9].map((c) => cell(7, c)),
  blue: [13, 12, 11, 10, 9].map((r) => cell(r, 7))
}

/** Top-left corner (x = column, y = row) of each colour's 6 x 6 base. */
export const BASE_ORIGIN: Record<Color, Pt> = {
  red: { x: 0, y: 0 },
  green: { x: 9, y: 0 },
  yellow: { x: 9, y: 9 },
  blue: { x: 0, y: 9 }
}
const SLOT = [
  { x: 1.8, y: 1.8 },
  { x: 4.2, y: 1.8 },
  { x: 1.8, y: 4.2 },
  { x: 4.2, y: 4.2 }
]
export const baseSlot = (color: Color, i: number): Pt => ({
  x: BASE_ORIGIN[color].x + SLOT[i].x,
  y: BASE_ORIGIN[color].y + SLOT[i].y
})

const FINISH_DIR: Record<Color, Pt> = {
  red: { x: -1, y: 0 },
  green: { x: 0, y: -1 },
  yellow: { x: 1, y: 0 },
  blue: { x: 0, y: 1 }
}

export function tokenPoint(color: Color, progress: number, tokenIndex: number): Pt {
  if (progress === IN_BASE) return baseSlot(color, tokenIndex)
  if (progress === FINISH_PROGRESS) {
    const d = FINISH_DIR[color]
    const spread = (tokenIndex - 1.5) * 0.3
    return { x: 7.5 + d.x * 0.85 + d.y * spread, y: 7.5 + d.y * 0.85 + d.x * spread }
  }
  if (progress <= 50) return RING[(START_INDEX[color] + progress) % TRACK_LENGTH]
  return HOME_COLUMN[color][progress - 51]
}
