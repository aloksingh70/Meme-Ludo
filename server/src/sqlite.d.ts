declare module 'node:sqlite' {
  export class StatementSync {
    run(...params: (string | number | bigint | null | undefined | Buffer)[]): {
      changes: number
      lastInsertRowid: number | bigint
    }
    all(...params: (string | number | bigint | null | undefined | Buffer)[]): Record<string, unknown>[]
    get(...params: (string | number | bigint | null | undefined | Buffer)[]): Record<string, unknown> | undefined
  }

  export class DatabaseSync {
    constructor(location: string)
    exec(sql: string): void
    prepare(sql: string): StatementSync
    close(): void
  }
}
