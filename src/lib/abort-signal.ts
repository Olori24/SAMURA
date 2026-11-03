export function linkAbortSignal(source: AbortSignal, target: AbortController): () => void {
  const forwardAbort = () => target.abort(source.reason);

  if (source.aborted) {
    forwardAbort();
  } else {
    source.addEventListener("abort", forwardAbort, { once: true });
  }

  return () => source.removeEventListener("abort", forwardAbort);
}
