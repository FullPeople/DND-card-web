/** One replaceable hover intent. There is never a queue of old preview targets. */
export const WIKI_PREVIEW_EXIT_MS = 45;
export const WIKI_PREVIEW_ENTER_MS = 55;
export function createWikiPreviewTransition<T>(options: {
  currentKey: () => string | undefined;
  commit: (value: T) => void;
  begin: () => boolean;
  cancel: () => void;
  entering: (key: string | undefined) => void;
  reducedMotion: () => boolean;
}) {
  let pending: { value: T; key: string | undefined } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function cancel() {
    clearTimeout(timer); timer = undefined; pending = undefined; options.cancel();
  }
  function flush() {
    const target = pending;
    if (!target) return;
    clearTimeout(timer); timer = undefined; pending = undefined;
    options.entering(options.reducedMotion() ? undefined : target.key);
    if (options.reducedMotion()) options.cancel();
    options.commit(target.value);
  }
  return {
    request(value: T, key: string | undefined) {
      if (options.reducedMotion() || key === options.currentKey()) {
        cancel(); options.commit(value); return;
      }
      pending = { value, key };
      if (timer !== undefined) return;
      if (!options.begin()) { flush(); return; }
      timer = setTimeout(flush, WIKI_PREVIEW_EXIT_MS);
    },
    cancel,
    finishImmediately() { options.cancel(); flush(); },
  };
}
