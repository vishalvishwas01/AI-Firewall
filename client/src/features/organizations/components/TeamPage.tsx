import { useEffect, useRef, useState, type FormEvent } from "react"
import { SiteHeader } from "../../../components/SiteHeader"
import type { SessionUser } from "../../auth/types"
import { authRedirectKey } from "../../auth/extensionBridge"
import { addOrganizationMember, createOrganization, createOrganizationSitePolicy, deleteOrganizationSitePolicy, getOrganization, getOrganizationExtensionHealth, getOrganizationSitePolicies, getOrganizations, getOrganizationTrends, removeOrganizationMember, revokeOrganizationInvitation, updateOrganizationMemberRole } from "../api"
import type { ExtensionHealth, Organization, OrganizationMember, OrganizationRole, OrganizationSitePolicy, OrganizationSummary, OrganizationTrends } from "../types"
import { OrganizationLoadingState, OrganizationSelectionState, OrganizationsEmptyState, OrganizationsLoadingState } from "./OrganizationStates"
import { getReportSites } from "../../sites/api"
import type { ReportSite } from "../../sites/types"
import { sendSitesToExtension } from "../../sites/extensionBridge"

export function TeamPage({
  user,
  sessionLoading
}: {
  user: SessionUser | null;
  sessionLoading: boolean;
}) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [summary, setSummary] = useState<OrganizationSummary | null>(null);
  const [trends, setTrends] = useState<OrganizationTrends | null>(null);
  const [trendDays, setTrendDays] = useState<7 | 30 | 90>(30);
  const [sitePolicies, setSitePolicies] = useState<OrganizationSitePolicy[]>([]);
  const [extensionHealth, setExtensionHealth] = useState<ExtensionHealth[]>([]);
  const [organizationName, setOrganizationName] = useState("");
  const [policyHostname, setPolicyHostname] = useState("");
  const [policyLabel, setPolicyLabel] = useState("");
  const [policyCategory, setPolicyCategory] = useState<"all" | "sensitive-data" | "prompt-injection" | "risky-upload" | "scam-fraud">("all");
  const [policyMinimumSeverity, setPolicyMinimumSeverity] = useState<"low" | "medium" | "high">("high");
  const [policyAction, setPolicyAction] = useState<"warn" | "redact" | "block">("block");
  const [policyDestination, setPolicyDestination] = useState<"any" | "public-ai" | "approved-internal" | "unknown">("any");
  const [policyAllowOverride, setPolicyAllowOverride] = useState(false);
  const [policyRedactionAllowed, setPolicyRedactionAllowed] = useState(true);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<Exclude<OrganizationRole, "owner">>("member");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingOrganization, setSavingOrganization] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [removingPolicyId, setRemovingPolicyId] = useState("");
  const [updatingMemberId, setUpdatingMemberId] = useState("");
  const [removingMemberId, setRemovingMemberId] = useState("");
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<OrganizationMember | null>(null);
  const [policyPendingRemoval, setPolicyPendingRemoval] = useState<OrganizationSitePolicy | null>(null);
  const [error, setError] = useState("");
  const detailRequestId = useRef(0);

  const canManageMembers =
    selectedOrganization?.role === "owner" || selectedOrganization?.role === "admin";
  const formatRate = (rate: number) => `${Math.round(rate * 100)}%`;
  const maxTrendTotal = Math.max(1, ...(trends?.points.map((point) => point.totalLogs) ?? [1]));

  const loadOrganizations = async () => {
    const { organizations: nextOrganizations } = await getOrganizations();
    setOrganizations(nextOrganizations);
    setSelectedOrganizationId((current) => current || nextOrganizations[0]?.id || "");
  };

  const loadOrganizationDetail = async (organizationId: string) => {
    const requestId = ++detailRequestId.current;
    const [response, policyResponse, trendResponse, healthResponse] = await Promise.all([
      getOrganization(organizationId),
      getOrganizationSitePolicies(organizationId),
      getOrganizationTrends(organizationId, trendDays),
      getOrganizationExtensionHealth(organizationId)
    ]);
    if (requestId !== detailRequestId.current) return;
    setSelectedOrganization(response.organization);
    setMembers(response.members);
    setSummary(response.summary);
    setTrends(trendResponse.trends);
    setSitePolicies(policyResponse.sites);
    setExtensionHealth(healthResponse.health);
  };

  const syncMergedSitesToExtension = async () => {
    const { sites } = await getReportSites();
    await sendSitesToExtension(sites);
  };

  useEffect(() => {
    if (sessionLoading) return;
    if (!user && window.location.pathname !== "/login") {
      window.sessionStorage.setItem(
        authRedirectKey,
        `${window.location.pathname}${window.location.search}`
      );
      window.history.pushState({}, "", "/login");
      window.dispatchEvent(new Event("popstate"));
    }
  }, [sessionLoading, user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    getOrganizations()
      .then(({ organizations: nextOrganizations }) => {
        if (!active) return;
        setOrganizations(nextOrganizations);
        setSelectedOrganizationId((current) => current || nextOrganizations[0]?.id || "");
      })
      .catch((teamError) => {
        if (active) setError(teamError instanceof Error ? teamError.message : "Failed to load teams");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedOrganizationId) {
      setSelectedOrganization(null);
      setMembers([]);
      setSummary(null);
      setTrends(null);
      setSitePolicies([]);
      return;
    }

    let active = true;
    setDetailLoading(true);
    setError("");

    loadOrganizationDetail(selectedOrganizationId)
      .then(() => {
        if (!active) return;
      })
      .catch((teamError) => {
        if (active) setError(teamError instanceof Error ? teamError.message : "Failed to load team");
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, selectedOrganizationId, trendDays]);

  const submitOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingOrganization(true);
    setError("");

    try {
      const { organization } = await createOrganization(organizationName);
      setOrganizationName("");
      await loadOrganizations();
      setSelectedOrganizationId(organization.id);
    } catch (teamError) {
      setError(teamError instanceof Error ? teamError.message : "Failed to create team");
    } finally {
      setSavingOrganization(false);
    }
  };

  const submitMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOrganization) return;

    setSavingMember(true);
    setError("");

    try {
      await addOrganizationMember(selectedOrganization.id, memberEmail, memberRole);
      setMemberEmail("");
      setMemberRole("member");
      await loadOrganizationDetail(selectedOrganization.id);
    } catch (teamError) {
      setError(teamError instanceof Error ? teamError.message : "Failed to add member");
    } finally {
      setSavingMember(false);
    }
  };

  const submitSitePolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOrganization || !canManageMembers) return;

    setSavingPolicy(true);
    setError("");

    try {
      const existingVersion = sitePolicies.find((site) => site.hostname === policyHostname.trim().toLowerCase().replace(/^www\./, ""))?.policy?.version ?? 0;
      await createOrganizationSitePolicy(selectedOrganization.id, policyHostname, policyLabel, {
        schemaVersion: 1, version: existingVersion + 1, category: policyCategory,
        minimumSeverity: policyMinimumSeverity, action: policyAction,
        destination: policyDestination, allowOverride: policyAction === "warn" ? true : policyAllowOverride,
        redactionAllowed: policyAction === "redact" ? true : policyRedactionAllowed
      });
      setPolicyHostname("");
      setPolicyLabel("");
      await loadOrganizationDetail(selectedOrganization.id);
      await syncMergedSitesToExtension();
    } catch (teamError) {
      setError(teamError instanceof Error ? teamError.message : "Failed to add protected website");
    } finally {
      setSavingPolicy(false);
    }
  };

  const removeSitePolicy = async (policy: OrganizationSitePolicy) => {
    if (!selectedOrganization || !canManageMembers) return;

    setRemovingPolicyId(policy.id);
    setError("");

    try {
      await deleteOrganizationSitePolicy(selectedOrganization.id, policy.id);
      await loadOrganizationDetail(selectedOrganization.id);
      await syncMergedSitesToExtension();
    } catch (teamError) {
      setError(teamError instanceof Error ? teamError.message : "Failed to remove protected website");
    } finally {
      setRemovingPolicyId("");
      setPolicyPendingRemoval(null);
    }
  };

  const changeMemberRole = async (
    member: OrganizationMember,
    role: Exclude<OrganizationRole, "owner">
  ) => {
    if (!selectedOrganization || member.role === role) return;

    setUpdatingMemberId(member.id);
    setError("");

    try {
      await updateOrganizationMemberRole(selectedOrganization.id, member.id, role);
      await loadOrganizationDetail(selectedOrganization.id);
    } catch (teamError) {
      setError(teamError instanceof Error ? teamError.message : "Failed to update member role");
    } finally {
      setUpdatingMemberId("");
    }
  };

  const removeMember = async (member: OrganizationMember) => {
    if (!selectedOrganization) return;

    setRemovingMemberId(member.id);
    setError("");

    try {
      if (member.status === "invited") {
        await revokeOrganizationInvitation(selectedOrganization.id, member.id);
      } else {
        await removeOrganizationMember(selectedOrganization.id, member.id);
      }
      await loadOrganizationDetail(selectedOrganization.id);
    } catch (teamError) {
      setError(
        teamError instanceof Error
          ? teamError.message
          : member.status === "invited"
            ? "Failed to revoke invitation"
            : "Failed to remove member"
      );
    } finally {
      setRemovingMemberId("");
      setMemberPendingRemoval(null);
    }
  };

  return (
    <section className="bg-slate-50 px-6 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="border-b border-slate-200 pb-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
            Team foundations
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
            Organization risk summary
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Create a small workspace, add members, and review aggregate redacted warning metrics. This view is intentionally metadata-only.
          </p>
        </div>

        <div className="grid gap-5 py-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-5">
            <form
              onSubmit={submitOrganization}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-slate-950">Create organization</h2>
              <label className="mt-4 block text-sm font-semibold text-slate-950">
                Organization name
                <input
                  type="text"
                  required
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="Acme AI Safety"
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
                />
              </label>
              <button
                type="submit"
                disabled={savingOrganization}
                className="button-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingOrganization ? "Creating" : "Create team"}
              </button>
            </form>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Your organizations</h2>
              {loading ? (
                <OrganizationsLoadingState />
              ) : organizations.length === 0 ? (
                <OrganizationsEmptyState />
              ) : (
                <div className="mt-4 space-y-2">
                  {organizations.map((organization) => (
                    <button
                      key={organization.id}
                      type="button"
                      onClick={() => setSelectedOrganizationId(organization.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm font-semibold transition ${
                        selectedOrganizationId === organization.id
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                      }`}
                    >
                      {organization.name}
                      <span className="ml-2 text-xs font-medium opacity-75">{organization.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
                {error}
              </div>
            ) : null}

            {!selectedOrganization ? (
              <OrganizationSelectionState />
            ) : detailLoading ? (
              <OrganizationLoadingState />
            ) : (
              <>
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-950">
                        {selectedOrganization.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Your role: {selectedOrganization.role}
                      </p>
                    </div>
                    <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase text-teal-700">
                      Aggregate only
                    </span>
                  </div>

                  {summary ? (
                    <>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {[
                          ["Synced warnings", summary.totalLogs.toLocaleString()],
                          ["Active members", summary.activeMembers.toLocaleString()],
                          ["Invited", summary.invitedMembers.toLocaleString()],
                          ["Revoked", summary.revokedInvitations.toLocaleString()],
                          ["False alarm rate", formatRate(summary.falseAlarmRate)]
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              {label}
                            </p>
                            <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                              Warning trend
                            </h3>
                            <p className="mt-1 text-xs text-slate-500">
                              Daily aggregate warning counts. No prompt content or per-user detail.
                            </p>
                          </div>
                          <div className="flex rounded-md border border-slate-300 bg-white p-1" aria-label="Trend range">
                            {([7, 30, 90] as const).map((days) => (
                              <button
                                key={days}
                                type="button"
                                onClick={() => setTrendDays(days)}
                                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                                  trendDays === days
                                    ? "bg-slate-950 text-white"
                                    : "text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                {days}d
                              </button>
                            ))}
                          </div>
                        </div>
                        {trends ? (
                          <div className="mt-5 overflow-x-auto pb-1">
                            <div
                              className="flex h-32 min-w-full items-end gap-1"
                              style={{ minWidth: `${Math.max(480, trends.points.length * 12)}px` }}
                              role="img"
                              aria-label={`${trends.rangeDays}-day aggregate warning trend`}
                            >
                              {trends.points.map((point) => (
                                <div
                                  key={point.date}
                                  className="group relative flex min-w-1 flex-1 items-end"
                                  title={`${point.date}: ${point.totalLogs} warnings`}
                                >
                                  <div
                                    className="w-full rounded-t bg-teal-600 transition hover:bg-teal-700"
                                    style={{
                                      height: `${Math.max(4, (point.totalLogs / maxTrendTotal) * 112)}px`,
                                      opacity: point.totalLogs === 0 ? 0.22 : 1
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 flex justify-between text-xs text-slate-500">
                              <span>{trends.points[0]?.date}</span>
                              <span>{trends.points[trends.points.length - 1]?.date}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-slate-500">Loading trend...</p>
                        )}
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                            Severity
                          </h3>
                          <div className="mt-3 space-y-2 text-sm text-slate-600">
                            {Object.entries(summary.bySeverity).map(([severity, count]) => (
                              <div key={severity} className="flex items-center justify-between gap-3">
                                <span>{severity}</span>
                                <strong className="text-slate-950">{count}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                            Warning type
                          </h3>
                          <div className="mt-3 space-y-2 text-sm text-slate-600">
                            {Object.entries(summary.byEventType).map(([eventType, count]) => (
                              <div key={eventType} className="flex items-center justify-between gap-3">
                                <span>{eventType}</span>
                                <strong className="text-slate-950">{count}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                            Feedback
                          </h3>
                          <div className="mt-3 space-y-2 text-sm text-slate-600">
                            {Object.entries(summary.byFeedback).map(([feedback, count]) => (
                              <div key={feedback} className="flex items-center justify-between gap-3">
                                <span>{feedback}</span>
                                <strong className="text-slate-950">{count}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
                    <h2 className="text-lg font-semibold text-slate-950">Extension protection health</h2>
                    <p className="mt-2 text-sm text-slate-600">A stale signal can mean the browser is closed, offline, disabled, removed, or unavailable; it does not prove uninstall.</p>
                    <div className="mt-4 divide-y divide-slate-200">
                      {extensionHealth.map((item) => <div key={item.memberId ?? item.email} className="flex justify-between gap-3 py-2 text-sm"><span>{item.email}</span><span className="font-semibold">{item.state === "active" ? "Active" : item.state === "stale" ? "Stale" : "Protection unavailable"}</span></div>)}
                    </div>
                  </div>
                  <form
                    onSubmit={submitSitePolicy}
                    className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h2 className="text-lg font-semibold text-slate-950">Protected websites</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      These domains are inherited by every active organization member.
                    </p>
                    <label className="mt-4 block text-sm font-semibold text-slate-950">
                      Domain
                      <input
                        type="text"
                        required
                        disabled={!canManageMembers}
                        value={policyHostname}
                        onChange={(event) => setPolicyHostname(event.target.value)}
                        placeholder="example.com"
                        className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-100"
                      />
                    </label>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-semibold text-slate-950">Category
                        <select value={policyCategory} onChange={(event) => setPolicyCategory(event.target.value as typeof policyCategory)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3">
                          <option value="all">All categories</option><option value="sensitive-data">Sensitive data</option><option value="prompt-injection">Prompt injection</option><option value="risky-upload">Risky upload</option><option value="scam-fraud">Scam/fraud</option>
                        </select>
                      </label>
                      <label className="text-sm font-semibold text-slate-950">Minimum severity
                        <select value={policyMinimumSeverity} onChange={(event) => setPolicyMinimumSeverity(event.target.value as typeof policyMinimumSeverity)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3">
                          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                        </select>
                      </label>
                      <label className="text-sm font-semibold text-slate-950">Action
                        <select value={policyAction} onChange={(event) => setPolicyAction(event.target.value as typeof policyAction)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3">
                          <option value="warn">Warn</option><option value="redact">Require redaction</option><option value="block">Block</option>
                        </select>
                      </label>
                      <label className="text-sm font-semibold text-slate-950">Destination
                        <select value={policyDestination} onChange={(event) => setPolicyDestination(event.target.value as typeof policyDestination)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3">
                          <option value="any">Any</option><option value="public-ai">Public AI</option><option value="approved-internal">Approved internal</option><option value="unknown">Unknown</option>
                        </select>
                      </label>
                    </div>
                    <label className="mt-4 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={policyAllowOverride || policyAction === "warn"} disabled={policyAction === "warn"} onChange={(event) => setPolicyAllowOverride(event.target.checked)} /> Allow member override</label>
                    <label className="mt-2 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={policyRedactionAllowed || policyAction === "redact"} disabled={policyAction === "redact"} onChange={(event) => setPolicyRedactionAllowed(event.target.checked)} /> Allow redacted replacement</label>
                    <label className="mt-4 block text-sm font-semibold text-slate-950">
                      Website name
                      <input
                        type="text"
                        required
                        disabled={!canManageMembers}
                        value={policyLabel}
                        onChange={(event) => setPolicyLabel(event.target.value)}
                        placeholder="Company AI workspace"
                        className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-100"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={!canManageMembers || savingPolicy}
                      className="button-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingPolicy ? "Saving" : "Add protected website"}
                    </button>
                    {!canManageMembers ? (
                      <p className="mt-3 text-sm text-slate-500">
                        Only owners and admins can change organization protection.
                      </p>
                    ) : null}
                  </form>

                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-950">Organization policy</h2>
                    {sitePolicies.length === 0 ? (
                      <p className="mt-4 text-sm leading-6 text-slate-600">
                        No organization-managed websites yet.
                      </p>
                    ) : (
                      <div className="mt-4 divide-y divide-slate-200">
                        {sitePolicies.map((policy) => (
                          <div key={policy.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                            <div>
                              <p className="font-semibold text-slate-950">{policy.label}</p>
                              <p className="mt-1 text-xs text-slate-500">{policy.hostname}</p>
                              {policy.policy ? (
                                <p className="mt-1 text-xs text-slate-500">
                                  v{policy.policy.version} · {policy.policy.category} · {policy.policy.minimumSeverity}+ · {policy.policy.action} · {policy.policy.allowOverride ? "override allowed" : "managed"}
                                </p>
                              ) : (
                                <p className="mt-1 text-xs text-amber-700">Legacy site-only policy</p>
                              )}
                            </div>
                            {canManageMembers ? (
                              <button
                                type="button"
                                disabled={removingPolicyId === policy.id}
                                onClick={() => setPolicyPendingRemoval(policy)}
                                className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {removingPolicyId === policy.id ? "Removing" : "Remove"}
                              </button>
                            ) : (
                              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                                Managed
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                  <form
                    onSubmit={submitMember}
                    className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h2 className="text-lg font-semibold text-slate-950">Add member</h2>
                    <label className="mt-4 block text-sm font-semibold text-slate-950">
                      Email
                      <input
                        type="email"
                        required
                        disabled={!canManageMembers}
                        value={memberEmail}
                        onChange={(event) => setMemberEmail(event.target.value)}
                        placeholder="teammate@example.com"
                        className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-100"
                      />
                    </label>
                    <label className="mt-4 block text-sm font-semibold text-slate-950">
                      Role
                      <select
                        value={memberRole}
                        disabled={!canManageMembers}
                        onChange={(event) =>
                          setMemberRole(event.target.value as Exclude<OrganizationRole, "owner">)
                        }
                        className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-100"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      disabled={!canManageMembers || savingMember}
                      className="button-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingMember ? "Adding" : "Add member"}
                    </button>
                    {!canManageMembers ? (
                      <p className="mt-3 text-sm text-slate-500">
                        Only owners and admins can add members.
                      </p>
                    ) : null}
                  </form>

                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-950">Members</h2>
                    <div className="mt-4 divide-y divide-slate-200">
                      {members.map((member) => (
                        <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                          <div>
                            <p className="font-semibold text-slate-950">{member.email}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {member.status === "invited"
                                ? "Invitation pending"
                                : member.status === "revoked"
                                  ? "Invitation revoked"
                                  : "Active member"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {canManageMembers && member.role !== "owner" && member.status !== "revoked" ? (
                              <>
                                <select
                                  value={member.role}
                                  disabled={
                                    updatingMemberId === member.id ||
                                    removingMemberId === member.id ||
                                    (selectedOrganization?.role === "admin" && member.role === "admin")
                                  }
                                  onChange={(event) =>
                                    void changeMemberRole(
                                      member,
                                      event.target.value as Exclude<OrganizationRole, "owner">
                                    )
                                  }
                                  className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold uppercase text-slate-700 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                  <option value="member">Member</option>
                                  <option value="admin">Admin</option>
                                </select>
                                <button
                                  type="button"
                                  disabled={
                                    removingMemberId === member.id ||
                                    (selectedOrganization?.role === "admin" && member.role === "admin")
                                  }
                                  onClick={() => setMemberPendingRemoval(member)}
                                  className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {removingMemberId === member.id
                                    ? member.status === "invited" ? "Revoking" : "Removing"
                                    : member.status === "invited" ? "Revoke" : "Remove"}
                                </button>
                              </>
                            ) : (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold uppercase text-slate-600">
                                {member.role}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {memberPendingRemoval ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-member-title"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <h2 id="remove-member-title" className="text-xl font-semibold text-slate-950">
              {memberPendingRemoval.status === "invited" ? "Revoke invitation?" : "Remove member?"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {memberPendingRemoval.status === "invited" ? "Revoke the pending invitation for" : "Remove"}{" "}
              <strong className="text-slate-950">{memberPendingRemoval.email}</strong>{" "}
              {memberPendingRemoval.status === "invited" ? `from ${selectedOrganization?.name ?? "this organization"}? They will not be activated if they later sign in.` : `from ${selectedOrganization?.name ?? "this organization"}?`}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setMemberPendingRemoval(null)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void removeMember(memberPendingRemoval)}
                disabled={removingMemberId === memberPendingRemoval.id}
                className="rounded-md border border-rose-700 bg-rose-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removingMemberId === memberPendingRemoval.id
                  ? memberPendingRemoval.status === "invited" ? "Revoking" : "Removing"
                  : memberPendingRemoval.status === "invited" ? "Revoke invitation" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {policyPendingRemoval ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-policy-title"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <h2 id="remove-policy-title" className="text-xl font-semibold text-slate-950">
              Remove protected website?
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Remove <strong className="text-slate-950">{policyPendingRemoval.label}</strong> ({policyPendingRemoval.hostname}) from {selectedOrganization?.name ?? "this organization"}? Active members will no longer inherit it.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setPolicyPendingRemoval(null)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void removeSitePolicy(policyPendingRemoval)}
                disabled={removingPolicyId === policyPendingRemoval.id}
                className="rounded-md border border-rose-700 bg-rose-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removingPolicyId === policyPendingRemoval.id ? "Removing" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
