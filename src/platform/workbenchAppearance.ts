// Mirror only host-validated personal appearance into the detached document.
// A settings iframe can have a different storage partition from the host.
export function mirrorWorkbenchAppearance(key:unknown,value:unknown){
 if(typeof key!=='string'||!['full-suite/ui-theme','full-suite/ui-night','full-suite/ui-tone'].includes(key)||value!==null&&typeof value!=='string')return;
 if(value!==null&&(key==='full-suite/ui-theme'&&!['night','graphite','parchment','celadon'].includes(value as string)||key==='full-suite/ui-night'&&!['0','1'].includes(value as string)||key==='full-suite/ui-tone'&&!/^#[0-9a-f]{6}$/i.test(value as string)))return;
 try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value as string);}catch{}
 window.dispatchEvent(new StorageEvent('storage',{key,newValue:value as string|null,storageArea:localStorage}));
}
