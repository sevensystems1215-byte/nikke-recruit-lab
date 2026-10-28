import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHARACTERS,SNAPSHOT} from '../dist/data.js';
import {PORTRAITS} from '../dist/portraits.js';

test('every character in the current 127-character snapshot has a bundled official portrait',()=>{
  const chars=CHARACTERS.filter(c=>c.since<=SNAPSHOT);
  assert.equal(chars.length,127);assert.equal(Object.keys(PORTRAITS).length,127);
  for(const char of chars){
    const portrait=PORTRAITS[char.id];assert.ok(portrait,char.name);
    assert.ok(portrait.src.startsWith('assets/characters/'));
    const bytes=readFileSync(new URL('../dist/'+portrait.src,import.meta.url));
    const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg=bytes[0]===255&&bytes[1]===216;
    assert.ok(png||jpeg,`${char.name}: valid image format`);
    assert.match(portrait.backgroundSize,/^\d+(\.\d+)?% auto$/);
    assert.match(portrait.backgroundPosition,/^\d+(\.\d+)?% \d+(\.\d+)?%$/);
    assert.ok(portrait.source.startsWith('https://'));
  }
});
