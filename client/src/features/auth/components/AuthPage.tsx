import { useEffect, useState, type FormEvent } from "react";
import { login, signup, startGoogleLogin } from "../api";
import type { AccountType, SessionUser } from "../types";
import { authRedirectKey, isExtensionAuthFlow, sendSessionToExtension } from "../extensionBridge";

export function AuthPage({ mode, accountType, onAuthenticated }: { mode: "login" | "signup"; accountType: AccountType; onAuthenticated: (user: SessionUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const isSignup = mode === "signup";
  const isEnterprise = accountType === "enterprise";

  useEffect(() => {
    const errorCode = new URLSearchParams(window.location.search).get("error");
    if (errorCode === "google_oauth_failed") setError("Google sign-in failed. Please try again.");
    if (errorCode === "google_email_not_verified") setError("Your Google email address is not verified.");
    if (errorCode === "account_type_mismatch") setError("This Google account is registered for the other account type.");
  }, []);

  const switchPath = (nextType: AccountType) => {
    const prefix = nextType === "enterprise" ? "/enterprise" : "";
    window.history.pushState({}, "", `${prefix}/${mode}`);
    window.dispatchEvent(new Event("popstate"));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = isSignup
        ? await signup(accountType, { password, ...(isEnterprise ? { name, companyName, companyEmail } : { email }) })
        : await login(accountType, email, password);
      onAuthenticated(response.user);
      if (isExtensionAuthFlow()) await sendSessionToExtension(response.token);
      const redirectPath = window.sessionStorage.getItem(authRedirectKey);
      window.sessionStorage.removeItem(authRedirectKey);
      window.history.replaceState({}, "", redirectPath ?? "/");
      window.dispatchEvent(new Event("popstate"));
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    setError("");
    setGoogleSubmitting(true);
    startGoogleLogin(accountType);
  };

  return (
    <section className="flex min-h-[calc(100vh-4rem)] items-center bg-slate-50 px-6 py-16 sm:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 grid grid-cols-2 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <button type="button" onClick={() => switchPath("individual")} className={`rounded-md px-4 py-2 text-sm font-semibold ${!isEnterprise ? "bg-slate-950 text-white" : "text-slate-600"}`}>Individual</button>
          <button type="button" onClick={() => switchPath("enterprise")} className={`rounded-md px-4 py-2 text-sm font-semibold ${isEnterprise ? "bg-slate-950 text-white" : "text-slate-600"}`}>Enterprise</button>
        </div>

        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">{isEnterprise ? "Enterprise workspace" : "Personal protection"}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">{isSignup ? (isEnterprise ? "Create your enterprise account." : "Create your personal account.") : (isEnterprise ? "Enterprise login." : "Welcome back.")}</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">{isEnterprise ? "Manage teams, members, policies, and reports from one workspace." : "Use HallGuard locally and view your personal redacted warning reports."}</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {isEnterprise && isSignup ? <>
            <div><label htmlFor="name" className="text-sm font-semibold text-slate-950">Your name</label><input id="name" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm" /></div>
            <div className="mt-5"><label htmlFor="companyName" className="text-sm font-semibold text-slate-950">Company name</label><input id="companyName" type="text" autoComplete="organization" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm" /></div>
            <div className="mt-5"><label htmlFor="companyEmail" className="text-sm font-semibold text-slate-950">Company email</label><input id="companyEmail" type="email" autoComplete="email" required value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm" /></div>
          </> : <div><label htmlFor="email" className="text-sm font-semibold text-slate-950">{isEnterprise ? "Company email" : "Email"}</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm" /></div>}

          <div className="mt-5"><label htmlFor="password" className="text-sm font-semibold text-slate-950">Password</label><input id="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm" /></div>
          {error ? <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{error}</div> : null}
          <button type="submit" disabled={submitting} className="button-primary mt-6 w-full disabled:opacity-60">{submitting ? "Please wait" : isSignup ? "Create account" : "Login"}</button>
          <button type="button" disabled={googleSubmitting} onClick={handleGoogleLogin} className="button-secondary mt-4 w-full disabled:opacity-60">{googleSubmitting ? "Please wait" : "Continue with Google"}</button>
          <p className="mt-5 text-center text-sm text-slate-600">{isSignup ? "Already have an account?" : "Need an account?"}{" "}<a className="font-semibold text-slate-950 underline underline-offset-4" href={`${isEnterprise ? "/enterprise" : ""}/${isSignup ? "login" : "signup"}`}>{isSignup ? "Login" : "Sign up"}</a></p>
        </form>
      </div>
    </section>
  );
}
