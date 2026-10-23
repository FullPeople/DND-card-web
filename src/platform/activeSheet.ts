/** Export and focus operations belong to the visible sheet, including when
 * other opened cards keep their layout surfaces in memory. */
export function activeSheet(){return document.querySelector<HTMLElement>('[data-retained-card-active="true"] .paper[data-active-sheet="true"]')||document.querySelector<HTMLElement>('.paper[data-active-sheet="true"]')||document.querySelector<HTMLElement>('.paper:not([data-active-sheet="false"])');}
export function isActiveSheetTarget(node:HTMLElement){return node.isConnected&&!node.closest('[inert],[data-retained-card-active="false"]');}
