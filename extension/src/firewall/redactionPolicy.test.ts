import { describe, expect, it } from "vitest"

import { redactSensitiveText, redactSnippet } from "./redact"

const redactionCases = [
  {
    label: "secret assignment",
    input: "JWT_SECRET=super-secret-value-12345",
    expected: "JWT_SECRET=[REDACTED]",
    rawValues: ["super-secret-value-12345"]
  },
  {
    label: "service URI assignment",
    input: "MONGODB_URI=mongodb+srv://user:password@example.mongodb.net/app",
    expected: "MONGODB_URI=[REDACTED_URL]",
    rawValues: ["mongodb+srv://user:password@example.mongodb.net/app"]
  },
  {
    label: "generic token",
    input: "token ghp_123456789012345678901234567890123456",
    expected: "token [REDACTED_TOKEN]",
    rawValues: ["ghp_123456789012345678901234567890123456"]
  },
  {
    label: "email address",
    input: "send to admin@example.com",
    expected: "send to [REDACTED_EMAIL]",
    rawValues: ["admin@example.com"]
  },
  {
    label: "card-like number",
    input: "card 4242 4242 4242 4242",
    expected: "card [REDACTED_CARD]",
    rawValues: ["4242 4242 4242 4242"]
  },
  {
    label: "phone-like number",
    input: "call +1 415 555 0123",
    expected: "call [REDACTED_PHONE]",
    rawValues: ["+1 415 555 0123"]
  }
]

describe("redaction storage policy", () => {
  it.each(redactionCases)("redacts $label with the agreed placeholder", (item) => {
    const redacted = redactSensitiveText(item.input)

    expect(redacted).toBe(item.expected)
    for (const rawValue of item.rawValues) {
      expect(redacted).not.toContain(rawValue)
    }
  })

  it("caps stored snippets at 240 characters", () => {
    const redacted = redactSnippet(`JWT_SECRET=super-secret-value-12345 ${"x".repeat(300)}`)

    expect(redacted.length).toBeLessThanOrEqual(240)
    expect(redacted).toContain("JWT_SECRET=[REDACTED]")
    expect(redacted).not.toContain("super-secret-value-12345")
  })

  it("does not corrupt benign UUIDs, hashes, versions, or timestamps", () => {
    const source = "v3.14.2 550e8400-e29b-41d4-a716-446655440000 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef 2026-08-01T12:00:00Z"
    expect(redactSensitiveText(source)).toBe(source)
  })
})
