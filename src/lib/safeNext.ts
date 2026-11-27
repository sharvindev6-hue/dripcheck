// Post-login redirect guard.
//
// `next` arrives from a query string, so it is attacker-controlled. Only a
// same-origin absolute path is allowed. Protocol-relative (`//evil`),
// backslash-normalised (`/\evil`) and control-character paths are rejected
// because browsers can turn them into an off-site redirect.

export function safeNextPath(value: string | null | undefined): string {
  if (!value) return '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/'
  if (/[\u0000-\u001f]/.test(value)) return '/'
  return value
}
