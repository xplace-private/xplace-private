export interface SessionGeneration {
  read(): number
  advance(): number
  isCurrent(value: number): boolean
}

export function createSessionGeneration(): SessionGeneration {
  let value = 0
  return {
    read: () => value,
    advance: () => (value += 1),
    isCurrent: (captured) => captured === value,
  }
}
