/** Only the permission guide's built assets belong to its paired-file route. */
export function permissionPanelAssetRoute(url:URL){
 return /\/workbench-panels\/permissions(?:\.html|-[^/]+\.js)$/.test(url.pathname);
}
