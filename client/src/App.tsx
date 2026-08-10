import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Chrome,
  Download,
  EyeOff,
  Github,
  Lock,
  ShieldCheck
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  faqItems,
  privacyPoints,
  riskCards,
  supportedTools,
  workflowSteps
} from "./data/siteContent";
import { getSession, logout } from "./features/auth/api";
import type { SessionUser } from "./features/auth/types";
import { AuthPage } from "./features/auth/components/AuthPage";
import { ReportsPage } from "./features/reports/components/ReportsPage";
import { TeamPage } from "./features/organizations/components/TeamPage";
import { TrustPage as FeatureTrustPage } from "./features/trust/components/TrustPage";
import { getAdminBenchmark } from "./features/trust/api";
import type { DetectionBenchmark } from "./features/trust/types";
import { SiteHeader } from "./components/SiteHeader";

const fadeIn = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.45, ease: "easeOut" as const }
} as const;

function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [path, setPath] = useState(window.location.pathname);
  const authMode = path === "/signup" ? "signup" : path === "/login" ? "login" : null;
  const isReports = path === "/reports";
  const isTeam = path === "/team";
  const isPrivacy = path === "/privacy";
  const isTrust = path === "/trust";

  useEffect(() => {
    let active = true;

    getSession()
      .then(({ user: sessionUser }) => {
        if (active) setUser(sessionUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleLocationChange = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    window.history.pushState({}, "", "/");
    setPath("/");
  };

  if (authMode) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <SiteHeader
          user={user}
          sessionLoading={sessionLoading}
          onLogout={handleLogout}
        />
        <div id="page-content" tabIndex={-1}><AuthPage mode={authMode} onAuthenticated={setUser} /></div>
      </main>
    );
  }

  if (isReports) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <SiteHeader
          user={user}
          sessionLoading={sessionLoading}
          onLogout={handleLogout}
        />
        <div id="page-content" tabIndex={-1}><ReportsPage user={user} sessionLoading={sessionLoading} /></div>
      </main>
    );
  }

  if (isTeam) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <SiteHeader
          user={user}
          sessionLoading={sessionLoading}
          onLogout={handleLogout}
        />
        <div id="page-content" tabIndex={-1}><TeamPage user={user} sessionLoading={sessionLoading} /></div>
      </main>
    );
  }

  if (isPrivacy) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <SiteHeader
          user={user}
          sessionLoading={sessionLoading}
          onLogout={handleLogout}
        />
        <div id="page-content" tabIndex={-1}><PrivacyPolicyPage /></div>
        <SiteFooter />
      </main>
    );
  }

  if (isTrust) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <SiteHeader
          user={user}
          sessionLoading={sessionLoading}
          onLogout={handleLogout}
        />
        <div id="page-content" tabIndex={-1}><FeatureTrustPage user={user} sessionLoading={sessionLoading} /></div>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <SiteHeader
        user={user}
        sessionLoading={sessionLoading}
        onLogout={handleLogout}
      />
      <HeroSection />
      <ProblemSection />
      <WorkflowSection />
      <SupportSection />
      <PrivacySection />
      <DemoSection />
      <InstallSection />
      <FaqSection />
      <SiteFooter />
    </main>
  );
}




function HeroSection() {
  return (
    <section id="page-content" tabIndex={-1} className="relative overflow-hidden border-b border-slate-200 bg-white">
      <div className="mx-auto grid min-h-[92vh] w-full max-w-7xl items-center gap-12 px-6 py-8 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
            <img
              src="/hallguard-icon.png"
              alt=""
              className="h-6 w-6 rounded"
              width="24"
              height="24"
            />
            Local-first Chrome extension for safer AI chats
          </div>
          <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
            HallGuard
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700 sm:text-xl">
            Warn users before sensitive data, risky uploads, prompt injection,
            or scam-like language gets sent to ChatGPT, Claude, or Gemini.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a className="button-primary" href="#install">
              <Download className="h-4 w-4" aria-hidden="true" />
              Get early install steps
            </a>
            <a className="button-secondary" href="#demo">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              Watch the warning flow
            </a>
          </div>
          <dl className="mt-10 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["Local detection", "Checks stay browser-local"],
              ["3 AI tools", "ChatGPT, Claude, Gemini"],
              ["Redacted reports", "Account sync stores masked records"]
            ].map(([value, label]) => (
              <div
                key={value}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <dt className="text-sm font-semibold text-slate-950">{value}</dt>
                <dd className="mt-1 text-sm leading-5 text-slate-600">{label}</dd>
              </div>
            ))}
          </dl>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.1 }}
          className="relative"
        >
          <ProductMock />
        </motion.div>
      </div>
    </section>
  );
}

function ProductMock() {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 shadow-2xl shadow-slate-300/60">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-rose-400" />
          <span className="h-3 w-3 rounded-full bg-amber-300" />
          <span className="h-3 w-3 rounded-full bg-teal-300" />
        </div>
        <div className="text-xs font-medium text-slate-400">chatgpt.com</div>
      </div>
      <div className="space-y-4 pt-5">
        <div className="rounded-lg bg-white px-4 py-4 text-sm leading-6 text-slate-700">
          Summarize this contract and explain what the vendor can access.
        </div>
        <div className="rounded-lg border border-amber-300/40 bg-amber-300/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-300 text-slate-950">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                HallGuard warning
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-50">
                This message appears to include a secret token and a risky
                attachment. Review before sending.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-950">
              Review details
            </button>
            <button className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-white">
              Send anyway
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase text-slate-400">Status</p>
            <p className="mt-1 text-sm font-semibold text-teal-200">Blocked</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase text-slate-400">Log</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">
              Token redacted
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProblemSection() {
  return (
    <section className="bg-slate-50 px-6 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="The problem"
          title="AI chats make sharing feel frictionless. Risk still needs a pause."
          body="People paste keys, contracts, screenshots, support messages, and suspicious instructions into AI tools every day. The extension adds a local warning layer before those moments become irreversible."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {riskCards.map((card) => (
            <InfoCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section className="border-y border-slate-200 bg-white px-6 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="How it works"
          title="Detect locally, warn in context, sync only redacted reports."
          body="The extension uses rule-based checks in the browser for the moments that matter most: paste, send, and upload. Account-backed reporting stores masked warning records only."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {workflowSteps.map((step, index) => (
            <motion.div
              key={step.title}
              {...fadeIn}
              transition={{
                duration: 0.45,
                ease: "easeOut",
                delay: index * 0.06
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white">
                <step.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-950">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SupportSection() {
  return (
    <section className="bg-slate-950 px-6 py-20 text-white sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1fr] lg:items-center">
        <SectionIntro
          eyebrow="Supported first"
          title="Built around the AI tools people already use."
          body="The first extension target list is intentionally focused so the warning behavior can be tested and tuned on real AI chat surfaces."
          inverted
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {supportedTools.map((tool) => (
            <div
              key={tool}
              className="rounded-lg border border-white/10 bg-white/5 p-5"
            >
              <Chrome className="h-5 w-5 text-sky-300" aria-hidden="true" />
              <p className="mt-5 text-xl font-semibold">{tool}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Prompt, paste, send, and upload checks.
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PrivacySection() {
  return (
    <section id="privacy" className="bg-white px-6 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <SectionIntro
          eyebrow="Privacy posture"
          title="Local-first by default, simple enough to trust."
          body="The website should make the privacy model easy to understand before users install anything."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {privacyPoints.map((point) => (
            <InfoCard key={point.title} {...point} />
          ))}
        </div>
        <a className="button-secondary mt-8" href="/privacy">
          Read the full Privacy Policy
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

function PrivacyPolicyPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Privacy Policy | HallGuard";

    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;
    if (description) {
      description.content = "Learn how HallGuard processes, stores, protects, and shares data used by its AI permission firewall extension and website.";
    }

    return () => {
      document.title = previousTitle;
      if (description && previousDescription !== undefined) {
        description.content = previousDescription;
      }
    };
  }, []);

  return (
    <article className="bg-white px-6 py-16 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
          Legal
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          HallGuard Privacy Policy
        </h1>
        <p className="mt-5 text-base leading-7 text-slate-600">
          Effective date: July 26, 2026 · Last updated: July 26, 2026
        </p>
        <p className="mt-8 text-base leading-7 text-slate-700">
          This Privacy Policy explains how HallGuard collects, processes, stores,
          uses, and shares information through the HallGuard browser extension,
          website, accounts, reports, and team features. HallGuard is an AI
          permission firewall designed to warn users before risky information or
          actions reach supported AI services.
        </p>

        <div className="mt-12 space-y-12">
          <PolicySection title="1. HallGuard’s single purpose">
            <p>
              HallGuard protects users on configured AI websites by examining
              prompts, relevant page content, submission actions, and upload
              metadata for sensitive information, prompt injection, risky files,
              and scam-related language. It then displays a warning, blocks a
              high-risk action, or lets the user review and continue.
            </p>
          </PolicySection>

          <PolicySection title="2. Information processed by the extension">
            <h3>AI chat and website content</h3>
            <p>
              On a protected website, HallGuard may inspect text entered into
              text fields or editable areas, relevant AI-generated page text,
              and the context of a send or submit action. This analysis occurs
              locally in the browser. HallGuard does not use this content for
              advertising or to train artificial intelligence models.
            </p>
            <h3>Upload metadata</h3>
            <p>
              HallGuard may inspect a selected file’s name, media type, and size
              to identify risky uploads. The current extension does not read or
              upload the contents of the selected file.
            </p>
            <h3>Security-event records</h3>
            <p>
              When a warning occurs, HallGuard may create a record containing an
              event identifier, timestamp, AI tool, hostname, risk category,
              severity, user decision, warning title, evidence labels, optional
              feedback, and a redacted text snippet of no more than 240
              characters.
            </p>
            <p>
              Redaction is pattern-based. HallGuard is designed to remove
              recognized email addresses, phone numbers, card-like numbers,
              credentials, tokens, secrets, and service URLs before a snippet is
              saved or synced. Automated redaction cannot guarantee removal of
              every personal or sensitive statement, so users should still avoid
              entering unnecessary sensitive information into AI services.
            </p>
          </PolicySection>

          <PolicySection title="3. Information stored locally">
            <p>HallGuard uses Chrome local storage to keep:</p>
            <ul>
              <li>Protection settings and sensitivity preferences.</li>
              <li>User-selected and organization-managed protected websites.</li>
              <li>An authentication token for a connected HallGuard account.</li>
              <li>Up to 50 recent redacted security-event records.</li>
              <li>Up to 100 warning-feedback records.</li>
              <li>Up to 100 redacted records queued for account synchronization.</li>
              <li>Up to 100 derived-feature improvement events, only when separate improvement consent is enabled.</li>
            </ul>
            <p>
              Users can clear local warning history from the extension. Removing
              the extension may also remove extension-local data, subject to
              Chrome’s behavior and synchronization settings.
            </p>
          </PolicySection>

          <PolicySection title="4. HallGuard account and team information">
            <p>
              If a user creates or uses a HallGuard account, HallGuard processes
              the account email address, an internal user identifier, login
              credentials, authentication tokens, and session information.
              Passwords are sent to the HallGuard API over the configured network
              connection and stored only as secure password hashes, not as plain
              text.
            </p>
            <p>
              Team features may additionally process organization names, member
              email addresses, membership status, roles, organization-managed
              protected domains, and related policy information.
            </p>
          </PolicySection>

          <PolicySection title="5. Redacted reporting and server storage">
            <p>
              Redacted-event synchronization is controlled from the extension.
              When it is enabled and the user is authenticated, HallGuard sends
              eligible redacted security-event records to the HallGuard API so
              the user or an authorized organization can view reports. If the
              account is unavailable, eligible records may remain in a local
              retry queue.
            </p>
            <p>
              Synced records may include the fields described in Section 2 and
              the authenticated account identifier. Raw detected credentials and
              recognized personal-data patterns are not intentionally included.
              Standard network requests may also expose technical information,
              such as an IP address, browser information, and request timestamps,
              to HallGuard’s hosting and infrastructure providers.
            </p>
            <h3>Optional improvement telemetry</h3>
            <p>
              Improvement telemetry is a separate, off-by-default control. If a
              user enables it, HallGuard may sync a random event id, coarse time
              bucket, bounded numeric or bucketed classifier features, predicted
              category and confidence band, optional feedback, model/rule
              versions, and action outcome. This telemetry does not upload prompt
              content, redacted snippets, candidate values, literal prefixes,
              exact hashes, hostnames, files, or screenshots. Disabling the
              control stops new collection and retry; queued telemetry can be
              cleared locally and from the authenticated account.
            </p>
          </PolicySection>

          <PolicySection title="6. How information is used">
            <p>HallGuard uses information only to:</p>
            <ul>
              <li>Detect and warn about risky AI interactions.</li>
              <li>Apply personal and organization-managed protection settings.</li>
              <li>Authenticate accounts and maintain secure sessions.</li>
              <li>Provide local history, reports, feedback, and team features.</li>
              <li>Maintain security, prevent abuse, debug failures, and improve detection quality.</li>
              <li>Comply with applicable law and enforce product terms.</li>
            </ul>
            <p>
              HallGuard does not use or transfer user data for advertising,
              unrelated purposes, creditworthiness, lending decisions, or AI
              model training.
            </p>
          </PolicySection>

          <PolicySection title="7. Chrome extension permissions">
            <h3>Storage</h3>
            <p>
              Used for settings, protected domains, account authentication,
              redacted warning history, feedback, and queued synchronization.
            </p>
            <h3>Tabs</h3>
            <p>
              Used to open HallGuard account pages and reload already-open tabs
              that match an updated protected-domain policy. It is not used to
              build a general browsing profile.
            </p>
            <h3>Host access</h3>
            <p>
              HallGuard supports built-in AI services and custom domains chosen
              by users or organizations. Its content script can therefore be
              present on HTTPS pages, but inspection and protection are activated
              only when the current hostname matches the protected-site list.
            </p>
            <h3>Remote code</h3>
            <p>
              HallGuard does not download or execute remote JavaScript,
              WebAssembly, or other executable code. Executable extension code is
              packaged with the Chrome Web Store submission. API responses are
              treated as data and are not executed.
            </p>
          </PolicySection>

          <PolicySection title="8. Sharing and disclosure">
            <p>
              HallGuard does not sell user data. Information may be disclosed
              only to infrastructure and service providers acting on HallGuard’s
              behalf, to authorized organization administrators for team reports,
              when required by law or necessary to protect rights and safety, or
              as part of a merger, financing, acquisition, or transfer of the
              service. Providers may use information only to perform their
              contracted services and must protect it appropriately.
            </p>
          </PolicySection>

          <PolicySection title="9. Retention and deletion">
            <p>
              Local extension limits are described in Section 3. Server-side
              account, organization, and report records are retained while needed
              to provide HallGuard, comply with legal obligations, resolve
              disputes, and protect the service. Users can clear local warning
              history in the extension, disable redacted synchronization, and
              request access to or deletion of server-held personal information
              through the contact method in Section 14.
            </p>
          </PolicySection>

          <PolicySection title="10. Security">
            <p>
              HallGuard uses reasonable technical and organizational safeguards,
              including local analysis, redaction controls, authenticated API
              requests, access controls, and hashed passwords. No system can
              guarantee absolute security, and users should not intentionally
              submit secrets or unnecessary personal information to any AI tool.
            </p>
          </PolicySection>

          <PolicySection title="11. User choices and rights">
            <p>Depending on applicable law, users may have the right to:</p>
            <ul>
              <li>Request access to, correction of, or deletion of personal information.</li>
              <li>Object to or restrict certain processing.</li>
              <li>Disable redacted synchronization and clear local warning history.</li>
              <li>Remove protected sites or uninstall HallGuard.</li>
              <li>Submit a complaint to an applicable data-protection authority.</li>
            </ul>
          </PolicySection>

          <PolicySection title="12. Children’s privacy">
            <p>
              HallGuard is not directed to children under 13, or under the higher
              minimum age required in a user’s jurisdiction. HallGuard does not
              knowingly collect personal information from children without
              appropriate authorization.
            </p>
          </PolicySection>

          <PolicySection title="13. Changes to this policy">
            <p>
              HallGuard may update this Privacy Policy as the product, legal
              requirements, or data practices change. The updated policy will be
              posted on this page with a revised effective or last-updated date.
              Material changes may also be communicated through the website,
              extension, or account service.
            </p>
          </PolicySection>

          <PolicySection title="14. Contact and privacy requests">
            <p>
              Until a dedicated HallGuard privacy email is published, privacy and
              data-rights requests can be submitted through the HallGuard support
              contact shown on its Chrome Web Store listing. Include the email
              address associated with the account and enough detail to identify
              the request. Do not include passwords, authentication tokens, or
              sensitive AI chat content in the request.
            </p>
          </PolicySection>
        </div>
      </div>
    </article>
  );
}

function PolicySection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 pt-8">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-7 text-slate-700 [&_h3]:pt-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-950 [&_li]:ml-5 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-950 px-6 py-8 text-slate-300 sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/hallguard-icon.png"
            alt=""
            className="h-7 w-7 rounded"
            width="28"
            height="28"
          />
          <span>© 2026 HallGuard. AI permission firewall.</span>
        </div>
        <nav aria-label="Legal" className="flex items-center gap-5 font-semibold">
          <a className="transition hover:text-white" href="/trust">
            Trust architecture
          </a>
          <a className="transition hover:text-white" href="/privacy">
            Privacy Policy
          </a>
        </nav>
      </div>
    </footer>
  );
}

function DemoSection() {
  return (
    <section
      id="demo"
      className="border-y border-slate-200 bg-slate-100 px-6 py-20 sm:px-8 lg:px-10"
    >
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1fr] lg:items-center">
        <SectionIntro
          eyebrow="Demo"
          title="A warning appears before the risky action continues."
          body="This early website uses a faithful UI mock while real production screenshots are prepared. The flow should eventually show the exact extension popup and warning state."
        />
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Recent warning
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Sensitive data detected before send
              </p>
            </div>
            <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              Review
            </span>
          </div>
          <div className="space-y-4 pt-5">
            {[
              ["Input checked", "Prompt includes API key-like text"],
              ["Decision", "User reviews warning before continuing"],
              ["History", "Only redacted snippets are eligible for synced reports"]
            ].map(([label, value]) => (
              <div key={label} className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 text-teal-600" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-slate-950">{label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function InstallSection() {
  return (
    <section id="install" className="bg-white px-6 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-xl shadow-slate-300/40 lg:grid-cols-[1fr_0.8fr] lg:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-teal-200">
              Early access path
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Manual install first. Chrome Web Store later.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Before the Web Store listing is approved, this website should send
              people to clear install instructions or a release download. Once
              the listing exists, this CTA becomes Add to Chrome.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-3">
            <a className="button-light" href="#faq">
              <Download className="h-4 w-4" aria-hidden="true" />
              Prepare install instructions
            </a>
            <a className="button-dark-outline" href="#demo">
              <Github className="h-4 w-4" aria-hidden="true" />
              Link release when ready
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section id="faq" className="bg-slate-50 px-6 py-20 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <SectionIntro
          eyebrow="FAQ"
          title="Clear expectations before public sharing."
          body="The first public version should reduce confusion around installation, privacy, and limits."
        />
        <div className="mt-10 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {faqItems.map((item) => (
            <details key={item.question} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-slate-950">
                {item.question}
                <span className="text-xl leading-none text-slate-500 transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionIntro({
  eyebrow,
  title,
  body,
  inverted = false
}: {
  eyebrow: string;
  title: string;
  body: string;
  inverted?: boolean;
}) {
  return (
    <motion.div {...fadeIn} className="max-w-3xl">
      <p
        className={`text-sm font-semibold uppercase tracking-wider ${inverted ? "text-teal-200" : "text-teal-700"
          }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-3 text-3xl font-semibold tracking-normal sm:text-4xl ${inverted ? "text-white" : "text-slate-950"
          }`}
      >
        {title}
      </h2>
      <p
        className={`mt-4 text-base leading-7 ${inverted ? "text-slate-300" : "text-slate-600"
          }`}
      >
        {body}
      </p>
    </motion.div>
  );
}

function InfoCard({
  title,
  description,
  icon: Icon
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <motion.article
      {...fadeIn}
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-teal-50 text-teal-700">
        <Icon className="h-5 w-5" aria-hidden={true} />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
    </motion.article>
  );
}

export default App;
