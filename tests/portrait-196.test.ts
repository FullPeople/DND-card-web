import {it,expect} from 'vitest';
import {newCharacter} from '../src/core/model';
import {readCharacter,storedImage,validateCharacter} from '../src/core/validation';
// 玩家反馈的现场：绑定棋子的角色把棋子图片 URL 当成头像存进角色，之后整张卡读不出来。
const tokenUrl='https://assets.example.com/token-portrait.png';
const webp='data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=';
it('只把有界的图片 data URL 当成已存的头像，棋子图片地址不是头像数据',()=>{
 const valid={data:webp,x:0,y:0,zoom:1,frameWidth:104,frameHeight:110};
 expect(storedImage(valid)).toBe(true);
 expect(storedImage({data:webp,x:-300,y:300,zoom:5})).toBe(true);
 for(const broken of [{data:tokenUrl,x:0,y:0,zoom:1},{data:'javascript:bad',x:0,y:0,zoom:1},{data:`data:image/svg+xml;base64,${'A'.repeat(20)}`,x:0,y:0,zoom:1},{data:`data:image/webp;base64,${'A'.repeat(650001)}`,x:0,y:0,zoom:1},{data:webp,x:0,y:0,zoom:1,frameWidth:0},{data:webp,x:301,y:0,zoom:1},{data:webp,x:0,y:0,zoom:6},undefined])expect(storedImage(broken)).toBe(false);
});
it('读不出来的头像或立绘只丢弃自己，角色其余内容照常打开',()=>{
 const c=newCharacter();c.name='绑定棋子英雄';c.runtime.hp=7;
 const damaged={...c,portrait:{data:tokenUrl,x:0,y:0,zoom:1},illustration:{data:webp,x:0,y:0,zoom:2}};
 expect(()=>validateCharacter(damaged)).toThrow('头像数据无效。');
 const read=readCharacter(damaged);
 expect(read.repaired).toEqual(['头像']);
 expect(read.character.portrait).toBeUndefined();
 expect(read.character.illustration).toEqual({data:webp,x:0,y:0,zoom:2});
 expect(read.character.name).toBe('绑定棋子英雄');expect(read.character.runtime.hp).toBe(7);
 expect(validateCharacter(read.character)).toEqual(read.character);
 expect(readCharacter(read.character).repaired).toEqual([]);
 expect(readCharacter({character:{...c,illustration:{data:tokenUrl,x:0,y:0,zoom:1}}}).repaired).toEqual(['立绘']);
});
it('图片以外的损坏仍然拒绝打开，不会被静默吞掉',()=>{
 const c=newCharacter();
 expect(()=>readCharacter({...c,portrait:{data:tokenUrl,x:0,y:0,zoom:1},abilities:{...c.abilities,str:0}})).toThrow();
 expect(()=>readCharacter({...c,schemaVersion:2})).toThrow('不支持的角色格式版本');
});
