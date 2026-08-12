import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { SiteHeader } from "../../../components/SiteHeader";
import { login, signup, startGoogleLogin } from "../api";
import type { SessionUser } from "../types";
import {
  authRedirectKey,
  isExtensionAuthFlow,
  sendSessionToExtension,
} from "../extensionBridge";

export function AuthPage({
  mode,
  onAuthenticated,
}: {
  mode: "login" | "signup";
  onAuthenticated: (user: SessionUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const isSignup = mode === "signup";

  useEffect(() => {
    const errorCode = new URLSearchParams(window.location.search).get("error");

    if (errorCode === "google_oauth_failed") {
      setError("Google sign-in failed. Please try again.");
    }

    if (errorCode === "google_email_not_verified") {
      setError("Your Google email address is not verified.");
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = isSignup
        ? await signup(email, password)
        : await login(email, password);
      onAuthenticated(response.user);
      if (isExtensionAuthFlow()) {
        await sendSessionToExtension(response.token);
      }
      const redirectPath = window.sessionStorage.getItem(authRedirectKey);
      window.sessionStorage.removeItem(authRedirectKey);
      window.history.replaceState({}, "", redirectPath ?? "/");
      window.dispatchEvent(new Event("popstate"));
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Authentication failed",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    setError("");
    setGoogleSubmitting(true);
    startGoogleLogin();
  };

  return (
    <section className="flex min-h-[calc(100vh-4rem)] items-center bg-slate-50 px-6 py-16 sm:px-8 lg:px-10">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.9fr_1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
            Account-backed reports
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
            {isSignup ? "Create your report account." : "Welcome back."}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            Sign in to prepare the web dashboard for synced warning history. The
            extension still detects risky AI chat activity locally, and synced
            report records must stay redacted.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div>
            <label
              htmlFor="email"
              className="text-sm font-semibold text-slate-950"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor="password"
              className="text-sm font-semibold text-slate-950"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            />
          </div>

          {error ? (
            <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="button-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Please wait" : isSignup ? "Create account" : "Login"}
          </button>

          <button
            type="button"
            disabled={googleSubmitting}
            onClick={handleGoogleLogin}
            className="button-secondary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {googleSubmitting ? "Please wait" : "Sign in with Google"}
          </button>

          <p className="mt-5 text-center text-sm text-slate-600">
            {isSignup ? "Already have an account?" : "Need an account?"}{" "}
            <a
              className="font-semibold text-slate-950 underline underline-offset-4"
              href={isSignup ? "/login" : "/signup"}
            >
              {isSignup ? "Login" : "Sign up"}
            </a>
          </p>
        </form>
      </div>
    </section>
  );
}
