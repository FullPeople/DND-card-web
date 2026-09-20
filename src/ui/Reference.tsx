import { createContext, useContext, type ReactNode } from 'react';

type Preview = { show: (anchor: HTMLElement, reference: string, kind?: string) => void; leave: () => void; close: () => void; active?: HTMLElement };
export const ReferenceContext = createContext<Preview | null>(null);
export function Reference({ reference, kind, children, onClick, className = 'inline-reference' }: { reference: string; kind?: string; children: ReactNode; onClick?: () => void; className?: string }) {
  const preview = useContext(ReferenceContext);
  return <button className={className} onMouseEnter={e => preview?.show(e.currentTarget, reference, kind)} onMouseLeave={() => preview?.leave()} onFocus={e => preview?.show(e.currentTarget, reference, kind)} onBlur={() => preview?.leave()} aria-describedby={preview?.active?.dataset.reference === `${kind}:${reference}` ? 'keyword-preview' : undefined} data-reference={`${kind}:${reference}`} onClick={() => { preview?.close(); onClick?.(); }}>{children}</button>;
}
