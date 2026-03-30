"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Github, Send, CheckCircle2 } from "lucide-react";

export default function ContactPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder — no backend endpoint for contact form yet
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
    setName("");
    setEmail("");
    setMessage("");
  };

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
          <h1 className="text-sm font-semibold text-gray-900">Contact</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-16">
        <div className="mb-10">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Contact</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Get in touch
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-500 leading-relaxed max-w-xl">
            Have a question, found a bug, or want to suggest a feature? Reach out through any of these channels.
          </p>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          <a
            href="https://github.com/aniket1251"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all group"
          >
            <div className="h-10 w-10 rounded-xl bg-gray-900 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Github className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">GitHub</p>
              <p className="text-xs text-gray-400">Open an issue or contribute</p>
            </div>
          </a>

          <a
            href="mailto:aniket@outly.dev"
            className="flex items-center gap-4 rounded-xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all group"
          >
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Email</p>
              <p className="text-xs text-gray-400">For direct inquiries</p>
            </div>
          </a>
        </div>

        {/* Contact form */}
        <div className="rounded-xl border border-gray-100 p-5 sm:p-8">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Send a message</h3>
          <p className="text-xs text-gray-400 mb-6">We'll get back to you as soon as possible.</p>

          {submitted && (
            <div className="mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Message sent! We'll be in touch.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full h-11 rounded-lg border border-gray-200 bg-gray-50 px-3.5 text-sm text-gray-900 outline-none placeholder:text-gray-300 transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-11 rounded-lg border border-gray-200 bg-gray-50 px-3.5 text-sm text-gray-900 outline-none placeholder:text-gray-300 transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Message</label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-300 transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/10 resize-none"
              />
            </div>
            <button
              type="submit"
              className="h-11 px-6 rounded-lg bg-gray-900 text-white text-sm font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-sm"
            >
              <Send className="h-3.5 w-3.5" />
              Send Message
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
