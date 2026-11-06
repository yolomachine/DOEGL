import test from 'node:test';
import assert from 'node:assert/strict';
import {Garden,findPath,walkable} from '../dist/simulation.js';

function advance(g,seconds){for(let i=0;i<seconds*10;i++)g.update(.1);}
test('different seeds produce different choices, and a seed is reproducible',()=>{
  const a=new Garden(41),b=new Garden(41),c=new Garden(99);
  advance(a,60);advance(b,60);advance(c,60);
  const state=g=>g.agents.map(a=>[a.x,a.y,a.task?.type,a.carry,a.completed]);
  assert.deepEqual(state(a),state(b));assert.notDeepEqual(state(a),state(c));
});
test('the autonomous simulation completes and keeps running across a range of worlds',()=>{
  for(const seed of [1,2,7,42,570,912,10001,728839]){
    const g=new Garden(seed);advance(g,900);
    assert.ok(g.totalCelebrations>=2,`seed ${seed}: only ${g.totalCelebrations} celebrations`);
    assert.ok(g.round>=3);assert.equal(g.bunniesHarmed,0);
    assert.ok(g.totalOfferings>50);assert.ok(g.events.length<=30);
    for(const s of Object.values(g.sources))assert.ok(s.stock>=0&&s.stock<=7);
    for(const p of g.progress)assert.ok(p>=0&&p<=100);
    for(const a of g.agents){assert.ok(a.completed>8,`${a.name} stalled`);assert.ok(a.energy>=0&&a.energy<=100);assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));}
  }
});
test('agents respond to needs rather than following a fixed animation',()=>{
  const g=new Garden(543);const a=g.agents[0];a.energy=10;g.choose(a);assert.equal(a.task.type,'rest');
  a.carry='bits';g.choose(a);assert.equal(a.task.type,'offer');
  a.carry=null;a.energy=99;for(const s of Object.values(g.sources))s.stock=0;
  g.choose(a);assert.notEqual(a.task.type,'gather');
});
test('faster helpers deliver promptly and use all three offering places',()=>{
  for(const seed of [1,42,570,912]){
    const g=new Garden(seed);while(!g.totalOfferings&&g.time<20)g.update(.025);
    assert.ok(g.totalOfferings>0,`seed ${seed}: no early offering`);
    advance(g,180);assert.ok(g.totalCelebrations>0,`seed ${seed}: first cycle stalled`);
    for(const shrine of g.shrines)assert.ok(shrine.deliveries>0,`${shrine.name} received no gifts`);
  }
});
test('navigation goes around the altar and never routes through the bunny sanctuary',()=>{
  const path=findPath({x:680,y:390},{x:820,y:450});assert.ok(path.length>3);
  for(const p of path)assert.ok(walkable(p.x,p.y),`blocked path at ${p.x}, ${p.y}`);
  const shrine=findPath({x:390,y:280},{x:570,y:280});assert.ok(shrine.length>4);
  for(const p of shrine)assert.ok(walkable(p.x,p.y));
});
