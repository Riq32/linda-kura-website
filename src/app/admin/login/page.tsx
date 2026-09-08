"use client";

import { Suspense, useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const callbackUrl = searchParams.get("callbackUrl") || "/admin";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Please enter your Agent Access Code");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await signIn("agent-code", {
          code: code.trim(),
          redirect: false,
          callbackUrl
        });

        if (res?.error) {
          setError(res.error || "Authentication failed. Invalid agent code.");
        } else if (res?.ok) {
          router.push(callbackUrl);
          router.refresh();
        }
      } catch (err) {
        setError("Network error occurred during login. Please try again.");
      }
    });
  };

  const setPresetCode = (preset: string) => {
    setCode(preset);
    setError(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-black/60 p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
    >
      {/* Header Branding */}
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner shadow-white/10">
          <span className="h-7 w-7 rotate-[-7deg] rounded-[10px_14px_11px_15px] bg-green-500 shadow-[inset_0_1px_rgba(255,255,255,.3)]" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#f2a900]">
          Official Agent Portal
        </span>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
          LINDA<span className="text-[#f2a900]">—</span>KURA
        </h1>
        <p className="mt-2 text-xs text-white/50">
          Enter your assigned electoral polling station access code to authenticate telemetry and verify counts.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="agent-code" className="text-xs font-bold uppercase tracking-wider text-white/70">
            Agent Access Code
          </label>
          <div className="relative">
            <input
              id="agent-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. LK-36QW or LK-7KQ2"
              maxLength={12}
              disabled={isPending}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 font-mono text-base font-bold tracking-wider text-white placeholder-white/20 shadow-inner outline-none transition duration-150 focus:border-[#f2a900] focus:bg-white/[0.07] focus:ring-2 focus:ring-[#f2a900]/20 disabled:opacity-50"
              autoFocus
              autoComplete="off"
              spellCheck="false"
            />
            {code && (
              <button
                type="button"
                onClick={() => setCode("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-xs text-white/40 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-medium text-red-400"
          >
            <span className="shrink-0 text-sm">⚠️</span>
            <span>{error}</span>
          </motion.div>
        )}

        <button
          type="submit"
          disabled={isPending || !code.trim()}
          className="group relative mt-2 flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-green-500 via-emerald-500 to-[#f2a900] px-6 py-3.5 font-bold text-black shadow-[0_4px_20px_rgba(34,197,94,0.3)] transition duration-200 hover:opacity-95 hover:shadow-[0_6px_25px_rgba(242,169,0,0.4)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? (
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
              <span>Verifying Credentials...</span>
            </div>
          ) : (
            <span>Access Station Dashboard →</span>
          )}
        </button>
      </form>

      {/* Demo Preset Quick Selectors */}
      <div className="mt-8 border-t border-white/10 pt-5">
        <span className="block text-center text-[10px] font-bold uppercase tracking-widest text-white/40">
          Quick Test Codes
        </span>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setPresetCode("LK-36QW")}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs font-semibold text-white/80 transition hover:border-[#f2a900]/50 hover:bg-white/10"
          >
            LK-36QW <span className="text-[10px] text-white/40">(Mombasa)</span>
          </button>
          <button
            type="button"
            onClick={() => setPresetCode("LK-7KQ2")}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs font-semibold text-white/80 transition hover:border-green-500/50 hover:bg-white/10"
          >
            LK-7KQ2 <span className="text-[10px] text-white/40">(Nairobi)</span>
          </button>
        </div>
      </div>

      {/* Back Link */}
      <div className="mt-6 text-center">
        <a
          href="/"
          className="text-xs font-medium text-white/40 transition hover:text-white hover:underline"
        >
          ← Return to Public Live Feed
        </a>
      </div>
    </motion.div>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#0d0e10] p-4 text-white">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#f2a900]/20 via-[#22c55e]/15 to-transparent blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-[#22c55e]/10 to-transparent blur-[100px]" />

      <Suspense
        fallback={
          <div className="flex h-64 w-full max-w-md items-center justify-center rounded-3xl border border-white/10 bg-black/60 p-8 backdrop-blur-2xl">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#f2a900] border-t-transparent" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
