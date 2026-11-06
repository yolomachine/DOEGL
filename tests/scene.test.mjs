import test from 'node:test';
import assert from 'node:assert/strict';
import {Garden,walkable} from '../dist/simulation.js';
import {createSceneLayout,sceneDepthOrder} from '../dist/scene-layout.js';

for(const [w,h]of [[1120,780],[1540,780],[1120,1093],[420,909],[615,820],[462,820]])test(`one continuous ${w}×${h} world keeps the whole cast moving and celebrating`,()=>{
  const layout=createSceneLayout(w,h),g=new Garden(912);g.setLayout(layout);
  for(let i=0;i<4800;i++){g.update(.1);for(const a of g.agents)assert.ok(walkable(a.x,a.y,layout),`${a.name} entered ${a.x},${a.y} at ${g.time}`);}
  assert.ok(g.totalCelebrations>=2,`${g.totalCelebrations} cycles, ${g.totalOfferings} gifts, progress ${g.progress}`);
  for(const a of g.agents)assert.ok(a.completed>8,`${a.name} stalled`);for(const s of g.shrines)assert.ok(s.deliveries>0,`${s.name} got no gifts`);
  const visible=l=>l.x>=0&&l.x<=w&&l.y>=0&&l.y<=h;for(const p of layout.props)assert.ok(visible(p),`${p.id} is offscreen`);
});

test('bunny jump height cannot change its side of either fence rail',()=>{
  const layout=createSceneLayout(420,909),g=new Garden(41);g.setLayout(layout);
  for(let i=0;i<1000;i++){
    if(i===400)g.completedAt=g.time;g.update(.05);
    const entries=sceneDepthOrder([{id:'back',depth:layout.pen.y},{id:'front',depth:layout.pen.y+layout.pen.h},...g.life.bunnies.map(b=>({id:'bunny-'+b.id,depth:b.y}))]);
    assert.equal(entries[0].id,'back');assert.equal(entries.at(-1).id,'front');
  }
});

test('resize preserves progress and carried items while giving new legal destinations',()=>{
  const g=new Garden(22);g.setLayout(createSceneLayout(1540,780));for(let i=0;i<500;i++)g.update(.1);
  const state={progress:[...g.progress],carry:g.agents.map(a=>a.carry),round:g.round,offerings:g.totalOfferings};
  const layout=createSceneLayout(420,909);g.setLayout(layout);assert.deepEqual({progress:g.progress,carry:g.agents.map(a=>a.carry),round:g.round,offerings:g.totalOfferings},state);
  for(const a of g.agents)assert.ok(walkable(a.x,a.y,layout));
});
