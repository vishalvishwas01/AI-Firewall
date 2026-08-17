import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  acceptOrganizationInvitation,
  getInvitation,
  getSession,
  login,
  signup,
  startGoogleLogin,
} from "../api";
import type { AccountType, SessionUser } from "../types";
import {
  authRedirectKey,
  isExtensionAuthFlow,
  sendSessionToExtension,
} from "../extensionBridge";
import { LivingFirewall } from "./LivingFirewall";

const fieldClassName =
  "mt-1.5 w-full rounded-lg border-0 bg-white px-4 py-3 text-base text-[#33312b] shadow-sm outline-none ring-1 ring-transparent transition duration-200 placeholder:text-[#9d978c] focus:bg-[#faf9f6] focus:ring-[#33312b] read-only:cursor-not-allowed read-only:bg-[#efeeeb]";
const labelClassName =
  "ml-1 text-sm font-medium tracking-[0.02em] text-[#4a463f]";

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 18 18"
      width="18"
    >
      <path
        d="M17.64 9.20455c0-.63819-.0573-1.25182-.1636-1.84091H9v3.48136h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8591-3.0477.8591-2.34409 0-4.32818-1.5832-5.03591-3.7105H.957275v2.3318C2.43818 15.9832 5.48182 18 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.96409 10.71A5.32 5.32 0 0 1 3.68182 9c0-.59318.10227-1.17.28227-1.71V4.95818H.957275A8.996 8.996 0 0 0 0 9c0 1.4523.347727 2.8268.957275 4.0418L3.96409 10.71Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.57955c1.3214 0 2.5077.45409 3.4405 1.3459l2.5813-2.58136C13.4632.891818 11.4259 0 9 0 5.48182 0 2.43818 2.01682.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AuthPage({
  mode,
  accountType,
  user,
  onAuthenticated,
}: {
  mode: "login" | "signup";
  accountType?: AccountType;
  user?: SessionUser | null;
  onAuthenticated: (user: SessionUser) => void;
}) {
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite") ?? "";
  const initialAccountType: AccountType =
    accountType ??
    (params.get("type") === "enterprise" ? "enterprise" : "individual");
  const [selectedAccountType, setSelectedAccountType] =
    useState<AccountType>(initialAccountType);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
  const cardRef = useRef<HTMLDivElement>(null);
  const isSignup = mode === "signup";
  const isEnterprise = selectedAccountType === "enterprise";
  const signupAccountType: AccountType = inviteToken
    ? "individual"
    : selectedAccountType;
  const signupIsEnterprise = signupAccountType === "enterprise";
  const passwordsMatch = password === confirmPassword;
  const showPasswordMatch = isSignup && confirmPassword.length > 0;
  const enterpriseSignupScrollable = isSignup && signupIsEnterprise;
  const isAuthenticatedForInvitation = Boolean(user && inviteToken);

  useEffect(() => {
    const errorCode = params.get("error");
    if (errorCode === "google_oauth_failed")
      setError("Google sign-in failed. Please try again.");
    if (errorCode === "google_email_not_verified")
      setError("Your Google email address is not verified.");
    if (errorCode === "account_type_mismatch")
      setError("This Google account is registered for the other account type.");
    if (inviteToken)
      getInvitation(inviteToken)
        .then((invitation) => {
          setInvitedOrganization(invitation.organizationName);
          setInvitedEmail(invitation.email);
          setInvitedRole(invitation.role);
          setEmail(invitation.email);
          setCompanyEmail(invitation.email);
        })
        .catch(() =>
          setError(
            "This invitation is expired, revoked, or no longer available.",
          ),
        );
  }, [inviteToken]);

  useEffect(() => {
    const syncAccountTypeFromUrl = () =>
      setSelectedAccountType(
        accountType ??
          (new URLSearchParams(window.location.search).get("type") ===
          "enterprise"
            ? "enterprise"
            : "individual"),
      );
    window.addEventListener("popstate", syncAccountTypeFromUrl);
    return () => window.removeEventListener("popstate", syncAccountTypeFromUrl);
  }, [accountType]);

  const switchType = (nextType: AccountType) => {
    const inviteQuery = inviteToken
      ? `&invite=${encodeURIComponent(inviteToken)}`
      : "";
    const query =
      nextType === "enterprise"
        ? `?type=enterprise${inviteQuery}`
        : inviteToken
          ? `?invite=${encodeURIComponent(inviteToken)}`
          : "";
    setSelectedAccountType(nextType);
    setError("");
    window.history.pushState({}, "", `/${mode}${query}`);
    window.dispatchEvent(new Event("popstate"));
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
      if (isSignup && !passwordsMatch)
        throw new Error("Passwords do not match.");
      const response = isSignup
        ? await signup(signupAccountType, {
            password,
            name,
            ...(signupIsEnterprise
              ? { companyName, companyEmail }
              : { email }),
          })
        : await login(selectedAccountType, email, password);
      onAuthenticated(response.user);
      if (isExtensionAuthFlow()) await sendSessionToExtension(response.token);
      if (!inviteToken) redirectAfterAuthentication();
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

  const handleAcceptInvitation = async () => {
    if (!inviteToken || !user) return;
    setError("");
    setAccepting(true);
    try {
      await acceptOrganizationInvitation(inviteToken);
      const session = await getSession();
      if (!session.user)
        throw new Error(
          "Your session expired. Please sign in again before accepting the invitation.",
        );
      onAuthenticated(session.user);
      redirectAfterAuthentication();
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Could not accept invitation",
      );
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
  const handlePointerMove = (event: MouseEvent<HTMLDivElement>) => {
    if (
      !cardRef.current ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 12;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 12;
    cardRef.current.style.transform = `perspective(1000px) translate3d(${x}px, ${y}px, 0) rotateX(${-y * 0.25}deg) rotateY(${x * 0.25}deg)`;
  };
  const resetCardPosition = () => {
    if (cardRef.current)
      cardRef.current.style.transform =
        "perspective(1000px) translate3d(0, 0, 0) rotateX(0) rotateY(0)";
  };

  const alternatePath = isEnterprise
    ? `/${isSignup ? "login" : "signup"}?type=enterprise${inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : ""}`
    : `/${isSignup ? "login" : "signup"}${inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : ""}`;
  const handleAlternateNavigation = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.history.pushState({}, "", alternatePath);
    window.dispatchEvent(new Event("popstate"));
  };
  if (isAuthenticatedForInvitation && !user) return null;

  const eyebrow = inviteToken
    ? "Organization invitation"
    : isEnterprise
      ? "Enterprise workspace"
      : "Personal protection";
  const title = isAuthenticatedForInvitation
    ? "Accept your invitation."
    : inviteToken
      ? "Join your organization."
      : isSignup
        ? isEnterprise
          ? "Create your enterprise account."
          : "Create your personal account."
        : isEnterprise
          ? "Enterprise login."
          : "Welcome back.";
  const description = isAuthenticatedForInvitation ? (
    <>
      You are signed in as <strong>{user?.email}</strong>. The invitation is for{" "}
      <strong>{invitedEmail}</strong> to join{" "}
      <strong>{invitedOrganization}</strong> as a {invitedRole}.
    </>
  ) : invitedOrganization ? (
    `You have been invited to ${invitedOrganization}. Use ${invitedEmail} to accept the invitation.`
  ) : isEnterprise ? (
    "Manage teams, members, policies, and reports from one workspace."
  ) : (
    "Use HallGuard locally and view your personal redacted warning reports."
  );

  return (
    <section className="auth-shell h-dvh overflow-hidden bg-[#faf9f6] text-[#1a1c1a] lg:grid lg:grid-cols-[5fr_7fr]">
      <aside className="auth-left-panel relative hidden h-dvh min-h-0 overflow-hidden border-r border-[#ccc6bc]/30 bg-[#f4f3f1] p-10 lg:flex lg:flex-col xl:p-12">
        <a
          href="/"
          className="relative z-10 block w-fit"
          aria-label="HallGuard home"
        >
          <img
            src="/hallguard-auth-logo.svg"
            alt="HallGuard"
            className="h-16 w-16 rounded-lg object-contain mix-blend-multiply xl:h-20 xl:w-20"
          />
        </a>
        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center py-6">
          <LivingFirewall />
        </div>
        <div className="relative z-10 max-w-md pb-1">
          <h2 className="text-[32px] font-semibold leading-10 tracking-[-0.01em] text-[#33312b]">
            Securing the Digital Frontier
          </h2>
          <p className="mt-4 text-lg leading-7 text-[#4a463f]">
            Experience peace of mind with HallGuard&apos;s living firewall
            technology. Advanced threat detection and real-time redacted warning
            reports keep your environment secure locally.
          </p>
        </div>
      </aside>

      <div
        className={`auth-right-panel relative isolate flex h-dvh min-h-0 justify-center bg-[#dedede] px-5 sm:px-6 lg:px-8 ${enterpriseSignupScrollable ? "items-start overflow-y-auto py-6" : "items-center overflow-hidden py-4"}`}
        onMouseMove={handlePointerMove}
        onMouseLeave={resetCardPosition}
      >
        <main
          id="page-content"
          tabIndex={-1}
          className={`relative z-10 flex w-full items-center justify-center outline-none ${enterpriseSignupScrollable ? "min-h-full" : ""}`}
        >
          <div
            ref={cardRef}
            className={`auth-card w-full max-w-[440px] rounded-2xl border border-white/40 bg-[#f5f2ea]/80 p-8 shadow-[0_8px_32px_rgba(51,49,43,0.10)] backdrop-blur-xl transition-[transform,box-shadow] duration-700 ease-out hover:shadow-[0_16px_48px_rgba(51,49,43,0.14)] sm:p-10 ${isSignup ? "auth-card--signup" : "auth-card--login"} ${enterpriseSignupScrollable ? "auth-card--enterprise" : ""}`}
          >
            {!isAuthenticatedForInvitation ? (
              <>
                <div className="auth-mode-toggle relative mx-auto mb-8 flex w-[208px] rounded-full bg-[#e3e2e0] p-1 shadow-inner">
                  <span
                    className={`absolute bottom-1 top-1 w-[100px] rounded-full bg-[#33312b] shadow-sm transition-transform duration-300 ${isEnterprise ? "translate-x-full" : "translate-x-0"}`}
                  />
                  <button
                    type="button"
                    aria-pressed={!isEnterprise}
                    onClick={() => switchType("individual")}
                    className={`relative z-10 w-[100px] rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-300 ${!isEnterprise ? "text-white" : "text-[#4a463f]"}`}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    aria-pressed={isEnterprise}
                    onClick={() => switchType("enterprise")}
                    className={`relative z-10 w-[100px] rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-300 ${isEnterprise ? "text-white" : "text-[#4a463f]"}`}
                  >
                    Enterprise
                  </button>
                </div>
                <div className="auth-heading mb-8 text-center">
                  {inviteToken ? (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#65645e]">
                      {eyebrow}
                    </p>
                  ) : null}
                  <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.01em] text-[#33312b] sm:text-[32px] sm:leading-10">
                    {title}
                  </h1>
                  <p className="mt-2 text-base leading-6 text-[#4a463f]">
                    {description}
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="auth-form w-full space-y-4">
                  {isSignup ? (
                    <>
                      <div>
                        <label htmlFor="name" className={labelClassName}>
                          Your name
                        </label>
                        <input
                          id="name"
                          name="name"
                          type="text"
                          autoComplete="name"
                          required
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          className={fieldClassName}
                          placeholder="Your name"
                        />
                      </div>
                      {signupIsEnterprise ? (
                        <>
                          <div>
                            <label htmlFor="companyName" className={labelClassName}>
                              Company name
                            </label>
                            <input
                              id="companyName"
                              name="companyName"
                              type="text"
                              autoComplete="organization"
                              required
                              value={companyName}
                              onChange={(event) => setCompanyName(event.target.value)}
                              className={fieldClassName}
                              placeholder="Company name"
                            />
                          </div>
                          <div>
                            <label htmlFor="companyEmail" className={labelClassName}>
                              Company email
                            </label>
                            <input
                              id="companyEmail"
                              name="companyEmail"
                              type="email"
                              autoComplete="email"
                              required
                              readOnly={Boolean(inviteToken)}
                              value={companyEmail}
                              onChange={(event) => setCompanyEmail(event.target.value)}
                              className={fieldClassName}
                              placeholder="Email"
                            />
                          </div>
                        </>
                      ) : (
                        <div>
                          <label htmlFor="email" className={labelClassName}>
                            Email
                          </label>
                          <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            readOnly={Boolean(inviteToken)}
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className={fieldClassName}
                            placeholder="Email"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <label htmlFor="email" className={labelClassName}>
                        {isEnterprise ? "Company email" : "Email"}
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        readOnly={Boolean(inviteToken)}
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className={fieldClassName}
                        placeholder="Email"
                      />
                    </div>
                  )}
                  <div>
                    <label htmlFor="password" className={labelClassName}>
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete={
                        isSignup ? "new-password" : "current-password"
                      }
                      minLength={8}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className={fieldClassName}
                      placeholder="Password"
                    />
                  </div>
                  {isSignup ? (
                    <div>
                      <label htmlFor="confirmPassword" className={labelClassName}>
                        Retype password
                      </label>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        aria-invalid={showPasswordMatch && !passwordsMatch}
                        aria-describedby="password-match-status"
                        className={fieldClassName}
                        placeholder="Retype password"
                      />
                      <p
                        id="password-match-status"
                        aria-live="polite"
                        className={`ml-1 mt-1 text-xs font-medium ${showPasswordMatch ? (passwordsMatch ? "text-emerald-700" : "text-[#93000a]") : "invisible"}`}
                      >
                        {passwordsMatch
                          ? "Passwords match."
                          : "Passwords do not match."}
                      </p>
                    </div>
                  ) : null}
                  {isSignup ? (
                    <div
                      className="auth-captcha-slot"
                      aria-label="Reserved space for security verification"
                    >
                      <span>Security verification</span>
                    </div>
                  ) : null}
                  {inviteToken && isSignup ? (
                    <p className="rounded-lg border border-[#cac6bb] bg-white/60 px-3 py-2 text-sm leading-5 text-[#4a463f]">
                      After authentication, you will be asked to explicitly
                      accept the organization invitation.
                    </p>
                  ) : null}
                  {error ? (
                    <div
                      role="alert"
                      className="rounded-lg border border-[#ba1a1a]/20 bg-[#ffdad6] px-3 py-2 text-sm font-medium text-[#93000a]"
                    >
                      {error}
                    </div>
                  ) : null}
                  <div className="auth-actions space-y-3 pt-2">
                    <button
                      type="submit"
                      disabled={
                        submitting ||
                        Boolean(inviteToken && !invitedEmail) ||
                        Boolean(isSignup && (!confirmPassword || !passwordsMatch))
                      }
                      className="w-full rounded-lg bg-[#33312b] px-5 py-3.5 text-sm font-medium tracking-[0.02em] text-white shadow-sm transition hover:bg-[#49483f] hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting
                        ? "Please wait"
                        : inviteToken
                          ? "Continue to invitation"
                          : isSignup
                            ? "Create account"
                            : "Login"}
                    </button>
                    {!inviteToken && (!isEnterprise || !isSignup) ? (
                      <button
                        type="button"
                        disabled={googleSubmitting}
                        onClick={handleGoogleLogin}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#ccc6bc] bg-white px-5 py-3 text-sm font-medium tracking-[0.02em] text-[#33312b] shadow-sm transition hover:bg-[#f4f3f1] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <GoogleIcon />
                        {googleSubmitting
                          ? "Please wait"
                          : "Continue with Google"}
                      </button>
                    ) : null}
                  </div>
                  <p className="auth-footer pt-1 text-center text-base text-[#4a463f]">
                    {isSignup ? "Already have an account?" : "Need an account?"}{" "}
                    <a
                      className="font-semibold text-[#33312b] underline-offset-4 hover:underline"
                      href={alternatePath}
                      onClick={handleAlternateNavigation}
                    >
                      {isSignup ? "Login" : "Sign up"}
                    </a>
                  </p>
                </form>
              </>
            ) : (
              <>
                <div className="mb-8 text-center">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#65645e]">
                    {eyebrow}
                  </p>
                  <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.01em] text-[#33312b] sm:text-[32px] sm:leading-10">
                    {title}
                  </h1>
                  <p className="mt-3 text-base leading-6 text-[#4a463f]">
                    {description}
                  </p>
                </div>
                {error ? (
                  <div
                    role="alert"
                    className="mb-5 rounded-lg border border-[#ba1a1a]/20 bg-[#ffdad6] px-3 py-2 text-sm font-medium text-[#93000a]"
                  >
                    {error}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={handleAcceptInvitation}
                  disabled={accepting || !invitedEmail}
                  className="w-full rounded-lg bg-[#33312b] px-5 py-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#49483f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {accepting ? "Accepting invitation" : "Accept invitation"}
                </button>
                <button
                  type="button"
                  onClick={handleContinueWithoutAccepting}
                  disabled={accepting}
                  className="mt-3 w-full rounded-lg border border-[#ccc6bc] bg-white px-5 py-3 text-sm font-medium text-[#33312b] shadow-sm transition hover:bg-[#f4f3f1] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue without accepting
                </button>
              </>
            )}
          </div>
        </main>
      </div>
    </section>
  );
}
