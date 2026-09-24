import {describe,it,expect} from 'vitest';
import {homebrewPaths,homebrewBody,homebrewMetadata} from '../src/data/homebrew';
import {normalizeData} from '../src/data/catalog';

describe('third-party catalog channel',()=>{
 it('deduplicates aliased collections and rejects paths escaping the configured origin',()=>{
  expect(homebrewPaths({One:'collection/Author; Book.json',Two:'collection/Author; Book.json',bad:'../outside.json',url:'https://foreign/x.json',root:'/x.json',query:'x.json?callback=x',normal:'class/测试.json'})).toEqual(['collection/Author; Book.json','class/测试.json']);
 });
 it('uses book-level edition and Chinese names while retaining class ownership and physical fields',()=>{
  const body={_meta:{edition:'one',sources:[{json:'Workshop',full:'工坊三方书',dateReleased:'2025-06-10'}]},class:[{name:'测试职业',source:'Workshop',entries:['本文']}],subclass:[{name:'测试子职',source:'Workshop',className:'测试职业',classSource:'Workshop',entries:['子职正文']}],spell:[{name:'测试法术',source:'Workshop',level:2}],baseitem:[{name:'测试装备',source:'Workshop',weight:2.5,value:700}],feat:[{name:'旧版专长',source:'Workshop',edition:'classic'}]};
  const entries=normalizeData(homebrewBody(body),'rev','kiwee-homebrew');
  expect(entries).toHaveLength(5);expect(entries.find(e=>e.kind==='class')?.edition).toBe('2024');expect(entries.find(e=>e.kind==='feat')?.edition).toBe('2014');expect(entries.find(e=>e.kind==='subclass')?.raw.classSource).toBe('Workshop');expect(entries.find(e=>e.kind==='item')?.raw.weight).toBe(2.5);expect(homebrewMetadata(body)).toEqual({WORKSHOP:{name:'工坊三方书',date:'2025-06-10'}});
 });
});
