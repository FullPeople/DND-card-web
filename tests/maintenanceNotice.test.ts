// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import notice from '../src/data/maintenanceNotice20261101.json';
import {APP_VERSION,announcementVersionFor} from '../src/platform/announcement';
it('preserves the exact previously published author body as inert historical content',()=>{
 expect(notice.date).toBe('2026-11-01');expect(createHash('sha256').update(notice.html).digest('hex')).toBe('115a72e0adcfa831b2a032c41a72fb372f899a0bb30db89a49a67ab0ddc3b185');
 const host=document.createElement('div'),allowed=new Set(['DIV','STYLE','H3','H4','P','OL','LI','STRONG','BR']);host.innerHTML=notice.html;
 for(const element of host.querySelectorAll('*')){expect(allowed.has(element.tagName)).toBe(true);expect([...element.attributes].every(attribute=>attribute.name==='class')).toBe(true);}
 expect(host.textContent).toContain('以下是碎碎念');expect(host.textContent).toContain('随缘支持一下我');
});
it('keeps package, lock and standalone notice versions aligned without changing the Suite version',()=>{
 const pkg=JSON.parse(readFileSync('package.json','utf8')),lock=JSON.parse(readFileSync('package-lock.json','utf8'));expect(pkg.version).toBe(APP_VERSION);expect(lock.version).toBe(APP_VERSION);expect(lock.packages[''].version).toBe(APP_VERSION);expect(announcementVersionFor('suite')).toBe('1.0.302-dev');
});
