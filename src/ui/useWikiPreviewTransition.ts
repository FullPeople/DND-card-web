import {useEffect, useLayoutEffect, useRef} from 'react';
import {createWikiPreviewTransition, WIKI_PREVIEW_ENTER_MS, WIKI_PREVIEW_EXIT_MS} from './wikiPreviewTransition';

/** Animate only the reader's paint; the catalog, sheet and scroll geometry stay put. */
export function useWikiPreviewTransition<T>(key: string | undefined, commit: (value: T) => void) {
  const latest = useRef({key, commit}); latest.current = {key, commit};
  const animation = useRef<{pane: HTMLElement; value: Animation} | undefined>(undefined);
  const entering = useRef<string | undefined>(undefined);
  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pane = () => document.querySelector<HTMLElement>('.wiki-pane:not(.table-pane) .entry-detail');
  function cancelAnimation() {
    const active = animation.current;
    if (active) { active.value.cancel(); delete active.pane.dataset.wikiPreviewTransition; animation.current = undefined; }
    entering.current = undefined;
  }
  function animate(node: HTMLElement, from: number, to: number, duration: number, phase: string) {
    cancelAnimation();
    node.dataset.wikiPreviewTransition = phase;
    const value = node.animate([{opacity: from}, {opacity: to}], {duration, easing: 'ease-out', fill: 'forwards'});
    animation.current = {pane: node, value};
    if (phase === 'entering') void value.finished.then(() => {
      if (animation.current?.value === value) cancelAnimation();
    }, () => { /* Replaced hovers cancel their old paint, never their newer target. */ });
  }
  const transition = useRef<ReturnType<typeof createWikiPreviewTransition<T>> | undefined>(undefined);
  if (!transition.current) transition.current = createWikiPreviewTransition<T>({
    currentKey: () => latest.current.key,
    commit: value => latest.current.commit(value),
    reducedMotion: reduced,
    cancel: cancelAnimation,
    entering: target => { entering.current = target; },
    begin: () => {
      const node = pane();
      if (!node?.animate) return false;
      const opacity = Number.parseFloat(getComputedStyle(node).opacity);
      animate(node, Number.isFinite(opacity) ? opacity : 1, .25, WIKI_PREVIEW_EXIT_MS, 'leaving');
      return true;
    },
  });
  useLayoutEffect(() => {
    const target = entering.current;
    if (target !== undefined && target === key && !reduced()) {
      const node = pane();
      if (node?.animate) { animate(node, .25, 1, WIKI_PREVIEW_ENTER_MS, 'entering'); return; }
    }
    cancelAnimation();
  }, [key]);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => { if (media.matches) transition.current!.finishImmediately(); };
    media.addEventListener('change', change);
    return () => { media.removeEventListener('change', change); transition.current!.cancel(); };
  }, []);
  return transition.current;
}
