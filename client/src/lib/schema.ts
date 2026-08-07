export class ResponseValidationError extends Error {
  constructor() { super("Invalid API response"); this.name = "ResponseValidationError" }
}

export const object = (value: unknown, required: readonly string[], optional: readonly string[] = []) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ResponseValidationError()
  const result = value as Record<string, unknown>
  const allowed = new Set([...required, ...optional])
  if (required.some((key) => !(key in result)) || Object.keys(result).some((key) => !allowed.has(key))) throw new ResponseValidationError()
  return result
}
export const dictionary = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ResponseValidationError()
  return value as Record<string, unknown>
}
export const string = (value: unknown, max = 1000) => {
  if (typeof value !== "string" || value.length > max) throw new ResponseValidationError()
  return value
}
export const nonEmptyString = (value: unknown, max = 1000) => {
  const result = string(value, max)
  if (!result) throw new ResponseValidationError()
  return result
}
export const number = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ResponseValidationError()
  return value
}
export const nonNegativeInteger = (value: unknown) => {
  const result = number(value)
  if (!Number.isInteger(result) || result < 0) throw new ResponseValidationError()
  return result
}
export const boolean = (value: unknown) => {
  if (typeof value !== "boolean") throw new ResponseValidationError()
  return value
}
export const array = <T>(value: unknown, parse: (item: unknown) => T, max = 10_000) => {
  if (!Array.isArray(value) || value.length > max) throw new ResponseValidationError()
  return value.map(parse)
}
export const oneOf = <T extends string>(value: unknown, allowed: readonly T[]) => {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new ResponseValidationError()
  return value as T
}
export const isoDate = (value: unknown) => {
  const result = nonEmptyString(value, 40)
  if (Number.isNaN(Date.parse(result))) throw new ResponseValidationError()
  return result
}
export const optional = <T>(value: unknown, parse: (item: unknown) => T) => value === undefined ? undefined : parse(value)
export const nullable = <T>(value: unknown, parse: (item: unknown) => T) => value === null ? null : parse(value)
