from __future__ import annotations

import copy
import unittest

from hallguard_ml.a4_evidence import A4EvidenceError, validate_a4_evidence


ARTIFACT_SHA256 = "b1dbb154bce2934e1a803ce897561d9a3614892e798d72d92d35f475c42c2651"
EVIDENCE = {
    "schemaVersion": 1,
    "evidenceVersion": "a4-evidence-manifest-v1",
    "evidenceType": "extension-latency",
    "candidateArtifactSha256": ARTIFACT_SHA256,
    "status": "passed",
    "sourceRevision": "0" * 64,
    "measurements": {"p95Milliseconds": 4.0, "sampleCount": 100},
    "rawContentIncluded": False,
}


class A4EvidenceTests(unittest.TestCase):
    def test_validates_content_free_candidate_bound_evidence(self) -> None:
        validate_a4_evidence(EVIDENCE, candidate_artifact_sha256=ARTIFACT_SHA256)

    def test_rejects_content_and_wrong_candidate_binding(self) -> None:
        for field, value in (("rawContentIncluded", True), ("candidateArtifactSha256", "1" * 64)):
            evidence = copy.deepcopy(EVIDENCE)
            evidence[field] = value
            with self.subTest(field=field), self.assertRaises(A4EvidenceError):
                validate_a4_evidence(evidence, candidate_artifact_sha256=ARTIFACT_SHA256)


if __name__ == "__main__":
    unittest.main()
