import {DialogueQueue} from './dialogue.js';
import {GardenLife} from './life.js';
export const SKILLS = [
  {id:'reading',sv:'Läsa',en:'reading',color:'#8d9e78'},
  {id:'listening',sv:'Lyssna',en:'listening',color:'#c5a05d'},
  {id:'writing',sv:'Skriva',en:'writing',color:'#a494b5'},
  {id:'speaking',sv:'Tala',en:'speaking',color:'#c98e7b'}
];
export const SOURCES = {
  bits:{x:205,y:378,color:'#aee5cc',label:'spare bits',gather:'Collecting spare bits',offer:['an unused semicolon','a perfectly round byte','a tiny backup of hope','three ethically sourced zeros','a very brave little pixel']},
  vowels:{x:264,y:307,color:'#d4b0e7',label:'glowing vowels',gather:'Finding a glowing vowel',offer:['a freshly polished ö','a particularly confident å','an ä with excellent posture','a pocket-sized hej','a gently glowing vowel']},
  buns:{x:702,y:316,color:'#edbd76',label:'pixel buns',gather:'Baking a pixel cinnamon bun',offer:['a pixel cinnamon bun','a warm cloud of cardamom','one extremely digital pastry','a cinnamon-scented algorithm','a bun baked with extra belief']}
};
const CREW = [
  {name:'Pip',role:'the optimist',color:'#abd7b3',dark:'#5f997f',favorite:'bits',social:.8,curiosity:.7,care:.7,pace:30},
  {name:'Miso',role:'the tiny mystic',color:'#e4a4aa',dark:'#b26f8c',favorite:'vowels',social:.9,curiosity:.85,care:.5,pace:26},
  {name:'Byte',role:'the overthinker',color:'#9dc6db',dark:'#638da8',favorite:'bits',social:.35,curiosity:.95,care:.85,pace:31},
  {name:'Lumi',role:'the cheerleader',color:'#ecda8c',dark:'#b5a568',favorite:'buns',social:1,curiosity:.4,care:1,pace:28},
  {name:'Nori',role:'the daydreamer',color:'#bcb0da',dark:'#9183b7',favorite:'vowels',social:.6,curiosity:1,care:.7,pace:25},
  {name:'Bo',role:'head of fika',color:'#e5b18a',dark:'#b78663',favorite:'buns',social:.8,curiosity:.5,care:.85,pace:29},
  {name:'Ada',role:'the kind compiler',color:'#ed9f88',dark:'#a95b67',favorite:'bits',social:.6,curiosity:.9,care:.7,pace:31},
  {name:'Rune',role:'the vowel whisperer',color:'#a3d5cd',dark:'#518e8d',favorite:'vowels',social:.75,curiosity:.8,care:.6,pace:28},
  {name:'Kiki',role:'chief sparkle officer',color:'#dbafd9',dark:'#a16ea6',favorite:'buns',social:1,curiosity:.7,care:.8,pace:30},
  {name:'Mochi',role:'the bun enthusiast',color:'#efd1a6',dark:'#b99a68',favorite:'buns',social:.9,curiosity:.4,care:1,pace:27},
  {name:'Tova',role:'the gentle debugger',color:'#a9c6ec',dark:'#708eb7',favorite:'bits',social:.5,curiosity:1,care:.9,pace:32},
  {name:'Sven',role:'the lagom expert',color:'#c9d69f',dark:'#899d66',favorite:'vowels',social:.8,curiosity:.6,care:.9,pace:29}
];
export const SHRINES=[
  {id:'hastur',name:'Hastur',title:'Midsommar in Yellow',x:350,y:274,favorite:'vowels',skills:[1,3],color:'#ffe18b',spots:[{x:322,y:337},{x:350,y:344},{x:379,y:337}],lines:['The King in Yellow approves your ö.','Midsommar is eternal. So is my flower crown.','Your vowels shine beyond Carcosa.']},
  {id:'cthulhu',name:'Cthulhu',title:'The Fika Dreamer',x:480,y:244,favorite:'bits',skills:[0,2],color:'#b4ead3',spots:[{x:443,y:350},{x:480,y:359},{x:517,y:350}],lines:['Ph’nglui… but first, fika.','Even R’lyeh believes in you.','I woke from eternal slumber. For cinnamon buns.']},
  {id:'yog',name:'Yog-Sothoth',title:'Lagom beyond space',x:615,y:274,favorite:'buns',skills:[2,3],color:'#d8b5ff',spots:[{x:585,y:337},{x:615,y:344},{x:645,y:337}],lines:['All of space. All of time. One perfect fika.','I have seen every timeline. You are brave in all of them.','Beyond infinity, there is a very small ö.']}
];
// Solid footprints include the pedestal corners and clearance for little feet.
export const SOLIDS=[
  {id:'main-pedestal',x:412,y:264,w:136,h:67},
  {id:'left-pedestal',x:312,y:256,w:76,h:61},
  {id:'right-pedestal',x:577,y:256,w:76,h:61},
  {id:'archive',x:228,y:246,w:69,h:47},
  {id:'bakery',x:653,y:243,w:96,h:55},
  {id:'bench',x:615,y:392,w:76,h:32},
  {id:'sanctuary',x:722,y:365,w:116,h:61},
  {id:'pole',x:187,y:427,w:12,h:16},
  {id:'horse',x:278,y:430,w:33,h:24}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function randomGenerator(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function walkable(x,y,layout){const b=layout?.bounds||{left:130,right:845,top:239,bottom:461},padding=layout?.clearance??6;return x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom&&!(layout?.solids||SOLIDS).some(o=>x>o.x-padding&&x<o.x+o.w+padding&&y>o.y-padding&&y<o.y+o.h+padding);}
// A small navigation grid keeps intentions independent of scene animation.
export function findPath(from,to,layout){
  const isOpen=(x,y)=>walkable(x,y,layout);
  if(!isOpen(to.x,to.y))return [];
  const step=8, start={x:Math.round(from.x/step),y:Math.round(from.y/step)},end={x:Math.round(to.x/step),y:Math.round(to.y/step)};
  if(!isOpen(end.x*step,end.y*step))return [];
  const key=n=>`${n.x},${n.y}`, startKey=key(start), endKey=key(end);
  const open=[{...start,g:0,f:0}], seen=new Map([[startKey,0]]),parents=new Map();
  let found;
  while(open.length){
    open.sort((a,b)=>a.f-b.f);const cur=open.shift(),ck=key(cur);
    if(ck===endKey){found=cur;break;}
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const n={x:cur.x+dx,y:cur.y+dy};const nk=key(n);
      if(!isOpen(n.x*step,n.y*step))continue;
      if(dx&&dy&&(!isOpen((cur.x+dx)*step,cur.y*step)||!isOpen(cur.x*step,(cur.y+dy)*step)))continue;
      const g=cur.g+Math.hypot(dx,dy);
      if(seen.has(nk)&&seen.get(nk)<=g)continue;
      seen.set(nk,g);parents.set(nk,ck);open.push({...n,g,f:g+Math.hypot(n.x-end.x,n.y-end.y)});
    }
  }
  if(!found)return [];
  const path=[{...to}];let k=endKey;
  while(k!==startKey){const[x,y]=k.split(',').map(Number);path.unshift({x:x*step,y:y*step});k=parents.get(k);if(!k)break;}
  return path;
}

export class Garden{
  constructor(seed=Date.now()){
    this.seed=seed;this.random=randomGenerator(seed);this.time=0;this.round=1;this.offerings=0;this.totalOfferings=0;this.progress=[0,0,0,0];this.events=[];this.effects=[];this.completedAt=null;this.lastCelebration=null;this.totalCelebrations=0;this.nextOmen=20+this.random()*18;this.omen=null;this.omenUntil=0;this.lastRoundAt=0;this.bunniesHarmed=0;
    this.sources=Object.fromEntries(Object.keys(SOURCES).map(k=>[k,{stock:6,regen:0}]));
    this.dialogue=new DialogueQueue();this.life=new GardenLife(randomGenerator(seed^0xabe17));this.celebrationStarted=false;
    this.shrines=SHRINES.map(s=>({...s,deliveries:0,lastGift:-100}));
    this.agents=CREW.map((a,i)=>({...a,pace:a.pace*2.5,id:i,x:318+i%6*47,y:375+Math.floor(i/6)*25,energy:65+this.random()*30,carry:null,task:null,path:[],state:'thinking',until:.15+i*.2,activity:'Considering something helpful',memory:[],decisions:0,completed:0,skills:0,phase:this.random()*6.28,face:1}));
    this.log('Twelve small agents believe in you. The void brought snacks.','heart');
    this.log('Cthulhu, Hastur & Yog-Sothoth have arrived for Swedish exam fika.','god');
    this.dialogue.enqueue('god',{ownerId:'cthulhu',owner:'Cthulhu',text:'Eternal slumber can wait. You have a Swedish exam.'},0);
  }
  pick(list){return list[Math.floor(this.random()*list.length)];}
  setLayout(layout){
    if(this.layout===layout)return;
    this.layout=layout;this.effects=[];
    for(const shrine of this.shrines){const positions=layout.shrines[shrine.id];Object.assign(shrine,positions,{spots:positions.spots.map(p=>this.safePoint(p))});}
    for(const a of this.agents){const [x,y]=layout.starts[a.id];Object.assign(a,this.safePoint({x,y}),{task:null,path:[],state:this.completedAt===null?'thinking':'dancing',until:this.time+.15+a.id*.12});}
    this.life.setBounds(layout.rabbits);
  }
  safePoint(point){
    if(!this.layout)return point;
    // Snap task destinations to the same clear cells used by navigation.
    const x=Math.round(point.x/8)*8,y=Math.round(point.y/8)*8;
    for(let r=0;r<=112;r+=8)for(let dx=-r;dx<=r;dx+=8)for(const dy of r===0?[0]:[-r,r])if(walkable(x+dx,y+dy,this.layout))return{x:x+dx,y:y+dy};
    return {x:this.layout.starts[0][0],y:this.layout.starts[0][1]};
  }
  areaPoint(area){return this.safePoint({x:area.x+this.random()*area.w,y:area.y+this.random()*area.h});}
  restPoint(a){return this.layout?this.safePoint(this.layout.rest[a.id%this.layout.rest.length]):{x:623+a.id%3*25,y:438};}
  log(text,kind='note'){this.events.unshift({id:`${this.time}-${this.random()}`,text,kind,time:this.time});this.events.length=Math.min(this.events.length,30);if(kind==='note'||kind==='bunny'){const a=this.agents?.find(a=>text.startsWith(a.name+' '));if(a)this.say(a,text.slice(a.name.length+1));}}
  say(a,text){this.dialogue.enqueue('agent',{ownerId:a.id,owner:a.name,text},this.time);}
  get overall(){return this.progress.reduce((a,b)=>a+b,0)/4;}
  get daylight(){return this.completedAt!==null?1:clamp(this.overall/100,0,1);}
  weighted(items){const sum=items.reduce((s,a)=>s+a.weight,0);let value=this.random()*sum;return items.find(a=>(value-=a.weight)<=0)||items.at(-1);}
  weakest(){const low=Math.min(...this.progress);return this.weighted(this.progress.map((p,i)=>({id:i,weight:.1+(100-p)+(p===low?30:0)}))).id;}
  choose(a){
    a.decisions++;
    if(a.carry){
      const skill=this.weakest();
      const free=this.shrines.filter(s=>s.spots.some(spot=>!this.agents.some(other=>other.id!==a.id&&other.task?.type==='offer'&&other.task.target.x===spot.x)));
      if(!free.length){this.assign(a,{type:'wait',target:this.layout?this.areaPoint(this.layout.wait):{x:385+a.id%4*30,y:385+Math.floor(a.id/4)*10},duration:1.5,activity:'Waiting politely with a tiny offering'});return;}
      const shrine=this.weighted(free.map(s=>({shrine:s,weight:(s.favorite===a.carry?4:1.2)*(s.skills.includes(skill)?1.5:1)/(1+this.agents.filter(other=>other.task?.shrine===s.id).length*.7)}))).shrine;
      const available=shrine.spots.filter(spot=>!this.agents.some(other=>other.id!==a.id&&other.task?.type==='offer'&&other.task.target.x===spot.x));
      this.assign(a,{type:'offer',shrine:shrine.id,target:this.pick(available.length?available:shrine.spots),duration:1.6+this.random(),activity:`Taking ${SOURCES[a.carry].label} to ${shrine.name}`,skill});return;
    }
    if(a.energy<23){this.assign(a,{type:'rest',target:this.restPoint(a),duration:9+this.random()*6,activity:'Taking a well-earned fika break'});return;}
    const performing=this.agents.filter(other=>other.id!==a.id&&other.task?.type==='offer');
    const candidates=[];
    for(const[source,data]of Object.entries(SOURCES)){
      const available=this.sources[source].stock;
      const assigned=this.agents.filter(other=>other.task?.source===source).length;
      if(available>assigned){
        const location=this.layout?.sources[source]||data,distance=Math.hypot(a.x-location.x,a.y-location.y);
        const novelty=a.memory.slice(-2).includes(source)?.5:1.3;
        const demand=this.omen===source?1.7:1;
        candidates.push({type:'gather',source,target:this.safePoint({x:location.x+this.random()*24-12,y:location.y+this.random()*10}),duration:source==='buns'?1.7:.8+this.random()*.6,activity:data.gather,weight:(source===a.favorite?4.5:2.1)*novelty*demand/(1+distance/550)});
      }
    }
    if(performing.length&&this.agents.filter(a=>a.task?.type==='help').length<2){const friend=this.pick(performing);candidates.push({type:'help',shrine:friend.task.shrine,target:{x:friend.task.target.x+this.random()*12-6,y:friend.task.target.y+25},duration:3+this.random()*2,activity:'Lending a friend some courage',weight:a.social*1.3});}
    if(a.energy<65)candidates.push({type:'rest',target:this.restPoint(a),duration:10,activity:'Recharging over imaginary coffee',weight:(65-a.energy)/14});
    candidates.push({type:'bunny',target:this.layout?this.layout.bunnyVisit:{x:707,y:390+this.random()*20},duration:4+this.random()*4,activity:'Checking that the bunnies are happy',weight:a.care*.3});
    candidates.push({type:'wonder',target:this.layout?this.areaPoint(this.layout.wander):{x:340+this.random()*240,y:398+this.random()*38},duration:3+this.random()*4,activity:'Having a small, hopeful thought',weight:a.curiosity*.42});
    this.assign(a,this.weighted(candidates));
  }
  assign(a,task){task={...task,target:this.safePoint(task.target)};a.task=task;a.activity=task.activity;a.path=findPath(a,task.target,this.layout);a.state='walking';if(!a.path.length){a.task=null;a.state='thinking';a.until=this.time+1;}}
  arrive(a){a.state='working';a.until=this.time+a.task.duration;const type=a.task.type;if(type==='offer')this.say(a,this.pick(['for her!','lycka till!','accept these bits','tiny offering!','heja dig!','with love <3']));if(type==='rest')this.say(a,this.pick(['fika?','aaand breathe','coffee.exe','a tiny break']));if(type==='bunny')this.say(a,this.pick(['all buns safe!','hello, friend','zero harm <3']));if(type==='help')this.say(a,this.pick(['we got this!','I believe in her','team tiny!']));}
  finish(a){
    const t=a.task;if(!t)return;
    a.completed++;
    if(t.type==='gather'){
      const source=this.sources[t.source];
      if(source.stock>=1){source.stock--;a.carry=t.source;a.memory.push(t.source);if(a.memory.length>8)a.memory.shift();a.energy-=3;this.say(a,this.pick(['found a good one!','this will help','perfect!','ooh, shiny']),2.8);}
      else{this.say(a,'I’ll try another',2);a.activity='Reconsidering the supply situation';}
    }else if(t.type==='offer'){
      const item=a.carry;if(item){
        const shrine=this.shrines.find(s=>s.id===t.shrine);
        const active=this.agents.filter(b=>b.task?.type==='help'&&b.task.shrine===t.shrine&&b.state==='working').length;
        const gain=(7+this.random()*5)*(1+active*.2)*(this.omen===item?1.35:1)*(shrine.favorite===item?1.12:1);
        const skill=this.progress[t.skill]>=99.9?this.weakest():t.skill;
        this.progress[skill]=Math.min(100,this.progress[skill]+gain);
        // A little shared confidence also reaches the other parts of the exam.
        this.progress=this.progress.map((v,i)=>i===skill?v:Math.min(100,v+gain*.14));
        a.skills+=gain;a.energy-=6;this.offerings++;this.totalOfferings++;a.carry=null;
        shrine.deliveries++;shrine.lastGift=this.time;const blessing=this.pick(shrine.lines);
        this.dialogue.enqueue('god',{ownerId:shrine.id,owner:shrine.name,text:blessing},this.time);
        this.effects.push({kind:'heart',x:shrine.x,y:shrine.y-35,color:'#ff729e',start:this.time,life:4});
        this.effects.push({kind:'offering',x:a.x,y:a.y-20,target:{x:shrine.x,y:shrine.y},color:SOURCES[item].color,start:this.time,life:2.4,item,shrine:shrine.id,gain,skill});
        this.log(`${a.name} → ${shrine.name}: ${this.pick(SOURCES[item].offer)}. +${Math.round(gain)} ${SKILLS[skill].en} courage!`, 'offering');
        if(this.overall>=99.999&&this.completedAt===null){this.completedAt=this.time;this.lastCelebration=this.time;this.totalCelebrations++;this.log('Du klarar det! A whole tiny universe is rooting for you.','celebration');for(const friend of this.agents)this.say(friend,this.pick(['HEJA DIG!','you’ve got this!','<3','rainbow time!']),7);}
      }
    }else if(t.type==='rest'){a.energy=Math.min(100,a.energy+55);if(this.random()<.45)this.log(`${a.name} remembered that even tiny heroes deserve a fika break.`);}
    else if(t.type==='help'){a.energy-=2;this.effects.push({kind:'heart',x:a.x,y:a.y-20,color:'#ff729e',start:this.time,life:4});}
    else if(t.type==='bunny'){a.energy=Math.min(100,a.energy+9);this.log(`${a.name} checked on the bunnies. All three are having an excellent day.`,'bunny');}
    else if(t.type==='wonder'){a.energy=Math.min(100,a.energy+4);if(this.random()<.5)this.log(this.pick([`${a.name} is pretty sure “lagom” is a state of mind.`,`${a.name} sent one very quiet “you’ve got this” into the universe.`,`${a.name} wondered if the ancient one would like a little hat.`,`${a.name} practiced saying “hej” to a mushroom. The mushroom was supportive.`]));}
    a.task=null;a.state='thinking';a.until=this.time+.12+this.random()*.3;
  }
  update(dt){
    this.time+=dt;
    this.life.update(dt,this);this.dialogue.update(this.time);
    if(this.completedAt!==null){
      if(!this.celebrationStarted){this.celebrationStarted=true;for(const a of this.agents){if(a.carry){this.sources[a.carry].stock=Math.min(7,this.sources[a.carry].stock+1);a.carry=null;}a.task=null;a.path=[];a.state='dancing';a.activity='Dancing for you!';}}
      if(this.time-this.completedAt<=24){this.effects=this.effects.filter(e=>this.time-e.start<e.life);return;}
      this.round++;this.lastRoundAt=this.time;this.progress=[0,0,0,0];this.offerings=0;this.completedAt=null;this.celebrationStarted=false;
      for(const a of this.agents){a.state='thinking';a.until=this.time+this.random();a.energy=Math.max(a.energy,65);}
      this.log('Another wave of good luck. The void has very good stamina.','heart');
    }
    for(const source of Object.values(this.sources)){source.regen+=dt;if(source.regen>=3){source.stock=Math.min(7,source.stock+Math.floor(source.regen/3));source.regen%=3;}}
    if(this.time>=this.nextOmen){
      this.omen=this.pick(Object.keys(SOURCES));this.omenUntil=this.time+22;this.nextOmen=this.time+36+this.random()*28;
      const notes={bits:'The ancient one is in a crunchy-byte mood. The helpers have noticed.',vowels:'A small aurora appears. Glowing vowels feel extra lucky today.',buns:'A cinnamon-scented breeze! The ancient one is hoping for fika.'};
      this.log(notes[this.omen],'omen');this.dialogue.enqueue('god',{ownerId:'cthulhu',owner:'Cthulhu',text:this.omen==='buns'?'Did someone say fika?':this.omen==='vowels'?'Å, ä, ö. Lovely.':'A byte-sized blessing.'},this.time);
    }
    if(this.time>this.omenUntil)this.omen=null;
    for(const a of this.agents){
      a.energy=clamp(a.energy-dt*(a.state==='walking'?.12:.025),0,100);
      if(a.state==='thinking'&&this.time>=a.until)this.choose(a);
      else if(a.state==='walking'){
        let remaining=a.pace*(this.layout?.speed||1)*(a.carry?.86:1)*dt;
        while(a.path.length&&remaining>0){
          const point=a.path[0],dx=point.x-a.x,dy=point.y-a.y,d=Math.hypot(dx,dy);
          if(Math.abs(dx)>.5)a.face=dx>0?1:-1;
          if(d<=remaining){a.x=point.x;a.y=point.y;a.path.shift();remaining-=d;}
          else{a.x+=dx/d*remaining;a.y+=dy/d*remaining;remaining=0;}
        }
        if(!a.path.length)this.arrive(a);
      }else if(a.state==='working'&&this.time>=a.until)this.finish(a);
    }
    this.effects=this.effects.filter(e=>this.time-e.start<e.life);
  }
}
