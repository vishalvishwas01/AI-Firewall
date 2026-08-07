declare module "node:test" {
  const test: (name: string, callback: () => unknown) => void
  export default test
}
declare module "node:assert/strict" {
  const assert: { rejects(promise: Promise<unknown>, predicate: (error: unknown) => boolean): Promise<void>; deepEqual(actual: unknown, expected: unknown): void }
  export default assert
}
