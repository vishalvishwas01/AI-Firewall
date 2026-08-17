import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  CloudOff,
  Copy,
  EyeOff,
  FileWarning,
  LockKeyhole,
  MessageSquareWarning,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";

const reveal = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-70px" },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const risks = [
  { icon: LockKeyhole, title: "Sensitive data", text: "Keys, tokens, passwords, private URLs, personal details, and other confidential values." },
  { icon: Upload, title: "Risky uploads", text: "Files and upload moments that deserve review before they reach a public AI tool." },
  { icon: ShieldCheck, title: "Prompt injection", text: "Instructions that attempt to override safeguards, reveal hidden rules, or manipulate the user." },
  { icon: MessageSquareWarning, title: "Scam and fraud signals", text: "Urgent, coercive, or deceptive language that can push people toward unsafe actions." },
];

const steps = [
  { number: "01", title: "Work normally", text: "Use ChatGPT, Claude, or Gemini as usual. HallGuard stays close to the composer without sending your prompt to a detection server." },
  { number: "02", title: "A local check runs", text: "Deterministic rules inspect supported paste, send, and upload moments inside the browser before the protected action continues." },
  { number: "03", title: "Review the reason", text: "When a rule finds risk, HallGuard explains the severity, evidence labels, and a safely redacted preview." },
  { number: "04", title: "Choose the next action", text: "Cancel, copy or use the redacted version, or continue when your active policy permits an override." },
];

export function HomePage() {
  return <div id="page-content" tabIndex={-1} className="home-shell overflow-hidden bg-[#faf9f6] text-[#1a1c1a] outline-none">
    <Hero />
    <RiskStrip />
    <Walkthrough />
    <WarningDemo />
    <Privacy />
    <ForEveryone />
    <Setup />
    <Faq />
  </div>;
}

function Hero() {
  return <section className="home-grid relative border-b border-[#ccc6bc]/60">
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1280px] items-center gap-12 px-6 py-16 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-12 xl:px-16">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: "easeOut" }} className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#ccc6bc] bg-white/75 px-3 py-2 text-sm font-medium text-[#4a463f] shadow-sm backdrop-blur"><span className="h-2 w-2 rounded-full bg-emerald-600" />Local-first protection for AI conversations</div>
        <h1 className="mt-7 font-[Manrope] text-[42px] font-semibold leading-[1.08] tracking-[-0.035em] text-[#33312b] sm:text-[56px] lg:text-[64px]">Pause risky data before AI receives it.</h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[#4a463f]">HallGuard is a browser permission firewall that checks supported AI actions locally, explains what looks risky, and lets you redact or stop sensitive content before it leaves the page.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a href="#setup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#33312b] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#49483f]">Set up extension <ArrowRight className="h-4 w-4" /></a>
          <a href="/trust" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#7b776e]/50 bg-white/70 px-6 py-3 text-sm font-semibold text-[#33312b] transition hover:bg-white"><ShieldCheck className="h-4 w-4" />Explore Trust</a>
        </div>
        <div className="mt-10 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
          {[ ["Local", "Detection path"], ["Before action", "Paste, send, upload"], ["Redacted", "Optional reporting"] ].map(([value, label]) => <div key={value} className="rounded-xl border border-white/60 bg-[#f5f2ea]/75 px-4 py-3 shadow-[0_8px_24px_rgba(51,49,43,0.05)] backdrop-blur"><p className="font-[Geist] text-sm font-semibold text-[#33312b]">{value}</p><p className="mt-1 text-xs leading-5 text-[#65645e]">{label}</p></div>)}
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.1, ease: "easeOut" }} className="relative z-10 lg:pl-4"><BrowserDemo /></motion.div>
    </div>
  </section>;
}

function BrowserDemo() {
  return <div className="relative mx-auto max-w-[620px]">
    <div className="absolute -inset-8 rounded-full bg-[#cbc6be]/30 blur-3xl" />
    <div className="relative overflow-hidden rounded-[24px] border border-white/70 bg-[#2f312f] p-3 shadow-[0_28px_80px_rgba(51,49,43,0.22)]">
      <div className="flex items-center justify-between px-2 pb-3 pt-1"><div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#ff8c82]"/><span className="h-2.5 w-2.5 rounded-full bg-[#e8c15a]"/><span className="h-2.5 w-2.5 rounded-full bg-[#68c9ad]"/></div><div className="rounded-full bg-white/10 px-4 py-1 text-[11px] text-[#cbc6be]">chatgpt.com</div><span className="w-10"/></div>
      <div className="rounded-[17px] bg-[#f4f3f1] p-4 sm:p-5">
        <div className="rounded-xl border border-[#ccc6bc]/70 bg-white p-4 text-sm leading-6 text-[#4a463f]">Review this deployment config:<br/><code className="text-[#93000a]">api_key=sk_live_••••••••</code></div>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-[#33312b] px-4 py-3 text-sm text-white"><span>Ask AI</span><ArrowRight className="h-4 w-4"/></div>
      </div>
    </div>
    <div className="relative z-10 mt-5 ml-auto w-[96%] rounded-[20px] border border-[#e2c7a1] bg-[#fffaf0] shadow-[0_24px_70px_rgba(51,49,43,0.20)] sm:-mr-3 sm:w-[88%] lg:-mr-5">
      <div className="grid grid-cols-[1fr_auto] items-start gap-4 border-b border-[#eadcc8] p-5"><div><div className="flex items-center gap-2"><CircleAlert className="h-5 w-5 shrink-0 text-[#a51d22]"/><p className="font-[Manrope] text-lg font-semibold text-[#2f312f]">Sensitive secret detected</p></div><p className="mt-1 text-sm leading-5 text-[#4a463f]">This looks like it contains a key, token, password, or private secret.</p></div><span className="shrink-0 whitespace-nowrap rounded-full bg-[#ffdad6] px-3 py-1.5 text-xs font-semibold leading-none text-[#93000a]">HIGH RISK</span></div>
      <div className="space-y-3 p-5"><div className="rounded-lg border border-[#e5d9c8] bg-white/80 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[#65645e]">Redacted preview</p><code className="mt-2 block text-sm text-[#33312b]">api_key=[REDACTED]</code></div><div className="grid grid-cols-2 gap-2"><button className="rounded-lg border border-[#ccc6bc] bg-white px-3 py-2.5 text-sm font-semibold text-[#33312b]">Cancel</button><button className="rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white">Use redacted</button></div></div>
    </div>
  </div>;
}

function RiskStrip() {
  return <section className="border-b border-[#ccc6bc]/60 bg-[#33312b] px-6 py-10 text-white sm:px-8 lg:px-12"><div className="mx-auto grid max-w-[1280px] gap-6 sm:grid-cols-2 lg:grid-cols-4">{risks.map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10"><Icon className="h-5 w-5 text-[#e8e2d9]"/></div><div><h2 className="font-[Manrope] text-base font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-[#cbc6be]">{text}</p></div></div>)}</div></section>;
}

function Walkthrough() {
  return <section id="how-it-works" className="bg-[#faf9f6] px-6 py-24 sm:px-8 lg:px-12"><div className="mx-auto max-w-[1280px]"><SectionHeading eyebrow="How it works" title="A clear decision at the moment it matters." text="HallGuard adds a review step without moving synchronous detection to the cloud or taking control away from the user."/><div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-[#ccc6bc]/70 bg-[#ccc6bc]/70 md:grid-cols-2 lg:grid-cols-4">{steps.map((step, index) => <motion.article key={step.number} {...reveal} transition={{ ...reveal.transition, delay: index * 0.06 }} className="bg-[#f5f2ea] p-6 lg:min-h-72"><span className="font-[Geist] text-xs font-semibold tracking-[0.14em] text-[#7b776e]">{step.number}</span><h3 className="mt-12 font-[Manrope] text-xl font-semibold text-[#33312b]">{step.title}</h3><p className="mt-3 text-sm leading-6 text-[#4a463f]">{step.text}</p></motion.article>)}</div></div></section>;
}

function WarningDemo() {
  return <section className="home-grid border-y border-[#ccc6bc]/60 bg-[#efeeeb] px-6 py-24 sm:px-8 lg:px-12"><div className="relative z-10 mx-auto max-w-[1280px]"><SectionHeading eyebrow="Warning walkthrough" title="Understand the warning before choosing what happens next." text="The demonstration below mirrors the extension’s current action model using safe example content."/><div className="mt-14 grid items-start gap-8 xl:grid-cols-[0.72fr_1.28fr]">
    <div className="space-y-3">{[
      [ScanSearch, "Why it was flagged", "Evidence labels describe the matched pattern without exposing more data."],
      [EyeOff, "What will be redacted", "The preview masks the detected value before you copy or replace it."],
      [ClipboardCheck, "You keep the decision", "Cancel, use the redacted version, or continue when policy allows."],
      [FileWarning, "Feedback improves review", "Mark a warning correct or a false alarm without uploading the raw secret."],
    ].map(([Icon, title, text]) => { const DemoIcon = Icon as typeof ScanSearch; return <div key={String(title)} className="rounded-xl border border-white/70 bg-white/55 p-5 backdrop-blur"><div className="flex gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#33312b] text-white"><DemoIcon className="h-5 w-5"/></div><div><h3 className="font-[Manrope] font-semibold text-[#33312b]">{String(title)}</h3><p className="mt-1 text-sm leading-6 text-[#4a463f]">{String(text)}</p></div></div></div>})}</div>
    <DetailedWarning />
  </div></div></section>;
}

function DetailedWarning() {
  return <div className="overflow-hidden rounded-2xl border border-[#e2c7a1] bg-[#fffaf0] shadow-[0_22px_70px_rgba(51,49,43,0.13)]">
    <div className="flex flex-col justify-between gap-4 border-b border-[#eadcc8] p-6 sm:flex-row"><div><h3 className="font-[Manrope] text-xl font-semibold text-[#2f312f]">Sensitive secret detected</h3><p className="mt-1 text-base text-[#4a463f]">This looks like it contains a key, token, password, or private secret.</p><p className="mt-3 font-[Geist] text-xs font-semibold uppercase tracking-[0.08em] text-[#745c12]">High confidence · rule</p></div><span className="h-fit w-fit shrink-0 whitespace-nowrap rounded-full bg-[#ffdad6] px-3 py-1.5 font-[Geist] text-xs font-semibold text-[#93000a]">HIGH RISK</span></div>
    <div className="space-y-4 p-6"><p className="text-sm text-[#4a463f]">HallGuard recommends blocking this paste until you review it.</p><div className="rounded-xl border border-[#e5d9c8] bg-white/80 p-4"><p className="font-[Geist] text-xs font-semibold uppercase text-[#65645e]">Why flagged</p><ul className="mt-3 space-y-1 pl-5 text-sm text-[#4a463f]"><li>secret assignment</li><li>key-like text</li><li>Code: sensitive.secret-assignment</li></ul></div><div className="rounded-xl border border-[#e5d9c8] bg-white/80 p-4"><p className="font-[Geist] text-xs font-semibold uppercase text-[#65645e]">Redacted preview</p><code className="mt-3 block text-sm text-[#33312b]">api_key=[REDACTED]</code></div><div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e5d9c8] bg-white/80 p-3"><span className="mr-1 text-xs font-semibold text-[#65645e]">Warning quality</span><button className="rounded-lg border border-[#d8c9b6] bg-white px-3 py-2 text-sm font-semibold text-[#33312b]">Correct</button><button className="rounded-lg border border-[#d8c9b6] bg-white px-3 py-2 text-sm font-semibold text-[#33312b]">False alarm</button></div></div>
    <div className="grid gap-2 border-t border-[#eadcc8] bg-white/35 p-5 sm:grid-cols-4"><button className="rounded-lg border border-[#d8c9b6] bg-white px-3 py-3 text-sm font-semibold text-[#33312b]">Cancel paste</button><button className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-3 text-sm font-semibold text-white"><Copy className="h-4 w-4"/>Copy redacted</button><button className="rounded-lg border border-[#d8c9b6] bg-white px-3 py-3 text-sm font-semibold text-[#33312b]">Use redacted</button><button className="rounded-lg bg-[#a51d22] px-3 py-3 text-sm font-semibold text-white">Paste anyway</button></div>
  </div>;
}

function Privacy() {
  const items = [
    [CloudOff, "No network dependency for the decision", "The supported synchronous detection path runs locally, so a paste or send check does not wait for server inference."],
    [EyeOff, "Raw prompt content stays out of reports", "Optional account reporting receives bounded warning metadata, evidence labels, and masked snippets—not the original secret."],
    [Sparkles, "Classifier remains shadow-only", "The optional local classifier can provide observational signals, but deterministic rules still control warnings and actions."],
  ];
  return <section className="bg-[#33312b] px-6 py-24 text-white sm:px-8 lg:px-12"><div className="mx-auto grid max-w-[1280px] gap-14 lg:grid-cols-[0.78fr_1.22fr]"><SectionHeading eyebrow="Privacy boundary" title="Protection first. Collection optional." text="HallGuard is designed so local protection does not depend on account reporting or improvement telemetry." inverted/><div className="grid gap-4">{items.map(([Icon, title, text]) => { const PrivacyIcon = Icon as typeof CloudOff; return <article key={String(title)} className="rounded-2xl border border-white/10 bg-white/[0.06] p-6"><PrivacyIcon className="h-6 w-6 text-[#e8e2d9]"/><h3 className="mt-5 font-[Manrope] text-xl font-semibold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-[#cbc6be]">{String(text)}</p></article>})}<a href="/trust" className="mt-2 inline-flex items-center gap-2 font-[Geist] text-sm font-semibold text-white hover:underline">Read the full Trust Architecture <ChevronRight className="h-4 w-4"/></a></div></div></section>;
}

function ForEveryone() {
  return <section className="bg-[#faf9f6] px-6 py-24 sm:px-8 lg:px-12"><div className="mx-auto max-w-[1280px]"><SectionHeading eyebrow="One firewall, two ways to use it" title="Personal protection and managed team policy." text="Choose an individual account for your own redacted history, or an enterprise workspace for members, protected sites, policy controls, and aggregate reporting."/><div className="mt-12 grid gap-5 lg:grid-cols-2"><AudienceCard icon={Users} title="Individual" points={["Local warning controls", "Personal protected-site list", "Optional redacted report history", "Local export and feedback controls"]} href="/signup"/><AudienceCard icon={Building2} title="Enterprise" points={["Organization members and invitations", "Managed site and warning policies", "Aggregate metadata-only team reporting", "Owner and admin workspace controls"]} href="/signup?type=enterprise"/></div></div></section>;
}

function AudienceCard({ icon: Icon, title, points, href }: { icon: typeof Users; title: string; points: string[]; href: string }) {
  return <article className="rounded-2xl border border-[#ccc6bc]/70 bg-[#f5f2ea] p-7 shadow-[0_10px_35px_rgba(51,49,43,0.06)]"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#33312b] text-white"><Icon className="h-6 w-6"/></div><h3 className="mt-6 font-[Manrope] text-2xl font-semibold text-[#33312b]">{title}</h3><ul className="mt-5 grid gap-3">{points.map(point => <li key={point} className="flex gap-3 text-sm text-[#4a463f]"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e5e2da]"><Check className="h-3 w-3"/></span>{point}</li>)}</ul><a href={href} className="mt-7 inline-flex items-center gap-2 rounded-lg bg-[#33312b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#49483f]">Create {title.toLowerCase()} account <ArrowRight className="h-4 w-4"/></a></article>;
}

function Setup() {
  return <section id="setup" className="home-grid border-y border-[#ccc6bc]/60 bg-[#efeeeb] px-6 py-24 sm:px-8 lg:px-12"><div className="relative z-10 mx-auto max-w-[1000px] text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#33312b] text-white"><ShieldCheck className="h-7 w-7"/></div><h2 className="mt-7 font-[Manrope] text-3xl font-semibold tracking-[-0.02em] text-[#33312b] sm:text-4xl">Extension setup is coming next.</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#4a463f]">This area is reserved for the final Chrome Web Store installation and connection flow. Until deployment details are ready, no misleading install action is shown.</p><div className="mx-auto mt-8 min-h-14 max-w-md rounded-xl border border-dashed border-[#7b776e]/50 bg-white/40" aria-label="Reserved extension setup area"/></div></section>;
}

function Faq() {
  const questions = [
    ["Does HallGuard send my prompt away to check it?", "No. The supported synchronous warning decision runs locally in the extension. Optional reporting and separately consented improvement data are asynchronous and schema-bounded."],
    ["Can I use HallGuard without synced reports?", "Yes. Redacted report sync can be switched off while local protection and local warning history continue to work."],
    ["Can HallGuard block every mistake?", "No security tool is perfect. Deterministic rules can miss subtle risks or flag harmless text, which is why warnings explain evidence and keep decisions visible."],
    ["Which AI sites are supported first?", "The current first-party target set is ChatGPT, Claude, and Gemini, with protected-site configuration available for reporting and managed policy."],
  ];
  return <section className="bg-[#faf9f6] px-6 py-24 sm:px-8 lg:px-12"><div className="mx-auto max-w-[900px]"><SectionHeading eyebrow="Questions" title="What users should know before they start." text="Clear answers about the current product—not promises about future deployment."/><div className="mt-10 divide-y divide-[#ccc6bc] border-y border-[#ccc6bc]">{questions.map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-[Manrope] text-lg font-semibold text-[#33312b]"><span>{question}</span><span className="text-2xl font-light transition group-open:rotate-45">+</span></summary><p className="max-w-3xl pt-3 text-sm leading-7 text-[#4a463f]">{answer}</p></details>)}</div></div></section>;
}

function SectionHeading({ eyebrow, title, text, inverted = false }: { eyebrow: string; title: string; text: string; inverted?: boolean }) {
  return <motion.div {...reveal} className="max-w-3xl"><p className={`font-[Geist] text-xs font-semibold uppercase tracking-[0.14em] ${inverted ? "text-[#cbc6be]" : "text-[#65645e]"}`}>{eyebrow}</p><h2 className={`mt-4 font-[Manrope] text-3xl font-semibold leading-tight tracking-[-0.025em] sm:text-4xl ${inverted ? "text-white" : "text-[#33312b]"}`}>{title}</h2><p className={`mt-4 text-base leading-7 ${inverted ? "text-[#cbc6be]" : "text-[#4a463f]"}`}>{text}</p></motion.div>;
}
