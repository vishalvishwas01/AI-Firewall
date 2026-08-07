import { useEffect, useState } from "react";
import { getAdminBenchmark } from "../api";
import { trustArchitectureCopy } from "../copy";
import type { SessionUser } from "../../auth/types";
import type { DetectionBenchmark } from "../types";

type TrustPageProps = {
  user: SessionUser | null;
  sessionLoading: boolean;
};

const architecture = [
  {
    title: "Inspected locally",
    copy: trustArchitectureCopy[0]
  },
  {
    title: "Stored locally",
    copy: trustArchitectureCopy[1]
  },
  {
    title: "Synced when enabled",
    copy: trustArchitectureCopy[2]
  },
  {
    title: "Never stored by design",
    copy: trustArchitectureCopy[3]
  },
  {
    title: "Improvement telemetry (optional)",
    copy: trustArchitectureCopy[4]
  }
] as const;


const formatRate = (rate: number | null) =>
  rate === null ? "Not measured" : `${Math.round(rate * 100)}%`;

function BenchmarkPanel({
  user,
  sessionLoading
}: {
  user: SessionUser | null;
  sessionLoading: boolean;
}) {
  const [benchmark, setBenchmark] = useState<DetectionBenchmark | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState("");

  useEffect(() => {
    if (!user) {
      setBenchmark(null);
      setBenchmarkError("");
      setBenchmarkLoading(false);
      return;
    }

    let active = true;
    setBenchmarkLoading(true);
    setBenchmarkError("");
    getAdminBenchmark()
      .then(({ benchmark: nextBenchmark }) => {
        if (active) setBenchmark(nextBenchmark);
      })
      .catch((trustError) => {
        if (active) {
          setBenchmarkError(
            trustError instanceof Error
              ? trustError.message
              : "Benchmark access unavailable"
          );
        }
      })
      .finally(() => {
        if (active) setBenchmarkLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  return (
    <article className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
            Authenticated admin view
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Detection benchmark
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            This is a synthetic regression suite, not a claim of production-world accuracy. Access is limited to active organization owners and admins.
          </p>
        </div>
        {benchmark ? (
          <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
            Fixture {benchmark.fixtureVersion}
          </span>
        ) : null}
      </div>

      {sessionLoading || benchmarkLoading ? (
        <p className="mt-5 text-sm text-slate-600">Checking benchmark access...</p>
      ) : !user ? (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <a href="/login" className="font-semibold text-teal-700 underline underline-offset-4">
            Sign in
          </a>{" "}
          with an organization owner or admin account to view benchmark details.
        </div>
      ) : benchmarkError ? (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {benchmarkError}
        </div>
      ) : benchmark ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Fixtures", benchmark.totals.cases.toString()],
              ["Precision", formatRate(benchmark.rates.precision)],
              ["Recall", formatRate(benchmark.rates.recall)],
              ["Severity", formatRate(benchmark.rates.severityCorrectRate)],
              ["Raw leak free", formatRate(benchmark.rates.rawLeakFreeRate)]
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Fixture</th>
                  <th className="px-4 py-3 font-semibold">Outcome</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Severity</th>
                  <th className="px-4 py-3 font-semibold">Checks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {benchmark.results.map((result) => (
                  <tr key={result.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">{result.id}</td>
                    <td className="px-4 py-3 text-slate-600">{result.outcome}</td>
                    <td className="px-4 py-3 text-slate-600">{result.categories.join(", ") || "benign"}</td>
                    <td className="px-4 py-3 text-slate-600">{result.severity ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      Severity {result.severityCorrect === null ? "n/a" : result.severityCorrect ? "pass" : "fail"}; redaction {result.redactionCorrect === null ? "n/a" : result.redactionCorrect ? "pass" : "fail"}; leak {result.rawLeakFree === null ? "n/a" : result.rawLeakFree ? "pass" : "fail"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </article>
  );
}

export function TrustPage({ user, sessionLoading }: TrustPageProps) {
  useEffect(() => {
    document.title = "Trust Architecture | HallGuard";
    return () => {
      document.title = "HallGuard | AI Permission Firewall";
    };
  }, []);

  return (
    <section className="bg-slate-50 px-6 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="border-b border-slate-200 pb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">Trust architecture</p>
          <h1 className="mt-2 max-w-4xl text-3xl font-semibold text-slate-950 sm:text-4xl">
            Concrete privacy mechanisms, not a promise to just trust us.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            HallGuard combines deterministic rules with an optional local classifier that remains shadow-only and cannot create warnings. Account reporting is optional and redacted. This page describes what crosses each boundary and exposes the current synthetic benchmark to authorized organization owners and admins.
          </p>
        </div>

        <div className="grid gap-4 py-6 md:grid-cols-2 xl:grid-cols-5">
          {architecture.map((item) => (
            <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.copy}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">User controls</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li><strong className="text-slate-950">Local-only mode:</strong> turn off Redacted report sync in the extension popup. New warnings remain local and are not queued.</li>
              <li><strong className="text-slate-950">Local deletion:</strong> clear recent warning history from the popup.</li>
              <li><strong className="text-slate-950">Local export:</strong> download redacted activity, queued redacted records, and metadata-only feedback from the popup.</li>
              <li><strong className="text-slate-950">Account export:</strong> download all account-backed redacted warning records from Reports.</li>
              <li><strong className="text-slate-950">Detection controls:</strong> independently disable categories and choose Relaxed, Balanced, or Strict sensitivity.</li>
              <li><strong className="text-slate-950">Improvement consent:</strong> separately opt in or out of privacy-safe derived-feature telemetry. It is off by default and does not affect local protection or redacted report sync.</li>
            </ul>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Enforcement points</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>Browser redaction happens before local history or sync queue storage.</li>
              <li>The server independently rejects reportable raw values covered by the redaction specification.</li>
              <li>Synced records are scoped to the authenticated account.</li>
              <li>The optional classifier remains shadow-only; deterministic rules continue to control warnings and actions.</li>
              <li>Team reporting returns aggregate metadata instead of prompt snippets or per-user prompt detail.</li>
            </ul>
            <a href="/privacy" className="mt-5 inline-flex font-semibold text-teal-700 underline underline-offset-4">Read the privacy policy</a>
          </article>
        </div>
        <BenchmarkPanel user={user} sessionLoading={sessionLoading} />
      </div>
    </section>
  );
}
