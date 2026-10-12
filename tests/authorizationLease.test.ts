import {afterEach,expect,it,vi} from 'vitest';
import {authorizationLease} from '../src/cloud/authorizationLease';
afterEach(()=>{vi.useRealTimers();});
it('shared read order rejects older grants and older denials at the same body revision',()=>{
 const lease=authorizationLease(()=> 'scope',()=>{}),old=lease.beginRead(),denied=lease.beginRead();expect(lease.verifyRead(denied,false)).toBe(true);expect(lease.verifyRead(old,true)).toBe(false);expect(lease.check()).toBe(false);
 const regrant=lease.beginRead();expect(lease.verifyRead(regrant,true)).toBe(true);expect(lease.verifyRead(denied,false)).toBe(false);expect(lease.check()).toBe(true);lease.stop();
});
it('explicit invalidation rejects pending reads while normal expiry allows a timely new read to renew',()=>{
 vi.useFakeTimers();vi.setSystemTime(10000);const lease=authorizationLease(()=> 'scope',()=>{}),old=lease.beginRead();lease.invalidate();expect(lease.verifyRead(old,true)).toBe(false);
 expect(lease.verifyRead(lease.beginRead(),true)).toBe(true);vi.advanceTimersByTime(5500);const renewal=lease.beginRead();vi.advanceTimersByTime(501);expect(lease.check()).toBe(false);expect(lease.verifyRead(renewal,true)).toBe(true);expect(lease.check()).toBe(true);lease.stop();
});
it('the six-second budget starts at dispatch and cannot be moved by an old response',()=>{
 vi.useFakeTimers();vi.setSystemTime(10000);const lease=authorizationLease(()=> 'scope',()=>{}),old=lease.beginRead();vi.advanceTimersByTime(1000);const latest=lease.beginRead();lease.verifyRead(latest,false);expect(lease.snapshot().verifiedAt).toBe(11000);lease.verifyRead(old,true);expect(lease.snapshot().verifiedAt).toBe(11000);
 vi.advanceTimersByTime(6001);expect(lease.verifyRead(latest,true)).toBe(true);expect(lease.check()).toBe(false);lease.stop();
});
it('a replaced lease cannot accept a ticket from the previous lease with matching counters',()=>{
 const first=authorizationLease(()=> 'scope',()=>{}),old=first.beginRead(),replacement=authorizationLease(()=> 'scope',()=>{});replacement.beginRead();expect(replacement.verifyRead(old,true)).toBe(false);expect(replacement.check()).toBe(false);first.stop();replacement.stop();
});
