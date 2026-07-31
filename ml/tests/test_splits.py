from __future__ import annotations

import unittest

from hallguard_ml.features import build_feature_rows
from hallguard_ml.generators import generate_records
from hallguard_ml.splits import grouped_stratified_split


class GroupedSplitTests(unittest.TestCase):
    def test_split_is_deterministic_balanced_and_group_disjoint(self) -> None:
        rows = build_feature_rows(generate_records(groups_per_generator=8))
        first = grouped_stratified_split(rows)
        second = grouped_stratified_split(rows)
        self.assertEqual(first, second)
        self.assertEqual((len(first.train), len(first.validation), len(first.test)), (160, 48, 48))

        group_sets = []
        for indexes in (first.train, first.validation, first.test):
            groups = {rows[index]["templateGroupId"] for index in indexes}
            labels = [rows[index]["label"] for index in indexes]
            group_sets.append(groups)
            self.assertEqual(labels.count(0), labels.count(1))
        self.assertFalse(group_sets[0] & group_sets[1])
        self.assertFalse(group_sets[0] & group_sets[2])
        self.assertFalse(group_sets[1] & group_sets[2])

    def test_mixed_label_group_fails_closed(self) -> None:
        rows = build_feature_rows(generate_records(groups_per_generator=1))
        rows[0]["templateGroupId"] = rows[-1]["templateGroupId"]
        with self.assertRaisesRegex(ValueError, "mixed labels"):
            grouped_stratified_split(rows)


if __name__ == "__main__":
    unittest.main()
