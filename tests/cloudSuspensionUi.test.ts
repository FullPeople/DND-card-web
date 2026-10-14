import {describe,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('../src/platform/workbench',()=>({useWorkbench:vi.fn(()=>{throw Error('A disabled cloud component must not initialize the host bridge');}),workbenchRequest:vi.fn()}));
vi.mock('../src/platform/tone',()=>({applyTone:vi.fn(),applyNightMode:vi.fn()}));
vi.mock('../src/platform/workbenchAppearance',()=>({mirrorWorkbenchAppearance:vi.fn()}));
import {CloudSaveProvider,CloudSaveControl} from '../src/cloud/CloudSave';
import {QQLogin} from '../src/cloud/QQLogin';
import {WorkbenchQQAccount} from '../src/ui/WorkbenchQQAccount';
import {CloudRoomControl} from '../src/ui/CloudRoomControl';
import {WorkbenchPanel} from '../src/ui/WorkbenchPanel';

describe('suspended cloud UI entries',()=>{
 it('omits QQ login, logged-in account and cloud permission controls',()=>{
  expect(renderToStaticMarkup(createElement(QQLogin,{session:{authenticated:true,qqLogin:'ready',account:{id:'saved',qq:null}}}))).toBe('');
  expect(renderToStaticMarkup(createElement(WorkbenchQQAccount))).toBe('');
  expect(renderToStaticMarkup(createElement(CloudRoomControl,{upload:vi.fn()}))).toBe('');
 });
 it('keeps the local editor while omitting autosync and upload controls',()=>{
  const read=vi.fn(async()=>{throw Error('cloud read during pause');}),receive=vi.fn(async()=>false),html=renderToStaticMarkup(createElement(CloudSaveProvider,{enabled:true,disabled:false,characters:[],readCharacter:read,receive,children:createElement('div',null,'Local editor',createElement(CloudSaveControl,{id:'saved'}))}));
  expect(html).toBe('<div>Local editor</div>');expect(read).not.toHaveBeenCalled();expect(receive).not.toHaveBeenCalled();
 });
 it('shows the paused state instead of mounting a QQ panel iframe',()=>{
  const html=renderToStaticMarkup(createElement(WorkbenchPanel,{panel:'qq',close:vi.fn()}));expect(html).toContain('云端功能已暂停');expect(html).not.toContain('iframe');
 });
});
