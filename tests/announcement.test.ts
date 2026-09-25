import {describe,expect,it,vi} from 'vitest';
import {ANNOUNCEMENT_KEY,APP_VERSION,announcementPending,forgetAnnouncementVersion,readAnnouncementVersion,rememberAnnouncementVersion} from '../src/platform/announcement';

class MemoryStorage{
  private data=new Map<string,string>();
  getItem(key:string){return this.data.get(key)??null;}
  setItem(key:string,value:string){this.data.set(key,value);}
  removeItem(key:string){this.data.delete(key);}
}

describe('单机站公告的显示规则',()=>{
  it('从没确认过时显示',()=>expect(announcementPending('')).toBe(true));

  it('已确认当前版本时不再显示',()=>expect(announcementPending(APP_VERSION)).toBe(false));

  it('版本更新后重新显示',()=>{
    expect(announcementPending('0.1.3','0.1.4')).toBe(true);
    expect(announcementPending('0.1.4','0.1.4')).toBe(false);
  });
});

describe('公告确认记录的读写',()=>{
  it('勾选后记住当前版本，取消勾选后清除',()=>{
    vi.stubGlobal('localStorage',new MemoryStorage());
    expect(readAnnouncementVersion()).toBe('');
    rememberAnnouncementVersion();
    expect(readAnnouncementVersion()).toBe(APP_VERSION);
    expect(announcementPending(readAnnouncementVersion())).toBe(false);
    forgetAnnouncementVersion();
    expect(readAnnouncementVersion()).toBe('');
    expect(announcementPending(readAnnouncementVersion())).toBe(true);
    vi.unstubAllGlobals();
  });

  it('浏览器存储不可用时按未确认处理，不抛出异常',()=>{
    vi.stubGlobal('localStorage',{getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');},removeItem(){throw new Error('blocked');}});
    expect(readAnnouncementVersion()).toBe('');
    expect(()=>rememberAnnouncementVersion()).not.toThrow();
    expect(()=>forgetAnnouncementVersion()).not.toThrow();
    expect(announcementPending(readAnnouncementVersion())).toBe(true);
    vi.unstubAllGlobals();
  });

  it('旧版本的确认不会阻止新版本公告',()=>{
    vi.stubGlobal('localStorage',new MemoryStorage());
    rememberAnnouncementVersion('0.1.3');
    expect(localStorage.getItem(ANNOUNCEMENT_KEY)).toBe('0.1.3');
    expect(announcementPending(readAnnouncementVersion(),'0.1.4')).toBe(true);
    vi.unstubAllGlobals();
  });
});
