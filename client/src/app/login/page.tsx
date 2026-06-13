"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { loginWithGoogle } from "../../lib/apis";
import { useRouter } from "next/navigation";
import { Shield, Zap, Send, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useToast } from "@/context/ToastContext";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
        };
      };
    };
  }
}

const LoginPage = () => {
  const router = useRouter();
  const { addToast } = useToast();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) router.replace("/dashboard");
  }, [router]);

  // Exchange Google credential for app session token
  const handleCredential = useCallback(
    async (credential: string) => {
      setIsLoggingIn(true);
      try {
        const data = await loginWithGoogle(credential);
        localStorage.setItem("accessToken", data.accessToken);
        addToast("success", "Welcome back!");
        router.push("/dashboard");
      } catch (err) {
        console.error("Google login failed", err);
        const axiosErr = err as { response?: { data?: { message?: string; detail?: string } } };
        const serverMessage = axiosErr.response?.data?.detail ?? axiosErr.response?.data?.message;
        addToast("error", serverMessage ?? "Login failed. Please try again.");
      } finally {
        setIsLoggingIn(false);
      }
    },
    [addToast, router],
  );

  // Initialize GIS and render the official Google button (avoids FedCM One Tap errors)
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error("NEXT_PUBLIC_GOOGLE_CLIENT_ID not configured");
      return;
    }

    let attempts = 0;
    const maxAttempts = 50;

    const setupGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) {
        attempts += 1;
        if (attempts < maxAttempts) {
          window.setTimeout(setupGoogleButton, 100);
        }
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential?: string }) => {
          if (response.credential) {
            void handleCredential(response.credential);
          }
        },
        // Disable FedCM — prevents "FedCM get() NetworkError" on localhost
        use_fedcm_for_prompt: false,
        use_fedcm_for_button: false,
        auto_select: false,
        cancel_on_tap_outside: false,
      });

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 384,
        logo_alignment: "left",
      });

      setGoogleReady(true);
    };

    setupGoogleButton();
  }, [handleCredential]);

  return (
    <div className="flex min-h-screen bg-[#f8f9fb]">
      {/* Left panel — branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex-col justify-between p-12">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-primary/15 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-20 right-20 w-24 h-24 border border-white/5 rounded-2xl rotate-12" />
        <div className="absolute bottom-32 left-16 w-16 h-16 border border-white/5 rounded-full" />

        <div className="relative">
          <Logo size="md" variant="light" />
        </div>

        <div className="relative">
          <h2 className="text-4xl font-bold text-white leading-tight tracking-tight mb-4">
            Land your dream job<br />
            <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">with cold outreach</span>
          </h2>
          <p className="text-base text-gray-400 max-w-sm leading-relaxed">
            Send personalized emails to recruiters at scale with smart scheduling and rate limiting.
          </p>

          <div className="flex flex-wrap gap-3 mt-8">
            {[
              { icon: Shield, text: "Encrypted credentials" },
              { icon: Zap, text: "2 min setup" },
              { icon: Send, text: "Bulk sending" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3.5 py-1.5">
                <Icon className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-gray-300">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="rounded-xl bg-white/5 border border-white/10 p-5">
            <p className="text-sm text-gray-300 leading-relaxed italic">
              &ldquo;Outly helped me land 3 interviews in my first week. The scheduling feature is a game changer.&rdquo;
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center">
                <span className="text-xs font-bold text-white">A</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Alex Chen</p>
                <p className="text-[10px] text-gray-500">CS Student, Stanford</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center px-4 md:px-8 relative">
        <button
          onClick={() => router.push("/")}
          className="absolute top-4 left-4 md:top-6 md:left-6 h-10 w-10 rounded-xl flex items-center justify-center
            text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center justify-center mb-10">
            <Logo size="lg" />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back</h1>
            <p className="text-sm text-gray-400 mt-1.5">Sign in to continue your outreach</p>
          </div>

          {/* Official Google sign-in button (popup flow, no FedCM One Tap) */}
          <div className="flex justify-center min-h-[44px]">
            <div
              ref={googleButtonRef}
              className={isLoggingIn ? "opacity-50 pointer-events-none" : ""}
            />
          </div>

          {!googleReady && !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
            <p className="mt-3 text-center text-xs text-red-500">
              Google Client ID is not configured in client/.env
            </p>
          )}

          {!googleReady && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
            <button
              disabled
              className="w-full h-12 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-400 flex items-center justify-center gap-2.5"
            >
              <Image
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                alt="Google"
                width={18}
                height={18}
              />
              Loading Google sign-in...
            </button>
          )}

          <div className="my-7 flex items-center gap-4">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-[11px] font-medium text-gray-300 uppercase tracking-wider">secure</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <p className="text-center text-xs text-gray-400 leading-relaxed">
            We use Google OAuth for secure authentication.<br />
            No passwords stored on our servers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
