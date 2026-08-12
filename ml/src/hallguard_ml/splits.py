"""Deterministic label-stratified group splitting with zero template leakage."""

from __future__ import annotations

import hashlib
from collections import defaultdict
from dataclasses import dataclass
from typing import cast

from .contracts import DETERMINISTIC_SEED


@dataclass(frozen=True)
class GroupedSplit:
    train: tuple[int, ...]
    validation: tuple[int, ...]
    test: tuple[int, ...]


def _rank(seed: int, label: int, group_id: str) -> bytes:
    return hashlib.sha256(f"{seed}:{label}:{group_id}".encode()).digest()


def _allocate(group_ids: list[str]) -> tuple[set[str], set[str], set[str]]:
    if len(group_ids) < 5:
        raise ValueError("each label requires at least five template groups")
    validation_count = max(1, round(len(group_ids) * 0.20))
    test_count = max(1, round(len(group_ids) * 0.20))
    if validation_count + test_count >= len(group_ids):
        raise ValueError("not enough groups for non-empty train/validation/test splits")
    train_count = len(group_ids) - validation_count - test_count
    return (
        set(group_ids[:train_count]),
        set(group_ids[train_count : train_count + validation_count]),
        set(group_ids[train_count + validation_count :]),
    )


def grouped_stratified_split(
    rows: list[dict[str, object]],
    seed: int = DETERMINISTIC_SEED,
) -> GroupedSplit:
    if seed != DETERMINISTIC_SEED:
        raise ValueError("split seed must match the reviewed deterministic seed")
    labels_by_group: dict[str, set[int]] = defaultdict(set)
    for row in rows:
        labels_by_group[str(row["templateGroupId"])].add(cast(int, row["label"]))
    mixed = [group_id for group_id, labels in labels_by_group.items() if len(labels) != 1]
    if mixed:
        raise ValueError("a template group cannot contain mixed labels")

    groups_by_label: dict[int, list[str]] = defaultdict(list)
    for group_id, labels in labels_by_group.items():
        label = next(iter(labels))
        groups_by_label[label].append(group_id)
    if set(groups_by_label) != {0, 1}:
        raise ValueError("both benign and sensitive groups are required")

    split_groups: dict[str, set[str]] = {"train": set(), "validation": set(), "test": set()}
    for label, group_ids in groups_by_label.items():
        ordered = sorted(group_ids, key=lambda group_id: _rank(seed, label, group_id))
        train, validation, test = _allocate(ordered)
        split_groups["train"].update(train)
        split_groups["validation"].update(validation)
        split_groups["test"].update(test)

    indexes = {
        name: tuple(index for index, row in enumerate(rows) if str(row["templateGroupId"]) in group_ids)
        for name, group_ids in split_groups.items()
    }
    if set(indexes["train"]) & set(indexes["validation"]) or set(indexes["train"]) & set(indexes["test"]):
        raise ValueError("group split overlap detected")
    if set(indexes["validation"]) & set(indexes["test"]):
        raise ValueError("group split overlap detected")
    return GroupedSplit(**indexes)
