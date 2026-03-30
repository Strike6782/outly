"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, AlertTriangle, Scale, Ban, RefreshCw } from "lucide-react";

export default function TermsPage() {
  const router = useRouter();

  const sections = [
    {
      icon: FileText,
      title: "Acceptance of Terms",
      content: "By using Outly, you agree to these terms. Outly is a tool for professional cold outreach — specifically designed for job seekers reaching out to recruiters and hiring managers. You are responsible for how you use it.",
    },
    {
      icon: Scale,
      title: "Acceptable Use",
      content: "You may use Outly to send professional outreach emails related to job seeking, networking, and career development. You must comply with all applicable email laws including CAN-SPAM, GDPR, and your local regulations.",
    },
    {
      icon: Ban,
      title: "Prohibited Use",
      content: "You may not use Outly for spam, phishing, harassment, or any illegal activity. You may not send emails to purchased lists, scraped addresses without consent, or recipients who have opted out. Abuse will result in account termination.",
    },
    {
      icon: AlertTriangle,
      title: "Disclaimer",
      content: "Outly is provided as-is. We don't guarantee email deliverability, inbox placement, or response rates. Gmail's sending limits and policies are controlled by Google — we help you stay within them but can't override them.",
    },
    {
      icon: RefreshCw,
      title: "Changes to Terms",
      content: "We may update these terms from time to time. Continued use of Outly after changes constitutes acceptance. We'll note the last updated date at the top of this page.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b border-gray-100">
        <div className="mx-auto max-w-3xl flex items-center gap-4 px-4 sm:px-6 py-4">
          <button
            onClick={() => router.back()}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-sm font-semibold text-gray-900">Terms of Service</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-16">
        <div className="mb-10">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Terms</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Terms of Service
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-500 leading-relaxed max-w-xl">
            Simple, fair terms for using Outly. No legalese, just clarity.
          </p>
          <p className="mt-2 text-xs text-gray-300">Last updated: March 2026</p>
        </div>

        <div className="space-y-6">
          {sections.map((section, i) => (
            <div key={i} className="rounded-xl border border-gray-100 p-5 sm:p-6 hover:border-gray-200 transition-colors">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <section.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{section.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{section.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Questions about these terms?{" "}
            <a href="/contact" className="text-primary hover:underline">Get in touch</a>
          </p>
        </div>
      </main>
    </div>
  );
}
