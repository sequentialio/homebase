/**
 * Sanitized logging — logs only error message, never full stack
 * or response bodies that might contain tokens/credentials.
 */
export function safeError(prefix: string, err: unknown): void {
  if (err instanceof Error) {
    console.error(prefix, err.message)
  } else if (typeof err === "string") {
    console.error(prefix, err)
  } else {
    console.error(prefix, "[non-Error thrown]")
  }
}
