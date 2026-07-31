export type ShadowFixtureKind = "critical-known" | "unknown-format" | "benign"

export type ShadowFixture = {
  id: string
  groupId: string
  kind: ShadowFixtureKind
  text: string
  forbiddenValues?: string[]
  tags: string[]
}

const unknown = (
  id: string,
  groupId: string,
  text: string,
  candidate: string,
  tags: string[]
): ShadowFixture => ({
  id,
  groupId,
  kind: "unknown-format",
  text,
  forbiddenValues: [candidate],
  tags
})

export const shadowFixtures: ShadowFixture[] = [
  {
    id: "known-env-secret",
    groupId: "known-assignment",
    kind: "critical-known",
    text: "JWT_SECRET=synthetic-critical-value-12345",
    forbiddenValues: ["synthetic-critical-value-12345"],
    tags: ["env", "assignment"]
  },
  {
    id: "known-prefixed-token",
    groupId: "known-prefix",
    kind: "critical-known",
    text: "token ghp_123456789012345678901234567890123456",
    forbiddenValues: ["ghp_123456789012345678901234567890123456"],
    tags: ["prefix"]
  },
  unknown(
    "unknown-json-credential",
    "unknown-json",
    '{"client_credential":"Hg7pQ2xN9vK4mR8sT6wY3zC5"}',
    "Hg7pQ2xN9vK4mR8sT6wY3zC5",
    ["json", "config"]
  ),
  unknown(
    "unknown-yaml-credential",
    "unknown-yaml",
    "session_credential: Zq8M2vR7kL4pT9xN6cW3yH5s",
    "Zq8M2vR7kL4pT9xN6cW3yH5s",
    ["yaml", "config"]
  ),
  unknown(
    "unknown-multiline-config",
    "unknown-multiline",
    "service: billing\nenvironment: production\ncredential: J7mQ4vT9xK2pR8wN6cZ3yH5s",
    "J7mQ4vT9xK2pR8wN6cZ3yH5s",
    ["multiline", "config"]
  ),
  unknown(
    "unknown-zero-width-context",
    "unknown-unicode",
    "creden\u200Btial=K9vT3mQ7xR2pN8wL6cZ4yH5s",
    "K9vT3mQ7xR2pN8wL6cZ4yH5s",
    ["unicode", "zero-width", "assignment"]
  ),
  {
    id: "benign-uuid-and-version",
    groupId: "benign-safe-shapes",
    kind: "benign",
    text: "Release v3.14.2 uses request id 550e8400-e29b-41d4-a716-446655440000.",
    tags: ["uuid", "version"]
  },
  {
    id: "benign-hash",
    groupId: "benign-safe-shapes",
    kind: "benign",
    text: "Verify artifact 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.",
    tags: ["hash"]
  },
  {
    id: "benign-path-and-timestamp",
    groupId: "benign-code",
    kind: "benign",
    text: "Read /usr/local/share/hallguard/config.json at 2026-08-01T12:00:00Z.",
    tags: ["path", "timestamp"]
  },
  {
    id: "benign-placeholder-config",
    groupId: "benign-code",
    kind: "benign",
    text: "credential=YOUR_CREDENTIAL_HERE and endpoint=https://example.invalid/api",
    tags: ["placeholder", "config"]
  },
  {
    id: "benign-ordinary-constant",
    groupId: "benign-code",
    kind: "benign",
    text: "const CACHE_NAMESPACE = 'hallguard-development-cache';",
    tags: ["identifier", "source-code"]
  }
]
