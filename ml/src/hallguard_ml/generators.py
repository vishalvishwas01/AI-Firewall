"""Deterministic M1 generators for explicitly synthetic and benign examples."""

from __future__ import annotations

import hashlib
import json
import random
import string
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from pathlib import Path

from .contracts import (
    DETERMINISTIC_SEED,
    GENERATOR_OUTPUT_SCHEMA_VERSION,
    validate_generator_record,
)

ALNUM = string.ascii_letters + string.digits
BASE64URL = ALNUM + "-_"
ZERO_WIDTH = "\u200b"


@dataclass(frozen=True)
class Variant:
    mutation_id: str
    format: str
    text: str
    candidate: str


@dataclass(frozen=True)
class GeneratorDefinition:
    generator_id: str
    version: int
    label: str
    family: str
    mutation_ids: tuple[str, ...]
    build: Callable[[random.Random], tuple[Variant, ...]]


def _token(rng: random.Random, length: int, alphabet: str = ALNUM) -> str:
    return "".join(rng.choice(alphabet) for _ in range(length))


def _fullwidth(value: str) -> str:
    return "".join(chr(ord(character) + 0xFEE0) if 0x21 <= ord(character) <= 0x7E else character for character in value)


def _assignment_mixed(rng: random.Random) -> tuple[Variant, ...]:
    value = _token(rng, 36, BASE64URL)
    return (
        Variant("env-quoted", "env", f'SERVICE_CREDENTIAL="{value}"', value),
        Variant("json-field", "json", json.dumps({"serviceCredential": value}), value),
        Variant("yaml-field", "yaml", f"service_credential: {value}", value),
        Variant("multiline-config", "code", f'config = {{\n  "auth_secret": "{value}"\n}}', value),
    )


def _unknown_base64url(rng: random.Random) -> tuple[Variant, ...]:
    value = _token(rng, 43, BASE64URL)
    separated = f"{value[:14]}.{value[14:28]}.{value[28:]}"
    wide = _fullwidth(value)
    return (
        Variant("plain", "env", f"service_token={value}", value),
        Variant("zero-width-context", "yaml", f"service_{ZERO_WIDTH}credential: {value}", value),
        Variant("fullwidth-value", "json", f'{{"private_key":"{wide}"}}', wide),
        Variant("separator-insertion", "env", f"AUTH_SECRET={separated}", separated),
    )


def _public_prefix(rng: random.Random) -> tuple[Variant, ...]:
    body = _token(rng, 32, string.ascii_uppercase + string.digits)
    github_value = f"github_pat_SYNTHETIC_{body}"
    classic_value = f"ghp_SYNTHETIC{body}"
    quoted_value = f"github_pat_TEST_{body.lower()}"
    context_value = f"github_pat_test_{body.lower()}"
    return (
        Variant("github-test-prefix", "raw", github_value, github_value),
        Variant("github-classic-prefix", "env", f"GITHUB_TEST_TOKEN={classic_value}", classic_value),
        Variant("quoted", "json", f'{{"test_token":"{quoted_value}"}}', quoted_value),
        Variant("lowercase-context", "env", f"api_key={context_value}", context_value),
    )


def _adversarial_structure(rng: random.Random) -> tuple[Variant, ...]:
    base = _token(rng, 18, string.ascii_letters + string.digits)
    repeated = f"{base[:8]}AAAAAA{base[8:]}"
    separated = f"{base[:6]}_{base[6:12]}-{base[12:]}"
    unicode_value = _fullwidth(f"S{base}9")
    nested = _token(rng, 48, BASE64URL)
    return (
        Variant("repeated-run", "env", f"PRIVATE_SECRET={repeated}", repeated),
        Variant("mixed-separators", "yaml", f"credential: {separated}", separated),
        Variant("unicode-context", "code", f'auth_{ZERO_WIDTH}token = "{unicode_value}"', unicode_value),
        Variant("nested-config", "json", f'{{"auth":{{"credential":"{nested}"}}}}', nested),
    )


def _safe_shapes(rng: random.Random) -> tuple[Variant, ...]:
    hexadecimal = string.hexdigits.lower()[:16]
    uuid_value = "-".join(
        (
            _token(rng, 8, hexadecimal),
            _token(rng, 4, hexadecimal),
            f"4{_token(rng, 3, hexadecimal)}",
            f"a{_token(rng, 3, hexadecimal)}",
            _token(rng, 12, hexadecimal),
        )
    )
    hash_value = _token(rng, 64, string.hexdigits.lower()[:16])
    version_value = f"package-v{rng.randint(1, 9)}.{rng.randint(0, 20)}.{rng.randint(0, 40)}-beta.1"
    timestamp_value = f"2026-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}T12:34:56.000Z"
    return (
        Variant("uuid", "json", f'{{"requestId":"{uuid_value}"}}', uuid_value),
        Variant("hash", "raw", f"commit {hash_value}", hash_value),
        Variant("semantic-version", "code", f'const release = "{version_value}"', version_value),
        Variant("timestamp", "json", f'{{"createdAt":"{timestamp_value}"}}', timestamp_value),
    )


def _developer_config(rng: random.Random) -> tuple[Variant, ...]:
    placeholder = "YOUR_API_KEY_HERE"
    example_url = "https://api.example.com/v1/resources"
    path = f"C:/projects/hallguard/src/module_{rng.randint(10, 99)}/config.ts"
    identifier = f"DEFAULT_REQUEST_TIMEOUT_{rng.randint(1000, 9999)}"
    return (
        Variant("placeholder", "env", f"API_KEY={placeholder}", placeholder),
        Variant("example-url", "yaml", f"service_url: {example_url}", example_url),
        Variant("path", "code", f'const configPath = "{path}"', path),
        Variant("ordinary-identifier", "code", f"const value = {identifier}", identifier),
    )


def _prose_and_package(rng: random.Random) -> tuple[Variant, ...]:
    package = f"@hallguard/detector-{rng.randint(10, 99)}"
    documentation = "credential_validation_example"
    enum_value = f"AUTH_STATE_RETRY_{rng.randint(10, 99)}"
    test_name = f"test_rejects_invalid_config_{rng.randint(100, 999)}"
    return (
        Variant("package-version", "prose", f"Install {package} version 2.4.1.", package),
        Variant("documentation", "prose", f"The {documentation} function uses placeholder input.", documentation),
        Variant("enum-constant", "code", f"case {enum_value}:", enum_value),
        Variant("test-name", "code", f"def {test_name}(): pass", test_name),
    )


def _near_miss(rng: random.Random) -> tuple[Variant, ...]:
    short = f"demo{rng.randint(1000, 9999)}"
    repeated = "placeholder_placeholder_value"
    public_id = f"publishable_demo_identifier_{rng.randint(100, 999)}"
    tutorial = f"sample_token_for_tutorial_{rng.randint(100, 999)}"
    return (
        Variant("short-token", "env", f"TOKEN={short}", short),
        Variant("repeated-placeholder", "json", f'{{"secret":"{repeated}"}}', repeated),
        Variant("public-id", "yaml", f"public_client_id: {public_id}", public_id),
        Variant("tutorial-example", "prose", f"Use {tutorial} only in documentation.", tutorial),
    )


GENERATOR_DEFINITIONS = (
    GeneratorDefinition(
        "secret.assignment.mixed-v1",
        1,
        "sensitive",
        "unknown-mixed-assignment",
        ("env-quoted", "json-field", "yaml-field", "multiline-config"),
        _assignment_mixed,
    ),
    GeneratorDefinition(
        "secret.base64url.unknown-v1",
        1,
        "sensitive",
        "unknown-base64url",
        ("plain", "zero-width-context", "fullwidth-value", "separator-insertion"),
        _unknown_base64url,
    ),
    GeneratorDefinition(
        "secret.public-prefix.synthetic-v1",
        1,
        "sensitive",
        "documented-public-prefix-shape",
        ("github-test-prefix", "github-classic-prefix", "quoted", "lowercase-context"),
        _public_prefix,
    ),
    GeneratorDefinition(
        "secret.adversarial.structure-v1",
        1,
        "sensitive",
        "adversarial-structural-secret",
        ("repeated-run", "mixed-separators", "unicode-context", "nested-config"),
        _adversarial_structure,
    ),
    GeneratorDefinition(
        "benign.safe-shapes-v1",
        1,
        "benign",
        "known-safe-shapes",
        ("uuid", "hash", "semantic-version", "timestamp"),
        _safe_shapes,
    ),
    GeneratorDefinition(
        "benign.developer-config-v1",
        1,
        "benign",
        "developer-config",
        ("placeholder", "example-url", "path", "ordinary-identifier"),
        _developer_config,
    ),
    GeneratorDefinition(
        "benign.prose-and-package-v1",
        1,
        "benign",
        "ordinary-developer-text",
        ("package-version", "documentation", "enum-constant", "test-name"),
        _prose_and_package,
    ),
    GeneratorDefinition(
        "benign.near-miss-v1",
        1,
        "benign",
        "secret-like-near-miss",
        ("short-token", "repeated-placeholder", "public-id", "tutorial-example"),
        _near_miss,
    ),
)


def _derived_rng(seed: int, generator_id: str, group_index: int) -> random.Random:
    material = f"{seed}:{generator_id}:{group_index}".encode()
    # Deterministic synthetic fixtures, never cryptographic key material.
    return random.Random(int.from_bytes(hashlib.sha256(material).digest()[:8], "big"))  # noqa: S311


def _record(definition: GeneratorDefinition, variant: Variant, group_index: int, seed: int) -> dict[str, object]:
    start = variant.text.index(variant.candidate)
    group_material = f"{seed}:{definition.generator_id}:{definition.version}:{group_index}"
    group_id = f"grp-{hashlib.sha256(group_material.encode()).hexdigest()[:16]}"
    record_material = f"{group_id}:{variant.mutation_id}:{variant.text}"
    value: dict[str, object] = {
        "schemaVersion": GENERATOR_OUTPUT_SCHEMA_VERSION,
        "recordId": f"rec-{hashlib.sha256(record_material.encode()).hexdigest()[:20]}",
        "generatorId": definition.generator_id,
        "generatorVersion": definition.version,
        "seed": seed,
        "templateGroupId": group_id,
        "label": definition.label,
        "family": definition.family,
        "format": variant.format,
        "mutationId": variant.mutation_id,
        "synthetic": True,
        "text": variant.text,
        "candidateStart": start,
        "candidateEnd": start + len(variant.candidate),
    }
    validate_generator_record(value)
    return value


def generate_records(groups_per_generator: int = 8, seed: int = DETERMINISTIC_SEED) -> list[dict[str, object]]:
    if seed != DETERMINISTIC_SEED:
        raise ValueError(f"M1 supports only the reviewed deterministic seed {DETERMINISTIC_SEED}")
    if not 1 <= groups_per_generator <= 10_000:
        raise ValueError("groups_per_generator must be between 1 and 10000")
    records: list[dict[str, object]] = []
    for definition in GENERATOR_DEFINITIONS:
        for group_index in range(groups_per_generator):
            variants = definition.build(_derived_rng(seed, definition.generator_id, group_index))
            if tuple(variant.mutation_id for variant in variants) != definition.mutation_ids:
                raise ValueError(f"{definition.generator_id} emitted an undocumented mutation set")
            records.extend(_record(definition, variant, group_index, seed) for variant in variants)
    return records


def dataset_digest(records: Iterable[dict[str, object]]) -> str:
    digest = hashlib.sha256()
    for record in records:
        digest.update(json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode())
        digest.update(b"\n")
    return digest.hexdigest()


def write_jsonl(records: list[dict[str, object]], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(f"{output.suffix}.tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
            handle.write("\n")
    temporary.replace(output)
