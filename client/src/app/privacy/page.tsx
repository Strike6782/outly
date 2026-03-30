"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Shield, Lock, Eye, Server, Trash2 } from "lucide-react";

export default function PrivacyPage() {
  const router = useRouter();

  const sections = [
    {
      icon: Shield,
      title: "What We Collect",
      content: "We collect your Google profile information (name, email, avatar) when you sign in via Google OAuth. We also store the email addresses you add as senders and the recipient lists you upload for campaigns.",
    },
    {
      icon: Lock,
      title: "How We Protect Your Data",
      content: "All SMTP credentials (Google App Passwords) are encrypted at rest using AES-256-CBC with a unique initialization vector per encryption. We never store your Google account password — only the App Password you generate specifically for Outly.",
    },
    {
      icon: Eye,
      title: "What We Don't Do",
      content: "We don't sell your data. We don't read your email content. We don't share your recipient lists with third parties. We don't track you across the web. Your outreach data stays yours.",
    },
    {
      icon: Server,
      title: "Data Storage",
      content: "Your data is stored in a PostgreSQL database. Email attachments are stored on Cloudinary. Job queue data is stored in Redis. All connections use encrypted transport where available.",
    },
    {
      icon: Trash2,
      title: "Data Deletion",
      content: "You can delete your sender accounts at any time. When a campaign is deleted, all associated email job records and attachment metadata are automatically removed (cascade delete).",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b border-gray-100">
        <div className="mx-auto max-w-3xl flex items-center gap-4 px-4 sm:px-6 py-4">
          <button
            onClick={() => router.back()}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-sm font-semibold text-gray-900">Privacy Policy</h1>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-16">
        <div className="mb-10">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Privacy</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Your data, your control
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-500 leading-relaxed max-w-xl">
            Outly is designed with privacy in mind. Here's exactly what we collect, how we protect it, and what we don't do.
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
            Questions about privacy?{" "}
            <a href="/contact" className="text-primary hover:underline">Get in touch</a>
          </p>
        </div>
      </main>
    </div>
  );
}
