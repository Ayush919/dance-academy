/**
 * Full page load to a same-site path. Used after sign-in and sign-out so the server renders with
 * the new session cookie (and role-based redirects run server-side) instead of a client transition.
 */
export function hardNavigate(path: string) {
  window.location.assign(new URL(path, window.location.origin).toString())
}
