"""Fail-closed validation for the M3 evidence-only representative coverage plan."""

from __future__ import annotations

import re
from datetime import date
from typing import Any, TypedDict

GAP_ANALYSIS_CONTRACT_ID = "hallguard-m3-representative-gap-analysis-v1"
GAP_ANALYSIS_VERSION = "m3-representative-gap-analysis-v1"
GAP_ANALYSIS_FILE = "m3-representative-gap-analysis-v1.analysis.json"
SCOPE_AMENDMENT_CONTRACT_ID = "hallguard-m3-representative-gap-scope-amendment-v1"
SCOPE_AMENDMENT_VERSION = "m3-representative-gap-scope-amendment-v1"
SCOPE_AMENDMENT_FILE = "m3-representative-gap-scope-amendment-v1.review.json"
WORKFLOW_AUTHORIZATION_CONTRACT_ID = "hallguard-m3-workflow-authorization-v1"
WORKFLOW_AUTHORIZATION_VERSION = "m3-workflow-authorization-v1"
WORKFLOW_AUTHORIZATION_FILE = "m3-workflow-authorization-v1.review.json"
REQUIRED_STRATA = {
    "ordinary-identifiers",
    "paths-urls-and-versions",
    "hashes-uuids-and-timestamps",
    "placeholders-and-examples",
    "secret-keyword-context-with-benign-values",
    "high-entropy-benign-constants",
}
OBSERVED_STRATA = {
    "ordinary-identifiers",
    "paths-urls-and-versions",
    "hashes-uuids-and-timestamps",
}
MISSING_STRATA = REQUIRED_STRATA - OBSERVED_STRATA
SOURCE_BINDINGS = {
    "cpython-public-corpus": {
        "repository": "https://github.com/python/cpython",
        "revision": "ef0affbf7c1cb8bbc136b65cc0f02985f8c568b5",
        "archiveSha256": "ee53a24cf590635ff26039c5f37ae64f9c7d9762c38f0ae5cb084f49a9d8b9e9",
        "sanitizedTreeSha256": "f32ee96fcead6aa1935569f0f87d6f639548f133064eb68f99b2ce398e69c0a4",
        "spdxId": "PSF-2.0",
        "attribution": "Python Software Foundation; PSF-2.0 and applicable file-level notices",
    },
    "kubernetes-website-public-corpus": {
        "repository": "https://github.com/kubernetes/website",
        "revision": "3281a6a4f4c1505e18040f3915eb226cc41987c3",
        "archiveSha256": "eb25d270d604a1334d5ddd5d07335f2146dfaaf3171a02b41ec5473b1312722f",
        "sanitizedTreeSha256": "9f9f61c5e4ae1a28744048d438c5605c949908060443fefb54206fd29f6613f7",
        "spdxId": "CC-BY-4.0",
        "attribution": "The Kubernetes Authors; Creative Commons Attribution 4.0 International",
    },
    "nodejs-public-corpus": {
        "repository": "https://github.com/nodejs/node",
        "revision": "15495a069fc8eaec8c70ea88781ae241a87fd25d",
        "archiveSha256": "d1bbf0b2cd7c672c691c6ae11241670c69113066a82f6c7c289ffbcbdfab6b7e",
        "sanitizedTreeSha256": "a43fa77d4e6cd16c3cdf673bf37e0879afba51278acb1235dd93656918046210",
        "spdxId": "MIT",
        "attribution": "Node.js contributors; MIT; dependencies and third-party content excluded",
    },
}


class SelectorContract(TypedDict):
    selectorId: str
    selectorRequirements: set[str]
    mandatoryExclusions: set[str]


SELECTORS: dict[str, SelectorContract] = {
    "placeholders-and-examples": {
        "selectorId": "placeholder-example-context-v1",
        "selectorRequirements": {
            "candidate-length-8-to-160",
            "approved-placeholder-marker-in-value-or-bounded-context",
            "documentation-or-example-path-family",
            "deterministic-group-by-source-and-path-family",
        },
        "mandatoryExclusions": {
            "known-token-pattern",
            "credential-assignment-with-non-placeholder-value",
            "scanner-hit-file",
            "notice-marker-file",
            "personal-data-pattern",
            "test-vendor-third-party-path",
        },
    },
    "secret-keyword-context-with-benign-values": {
        "selectorId": "secret-keyword-benign-context-v1",
        "selectorRequirements": {
            "candidate-length-8-to-160",
            "secret-keyword-within-normalized-context-96",
            "approved-benign-marker-or-schema-default-context",
            "deterministic-group-by-source-and-path-family",
        },
        "mandatoryExclusions": {
            "known-token-pattern",
            "credential-assignment-with-non-placeholder-value",
            "scanner-hit-file",
            "notice-marker-file",
            "personal-data-pattern",
            "test-vendor-third-party-path",
        },
    },
    "high-entropy-benign-constants": {
        "selectorId": "high-entropy-benign-constant-v1",
        "selectorRequirements": {
            "candidate-length-16-to-160",
            "candidate-entropy-at-least-3.5",
            "non-secret-purpose-confirmed-in-transient-context",
            "deterministic-group-by-source-and-path-family",
        },
        "mandatoryExclusions": {
            "known-token-pattern",
            "credential-assignment",
            "scanner-hit-file",
            "notice-marker-file",
            "personal-data-pattern",
            "private-key-or-certificate-shape",
            "test-vendor-third-party-path",
        },
    },
}


class GapAnalysisError(ValueError):
    """Raised when the evidence-only M3 plan exceeds its reviewed stop boundary."""


def _exact(value: Any, fields: set[str], location: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != fields:
        raise GapAnalysisError(f"{location} fields mismatch")
    return value


def _unique_strings(value: Any, expected: set[str], location: str) -> None:
    if not isinstance(value, list) or len(value) != len(set(value)) or set(value) != expected:
        raise GapAnalysisError(f"{location} is invalid")


def validate_representative_gap_analysis(value: dict[str, Any]) -> None:
    _exact(
        value,
        {
            "schemaVersion",
            "analysisVersion",
            "analyzedOn",
            "status",
            "basis",
            "missingStrata",
            "candidateSources",
            "privacyBoundary",
            "authorization",
            "gates",
            "nextStep",
        },
        "gapAnalysis",
    )
    if (
        value["schemaVersion"] != 1
        or value["analysisVersion"] != GAP_ANALYSIS_VERSION
        or value["status"] != "evidence-complete-awaiting-three-role-scope-amendment"
        or value["nextStep"] != "m3-obtain-three-role-scope-amendment"
    ):
        raise GapAnalysisError("gap analysis boundary is invalid")
    if not isinstance(value["analyzedOn"], str):
        raise GapAnalysisError("gap analysis date is invalid")
    try:
        if date.fromisoformat(value["analyzedOn"]).isoformat() != value["analyzedOn"]:
            raise GapAnalysisError("gap analysis date is invalid")
    except ValueError as error:
        raise GapAnalysisError("gap analysis date is invalid") from error

    basis = _exact(
        value["basis"],
        {
            "featureVersion",
            "representativeEvidenceVersion",
            "representativeReviewVersion",
            "datasetSha256",
            "recordCount",
            "requiredRiskStrata",
            "observedRiskStrata",
            "missingRiskStrata",
        },
        "gapAnalysis.basis",
    )
    if (
        basis["featureVersion"] != "candidate-features-v1"
        or basis["representativeEvidenceVersion"] != "b2-representative-set-v1"
        or basis["representativeReviewVersion"] != "b2-representative-review-v1"
        or basis["datasetSha256"] != "4cefd4c209a264353d49d9d5fbfa586cd9554cccf1180d3e8b29d69a5b40cbab"
        or basis["recordCount"] != 340
    ):
        raise GapAnalysisError("gap analysis evidence binding is invalid")
    _unique_strings(basis["requiredRiskStrata"], REQUIRED_STRATA, "required strata")
    _unique_strings(basis["observedRiskStrata"], OBSERVED_STRATA, "observed strata")
    _unique_strings(basis["missingRiskStrata"], MISSING_STRATA, "missing strata")

    strata = value["missingStrata"]
    if not isinstance(strata, list) or len(strata) != 3:
        raise GapAnalysisError("three missing-strata plans are required")
    seen: set[str] = set()
    for item in strata:
        plan = _exact(
            item,
            {
                "riskStratum",
                "definition",
                "selectorId",
                "selectorRequirements",
                "mandatoryExclusions",
                "eligibleSourceIds",
                "minimumEvidence",
                "transientHumanReviewRequired",
            },
            "gapAnalysis.missingStrata",
        )
        stratum = plan["riskStratum"]
        if stratum not in SELECTORS or stratum in seen:
            raise GapAnalysisError("missing-strata plan ids are invalid")
        expected = SELECTORS[stratum]
        if (
            plan["selectorId"] != expected["selectorId"]
            or not isinstance(plan["definition"], str)
            or not 40 <= len(plan["definition"]) <= 240
            or plan["transientHumanReviewRequired"] is not True
        ):
            raise GapAnalysisError(f"{stratum} selector boundary is invalid")
        _unique_strings(plan["selectorRequirements"], expected["selectorRequirements"], f"{stratum} requirements")
        _unique_strings(plan["mandatoryExclusions"], expected["mandatoryExclusions"], f"{stratum} exclusions")
        _unique_strings(plan["eligibleSourceIds"], set(SOURCE_BINDINGS), f"{stratum} sources")
        if plan["minimumEvidence"] != {"records": 60, "sources": 2, "pathFamilyGroups": 6}:
            raise GapAnalysisError(f"{stratum} minimum evidence is invalid")
        seen.add(stratum)
    if seen != MISSING_STRATA:
        raise GapAnalysisError("missing-strata plans are incomplete")

    sources = value["candidateSources"]
    if not isinstance(sources, list) or len(sources) != 3:
        raise GapAnalysisError("three exact pinned sources are required")
    seen_sources: set[str] = set()
    for item in sources:
        source = _exact(
            item,
            {
                "sourceId",
                "repository",
                "revision",
                "archiveSha256",
                "sanitizedTreeSha256",
                "spdxId",
                "attribution",
                "scopeAmendmentRequired",
            },
            "gapAnalysis.candidateSources",
        )
        source_id = source["sourceId"]
        if source_id not in SOURCE_BINDINGS or source_id in seen_sources:
            raise GapAnalysisError("candidate source ids are invalid")
        if source != {"sourceId": source_id, **SOURCE_BINDINGS[source_id], "scopeAmendmentRequired": True}:
            raise GapAnalysisError(f"candidate source {source_id} binding is invalid")
        if re.fullmatch(r"[0-9a-f]{40}", source["revision"]) is None:
            raise GapAnalysisError(f"candidate source {source_id} revision is invalid")
        seen_sources.add(source_id)

    if value["privacyBoundary"] != {
        "containsCustomerContent": False,
        "containsReportSnippets": False,
        "containsTelemetryPayloads": False,
        "containsProductionLogs": False,
        "containsRealSecrets": False,
        "containsPersonalData": False,
        "rawContentCommitAllowed": False,
        "derivedRowsContentFree": True,
        "quarantineDeletionRequired": True,
    }:
        raise GapAnalysisError("gap analysis privacy boundary is invalid")
    if value["authorization"] != {
        "networkAccessAuthorized": False,
        "sourceRehydrationAuthorized": False,
        "featureExtractionAuthorized": False,
        "representativeDatasetReplacementAuthorized": False,
        "trainingAuthorized": False,
        "releaseAuthorized": False,
    }:
        raise GapAnalysisError("gap analysis cannot authorize execution")
    if value["gates"] != {
        "gapAnalysisComplete": True,
        "existingPinsAndLicensesBound": True,
        "deterministicSelectorsSpecified": True,
        "privacyBoundarySpecified": True,
        "privacyScopeAmendmentApproved": False,
        "securityScopeAmendmentApproved": False,
        "maintainerScopeAmendmentApproved": False,
        "networkAuthorizationRecorded": False,
        "selectorsImplemented": False,
        "datasetChanged": False,
        "trainingEligible": False,
        "releaseEligible": False,
    }:
        raise GapAnalysisError("gap analysis gates must remain blocked")


def validate_representative_gap_scope_amendment(value: dict[str, Any]) -> None:
    _exact(
        value,
        {
            "schemaVersion",
            "amendmentVersion",
            "reviewType",
            "reviewedOn",
            "status",
            "analysisVersion",
            "scope",
            "reviewers",
            "authorization",
            "gates",
            "nextStep",
        },
        "gapScopeAmendment",
    )
    if (
        value["schemaVersion"] != 1
        or value["amendmentVersion"] != SCOPE_AMENDMENT_VERSION
        or value["reviewType"] != "HUMAN_APPROVAL"
        or value["status"] != "approved-selector-scope-awaiting-network-authorization"
        or value["analysisVersion"] != GAP_ANALYSIS_VERSION
        or value["nextStep"] != "m3-request-one-time-exact-pin-network-authorization"
    ):
        raise GapAnalysisError("gap scope-amendment boundary is invalid")
    if not isinstance(value["reviewedOn"], str):
        raise GapAnalysisError("gap scope-amendment date is invalid")
    try:
        if date.fromisoformat(value["reviewedOn"]).isoformat() != value["reviewedOn"]:
            raise GapAnalysisError("gap scope-amendment date is invalid")
    except ValueError as error:
        raise GapAnalysisError("gap scope-amendment date is invalid") from error

    scope = value["scope"]
    if not isinstance(scope, dict) or set(scope) != {
        "riskStrata",
        "selectorIds",
        "sourceIds",
        "transientHumanReviewRequired",
        "existingPinsOnly",
        "existingLicensesAndAttributionOnly",
        "mandatoryExclusionsUnchanged",
        "minimumEvidenceUnchanged",
        "quarantineDeletionRequired",
    }:
        raise GapAnalysisError("gap scope-amendment scope fields mismatch")
    _unique_strings(scope["riskStrata"], MISSING_STRATA, "scope-amendment risk strata")
    _unique_strings(
        scope["selectorIds"],
        {contract["selectorId"] for contract in SELECTORS.values()},
        "scope-amendment selectors",
    )
    _unique_strings(scope["sourceIds"], set(SOURCE_BINDINGS), "scope-amendment sources")
    if any(
        scope[field] is not True
        for field in (
            "transientHumanReviewRequired",
            "existingPinsOnly",
            "existingLicensesAndAttributionOnly",
            "mandatoryExclusionsUnchanged",
            "minimumEvidenceUnchanged",
            "quarantineDeletionRequired",
        )
    ):
        raise GapAnalysisError("gap scope-amendment controls must remain enabled")

    identities = {"privacy": "umang aggarwal", "security": "vishal vishwas", "maintainer": "tushar garg"}
    expected_scopes = {
        "privacy": (
            "transient context handling, prohibited-data exclusions, content-free output, retention, "
            "and quarantine deletion"
        ),
        "security": (
            "selector definitions, entropy threshold, token and credential exclusions, scanner exclusions, "
            "poisoning controls, and minimum coverage"
        ),
        "maintainer": (
            "exact pinned source revisions, path-family scope, PSF-2.0, CC-BY-4.0 and MIT handling, "
            "notice exclusions, and attribution wording"
        ),
    }
    reviewers = value["reviewers"]
    if not isinstance(reviewers, list) or len(reviewers) != 3:
        raise GapAnalysisError("gap scope amendment requires three reviewers")
    seen: set[str] = set()
    for reviewer in reviewers:
        if not isinstance(reviewer, dict):
            raise GapAnalysisError("gap scope amendment reviewer must be an object")
        role = reviewer.get("role")
        expected_fields = {"role", "identity", "relayedDecision", "decision", "scope"}
        if role == "maintainer":
            expected_fields.add("normalizationNote")
        if set(reviewer) != expected_fields or role not in identities or role in seen:
            raise GapAnalysisError("gap scope amendment reviewer fields are invalid")
        if (
            " ".join(str(reviewer["identity"]).lower().split()) != identities[role]
            or reviewer["decision"] != "approve-selector-scope"
            or reviewer["scope"] != expected_scopes[role]
        ):
            raise GapAnalysisError("gap scope amendment reviewer decision is invalid")
        if role == "maintainer":
            expected_note = (
                "Relayed decision 'approvee' normalized to 'approve' as an obvious spelling correction; "
                "scope was not expanded."
            )
            if reviewer["relayedDecision"] != "approvee" or reviewer["normalizationNote"] != expected_note:
                raise GapAnalysisError("maintainer decision normalization audit is invalid")
        elif reviewer["relayedDecision"] != "approve":
            raise GapAnalysisError("reviewer relayed decision is invalid")
        seen.add(role)
    if seen != set(identities):
        raise GapAnalysisError("gap scope amendment reviewer roles are incomplete")

    if value["authorization"] != {
        "selectorImplementationAuthorized": True,
        "networkAccessAuthorized": False,
        "sourceRehydrationAuthorized": False,
        "featureExtractionExecutionAuthorized": False,
        "representativeDatasetReplacementAuthorized": False,
        "trainingAuthorized": False,
        "releaseAuthorized": False,
    }:
        raise GapAnalysisError("gap scope amendment authorization exceeds approval")
    if value["gates"] != {
        "privacyScopeAmendmentApproved": True,
        "securityScopeAmendmentApproved": True,
        "maintainerScopeAmendmentApproved": True,
        "networkAuthorizationRecorded": False,
        "sourceRehydrationEligible": False,
        "datasetChangeEligible": False,
        "trainingEligible": False,
        "releaseEligible": False,
    }:
        raise GapAnalysisError("gap scope amendment execution gates must remain blocked")


def validate_m3_workflow_authorization(value: dict[str, Any]) -> None:
    _exact(
        value,
        {
            "schemaVersion",
            "authorizationVersion",
            "reviewType",
            "reviewedOn",
            "status",
            "scopeAmendmentVersion",
            "reviewers",
            "authorization",
            "evidenceGates",
            "nextStep",
        },
        "m3WorkflowAuthorization",
    )
    if (
        value["schemaVersion"] != 1
        or value["authorizationVersion"] != WORKFLOW_AUTHORIZATION_VERSION
        or value["reviewType"] != "HUMAN_APPROVAL"
        or value["status"] != "authorized-workflow-evidence-gated"
        or value["scopeAmendmentVersion"] != SCOPE_AMENDMENT_VERSION
        or value["nextStep"] != "m3-implement-test-and-execute-exact-pin-expansion"
    ):
        raise GapAnalysisError("M3 workflow authorization boundary is invalid")
    try:
        if date.fromisoformat(value["reviewedOn"]).isoformat() != value["reviewedOn"]:
            raise GapAnalysisError("M3 workflow authorization date is invalid")
    except (TypeError, ValueError) as error:
        raise GapAnalysisError("M3 workflow authorization date is invalid") from error
    identities = {"privacy": "umang aggarwal", "security": "vishal vishwas", "maintainer": "tushar garg"}
    actions = {
        "network-access",
        "exact-pin-source-rehydration",
        "feature-extraction-execution",
        "representative-dataset-replacement",
        "training",
        "release-work",
    }
    reviewers = value["reviewers"]
    if not isinstance(reviewers, list) or len(reviewers) != 3:
        raise GapAnalysisError("M3 workflow authorization requires three reviewers")
    seen: set[str] = set()
    for reviewer in reviewers:
        record = _exact(reviewer, {"role", "identity", "decision", "authorizedActions"}, "workflow reviewer")
        role = record["role"]
        if (
            role not in identities
            or role in seen
            or " ".join(str(record["identity"]).lower().split()) != identities[role]
            or record["decision"] != "approve-workflow"
        ):
            raise GapAnalysisError("M3 workflow reviewer is invalid")
        _unique_strings(record["authorizedActions"], actions, "workflow authorized actions")
        seen.add(role)
    if seen != set(identities):
        raise GapAnalysisError("M3 workflow reviewer roles are incomplete")
    if value["authorization"] != {
        "networkAccessAuthorized": True,
        "exactPinSourceRehydrationAuthorized": True,
        "featureExtractionExecutionAuthorized": True,
        "representativeDatasetReplacementAuthorized": True,
        "trainingAuthorized": True,
        "releaseWorkAuthorized": True,
        "authorizationReconfirmationRequired": False,
    }:
        raise GapAnalysisError("M3 workflow authorization fields are invalid")
    if value["evidenceGates"] != {
        "exactPinsAndDigestsRequired": True,
        "scannerAndExclusionGatesRequired": True,
        "contentFreeOutputRequired": True,
        "quarantineDeletionRequired": True,
        "coverageGateRequired": True,
        "qualityAndCalibrationGatesRequired": True,
        "browserCompatibilityAndLatencyGatesRequired": True,
        "signedPackageVerificationRequired": True,
        "automaticReleaseEligibility": False,
        "privateSigningKeyProvisioned": False,
        "productionDeploymentAuthorized": False,
    }:
        raise GapAnalysisError("M3 workflow evidence gates are invalid")
