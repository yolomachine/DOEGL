import test from 'node:test';
import assert from 'node:assert/strict';
import {Garden,walkable} from '../dist/simulation.js';
import {DialogueQueue} from '../dist/dialogue.js';
import {BAYER,DITHER_PATTERNS,ditherPattern,patternThreshold} from '../dist/dither.js';
import {createSceneLayout,sceneDepthOrder} from '../dist/scene-layout.js';

test('new speech cannot replace a readable bubble, even from the same speaker',()=>{
  const q=new DialogueQueue();q.enqueue('agent',{ownerId:0,owner:'Pip',text:'A hopeful thought'},0);
  const original=q.visible('agent',1);
  for(let t=1;t<10;t+=.25){q.enqueue('agent',{ownerId:t%3,owner:'Someone',text:`New message ${t}`},t);q.update(t);assert.equal(q.visible('agent',t).id,original.id);assert.equal(q.visible('agent',t).text,original.text);assert.equal(q.visible('agent',t).alpha,1);}
  assert.ok(q.channels.agent.pending.length<=3);
  assert.equal(q.visible('agent',10.5).alpha,.5);
  q.update(11);const next=q.visible('agent',11);assert.notEqual(next.id,original.id);assert.equal(next.alpha,0);assert.ok(Math.abs(q.visible('agent',11.35).alpha-1)<1e-9);
});

test('god and helper speech use independent protected reading windows',()=>{
  const q=new DialogueQueue();q.enqueue('god',{ownerId:'cthulhu',text:'A rather long and encouraging thought about your wonderful Swedish exam and all the courage you already possess'},0);
  q.enqueue('agent',{ownerId:2,text:'Hej!'},2);const god=q.visible('god',2);
  q.enqueue('god',{ownerId:'hastur',text:'New!'},3);q.update(11);
  assert.equal(q.visible('god',11).id,god.id);assert.ok(god.duration>10);assert.equal(q.visible('agent',11).text,'Hej!');
});

test('twelve helpers never enter solid scenery, including pedestal corners and bench',()=>{
  for(const seed of [1,42,912]){
    const g=new Garden(seed);assert.equal(g.agents.length,12);
    for(let i=0;i<180*20;i++){
      g.update(.05);
      for(const a of g.agents)assert.ok(walkable(a.x,a.y),`${seed}: ${a.name} inside scenery at ${a.x},${a.y}, time ${g.time}`);
    }
    for(const a of g.agents)assert.ok(a.completed>2,`${a.name} never joined in`);
  }
});

test('completion interrupts work for a whole-cast dance, then resumes autonomous play',()=>{
  const g=new Garden(72);while(g.completedAt===null&&g.time<180)g.update(.025);
  assert.notEqual(g.completedAt,null);g.update(.025);const positions=g.agents.map(a=>[a.x,a.y]);
  for(let i=0;i<100;i++)g.update(.1);
  for(const a of g.agents){assert.equal(a.state,'dancing');assert.equal(a.task,null);assert.equal(a.carry,null);assert.equal(a.path.length,0);}
  assert.deepEqual(g.agents.map(a=>[a.x,a.y]),positions);assert.equal(g.life.sun.expression,'laugh');assert.ok(g.life.bunnies.every(b=>b.state==='binky'));
  for(let i=0;i<200;i++)g.update(.1);
  assert.equal(g.round,2);assert.ok(g.agents.some(a=>a.state==='walking'||a.state==='working'));assert.equal(g.bunniesHarmed,0);
});

test('bunnies explore and vary activities while the sun changes mood and gaze',()=>{
  const g=new Garden(835),states=new Set(),moods=new Set(),looks=new Set();
  const start=g.life.bunnies.map(b=>[b.x,b.y]);
  for(let i=0;i<1200;i++){g.time+=.1;g.life.update(.1,g);for(const b of g.life.bunnies){states.add(b.state);assert.ok(b.x>=738&&b.x<=818&&b.y>=377&&b.y<=404);}moods.add(g.life.sun.expression);looks.add(Math.round(g.life.sun.gazeX*10));}
  assert.notDeepEqual(g.life.bunnies.map(b=>[b.x,b.y]),start);assert.ok(states.size>=5);assert.ok(moods.size>=4);assert.ok(looks.size>8);
});

test('depth order puts a helper behind and in front of each pedestal and the bench',()=>{
  for(const layout of [createSceneLayout(1120,780),createSceneLayout(420,909)])for(const prop of layout.props.filter(p=>['cthulhu','hastur','yog','bench'].includes(p.id))){
    const entries=sceneDepthOrder([{id:prop.id,depth:prop.y},{id:'behind',depth:prop.y-5},{id:'front',depth:prop.y+5}]);
    assert.deepEqual(entries.map(e=>e.id),['behind',prop.id,'front']);
  }
});

test('all six texture fields are distinct, stable and bounded',()=>{
  assert.equal(DITHER_PATTERNS.length,6);const images=new Set();
  for(const pattern of DITHER_PATTERNS){
    const preview=[];
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){
      const threshold=patternThreshold(pattern,x,y);assert.ok(threshold>=0&&threshold<16);
      assert.equal(patternThreshold(pattern,x+pattern.size,y+pattern.size),threshold);
      preview.push(threshold);
    }
    images.add(preview.join(','));
    if(pattern.id!=='bayer')assert.ok(Math.abs(pattern.data.reduce((a,b)=>a+b,0)/pattern.data.length-128)<=.5,'new textures should not introduce a brightness bias');
  }
  assert.equal(images.size,6);assert.equal(ditherPattern('missing').id,'bayer');
  for(let i=0;i<16;i++)assert.equal(patternThreshold(ditherPattern('bayer'),i%4,Math.floor(i/4)),BAYER[i]);
});
