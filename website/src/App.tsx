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

const fadeIn = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.45, ease: "easeOut" as const }
} as const;

function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <HeroSection />
      <ProblemSection />
      <WorkflowSection />
      <SupportSection />
      <PrivacySection />
      <DemoSection />
      <InstallSection />
      <FaqSection />
    </main>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-white">
      <div className="mx-auto grid min-h-[92vh] w-full max-w-7xl items-center gap-12 px-6 py-8 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
            <img
              src="/ai-firewall-icon.png"
              alt=""
              className="h-6 w-6 rounded"
              width="24"
              height="24"
            />
            Local-first Chrome extension for safer AI chats
          </div>
          <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
            AI Permission Firewall
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
              ["No backend", "MVP checks stay browser-local"],
              ["3 AI tools", "ChatGPT, Claude, Gemini"],
              ["Redacted logs", "Recent warnings stay local"]
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
                AI Permission Firewall warning
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
          title="Detect, warn, and keep the trail local."
          body="The MVP uses rule-based checks in the browser. It focuses on the moments that matter most: paste, send, and upload."
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
      </div>
    </section>
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
              ["History", "Only redacted snippet is stored locally"]
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
        className={`text-sm font-semibold uppercase tracking-wider ${
          inverted ? "text-teal-200" : "text-teal-700"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mt-3 text-3xl font-semibold tracking-normal sm:text-4xl ${
          inverted ? "text-white" : "text-slate-950"
        }`}
      >
        {title}
      </h2>
      <p
        className={`mt-4 text-base leading-7 ${
          inverted ? "text-slate-300" : "text-slate-600"
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
