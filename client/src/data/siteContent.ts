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
      "Rules run in the browser against prompts, uploads, paste events, and send actions.",
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
      "Recent warning history stays in local browser storage with sensitive snippets masked.",
    icon: FileWarning
  }
];

export const supportedTools = ["ChatGPT", "Claude", "Gemini"];

export const privacyPoints: IconItem[] = [
  {
    title: "No account for the MVP",
    description:
      "The extension is designed for individual use without sign-in, dashboards, or team admin.",
    icon: CheckCircle2
  },
  {
    title: "No backend logging",
    description:
      "Protection runs in the browser and the MVP does not send warning history to a server.",
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
    question: "Does AI Permission Firewall read my AI account?",
    answer:
      "The MVP watches supported AI chat pages for risky text and upload moments. It does not add a backend account, dashboard, or remote activity log."
  },
  {
    question: "Is detection perfect?",
    answer:
      "No. The current MVP uses local rules, so it can miss subtle risks or warn on harmless text. The first public version should explain that clearly."
  },
  {
    question: "Which sites are supported first?",
    answer:
      "The first extension target list is ChatGPT, Claude, and Gemini."
  }
];

