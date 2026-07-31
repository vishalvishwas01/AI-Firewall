/** Authentication feature boundary for popup/background consumers. */
export {
  apiUrl,
  getAuthStatus,
  getAuthToken,
  openLoginPage,
  openReportAddSitePage,
  openReportsPage,
  openSignupPage,
  saveAuthToken
} from "./auth"
export type { AuthStatus } from "./auth"
