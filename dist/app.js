import {Garden} from './simulation.js';
import {LivingScene} from './scene.js';
import {SceneScreen} from './scene-screen.js';
import {loadSceneAssets} from './scene-assets.js';
import {DITHER_PATTERNS} from './dither.js';

const display=document.querySelector('#world'),status=document.querySelector('#accessible-status');
const loading=display.getContext('2d');display.width=innerWidth;display.height=innerHeight;loading.fillStyle='#121c31';loading.fillRect(0,0,display.width,display.height);
loading.fillStyle='#f7dfac';loading.font='bold 18px monospace';loading.textAlign='center';loading.fillText('Waking the tiny universe…',display.width/2,display.height/2);

try{
  const artwork=await loadSceneAssets();
  const entropy=new Uint32Array(1);crypto.getRandomValues(entropy);const sim=new Garden(entropy[0]);
  sim.dialogue.channels.god.active.text='Lycka till!';
  for(const pattern of DITHER_PATTERNS){const b=document.createElement('button');b.dataset.pattern=pattern.id;b.textContent=pattern.label+' texture';b.setAttribute('aria-pressed',String(pattern.id==='bayer'));document.querySelector('#dither-patterns').append(b);}
  const scene=new LivingScene(sim,artwork),screen=new SceneScreen(display,scene,sim);screen.sync();
  document.querySelectorAll('[data-view]').forEach(b=>{b.addEventListener('click',()=>screen.setMode(b.dataset.view));b.addEventListener('focus',()=>{screen.focus=b.dataset.view;screen.setOpen(true);});b.addEventListener('blur',()=>{screen.focus=null;});});
  document.querySelectorAll('[data-pattern]').forEach(b=>{b.addEventListener('click',()=>screen.setPattern(b.dataset.pattern));b.addEventListener('focus',()=>{screen.focus='pattern:'+b.dataset.pattern;screen.setMode('dither');screen.setOpen(true);});b.addEventListener('blur',()=>{screen.focus=null;});});
  document.querySelectorAll('[data-layer]').forEach(b=>{b.addEventListener('click',()=>screen.setLayer(b.dataset.layer));b.addEventListener('focus',()=>{screen.focus='layer:'+b.dataset.layer;screen.setOpen(true);});b.addEventListener('blur',()=>{screen.focus=null;});});
  document.querySelector('#highlight-layer').addEventListener('click',()=>screen.toggleHighlight());
  const strength=document.querySelector('#dither-strength');strength.addEventListener('input',()=>screen.setStrength(Number(strength.value)/100));strength.addEventListener('focus',()=>{screen.setMode('dither');screen.setOpen(true);});
  for(const [id,key,divisor]of [['ascii-size','size',1],['ascii-contrast','contrast',100]]){const input=document.getElementById(id);input.addEventListener('input',()=>screen.setAscii(key,Number(input.value)/divisor));input.addEventListener('focus',()=>{screen.setMode('ascii');screen.setOpen(true);});}
  let previous=performance.now(),accumulator=0,lastDraw=0,lastAnnouncement=-30;const step=1/120;
  function frame(now){
    if(!document.hidden){
      accumulator+=Math.min((now-previous)/1000,.25);while(accumulator>=step){sim.update(step);accumulator-=step;}
      if(!scene.reduced||now-lastDraw>=1000){screen.draw();lastDraw=now;}
      if(sim.time-lastAnnouncement>=25){status.textContent=`Good luck is at ${Math.floor(sim.overall)} percent. ${sim.totalOfferings} digital offerings delivered to Cthulhu, Hastur and Yog-Sothoth. All three bunnies are safe. ${sim.events[0].text}`;lastAnnouncement=sim.time;}
    }
    previous=now;requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange',()=>{previous=performance.now();accumulator=0;});
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{scene.reduced=e.matches;screen.draw();});
  requestAnimationFrame(frame);
}catch(error){
  console.error(error);loading.fillStyle='#121c31';loading.fillRect(0,0,display.width,display.height);loading.fillStyle='#f7dfac';loading.fillText('The garden needs a moment. Please reload.',display.width/2,display.height/2);status.textContent='The garden artwork could not load. Please reload the page.';
}
