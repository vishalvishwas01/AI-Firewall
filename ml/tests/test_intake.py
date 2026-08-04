from __future__ import annotations

import json
import tempfile
import unittest
import zipfile
from datetime import date, timedelta
from pathlib import Path

from hallguard_ml.contracts import ContractError, validate_intake_evidence
from hallguard_ml.intake import IntakeError, SOURCES, scan_archive


class IntakeTests(unittest.TestCase):
    def _archive(self, root: Path, *, traversal: bool = False) -> Path:
        archive = root / "source.zip"
        with zipfile.ZipFile(archive, "w") as bundle:
            bundle.writestr(
                "cpython-revision/LICENSE",
                "PYTHON SOFTWARE FOUNDATION LICENSE VERSION 2\n",
            )
            bundle.writestr("cpython-revision/Lib/good.py", "value = 'ordinary-example'\n")
            bundle.writestr("cpython-revision/Lib/test/rejected.py", "test = True\n")
            bundle.writestr("cpython-revision/Lib/contact.py", "owner = 'person@example.com'\n")
            bundle.writestr("cpython-revision/README.md", "outside allowlist\n")
            if traversal:
                bundle.writestr("cpython-revision/../escape.py", "unsafe = True\n")
        return archive

    def test_scans_to_ignored_style_quarantine_without_retaining_rejections(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = self._archive(root)
            accepted = root / ".b2-quarantine" / "accepted" / "2026-08-04"
            revision = "a" * 40
            evidence = scan_archive(SOURCES[0], archive, revision, accepted, "b" * 64)
            self.assertEqual(evidence["acceptedFileCount"], 1)
            self.assertEqual(evidence["rejectedEntryCount"], 3)
            self.assertEqual(
                evidence["rejectionReasonCounts"],
                {"email-address": 1, "excluded-path": 1, "outside-allowlist": 1},
            )
            destination = accepted / SOURCES[0].source_id / revision
            self.assertTrue((destination / "Lib" / "good.py").is_file())
            self.assertFalse((destination / "Lib" / "contact.py").exists())

    def test_archive_traversal_fails_closed_and_cleans_staging(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = self._archive(root, traversal=True)
            accepted = root / ".b2-quarantine" / "accepted" / "2026-08-04"
            with self.assertRaisesRegex(IntakeError, "traversal"):
                scan_archive(SOURCES[0], archive, "a" * 40, accepted, "b" * 64)
            self.assertFalse((accepted / f".{SOURCES[0].source_id}.tmp").exists())
            self.assertFalse((root / "escape.py").exists())

    def test_content_free_evidence_contract_preserves_post_intake_gate(self) -> None:
        retrieved = date(2026, 8, 4)
        sources = []
        for source in SOURCES:
            sources.append(
                {
                    "sourceId": source.source_id,
                    "repository": source.repository,
                    "revision": "a" * 40,
                    "archiveSha256": "b" * 64,
                    "archiveDeleted": True,
                    "acceptedFileCount": 1,
                    "acceptedByteCount": 20,
                    "rejectedEntryCount": 1,
                    "rejectionReasonCounts": {"outside-allowlist": 1},
                    "acceptedTreeSha256": "c" * 64,
                    "scanStatus": "passed-with-rejections-filtered",
                    "license": {
                        "spdxId": source.spdx_id,
                        "sourcePath": "LICENSE",
                        "sha256": "d" * 64,
                        "markerVerified": True,
                        "attribution": source.attribution,
                        "verificationStatus": "pending-post-intake-human-review",
                    },
                }
            )
        evidence = {
            "schemaVersion": 1,
            "reportVersion": "b2-intake-evidence-v1",
            "status": "sanitized-quarantine-awaiting-human-review",
            "releaseEligible": False,
            "retrievedOn": retrieved.isoformat(),
            "retentionExpiresOn": (retrieved + timedelta(days=30)).isoformat(),
            "approvalPackageVersion": "b2-intake-approval-v1",
            "rawContentCommitted": False,
            "acceptedContentDeleted": False,
            "featureExtractionPerformed": False,
            "trainingPerformed": False,
            "sources": sources,
            "gates": {
                "humanApprovalRecorded": True,
                "sourcePinsVerified": True,
                "archiveHashesVerified": True,
                "pathAllowlistApplied": True,
                "quarantineScanPassed": True,
                "originalArchivesDeleted": True,
                "postIntakeHumanReview": False,
                "datasetApproved": False,
                "representativeEvaluationComplete": False,
                "calibrationApproved": False,
            },
            "nextStep": "post-intake-human-review",
        }
        validate_intake_evidence(evidence)
        self.assertNotIn("paths", json.dumps(evidence))

        evidence["gates"]["datasetApproved"] = True
        with self.assertRaisesRegex(ContractError, "overclaim"):
            validate_intake_evidence(evidence)


if __name__ == "__main__":
    unittest.main()
