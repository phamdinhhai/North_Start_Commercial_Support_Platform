export type DeadlineOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly timedOut: boolean; readonly error?: unknown };

/**
 * Run `fn` with an abort signal and a hard deadline. A timeout or thrown error is reported,
 * never retried: for consequential actions the caller must treat both as UNKNOWN.
 */
export async function withDeadline<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<DeadlineOutcome<T>> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<DeadlineOutcome<T>>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false, timedOut: true });
    }, timeoutMs);
  });
  const run = (async (): Promise<DeadlineOutcome<T>> => {
    try {
      return { ok: true, value: await fn(controller.signal) };
    } catch (error) {
      return { ok: false, timedOut: controller.signal.aborted, error };
    }
  })();
  try {
    return await Promise.race([run, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
