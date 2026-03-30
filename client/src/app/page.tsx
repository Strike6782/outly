"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import Button from "@/components/Button";
import {
  Mail, Zap, Shield, Clock, BarChart3, Users,
  ArrowRight, Menu, X, Send, Target, Gauge,
  Sparkles, Rocket, Eye, MousePointerClick,
  RefreshCw, Paperclip, FileText, Flame,
} from "lucide-react";
import { Logo } from "@/components/Logo";

function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref, { threshold: 0.1 });
  return (
    <div
      ref={ref}
      className={`fade-in-up ${isVisible ? "visible" : ""} ${className}`}
      style={{ transitionDelay: isVisible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isVisible = useIntersectionObserver(ref as React.RefObject<Element>, { threshold: 0.5 });
  useEffect(() => {
    if (!isVisible) return;
    let current = 0;
    const step = Math.ceil(target / 40);
    const timer = setInterval(() => {
      current += step;
      if (current >= target) { setCount(target); clearInterval(timer); }
      else setCount(current);
    }, 30);
    return () => clearInterval(timer);
  }, [isVisible, target]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const features = [
  { icon: Users, title: "Multi-Sender Rotation", desc: "Rotate across multiple Gmail accounts automatically. Distribute volume, avoid rate limits, and send up to 1,500+ emails/day.", color: "from-blue-500 to-cyan-600" },
  { icon: Gauge, title: "Smart Scheduling", desc: "Human-like random delays between emails — not robotic fixed intervals. Set your hourly limit and Outly handles the natural pacing.", color: "from-amber-500 to-orange-600" },
  { icon: Flame, title: "14-Day Warmup", desc: "New senders automatically ramp from 20 to 500 emails/day over 14 days, building reputation safely. Skip it for established accounts.", color: "from-rose-500 to-pink-600" },
  { icon: Eye, title: "Open & Click Tracking", desc: "Know exactly who opens your emails and clicks your links. Real-time metrics with per-recipient and per-link breakdowns.", color: "from-emerald-500 to-teal-600" },
  { icon: RefreshCw, title: "Follow-Up Sequences", desc: "Up to 5 automated follow-ups with configurable wait periods. Sequences stop automatically when a recipient replies.", color: "from-violet-500 to-purple-600" },
  { icon: Shield, title: "Encrypted & Secure", desc: "AES-256 encryption for credentials, JWT auth with token rotation, and per-user data isolation. Your accounts stay safe.", color: "from-gray-700 to-gray-900" },
];

const capabilities = [
  { icon: Zap, label: "Template Variables", desc: "{{name}}, {{company}} from CSV" },
  { icon: Paperclip, label: "File Attachments", desc: "PDF, DOC, images — 25 MB total" },
  { icon: FileText, label: "Reusable Templates", desc: "Save and reuse across campaigns" },
  { icon: Target, label: "Adaptive Throttle", desc: "Auto-slows on high error rates" },
  { icon: BarChart3, label: "Search & Filters", desc: "Find any email or campaign fast" },
  { icon: Clock, label: "Auto-Resume", desc: "Paused campaigns resume automatically" },
];

const steps = [
  { num: "01", title: "Connect Your Gmail", desc: "Add your email and a Google App Password. Outly verifies SMTP connectivity and starts a 14-day warmup.", icon: Mail },
  { num: "02", title: "Create Your Campaign", desc: "Write your email, import recipients via CSV with template variables, add follow-up sequences, and set your pace.", icon: Send },
  { num: "03", title: "Track & Iterate", desc: "Monitor open rates, click rates, and replies in real-time. Pause, resume, or adjust campaigns on the fly.", icon: Eye },
];

export default function LandingPage() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* ─── Navbar ─── */}
      <nav className={`sticky top-0 z-30 transition-all duration-300 bg-white/95 backdrop-blur-xl ${scrolled ? "shadow-sm border-b border-gray-100" : "border-b border-transparent"}`}>
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3.5">
          <a href="/" aria-label="Go to homepage"><Logo size="md" /></a>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-500">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How It Works</a>
            <a href="/guide" className="hover:text-gray-900 transition-colors">Guide</a>
            <a href="/faq" className="hover:text-gray-900 transition-colors">FAQ</a>
          </div>
          <div className="hidden md:block">
            <Button className="w-auto px-5 py-2 rounded-full text-sm" onClick={() => router.push("/login")}>
              Get Started
            </Button>
          </div>
          <button
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 px-6 py-4 space-y-2 bg-white/95 backdrop-blur-xl">
            <a href="#features" className="block text-sm text-gray-600 py-3" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="block text-sm text-gray-600 py-3" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <a href="/guide" className="block text-sm text-gray-600 py-3" onClick={() => setMobileMenuOpen(false)}>Guide</a>
            <a href="/faq" className="block text-sm text-gray-600 py-3" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            <Button className="w-full rounded-full mt-2" onClick={() => router.push("/login")}>Get Started</Button>
          </div>
        )}
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-12 md:pb-24 lg:pt-16 lg:pb-32">
        <div className="absolute inset-0 bg-gradient-to-br from-green-50/80 via-white to-emerald-50/60" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-primary/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-emerald-100/40 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:flex lg:items-center lg:gap-16">
          <div className="lg:flex-1 text-center lg:text-left" style={{ animation: "fadeInUp 0.8s ease-out" }}>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-5">
              <Sparkles className="h-3.5 w-3.5" />
              Cold outreach that feels human
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] font-bold text-gray-900 leading-[1.15] tracking-tight">
              Land Interviews With<br />
              <span className="bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">Smart Cold Outreach</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-gray-500 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Multi-sender rotation, human-like scheduling, follow-up sequences, and open/click tracking — all with a 14-day warmup that protects your accounts.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button className="w-full sm:w-auto px-8 py-3.5 text-sm rounded-full shadow-lg shadow-primary/25" onClick={() => router.push("/login")}>
                Start Free <ArrowRight className="ml-2 h-4 w-4 inline" />
              </Button>
              <Button variant="ghost" className="w-full sm:w-auto px-8 py-3.5 text-sm text-gray-600" onClick={() => router.push("/guide")}>
                Read the Guide
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4 justify-center lg:justify-start text-sm text-gray-400">
              <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> AES-256 encrypted</span>
              <span className="h-1 w-1 rounded-full bg-gray-300 hidden sm:block" />
              <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Free forever</span>
              <span className="h-1 w-1 rounded-full bg-gray-300 hidden sm:block" />
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 2 min setup</span>
            </div>
          </div>

          {/* Hero visual — desktop */}
          <div className="hidden lg:block lg:flex-1" style={{ animation: "fadeInUp 1s ease-out 0.2s both" }}>
            <div className="relative">
              <div className="w-full max-w-md mx-auto rounded-2xl bg-white border border-gray-200/60 shadow-2xl shadow-gray-200/50 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                  <div className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
                  <div className="h-3 w-3 rounded-full bg-[#28C840]" />
                  <span className="ml-auto text-[10px] text-gray-300 font-mono">campaign · 3 senders</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="font-medium text-gray-500 w-12">From:</span>
                    <div className="flex gap-1">
                      <span className="rounded-full bg-blue-50 text-blue-600 px-2 py-0.5 font-medium">alex@gmail.com</span>
                      <span className="rounded-full bg-violet-50 text-violet-600 px-2 py-0.5 font-medium">+2 more</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="font-medium text-gray-500 w-12">To:</span>
                    <span className="text-gray-700">150 recipients from CSV</span>
                  </div>
                  <div className="h-px bg-gray-100" />
                  <div className="text-[13px] text-gray-500 leading-relaxed space-y-2 py-1">
                    <p>Hi <span className="bg-cyan-100 text-cyan-700 px-1 rounded font-mono text-[11px]">{"{{name}}"}</span>,</p>
                    <p>I saw <span className="bg-cyan-100 text-cyan-700 px-1 rounded font-mono text-[11px]">{"{{company}}"}</span> is hiring and my experience with React could be a great fit...</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-600">
                      <Eye className="h-3 w-3" /> 42% opened
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-600">
                      <MousePointerClick className="h-3 w-3" /> 12% clicked
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -top-3 -right-3 rounded-xl bg-white border border-gray-100 shadow-lg px-3 py-2 text-xs font-medium text-gray-700 flex items-center gap-2" style={{ animation: "float 4s ease-in-out infinite" }}>
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                Warmup: Day 7 · 200/day
              </div>
              <div className="absolute -bottom-2 -left-3 rounded-xl bg-white border border-gray-100 shadow-lg px-3 py-2 text-xs font-medium text-gray-700 flex items-center gap-2" style={{ animation: "float 4s ease-in-out infinite 2s" }}>
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Sending · 38/40 this hour
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-16 sm:py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-12 md:mb-20">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Features</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
              Everything you need to<br className="hidden sm:block" /> land more interviews
            </h2>
            <p className="mt-4 text-sm sm:text-base text-gray-500 max-w-2xl mx-auto">
              Not just another bulk emailer. Outly is built specifically for job seekers who need smart, safe, and trackable cold outreach.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {features.map((f, i) => (
              <AnimatedSection key={i} delay={i * 80} className="h-full">
                <div className="group h-full rounded-2xl border border-gray-100 bg-white p-5 md:p-6 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300 flex flex-col">
                  <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${f.color} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    <f.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1.5 group-hover:text-primary transition-colors">{f.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed flex-1">{f.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── More Capabilities ─── */}
      <section className="py-12 sm:py-16 bg-gray-50/80 border-y border-gray-100">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-[0.15em] mb-8">And also</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {capabilities.map((c, i) => (
              <AnimatedSection key={i} delay={i * 60} className="h-full">
                <div className="rounded-xl bg-white border border-gray-100 p-3 text-center hover:border-gray-200 hover:shadow-sm transition-all h-full flex flex-col items-center justify-center">
                  <c.icon className="h-4 w-4 text-primary mx-auto mb-2" />
                  <p className="text-[11px] font-semibold text-gray-900">{c.label}</p>
                  <p className="text-[10px] text-gray-400 mt-1 leading-tight">{c.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-16 sm:py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center mb-12 md:mb-20">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">How It Works</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">Three steps to your next interview</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 relative">
            <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            {steps.map((s, i) => (
              <AnimatedSection key={i} delay={i * 120} className="text-center relative">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white border-2 border-primary/20 shadow-sm relative z-10">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <span className="inline-block text-[10px] font-bold text-white bg-primary rounded-full px-2.5 py-0.5 uppercase tracking-widest mb-3">Step {s.num}</span>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">{s.desc}</p>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="py-16 sm:py-24 bg-gray-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0">
            {[
              { value: 50000, suffix: "+", label: "Emails Sent" },
              { value: 42, suffix: "%", label: "Avg Open Rate" },
              { value: 99, suffix: "%", label: "Delivery Rate" },
              { value: 0, suffix: "$", label: "Monthly Cost", prefix: "" },
            ].map((s, i) => (
              <div key={i} className={`text-center ${i > 0 ? "md:border-l md:border-white/10" : ""} py-2`}>
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                  {s.value === 0 ? "$0" : <AnimatedCounter target={s.value} suffix={s.suffix} />}
                </div>
                <p className="mt-2 text-xs sm:text-sm text-gray-400 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-16 sm:py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative rounded-2xl sm:rounded-3xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 px-6 py-12 sm:px-10 sm:py-16 md:px-16 md:py-20 text-center overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-primary/20 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-green-300 mb-6 border border-white/10">
                <Rocket className="h-3.5 w-3.5" />
                Free forever · No credit card
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight leading-tight">
                Ready to start landing<br />
                <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">your dream interviews?</span>
              </h2>
              <p className="text-sm sm:text-base text-gray-400 mb-8 max-w-lg mx-auto leading-relaxed">
                Stop waiting for callbacks. Smart scheduling, multi-sender rotation, and real-time tracking — all in one tool built for job seekers.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button className="w-full sm:w-auto px-8 py-3.5 text-sm rounded-full shadow-lg shadow-primary/30" onClick={() => router.push("/login")}>
                  Start Your Outreach <ArrowRight className="ml-2 h-4 w-4 inline" />
                </Button>
                <button
                  className="w-full sm:w-auto px-8 py-3.5 text-sm rounded-full font-medium text-gray-400 hover:text-white border border-white/10 hover:bg-white/5 transition-all"
                  onClick={() => router.push("/guide")}
                >
                  Read the Guide
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-8 border-t border-gray-100 bg-gray-50/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col items-center gap-5 md:flex-row md:justify-between">
          <a href="/" aria-label="Go to homepage"><Logo size="sm" /></a>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <a href="/guide" className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">Guide</a>
            <a href="/faq" className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">FAQ</a>
            <a href="/privacy" className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">Privacy</a>
            <a href="/terms" className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">Terms</a>
            <a href="/contact" className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">Contact</a>
          </nav>
          <span className="text-xs text-gray-500">© 2026 Outly</span>
        </div>
      </footer>
    </div>
  );
}
