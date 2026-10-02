import {useLayoutEffect, useRef, type RefObject} from 'react';
import './wikiPreviewTransition.css';

type Box = {left: number; top: number; width: number; height: number};
export function readingHighlightBox(root: Box, target: Box) {
  return {x: target.left - root.left, y: target.top - root.top, width: target.width, height: target.height};
}
/** A single decoration moves between sections; text and focusable nodes never remount. */
export function useReadingHighlight(root: RefObject<HTMLDivElement | null>, section: string | undefined, active: boolean) {
  const overlay = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = root.current, layer = overlay.current;
    if (!node || !layer) return;
    const target = section ? node.querySelector<HTMLElement>(`[data-section="${CSS.escape(section)}"]`) : undefined;
    if (!active || !target) { layer.dataset.active = 'false'; return; }
    const measure = () => {
      const box = readingHighlightBox(node.getBoundingClientRect(), target.getBoundingClientRect());
      layer.style.transform = `translate(${box.x}px, ${box.y}px)`;
      layer.style.width = `${box.width}px`; layer.style.height = `${box.height}px`;
      layer.dataset.active = 'true';
    };
    measure();
    // Font/data/column changes can alter a paragraph without changing its anchor.
    // This only observes the reader and changes an out-of-flow decoration.
    const observer = new ResizeObserver(measure); observer.observe(node); observer.observe(target);
    return () => observer.disconnect();
  }, [root, section, active]);
  return overlay;
}
