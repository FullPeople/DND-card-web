import {expect,it} from 'vitest';
import {noticePresentation} from '../src/ui/noticePresentation';
it('never shows a selection receipt on a different card',()=>{
 const first=noticePresentation('已填入原创条目','card-a');expect(first.visible).toBe(true);
 const switched=noticePresentation(first.origin.message,'card-b',first.origin);expect(switched.visible).toBe(false);expect(switched.origin).toBe(first.origin);
});
it('accepts a new confirmed message for the current card',()=>{
 const first=noticePresentation('已填入条目 A','card-a');expect(noticePresentation('已填入条目 B','card-b',first.origin)).toMatchObject({visible:true,origin:{scope:'card-b'}});
});
it('keeps global save and diagnostic warnings visible across card navigation',()=>{
 const first=noticePresentation('同步失败，请核对','card-a');expect(noticePresentation(first.origin.message,'card-b',first.origin).visible).toBe(true);
});
