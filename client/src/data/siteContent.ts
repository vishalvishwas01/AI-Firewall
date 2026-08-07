import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileWarning,
  LockKeyhole,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UploadCloud
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type IconItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const riskCards: IconItem[] = [
  {
    title: "Sensitive prompts",
    description:
      "Warns when a prompt appears to contain passwords, tokens, contact details, or card-like data.",
    icon: LockKeyhole
  },
  {
    title: "Risky uploads",
    description:
      "Flags files that deserve a second look before they are shared with an AI chat.",
    icon: UploadCloud
  },
  {
    title: "Prompt injection",
    description:
      "Catches common instructions that try to override, reveal, or bypass AI system rules.",
    icon: ShieldAlert
  },
  {
    title: "Scam language",
    description:
      "Highlights fraud-like wording before you copy, paste, or act on suspicious AI content.",
    icon: MessageSquareWarning
  }
];

export const workflowSteps: IconItem[] = [
  {
    title: "Detect locally",
    description:
      "Deterministic rules run in the browser against prompts, uploads, paste events, and send actions. An optional local classifier adds private shadow signals without deciding warnings.",
    icon: Bot
  },
  {
    title: "Warn in context",
    description:
      "High and medium risk moments ask for confirmation before the action continues.",
    icon: AlertTriangle
  },
  {
    title: "Keep a redacted trail",
    description:
      "Recent warning history stays local first, and account-backed reports use masked snippets only.",
    icon: FileWarning
  }
];

export const supportedTools = ["ChatGPT", "Claude", "Gemini"];

export const privacyPoints: IconItem[] = [
  {
    title: "Local protection first",
    description:
      "Deterministic rules and the optional local classifier run in the browser. The classifier remains shadow-only and never sends prompt content.",
    icon: CheckCircle2
  },
  {
    title: "Redacted report sync",
    description:
      "Synced report records must store masked snippets, never raw prompts or secrets.",
    icon: ShieldCheck
  },
  {
    title: "Built for early trust",
    description:
      "The website will stay aligned with what the extension actually does today.",
    icon: Sparkles
  }
];

export const faqItems = [
  {
    question: "Can the website activate the extension automatically?",
    answer:
      "Not before the extension is installed. For now the website should guide users to manual install instructions. Later, the primary CTA can point to the Chrome Web Store listing."
  },
  {
    question: "Does HallGuard read my AI account?",
    answer:
      "The extension watches supported AI chat pages for risky text and upload moments. Detection stays local, and account-backed reporting is designed to sync redacted warning records only."
  },
  {
    question: "Is detection perfect?",
    answer:
      "No. Deterministic rules can miss subtle risks or warn on harmless text. An optional local classifier provides additional private shadow signals, but it is not used to create warnings."
  },
  {
    question: "Which sites are supported first?",
    answer:
      "The first extension target list is ChatGPT, Claude, and Gemini."
  }
];

