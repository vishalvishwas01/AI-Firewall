import { useEffect, useState, type FormEvent } from "react";
import { acceptOrganizationInvitation, getInvitation, getSession, login, signup, startGoogleLogin } from "../api";
import type { AccountType, SessionUser } from "../types";
import { authRedirectKey, isExtensionAuthFlow, sendSessionToExtension } from "../extensionBridge";

export function AuthPage({ mode, accountType, user, onAuthenticated }: { mode: "login" | "signup"; accountType?: AccountType; user?: SessionUser | null; onAuthenticated: (user: SessionUser) => void }) {
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite") ?? "";
  const selectedAccountType: AccountType = accountType ?? (params.get("type") === "enterprise" ? "enterprise" : "individual");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [invitedOrganization, setInvitedOrganization] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [invitedRole, setInvitedRole] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const isSignup = mode === "signup";
  const isEnterprise = selectedAccountType === "enterprise";
  const signupAccountType: AccountType = inviteToken ? "individual" : selectedAccountType;
  const signupIsEnterprise = signupAccountType === "enterprise";
  const isAuthenticatedForInvitation = Boolean(user && inviteToken);

  useEffect(() => {
    const errorCode = params.get("error");
    if (errorCode === "google_oauth_failed") setError("Google sign-in failed. Please try again.");
    if (errorCode === "google_email_not_verified") setError("Your Google email address is not verified.");
    if (errorCode === "account_type_mismatch") setError("This Google account is registered for the other account type.");

    if (inviteToken) {
      getInvitation(inviteToken)
        .then((invitation) => {
          setInvitedOrganization(invitation.organizationName);
          setInvitedEmail(invitation.email);
          setInvitedRole(invitation.role);
          setEmail(invitation.email);
          setCompanyEmail(invitation.email);
        })
        .catch(() => setError("This invitation is expired, revoked, or no longer available."));
    }
  }, [inviteToken]);

  const switchType = (nextType: AccountType) => {
    const inviteQuery = inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : "";
    const query = nextType === "enterprise" ? `?type=enterprise${inviteQuery}` : inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : "";
    window.history.pushState({}, "", `/${mode}${query}`);
    window.dispatchEvent(new Event("popstate"));
    window.location.reload();
  };

  const redirectAfterAuthentication = () => {
    const redirectPath = window.sessionStorage.getItem(authRedirectKey);
    window.sessionStorage.removeItem(authRedirectKey);
    window.history.replaceState({}, "", redirectPath ?? "/");
    window.dispatchEvent(new Event("popstate"));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = isSignup
        ? await signup(signupAccountType, { password, ...(signupIsEnterprise ? { name, companyName, companyEmail } : { email }) })
        : await login(selectedAccountType, email, password);

      onAuthenticated(response.user);
      if (isExtensionAuthFlow()) await sendSessionToExtension(response.token);

      // Authentication and invitation acceptance are deliberately separate actions.
      // Logging in or signing up must never activate a pending invitation by itself.
      if (!inviteToken) redirectAfterAuthentication();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!inviteToken || !user) return;
    setError("");
    setAccepting(true);
    try {
      await acceptOrganizationInvitation(inviteToken);
      const session = await getSession();
      onAuthenticated(session.user);
      redirectAfterAuthentication();
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Could not accept invitation");
    } finally {
      setAccepting(false);
    }
  };

  const handleContinueWithoutAccepting = () => {
    window.history.replaceState({}, "", "/");
    window.dispatchEvent(new Event("popstate"));
  };

  const handleGoogleLogin = () => {
    setError("");
    setGoogleSubmitting(true);
    startGoogleLogin(selectedAccountType);
  };

  const alternatePath = isEnterprise
    ? `/${isSignup ? "login" : "signup"}?type=enterprise${inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : ""}`
    : `/${isSignup ? "login" : "signup"}${inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : ""}`;

  return (
    <section className="flex min-h-[calc(100vh-4rem)] items-center bg-slate-50 px-6 py-16 sm:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-lg">
        {!isAuthenticatedForInvitation ? <>
          <div className="mb-6 grid grid-cols-2 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <button type="button" onClick={() => switchType("individual")} className={`rounded-md px-4 py-2 text-sm font-semibold ${!isEnterprise ? "bg-slate-950 text-white" : "text-slate-600"}`}>Individual</button>
            <button type="button" onClick={() => switchType("enterprise")} className={`rounded-md px-4 py-2 text-sm font-semibold ${isEnterprise ? "bg-slate-950 text-white" : "text-slate-600"}`}>Enterprise</button>
          </div>
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">{inviteToken ? "Organization invitation" : isEnterprise ? "Enterprise workspace" : "Personal protection"}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">{inviteToken ? "Join your organization." : isSignup ? (isEnterprise ? "Create your enterprise account." : "Create your personal account.") : (isEnterprise ? "Enterprise login." : "Welcome back.")}</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">{invitedOrganization ? `You have been invited to ${invitedOrganization}. Use ${invitedEmail} to accept the invitation.` : isEnterprise ? "Manage teams, members, policies, and reports from one workspace." : "Use HallGuard locally and view your personal redacted warning reports."}</p>
          </div>
          <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {signupIsEnterprise && isSignup ? <>
              <div><label htmlFor="name" className="text-sm font-semibold text-slate-950">Your name</label><input id="name" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm" /></div>
              <div className="mt-5"><label htmlFor="companyName" className="text-sm font-semibold text-slate-950">Company name</label><input id="companyName" type="text" autoComplete="organization" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm" /></div>
              <div className="mt-5"><label htmlFor="companyEmail" className="text-sm font-semibold text-slate-950">Company email</label><input id="companyEmail" type="email" autoComplete="email" required readOnly={Boolean(inviteToken)} value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm" /></div>
            </> : <div><label htmlFor="email" className="text-sm font-semibold text-slate-950">{isEnterprise && !isSignup ? "Company email" : "Email"}</label><input id="email" type="email" autoComplete="email" required readOnly={Boolean(inviteToken)} value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm" /></div>}
            <div className="mt-5"><label htmlFor="password" className="text-sm font-semibold text-slate-950">Password</label><input id="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm" /></div>
            {inviteToken && isSignup ? <p className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">After authentication, you will be asked to explicitly accept the organization invitation.</p> : null}
            {error ? <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{error}</div> : null}
            <button type="submit" disabled={submitting || Boolean(inviteToken && !invitedEmail)} className="button-primary mt-6 w-full disabled:opacity-60">{submitting ? "Please wait" : inviteToken ? "Continue to invitation" : isSignup ? "Create account" : "Login"}</button>
            {!inviteToken && (!isEnterprise || !isSignup) ? <button type="button" disabled={googleSubmitting} onClick={handleGoogleLogin} className="button-secondary mt-4 w-full disabled:opacity-60">{googleSubmitting ? "Please wait" : "Continue with Google"}</button> : null}
            <p className="mt-5 text-center text-sm text-slate-600">{isSignup ? "Already have an account?" : "Need an account?"}{" "}<a className="font-semibold text-slate-950 underline underline-offset-4" href={alternatePath}>{isSignup ? "Login" : "Sign up"}</a></p>
          </form>
        </> : <>
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">Organization invitation</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">Accept your invitation.</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">You are signed in as <strong>{user.email}</strong>. The invitation is for <strong>{invitedEmail}</strong> to join <strong>{invitedOrganization}</strong> as a {invitedRole}.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{error}</div> : null}
            <button type="button" onClick={handleAcceptInvitation} disabled={accepting || !invitedEmail} className="button-primary w-full disabled:opacity-60">{accepting ? "Accepting invitation" : "Accept invitation"}</button>
            <button type="button" onClick={handleContinueWithoutAccepting} disabled={accepting} className="button-secondary mt-4 w-full disabled:opacity-60">Continue without accepting</button>
          </div>
        </>}
      </div>
    </section>
  );
}
