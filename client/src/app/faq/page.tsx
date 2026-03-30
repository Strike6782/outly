"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import Button from "@/components/Button";
import {
  ChevronDown, HelpCircle, Mail, Shield, Clock, Gauge,
  Users, Zap, Paperclip, RefreshCw, ArrowRight, Menu, X,
  Flame, Snowflake, FileText, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: React.ReactNode;
  category: string;
  icon: React.ElementType;
}

function FAQAccordion({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={cn(
      "border rounded-xl overflow-hidden transition-all duration-200",
      isOpen ? "border-primary/20 bg-primary/[0.02] shadow-sm" : "border-gray-100 hover:border-gray-200"
    )}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-5 py-4 text-left">
        <div className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
          isOpen ? "bg-primary/10" : "bg-gray-50"
        )}>
          <item.icon className={cn("h-4 w-4", isOpen ? "text-primary" : "text-gray-400")} />
        </div>
        <span className={cn(
          "flex-1 text-sm font-semibold transition-colors",
          isOpen ? "text-gray-900" : "text-gray-700"
        )}>{item.question}</span>
        <ChevronDown className={cn(
          "h-4 w-4 text-gray-400 transition-transform duration-200",
          isOpen && "rotate-180 text-primary"
        )} />
      </button>
      <div className={cn(
        "overflow-hidden transition-all duration-200 ease-out",
        isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed ml-11">
          {item.answer}
        </div>
      </div>
    </div>
  );
}

const faqItems: FAQItem[] = [
  // ─── Warmup & Throttling ───
  {
    category: "Warmup & Throttling",
    icon: Flame,
    question: "What is the 14-day warmup and can I skip it?",
    answer: (
      <div className="space-y-2">
        <p>When you add a new sender, Outly automatically starts a 14-day warmup period that gradually increases your daily sending limit from 20 to 500 emails/day. This builds your sender reputation with email providers and prevents your account from being flagged.</p>
        <p>You can skip warmup by checking "Skip warmup period" when adding a sender — but only do this if the account already has established sending history. Skipping warmup on a brand-new account risks triggering Gmail's spam filters.</p>
      </div>
    ),
  },
  {
    category: "Warmup & Throttling",
    icon: Gauge,
    question: "What happens when I hit my sending limit?",
    answer: (
      <div className="space-y-2">
        <p>Outly enforces three layers of rate limiting: per-minute, per-hour, and per-day. When any limit is reached, pending emails are automatically rescheduled with a small random delay — they're not lost.</p>
        <p>If you're using multiple senders, Outly will automatically rotate to the next available sender. If all senders are exhausted, the campaign pauses and auto-resumes when capacity is available (checked every hour).</p>
      </div>
    ),
  },
  {
    category: "Warmup & Throttling",
    icon: Snowflake,
    question: "What is a cooldown and why did my sender enter one?",
    answer: (
      <div className="space-y-2">
        <p>If a sender encounters 3 consecutive SMTP errors (e.g., connection refused, authentication failure), Outly puts it in a 5-minute cooldown. No emails are sent during cooldown to prevent further damage to your sender reputation.</p>
        <p>After cooldown expires, sending resumes automatically. A single successful send resets the error counter. You can see cooldown status in the Throttle Status panel on the campaign detail page.</p>
      </div>
    ),
  },
  {
    category: "Warmup & Throttling",
    icon: Gauge,
    question: "What does 'adaptive throttle' mean?",
    answer: (
      <p>Outly monitors your error rate and bounce rate over a rolling 1-hour window. If more than 10% of emails fail or more than 5% bounce, all rate limits are automatically halved to protect your account. Once the rates drop back to normal, full speed resumes.</p>
    ),
  },
  // ─── Multi-Sender ───
  {
    category: "Multi-Sender",
    icon: Users,
    question: "How does multi-sender rotation work?",
    answer: (
      <div className="space-y-2">
        <p>When you select multiple senders for a campaign, Outly distributes emails across them using round-robin — each sender gets roughly equal volume, respecting their individual daily limits.</p>
        <p>During sending, if one sender hits its limit, emails are automatically reassigned to the next available sender. This lets you send higher volumes without exceeding any single account's limits.</p>
      </div>
    ),
  },
  {
    category: "Multi-Sender",
    icon: Users,
    question: "Do all senders need to be verified?",
    answer: <p>Yes. Every sender in a campaign must have verified SMTP credentials (a Google App Password). Unverified senders are shown in the dropdown but can't be selected for campaigns.</p>,
  },
  // ─── Sequences ───
  {
    category: "Sequences",
    icon: RefreshCw,
    question: "How do follow-up sequences work?",
    answer: (
      <div className="space-y-2">
        <p>You can add up to 5 follow-up steps to a campaign. Each step has its own subject, body, and a wait period (in days) after the previous step was sent.</p>
        <p>The sequence scheduler runs every 15 minutes, checking which recipients are due for their next follow-up. If a recipient replies to any step, their sequence stops automatically.</p>
      </div>
    ),
  },
  {
    category: "Sequences",
    icon: RefreshCw,
    question: "Can I pause or stop a sequence for specific recipients?",
    answer: <p>Yes. On the campaign detail page, switch to the Sequence tab. You can pause, resume, or stop individual recipients. You can also pause/stop the entire sequence for all recipients at once.</p>,
  },
  // ─── Template Variables ───
  {
    category: "Templates & Variables",
    icon: Zap,
    question: "How do template variables work with CSV imports?",
    answer: (
      <div className="space-y-2">
        <p>When you import a CSV, the first column must be email addresses. Additional columns become template variables. For example, a CSV with columns <code className="bg-gray-100 px-1 rounded text-xs">email, name, company</code> lets you use <code className="bg-gray-100 px-1 rounded text-xs">{"{{name}}"}</code> and <code className="bg-gray-100 px-1 rounded text-xs">{"{{company}}"}</code> in your subject and body.</p>
        <p>Variables are resolved per-recipient when the campaign is created. Unmatched variables (no CSV column) are left as-is in the email. The Variable Preview panel shows you exactly what each recipient will see.</p>
      </div>
    ),
  },
  {
    category: "Templates & Variables",
    icon: FileText,
    question: "What's the difference between templates and template variables?",
    answer: (
      <div className="space-y-2">
        <p>Templates are saved subject/body pairs you can reuse across campaigns — like a "cold outreach" template or a "follow-up" template. You create them in the Templates page.</p>
        <p>Template variables (<code className="bg-gray-100 px-1 rounded text-xs">{"{{variable}}"}</code>) are placeholders that get replaced with per-recipient data from your CSV. They work inside any email, whether you started from a template or wrote it from scratch.</p>
      </div>
    ),
  },
  // ─── Attachments ───
  {
    category: "Attachments",
    icon: Paperclip,
    question: "What are the attachment limits?",
    answer: (
      <div className="space-y-2">
        <p>10 MB per file, 25 MB total per campaign, up to 10 files. Supported formats: PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, PNG, JPG, GIF.</p>
        <p>The 25 MB limit matches Gmail's attachment limit — exceeding it would cause emails to bounce. Files are stored in Cloudinary and downloaded by the worker at send time.</p>
      </div>
    ),
  },
  // ─── Campaign Controls ───
  {
    category: "Campaign Controls",
    icon: Shield,
    question: "What happens when I pause a campaign?",
    answer: (
      <div className="space-y-2">
        <p>Pending emails stop being sent immediately. Emails already in the process of sending will complete. When you resume, any emails whose scheduled time has passed are rescheduled starting from now, preserving the original order and delay settings.</p>
      </div>
    ),
  },
  {
    category: "Campaign Controls",
    icon: Shield,
    question: "What happens when I cancel a campaign?",
    answer: <p>All pending emails are immediately marked as cancelled and won't be sent. Emails already sent are not affected. Cancellation is permanent — you can't resume a cancelled campaign.</p>,
  },
  {
    category: "Campaign Controls",
    icon: Shield,
    question: "Why does my campaign show 'Paused · All senders at limit'?",
    answer: <p>This means every sender in the campaign has reached their daily sending limit. The campaign will automatically resume when any sender regains capacity (checked every hour). You can also manually resume it, which will trigger rescheduling.</p>,
  },
  // ─── Security ───
  {
    category: "Security",
    icon: Shield,
    question: "How are my Gmail credentials stored?",
    answer: (
      <div className="space-y-2">
        <p>Your Google App Password is encrypted using AES-256-CBC with a unique random initialization vector before being stored in the database. The encryption key is a server-side secret that never leaves the server.</p>
        <p>Credentials are only decrypted momentarily in memory when the worker needs to send an email, then discarded. They are never included in API responses, logs, or error messages.</p>
      </div>
    ),
  },
  {
    category: "Security",
    icon: Mail,
    question: "What is a Google App Password and why do I need one?",
    answer: (
      <div className="space-y-2">
        <p>Google App Passwords are 16-character codes that let third-party apps access your Gmail via SMTP without using your main password. Google requires them since they disabled "Less Secure App" access in 2022.</p>
        <p>To generate one: go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">myaccount.google.com/apppasswords</a> (requires 2-Step Verification enabled). Create one specifically for Outly and paste it when adding a sender.</p>
      </div>
    ),
  },
  // ─── Tracking ───
  {
    category: "Tracking",
    icon: Mail,
    question: "How does open tracking work?",
    answer: (
      <div className="space-y-2">
        <p>Outly adds a tiny transparent 1x1 pixel image to each outgoing email. When the recipient's email client loads this image, the server records an open event. This is the industry-standard method used by all email marketing platforms.</p>
        <p>Limitation: some email clients (notably Outlook desktop) block images by default, so open rates will undercount. Apple Mail Privacy Protection may inflate rates by pre-fetching images. Open rates are best used as a relative indicator, not an absolute measure.</p>
      </div>
    ),
  },
  {
    category: "Tracking",
    icon: Mail,
    question: "How does click tracking work?",
    answer: <p>Links in your email are automatically rewritten to route through Outly's server. When a recipient clicks a link, the server records the click and immediately redirects them to the original URL. The redirect is instant (302) so recipients don't notice any delay. <code className="bg-gray-100 px-1 rounded text-xs">mailto:</code> links and anchor links are not rewritten.</p>,
  },
  {
    category: "Tracking",
    icon: Mail,
    question: "Can I disable tracking for a specific campaign?",
    answer: <p>Yes. In the compose form's Sending Settings section, you'll see "Track opens" and "Track clicks" toggles. Both are enabled by default. Turn them off before sending if you want to respect recipient privacy for that campaign. The Tracking tab will show a "Tracking not enabled" message for campaigns with tracking disabled.</p>,
  },
  {
    category: "Tracking",
    icon: Mail,
    question: "Why is my open rate higher than expected?",
    answer: <p>Apple Mail Privacy Protection (introduced in iOS 15 / macOS Monterey) pre-fetches all email images through a proxy, which triggers the tracking pixel even if the recipient never actually reads the email. This inflates open rates. There's no reliable way to filter these out — it's an industry-wide issue affecting all email tracking platforms.</p>,
  },
  // ─── General ───
  {
    category: "General",
    icon: Clock,
    question: "How does smart scheduling work?",
    answer: (
      <div className="space-y-2">
        <p>Instead of sending emails at rigid fixed intervals (which looks robotic to email providers), Outly uses your hourly limit to compute an average gap, then randomizes each gap by ±40%. For example, with an hourly limit of 40, the average gap is 90 seconds — but actual gaps range from ~54s to ~126s randomly.</p>
        <p>Your "Min delay" setting acts as a floor — no two emails will ever be closer than this value. The result is a natural-looking send pattern that averages out to your hourly limit over time.</p>
      </div>
    ),
  },
  {
    category: "General",
    icon: Clock,
    question: "When do daily limits reset?",
    answer: <p>Daily sending limits reset at midnight UTC. This means if you're in a timezone behind UTC, your limit resets in the evening. If you're ahead of UTC, it resets in the morning. All rate limiting (per-minute, per-hour, per-day) uses UTC time.</p>,
  },
  {
    category: "General",
    icon: HelpCircle,
    question: "Can I use Outly with non-Gmail providers?",
    answer: <p>Yes. While the default SMTP settings are configured for Gmail, the system supports any SMTP provider. The throttle engine uses provider profiles to set appropriate rate limits — Gmail, Outlook, and a default profile for custom SMTP hosts.</p>,
  },
];

const categories = [...new Set(faqItems.map((item) => item.category))];

export default function FAQPage() {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);

  const filtered = faqItems.filter((item) => {
    const matchesSearch = !searchQuery ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (typeof item.answer === "string" && item.answer.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !activeCategory || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-gray-100">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <a href="/" aria-label="Go to homepage"><Logo size="md" /></a>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
            <a href="/guide" className="hover:text-gray-900 transition-colors">Guide</a>
            <a href="/faq" className="text-gray-900">FAQ</a>
          </div>
          <Button className="hidden md:block w-auto px-5 py-2 rounded-full text-sm" onClick={() => router.push("/login")}>
            Get Started
          </Button>
          <button className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center" onClick={() => setMobileNav(!mobileNav)}>
            {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileNav && (
          <div className="md:hidden border-t border-gray-100 px-6 py-4 space-y-1 bg-white">
            <a href="/guide" className="block text-sm text-gray-600 py-3">Guide</a>
            <a href="/faq" className="block text-sm text-gray-900 font-medium py-3">FAQ</a>
            <Button className="w-full rounded-full mt-2" onClick={() => router.push("/login")}>Get Started</Button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden py-16 md:py-20 bg-gradient-to-b from-violet-50/60 to-white">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-violet-200/20 to-transparent rounded-full blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 mb-6">
            <HelpCircle className="h-3.5 w-3.5" />
            Frequently Asked Questions
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Got questions? We've got answers.
          </h1>
          <p className="mt-4 text-base text-gray-500 max-w-lg mx-auto">
            Everything you need to know about warmup, throttling, sequences, and more.
          </p>

          {/* Search */}
          <div className="relative mt-8 max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions..."
              className="w-full h-12 rounded-xl bg-white border border-gray-200 pl-11 pr-4 text-sm text-gray-700 outline-none shadow-sm focus:border-violet-300 focus:ring-2 focus:ring-violet-100 placeholder:text-gray-300 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 md:py-12">
        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium transition-all",
              !activeCategory
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            )}
          >
            All ({faqItems.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                activeCategory === cat
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              {cat} ({faqItems.filter((i) => i.category === cat).length})
            </button>
          ))}
        </div>

        {/* FAQ items */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No matching questions found.</p>
              <button
                onClick={() => { setSearchQuery(""); setActiveCategory(null); }}
                className="text-sm text-primary hover:underline mt-2"
              >
                Clear filters
              </button>
            </div>
          ) : (
            filtered.map((item, index) => (
              <FAQAccordion
                key={index}
                item={item}
                isOpen={openIndex === index}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))
          )}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-6 sm:p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-gradient-to-b from-violet-500/15 to-transparent rounded-full blur-3xl" />
          <div className="relative">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-3">Still have questions?</h3>
            <p className="text-xs sm:text-sm text-gray-400 mb-6 max-w-md mx-auto">Check out our detailed guide or get started and explore the features yourself.</p>
            <div className="flex flex-col items-center gap-3 max-w-xs mx-auto">
              <Button className="!w-full px-6 py-3 rounded-full text-sm" onClick={() => router.push("/guide")}>
                Read the Guide <ArrowRight className="ml-1.5 h-3.5 w-3.5 inline" />
              </Button>
              <button
                onClick={() => router.push("/contact")}
                className="w-full px-6 py-3 rounded-full text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                Contact Us
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-100 bg-gray-50/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col items-center gap-5 md:flex-row md:justify-between">
          <a href="/" aria-label="Go to homepage"><Logo size="sm" /></a>
          <nav className="flex items-center gap-6">
            <a href="/guide" className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">Guide</a>
            <a href="/faq" className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">FAQ</a>
            <a href="/privacy" className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">Privacy</a>
            <a href="/terms" className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">Terms</a>
          </nav>
          <span className="text-xs text-gray-500">© 2026 Outly</span>
        </div>
      </footer>
    </div>
  );
}
