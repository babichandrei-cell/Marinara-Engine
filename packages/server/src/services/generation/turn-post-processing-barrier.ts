const pendingTurnPostProcessing = new Map<string, symbol>();

/**
 * Marks a generation as still applying its authoritative post-processing
 * results. Consumers that derive media from the completed turn can use this
 * barrier instead of treating the assistant-message SSE event as completion.
 */
export function beginTurnPostProcessing(chatId: string): () => void {
  const token = Symbol(chatId);
  pendingTurnPostProcessing.set(chatId, token);

  return () => {
    if (pendingTurnPostProcessing.get(chatId) === token) {
      pendingTurnPostProcessing.delete(chatId);
    }
  };
}

export function isTurnPostProcessingPending(chatId: string): boolean {
  return pendingTurnPostProcessing.has(chatId);
}

function waitForTurnPostProcessingPoll(signal: AbortSignal, pollIntervalMs: number): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(signal.reason instanceof Error ? signal.reason : new Error("Turn post-processing cancelled"));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, pollIntervalMs);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason instanceof Error ? signal.reason : new Error("Turn post-processing cancelled"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Waits until tracker and other post-processing writes for this chat are durable. */
export async function waitForTurnPostProcessing(
  chatId: string,
  signal: AbortSignal,
  pollIntervalMs = 100,
): Promise<void> {
  while (isTurnPostProcessingPending(chatId)) {
    await waitForTurnPostProcessingPoll(signal, pollIntervalMs);
  }
}
