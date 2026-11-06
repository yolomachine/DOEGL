import test from 'node:test';
import assert from 'node:assert/strict';
import {Garden,walkable} from '../dist/simulation.js';
import {createSceneLayout} from '../dist/scene-layout.js';

test('every intended bench rest point is clear and inside the garden',()=>{
  for(const [w,h]of [[1120,780],[1540,780],[1120,1093],[420,909]]){
    const l=createSceneLayout(w,h);for(const p of l.rest)assert.ok(walkable(p.x,p.y,l),`Illegal bench destination ${w}×${h}: ${JSON.stringify(p)}`);
  }
});

test('a neighbour cannot push a napping rabbit',()=>{
  const g=new Garden(32);g.setLayout(createSceneLayout(420,909));const [a,b,c]=g.life.bunnies;
  Object.assign(a,{state:'napping',until:100});Object.assign(b,{x:a.x+g.life.spacing()+1,y:a.y,targetX:a.x,targetY:a.y,state:'hopping',until:100});Object.assign(c,{state:'napping',until:100});
  const fixed={x:a.x,y:a.y};for(let i=0;i<100;i++){g.time+=.025;g.life.update(.025,g);assert.deepEqual({x:a.x,y:a.y},fixed);}
});

test('bunnies keep personal space without crossing or displacement forces',()=>{
  for(const [w,h]of [[1120,780],[420,909]]){
    const g=new Garden(31);g.setLayout(createSceneLayout(w,h));const states=new Set();let distance=0;
    for(let i=0;i<4800;i++){
      const before=g.life.bunnies.map(b=>({...b}));g.time+=.05;if(i===1000)g.completedAt=g.time;if(i===1500)g.completedAt=null;g.life.update(.05,g);
      for(const b of g.life.bunnies){const a=before[b.id];states.add(b.state);distance+=Math.hypot(b.x-a.x,b.y-a.y);if(['napping','munching','grooming'].includes(a.state)&&g.time<a.until&&g.completedAt===null)assert.deepEqual([b.x,b.y],[a.x,a.y]);}
      for(let a=0;a<3;a++)for(let b=a+1;b<3;b++){const p=g.life.bunnies[a],q=g.life.bunnies[b];assert.ok(Math.hypot(p.x-q.x,(p.y-q.y)*1.15)>=g.life.spacing()-1e-8);}
    }
    assert.ok(distance>100,'The rabbits should still explore');assert.ok(states.size>=5,'Activities should still vary');
  }
});

test('helpers consume travel distance across short grid waypoints',()=>{
  const g=new Garden(1),a=g.agents[0];g.agents=[a];a.pace=100;a.carry=null;a.state='walking';a.x=400;a.y=400;a.path=[{x:408,y:400},{x:416,y:400},{x:424,y:400},{x:432,y:400}];a.task={type:'wonder',duration:3};g.update(.2);assert.equal(a.x,420);assert.equal(a.y,400);
});
