import test from 'node:test';
import assert from 'node:assert/strict';
import {MaterialShader,MATERIAL_LIMITS,normalizeLighting} from '../dist/material-shader.js';

test('lighting inputs cannot produce an unbounded or degenerate beam',()=>{
  const normal=normalizeLighting({x:400,y:80,r:30},{targetX:100,targetY:480,width:150,power:1});
  assert.equal(normal.length,500);assert.deepEqual(normal.direction,[-.6,.8]);assert.equal(normal.width,150);
  assert.equal(normal.power,.25);assert.equal(MATERIAL_LIMITS.maxLightOpacity,.25);
  assert.equal(normalizeLighting({x:20,y:20,r:30},{targetX:20,targetY:20,power:.2}).power,0);
  assert.equal(normalizeLighting({x:20,y:20,r:30},{targetX:25,targetY:25,power:.2}).power,0);
  const invalid=normalizeLighting({x:NaN,y:Infinity,r:-10},{targetX:NaN,targetY:Infinity,width:-200,power:-3,pixelSize:0});
  for(const value of [...invalid.moon,...invalid.direction,invalid.length,invalid.width,invalid.power,invalid.pixelSize])assert.ok(Number.isFinite(value));
  assert.equal(invalid.power,0);assert.ok(invalid.width>=1);assert.equal(invalid.pixelSize,1);
});

test('an unavailable graphics context preserves the scene instead of applying a misleading global filter',()=>{
  const saved=globalThis.document;
  globalThis.document={createElement:()=>({width:0,height:0,addEventListener(){},getContext(){return null;}})};
  try{
    const shader=new MaterialShader(),scene={width:390,height:844},surfaces={width:390,height:844};
    assert.equal(shader.backend,'unavailable');assert.match(shader.error,/WebGL is unavailable/);
    assert.equal(shader.render({scene,surfaces,settings:{objects:{strength:1},foliage:{strength:1},light:{strength:1}}}),scene);
  }finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
});
