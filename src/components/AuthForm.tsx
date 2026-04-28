"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

type AuthMode = "login" | "signup";

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const isSignup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const lastAttemptRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    const candidates = [
      "/Traffic-Radius-Logo.webp",
      "/traffic-radius-logo.webp",
      "/Traffic-Radius-Logo.png",
      "/traffic-radius-logo.png",
      "/logo.webp",
      "/logo.png",
    ];

    (async () => {
      for (const src of candidates) {
        try {
          const res = await fetch(src, { method: "HEAD" });
          if (res.ok) {
            if (mounted) setLogoSrc(src);
            return;
          }
        } catch {
          // Ignore and try next candidate.
        }
      }
      if (mounted) setLogoSrc(null);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const now = Date.now();
    if (now - lastAttemptRef.current < 1200) return;
    lastAttemptRef.current = now;
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    setError(null);
    setLoading(true);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Email and password are required.");
      setLoading(false);
      submittingRef.current = false;
      return;
    }
    if (isSignup && password !== confirmPassword) {
      setError("Password and confirm password do not match.");
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    try {
      const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSignup
            ? { email: trimmedEmail, password, confirmPassword }
            : { email: trimmedEmail, password }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `${isSignup ? "Sign up" : "Login"} failed. Please try again.`);
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <section className="min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-4rem)] bg-mesh-hero bg-grid-faint px-4 py-10 flex items-center justify-center">
      <div className="card-elevated w-full max-w-md p-7 sm:p-8">
        <div className="text-center mb-6">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt="Traffic Radius"
              className="h-14 w-auto mx-auto mb-4 object-contain"
              onError={() => setLogoSrc(null)}
            />
          ) : null}
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {isSignup ? "Sign up" : "Login"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {isSignup
              ? "Create your account using email and password."
              : "Login with your email and password."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm placeholder:text-slate-400 transition-all duration-200 hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
            >
              {isSignup ? "Create password" : "Password"}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete={isSignup ? "new-password" : "current-password"}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-20 text-slate-900 shadow-sm placeholder:text-slate-400 transition-all duration-200 hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                placeholder={isSignup ? "At least 8 characters" : "Enter password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {isSignup ? (
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-20 text-slate-900 shadow-sm placeholder:text-slate-400 transition-all duration-200 hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                  placeholder="Re-enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((p) => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary-live w-full py-3.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {loading ? (isSignup ? "Creating account..." : "Logging in...") : isSignup ? "Create account" : "Login"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-600">
          {isSignup ? (
            <>
              Already signed up?{" "}
              <Link href="/login" className="font-semibold text-tr-green-700 hover:underline">
                Go to login
              </Link>
            </>
          ) : (
            <>
              Haven&apos;t already signed up?{" "}
              <Link href="/signup" className="font-semibold text-tr-green-700 hover:underline">
                Go to sign up
              </Link>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
