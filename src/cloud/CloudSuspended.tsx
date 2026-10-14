import {cloudDisabledMessage} from './availability';
export function CloudSuspended(){return <main className="cloud-suspended" role="status"><h1>云端功能已暂停</h1><p>{cloudDisabledMessage}</p><a href="/card/">打开本机角色卡</a></main>;}
