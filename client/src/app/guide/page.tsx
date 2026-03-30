"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import Button from "@/components/Button";
import {
  Mail, Shield, Clock, Gauge, AlertTriangle, CheckCircle2,
  ArrowRight, ChevronDown, Send, Users, Rocket,
  Zap, BookOpen, Target, BarChart3, Lock, Menu, X,
  Flame, Paperclip, RefreshCw, FileText, HelpCircle,
} from "lucide-react";

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-24">{children}</section>;
}

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
    </div>
  );
}

function Accordion({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon: React.ElementType }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden transition-all duration-200 hover:border-gray-200">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-5 py-4 text-left">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <span className="flex-1 text-sm font-semibold text-gray-900">{title}</span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed">{children}</div>}
    </div>
  );
}

function StepCard({ step, title, desc, icon: Icon }: { step: string; title: string; desc: string; icon: React.ElementType }) {
  return (
    <div className="flex gap-4 p-5 rounded-xl bg-gray-50/80 border border-gray-100 hover:border-gray-200 transition-all">
      <div className="h-8 w-8 rounded-lg bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">{step}</div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

const limits = [
  { type: "Free Gmail", hourly: "20", daily: "300–400", color: "bg-blue-50 text-blue-700 border-blue-100" },
  { type: "Google Workspace", hourly: "75", daily: "1,500–1,800", color: "bg-purple-50 text-purple-700 border-purple-100" },
];

const warmupSchedule = [
  { day: "Day 1–2", limit: "20–30/day", note: "Initial reputation building" },
  { day: "Day 3–5", limit: "50–100/day", note: "Gradual ramp-up" },
  { day: "Day 6–10", limit: "150–300/day", note: "Approaching target" },
  { day: "Day 11–14", limit: "350–500/day", note: "Full capacity" },
];

const navItems = [
  { label: "Getting Started", href: "#getting-started" },
  { label: "Multi-Sender", href: "#multi-sender" },
  { label: "Throttling", href: "#throttling" },
  { label: "Sequences", href: "#sequences" },
  { label: "Variables", href: "#variables" },
  { label: "Best Practices", href: "#best-practices" },
  { label: "Troubleshooting", href: "#troubleshooting" },
];

export default function GuidePage() {
  const router = useRouter();
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-gray-100">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <a href="/" aria-label="Go to homepage"><Logo size="md" /></a>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
            {navItems.slice(0, 4).map((item) => (
              <a key={item.href} href={item.href} className="hover:text-gray-900 transition-colors">{item.label}</a>
            ))}
            <a href="/faq" className="hover:text-gray-900 transition-colors">FAQ</a>
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
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="block text-sm text-gray-600 py-3" onClick={() => setMobileNav(false)}>{item.label}</a>
            ))}
            <a href="/faq" className="block text-sm text-gray-600 py-3" onClick={() => setMobileNav(false)}>FAQ</a>
            <Button className="w-full rounded-full mt-2" onClick={() => router.push("/login")}>Get Started</Button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden py-16 md:py-24 bg-gradient-to-b from-green-50/60 to-white">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-primary/5 to-transparent rounded-full blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <BookOpen className="h-3.5 w-3.5" />
            Complete User Guide
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
            Send emails safely,<br />
            <span className="bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">land more interviews</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            Everything you need to know about multi-sender campaigns, smart throttling, follow-up sequences, and template variables.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 md:py-16 space-y-16">

        {/* Getting Started */}
        <Section id="getting-started">
          <SectionHeader icon={Rocket} title="Getting Started" color="from-primary to-emerald-600" />
          <div className="space-y-4">
            <StepCard step="1" title="Sign in with Google" desc="Click 'Continue with Google' on the login page. A placeholder sender is auto-created with your Gmail address." icon={Mail} />
            <StepCard step="2" title="Add & verify a sender" desc="In Compose, click '+' next to the sender dropdown. Enter your Gmail and a Google App Password (from myaccount.google.com/apppasswords). Outly verifies SMTP connectivity before saving." icon={Shield} />
            <StepCard step="3" title="Configure sending settings" desc="Set your hourly limit (how many emails per hour) and minimum delay between emails. Outly automatically adds random spacing to make your sending pattern look natural — not robotic." icon={Gauge} />
            <StepCard step="4" title="Add recipients" desc="Type emails manually or import a CSV. CSV columns beyond the first become template variables (e.g., name, company) for personalization." icon={Users} />
            <StepCard step="5" title="Send or schedule" desc="Write your email, optionally add follow-up steps and attachments, then send immediately or schedule for later. Monitor progress from the dashboard." icon={Send} />
          </div>
        </Section>

        {/* Multi-Sender */}
        <Section id="multi-sender">
          <SectionHeader icon={Users} title="Multi-Sender Campaigns" color="from-blue-500 to-cyan-600" />
          <div className="space-y-4">
            <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-5">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Why use multiple senders?</h3>
              <p className="text-sm text-blue-700 leading-relaxed">Gmail limits each account to ~500 emails/day. By rotating across 3 senders, you can send up to 1,500/day while staying within each account's limits. Outly handles the rotation automatically.</p>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3 items-start p-4 rounded-xl border border-gray-100">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Round-robin distribution</p>
                  <p className="text-xs text-gray-500 mt-0.5">Emails are evenly distributed across senders, respecting each sender's daily limit.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start p-4 rounded-xl border border-gray-100">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Automatic failover</p>
                  <p className="text-xs text-gray-500 mt-0.5">If one sender hits its limit, emails are automatically reassigned to the next available sender.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start p-4 rounded-xl border border-gray-100">
                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Auto-resume</p>
                  <p className="text-xs text-gray-500 mt-0.5">If all senders are exhausted, the campaign pauses and automatically resumes when capacity is available.</p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Throttling & Warmup */}
        <Section id="throttling">
          <SectionHeader icon={Gauge} title="Smart Throttling & Warmup" color="from-amber-500 to-orange-600" />

          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Outly enforces multiple layers of rate limiting to protect your sender accounts from suspension.
          </p>

          {/* Provider limits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {limits.map((l) => (
              <div key={l.type} className={`rounded-xl border p-5 ${l.color}`}>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-3">{l.type}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="opacity-70">Hourly</span><span className="font-semibold">{l.hourly} emails</span></div>
                  <div className="flex justify-between text-sm"><span className="opacity-70">Daily</span><span className="font-semibold">{l.daily} emails</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* Warmup schedule */}
          <div className="rounded-xl border border-gray-100 overflow-hidden mb-8">
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
              <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                <Flame className="h-4 w-4" />
                14-Day Automatic Warmup
              </h3>
              <p className="text-xs text-amber-700 mt-1">New senders start with low limits that increase daily. Skip this if your account has existing sending history.</p>
            </div>
            <div className="divide-y divide-gray-50">
              {warmupSchedule.map((w) => (
                <div key={w.day} className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-3 text-sm gap-1 sm:gap-0">
                  <span className="font-medium text-gray-700 sm:w-24">{w.day}</span>
                  <span className="text-gray-900 font-semibold">{w.limit}</span>
                  <span className="text-gray-400 text-xs sm:text-sm sm:text-right sm:flex-1 sm:ml-4">{w.note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Throttle layers */}
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Rate Limit Layers</h3>
          <div className="space-y-2 mb-6">
            {[
              { label: "Per-minute", desc: "Prevents burst sends that trigger spam filters", icon: Clock },
              { label: "Per-hour", desc: "Stays within provider hourly caps", icon: Gauge },
              { label: "Per-day", desc: "Respects daily limits including warmup", icon: BarChart3 },
              { label: "Adaptive", desc: "Halves speed when error rate > 10% or bounce rate > 5%", icon: AlertTriangle },
              { label: "Cooldown", desc: "Pauses sender for 5 min after 3 consecutive SMTP errors", icon: Shield },
            ].map((layer) => (
              <div key={layer.label} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <layer.icon className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-900">{layer.label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{layer.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Sequences */}
        <Section id="sequences">
          <SectionHeader icon={RefreshCw} title="Follow-Up Sequences" color="from-violet-500 to-purple-600" />
          <div className="space-y-4">
            <div className="rounded-xl bg-violet-50/50 border border-violet-100 p-5">
              <h3 className="text-sm font-semibold text-violet-900 mb-2">Automated follow-ups that stop on reply</h3>
              <p className="text-sm text-violet-700 leading-relaxed">Add up to 5 follow-up steps to any campaign. Each step has its own subject, body, and wait period. If a recipient replies to any step, their sequence stops automatically.</p>
            </div>
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Example Sequence</p>
              </div>
              <div className="divide-y divide-gray-50">
                {[
                  { step: "Step 1", subject: "Initial outreach", wait: "Sent immediately", color: "bg-primary" },
                  { step: "Step 2", subject: "Gentle follow-up", wait: "3 days after Step 1", color: "bg-violet-500" },
                  { step: "Step 3", subject: "Final check-in", wait: "5 days after Step 2", color: "bg-purple-500" },
                ].map((s) => (
                  <div key={s.step} className="flex items-center gap-3 px-5 py-3">
                    <div className={`h-6 w-6 rounded-md ${s.color} text-white flex items-center justify-center text-[10px] font-bold shrink-0`}>
                      {s.step.split(" ")[1]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{s.subject}</p>
                      <p className="text-[11px] text-gray-400">{s.wait}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 items-start p-4 rounded-xl border border-gray-100">
              <CheckCircle2 className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Per-recipient controls</p>
                <p className="text-xs text-gray-500 mt-0.5">Pause, resume, or stop sequences for individual recipients from the campaign detail page.</p>
              </div>
            </div>
          </div>
        </Section>

        {/* Template Variables */}
        <Section id="variables">
          <SectionHeader icon={Zap} title="Template Variables & CSV" color="from-cyan-500 to-teal-600" />
          <div className="space-y-4">
            <p className="text-sm text-gray-500 leading-relaxed">
              Personalize every email with dynamic variables pulled from your CSV data.
            </p>

            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CSV Format</p>
              </div>
              <div className="p-4 font-mono text-xs text-gray-600 bg-gray-50/50">
                <p className="text-gray-400">email,name,company,role</p>
                <p>recruiter@acme.com,Sarah,Acme Corp,Engineering Manager</p>
                <p>hiring@startup.io,Mike,StartupIO,CTO</p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Template</p>
              </div>
              <div className="p-4 text-sm text-gray-600 bg-gray-50/50 leading-relaxed">
                <p>Hi <span className="bg-cyan-100 text-cyan-700 px-1 rounded font-mono text-xs">{"{{name}}"}</span>,</p>
                <p className="mt-2">I saw that <span className="bg-cyan-100 text-cyan-700 px-1 rounded font-mono text-xs">{"{{company}}"}</span> is hiring for a <span className="bg-cyan-100 text-cyan-700 px-1 rounded font-mono text-xs">{"{{role}}"}</span> position...</p>
              </div>
            </div>

            <div className="flex gap-3 items-start p-4 rounded-xl bg-cyan-50 border border-cyan-100">
              <Zap className="h-4 w-4 text-cyan-600 mt-0.5 shrink-0" />
              <p className="text-sm text-cyan-700">The Variable Preview panel in the compose form shows you exactly how each recipient's email will look before you send.</p>
            </div>
          </div>
        </Section>

        {/* Email Tracking */}
        <Section id="tracking">
          <SectionHeader icon={Target} title="Email Tracking" color="from-emerald-500 to-teal-600" />
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50/50 border border-emerald-100 p-5">
              <h3 className="text-sm font-semibold text-emerald-900 mb-2">Know who opens and clicks</h3>
              <p className="text-sm text-emerald-700 leading-relaxed">Outly automatically tracks email opens (via a transparent pixel) and link clicks (via URL rewriting). View real-time metrics on the campaign detail page's Tracking tab.</p>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3 items-start p-4 rounded-xl border border-gray-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Open tracking</p>
                  <p className="text-xs text-gray-500 mt-0.5">A tiny invisible pixel is added to each email. When the recipient's email client loads it, an open is recorded.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start p-4 rounded-xl border border-gray-100">
                <CheckCircle2 className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Click tracking</p>
                  <p className="text-xs text-gray-500 mt-0.5">Links in your email are rewritten to route through Outly's server. When clicked, the click is recorded and the recipient is redirected to the original URL.</p>
                </div>
              </div>
              <div className="flex gap-3 items-start p-4 rounded-xl border border-gray-100">
                <CheckCircle2 className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Optional per campaign</p>
                  <p className="text-xs text-gray-500 mt-0.5">Toggle "Track opens" and "Track clicks" in the compose form's sending settings. Both are enabled by default.</p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Attachments */}
        <Section id="attachments">
          <SectionHeader icon={Paperclip} title="Attachments" color="from-pink-500 to-rose-600" />
          <div className="space-y-3">
            <p className="text-sm text-gray-500 leading-relaxed">
              Attach files to your campaigns — resumes, portfolios, or any supporting documents.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Per file", value: "10 MB max" },
                { label: "Per campaign", value: "25 MB total" },
                { label: "Max files", value: "10 per upload" },
                { label: "Formats", value: "PDF, DOC, XLS, CSV, images" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
                  <p className="text-xs text-gray-400">{item.label}</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Templates */}
        <Section id="templates">
          <SectionHeader icon={FileText} title="Email Templates" color="from-indigo-500 to-blue-600" />
          <div className="space-y-3">
            <p className="text-sm text-gray-500 leading-relaxed">
              Save frequently used subject/body combinations as templates. Access them from the Templates page or select one directly in the compose form.
            </p>
            <div className="flex gap-3 items-start p-4 rounded-xl border border-gray-100">
              <FileText className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">Templates + Variables = Power</p>
                <p className="text-xs text-gray-500 mt-0.5">Templates can contain <code className="bg-gray-100 px-1 rounded text-[10px]">{"{{variable}}"}</code> placeholders. Select a template, import a CSV, and every recipient gets a personalized email.</p>
              </div>
            </div>
          </div>
        </Section>

        {/* Best Practices */}
        <Section id="best-practices">
          <SectionHeader icon={Target} title="Best Practices" color="from-purple-500 to-violet-600" />
          <div className="space-y-3">
            <Accordion title="Write emails that get opened" icon={Mail}>
              <div className="space-y-3 mt-2">
                <p>Keep subject lines clear and honest. Avoid spam triggers like "FREE", "URGENT", or all caps.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg bg-green-50 border border-green-100 p-3">
                    <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Good subjects</p>
                    <ul className="text-xs text-green-600 space-y-1">
                      <li>Quick question about the SWE role</li>
                      <li>Following up on our conversation</li>
                      <li>Software Engineer — Excited to Connect</li>
                    </ul>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                    <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Avoid these</p>
                    <ul className="text-xs text-red-600 space-y-1">
                      <li>FREE OPPORTUNITY!!!</li>
                      <li>URGENT: ACT NOW</li>
                      <li>You won't believe this</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Accordion>
            <Accordion title="Keep your email list clean" icon={Users}>
              <div className="space-y-2 mt-2">
                <p>A clean list means fewer bounces and better deliverability:</p>
                <ul className="space-y-1.5 mt-2">
                  {["Remove duplicate and invalid emails", "Remove addresses that bounced previously", "Only include relevant contacts", "Check for typos (gmial.com, yaho.com)"].map((item, i) => (
                    <li key={i} className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" /><span>{item}</span></li>
                  ))}
                </ul>
              </div>
            </Accordion>
            <Accordion title="Time your campaigns right" icon={Clock}>
              <div className="space-y-2 mt-2">
                <p>Emails sent during business hours get better engagement:</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {["Tuesday–Thursday", "10–11 AM", "2–3 PM", "Avoid weekends"].map((t) => (
                    <span key={t} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">{t}</span>
                  ))}
                </div>
              </div>
            </Accordion>
            <Accordion title="Protect your account" icon={Lock}>
              <div className="space-y-2 mt-2">
                <ul className="space-y-1.5">
                  {["Enable 2-Factor Authentication on Google", "Use a unique App Password for Outly only", "Revoke the App Password if you suspect compromise", "Never share your App Password"].map((item, i) => (
                    <li key={i} className="flex items-start gap-2"><Shield className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" /><span>{item}</span></li>
                  ))}
                </ul>
              </div>
            </Accordion>
          </div>
        </Section>

        {/* Troubleshooting */}
        <Section id="troubleshooting">
          <SectionHeader icon={AlertTriangle} title="Troubleshooting" color="from-orange-500 to-amber-600" />
          <div className="space-y-3">
            <Accordion title="Campaign shows 'Paused · All senders at limit'" icon={Gauge}>
              <div className="space-y-2 mt-2">
                <p>All senders in the campaign have reached their daily limit. The campaign will auto-resume when any sender regains capacity (checked hourly). You can also:</p>
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>Add more senders to the campaign</li>
                  <li>Wait for the daily limit to reset (midnight UTC)</li>
                  <li>Manually resume — emails will be rescheduled</li>
                </ul>
              </div>
            </Accordion>
            <Accordion title="Sender entered cooldown" icon={Shield}>
              <div className="space-y-2 mt-2">
                <p>3 consecutive SMTP errors trigger a 5-minute cooldown. Common causes:</p>
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>App Password was revoked or changed</li>
                  <li>Google temporarily blocked the account</li>
                  <li>Network connectivity issues</li>
                </ul>
                <p>Cooldown expires automatically. Check the Throttle Status panel on the campaign detail page for live status.</p>
              </div>
            </Accordion>
            <Accordion title="Emails going to spam" icon={AlertTriangle}>
              <div className="space-y-2 mt-2">
                <ul className="space-y-1.5">
                  {["Remove spam trigger words", "Add more text content", "Reduce sending volume", "Clean your list", "Use the warmup period for new accounts"].map((item, i) => (
                    <li key={i} className="flex items-start gap-2"><ArrowRight className="h-3 w-3 text-orange-500 mt-1 shrink-0" /><span>{item}</span></li>
                  ))}
                </ul>
              </div>
            </Accordion>
            <Accordion title="High bounce rate" icon={BarChart3}>
              <div className="space-y-2 mt-2">
                <p>Bounce rate above 5% triggers adaptive throttling (halves send speed). To fix:</p>
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>Remove invalid emails from your list</li>
                  <li>Check for common typos</li>
                  <li>Use an email verification service before importing</li>
                </ul>
              </div>
            </Accordion>
          </div>
        </Section>

        {/* CTA */}
        <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-6 sm:p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-gradient-to-b from-primary/15 to-transparent rounded-full blur-3xl" />
          <div className="relative">
            <h3 className="text-lg sm:text-2xl font-bold text-white mb-3">Ready to start your outreach?</h3>
            <p className="text-xs sm:text-sm text-gray-400 mb-6 max-w-md mx-auto">Follow this guide, stay within safe limits, and you'll be landing interviews in no time.</p>
            <div className="flex flex-col items-center gap-3 max-w-xs mx-auto">
              <Button className="!w-full px-8 py-3 rounded-full text-sm shadow-lg shadow-primary/30" onClick={() => router.push("/login")}>
                Get Started <ArrowRight className="ml-2 h-4 w-4 inline" />
              </Button>
              <button onClick={() => router.push("/faq")} className="w-full px-6 py-3 rounded-full text-sm font-medium text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5" /> Read FAQ
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
