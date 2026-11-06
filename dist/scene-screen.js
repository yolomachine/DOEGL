import {DITHER_PATTERNS} from './dither.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hit=(p,r)=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
const LAYERS=[['objects','Objects'],['foliage','Trees & shrubs'],['light','Moonlight']];

export class SceneScreen{
  constructor(canvas,scene,sim){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.scene=scene;this.sim=sim;this.open=false;this.layer='objects';this.buttons=[];this.sliders=[];this.focus=null;this.dragging=null;
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.bind();this.resize();
  }
  resize(){
    const rect=this.canvas.getBoundingClientRect(),w=Math.round(rect.width),h=Math.round(rect.height),dpr=Math.min(3,devicePixelRatio||1);
    if(w===this.w&&h===this.h&&dpr===this.dpr)return;
    this.w=w;this.h=h;this.dpr=dpr;this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);
    const css=getComputedStyle(document.documentElement);this.safeTop=parseFloat(css.getPropertyValue('--safe-top'))||0;this.safeRight=parseFloat(css.getPropertyValue('--safe-right'))||0;
    this.scene.resize(this.w,this.h);this.draw();
  }
  bind(){
    const point=e=>{const r=this.canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};},over=p=>this.open&&this.sliders.find(s=>p.x>=s.x-10&&p.x<=s.x+s.w+10&&Math.abs(p.y-s.y)<19);
    const adjust=p=>{const s=this.dragging;s.action(clamp((p.x-s.x)/s.w,0,1));};
    this.canvas.addEventListener('pointerdown',e=>{const p=point(e),s=over(p);if(s){this.dragging=s;this.canvas.setPointerCapture(e.pointerId);adjust(p);e.preventDefault();}});
    this.canvas.addEventListener('pointermove',e=>{const p=point(e);if(this.dragging)adjust(p);this.canvas.style.cursor=over(p)||this.buttons.some(b=>hit(p,b))?'pointer':'default';});
    this.canvas.addEventListener('pointerup',e=>{if(this.dragging){this.dragging=null;if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);return;}const p=point(e),button=this.buttons.find(b=>hit(p,b));if(button)button.action();else if(this.open&&!hit(p,this.panel))this.setOpen(false);});
    this.canvas.addEventListener('pointercancel',()=>{this.dragging=null;});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')this.setOpen(false);if(e.key.toLowerCase()==='s'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.repeat)this.setOpen(!this.open);const mode={'1':'pixel','2':'ascii','3':'hybrid','4':'dither'}[e.key];if(mode)this.setMode(mode);});
  }
  setOpen(open){this.open=open;this.canvas.style.touchAction=open?'none':'manipulation';if(!open)this.scene.highlight=null;document.querySelector('#art-options').hidden=!open;this.sync();this.draw();}
  setMode(mode){this.scene.mode=mode;if(mode!=='dither')this.scene.highlight=null;this.sync();this.draw();}
  setLayer(layer){this.layer=layer;if(this.scene.highlight)this.scene.highlight=layer;this.sync();this.draw();}
  setPattern(id){this.scene.settings[this.layer].pattern=id;this.sync();this.draw();}
  setStrength(value){this.scene.settings[this.layer].strength=clamp(value,0,1);this.sync();this.draw();}
  setAscii(key,value){this.scene.asciiSettings[key]=key==='size'?Math.round(clamp(value,4,16)):clamp(value,.5,2);this.sync();this.draw();}
  toggleHighlight(){this.scene.highlight=this.scene.highlight?null:this.layer;this.sync();this.draw();}
  sync(){
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===this.scene.mode)));
    document.querySelectorAll('[data-layer]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layer===this.layer)));
    document.querySelectorAll('[data-pattern]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pattern===this.scene.settings[this.layer].pattern)));
    document.querySelector('#dither-strength').value=String(Math.round(this.scene.settings[this.layer].strength*100));document.querySelector('#dither-strength').setAttribute('aria-label',`${LAYERS.find(l=>l[0]===this.layer)[1]} dithering strength`);
    document.querySelector('#highlight-layer').setAttribute('aria-pressed',String(!!this.scene.highlight));
    document.querySelector('#dither-options').hidden=this.scene.mode!=='dither';document.querySelector('#ascii-options').hidden=this.scene.mode!=='ascii';
    document.querySelector('#ascii-size').value=String(this.scene.asciiSettings.size);document.querySelector('#ascii-contrast').value=String(Math.round(this.scene.asciiSettings.contrast*100));
  }
  point(x,y){return{x:x*this.scene.scale,y:y*this.scene.scale};}
  text(text,x,y,size=14,color='#ffe8b5',align='center'){const c=this.ctx;c.font=`bold ${size}px monospace`;c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.fillText(text,x,y);}
  box(x,y,w,h,fill='#ffefc8',edge='#17243b'){const c=this.ctx;c.fillStyle=edge;c.fillRect(x+3,y-2,w-6,h+4);c.fillRect(x-2,y+3,w+4,h-6);c.fillStyle=fill;c.fillRect(x+3,y,w-6,h);c.fillRect(x,y+3,w,h-6);}
  bubble(message,channel){
    if(!message)return;const c=this.ctx,god=channel==='god',mobile=this.scene.layout.portrait,l=this.scene.layout;
    const actor=god?l.godSpeech:this.sim.agents.find(a=>a.id===message.ownerId),anchor=this.point(actor?.x||l.width/2,god?l.godSpeech.y:(actor?.y||l.height*.7)-67*l.actorScale);
    const size=god&&message.text==='Lycka till!'?(mobile?20:25):mobile?13:16,maxW=Math.min(god?mobile?235:350:mobile?205:260,this.w-26);c.font=`bold ${size}px monospace`;
    const lines=[];let line='';for(const word of message.text.split(/\s+/)){const next=line?line+' '+word:word;if(c.measureText(next).width>maxW-24&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);
    const w=Math.min(maxW,Math.max(...lines.map(line=>c.measureText(line).width))+26),h=lines.length*(size+5)+16;
    let x=clamp(anchor.x-w/2,12,this.w-w-12),y=clamp(anchor.y-h/2,16+this.safeTop,this.h-h-12);
    if(mobile&&god){x=13;y=17+this.safeTop;}
    for(const box of this.bubbleBoxes)if(x<box.x+box.w+6&&x+w>box.x-6&&y<box.y+box.h+8&&y+h>box.y-8)y=clamp(box.y+box.h+13,16,this.h-h-12);
    this.bubbleBoxes.push({x,y,w,h});c.save();c.globalAlpha=message.alpha;this.box(x+2,y+3,w,h,'#0b193080','#0b193080');this.box(x,y,w,h,god?'#ffedc1':'#f7eed6');c.fillStyle=god?'#ffedc1':'#f7eed6';const tail=clamp(anchor.x,x+12,x+w-16);c.fillRect(tail,y+h-2,9,7);c.fillRect(tail+4,y+h+5,5,4);lines.forEach((line,i)=>this.text(line,x+w/2,y+10+size/2+i*(size+5),size,'#17253b'));c.restore();
  }
  button(rect,label,selected,action,id,size=12){this.buttons.push({...rect,action});this.box(rect.x,rect.y,rect.w,rect.h,selected?'#eed5a3':'#2b4252',this.focus===id?'#fff6d7':'#728486');this.text(label,rect.x+rect.w/2,rect.y+rect.h/2,size,selected?'#17273a':'#ecdfbf');}
  slider(x,y,w,value,action){const c=this.ctx;this.sliders.push({x,y,w,action});c.fillStyle='#4d6466';c.fillRect(x,y-3,w,6);c.fillStyle='#f1d8a7';c.fillRect(x,y-3,w*value,6);c.fillRect(x+w*value-6,y-10,12,20);}
  controls(){
    this.buttons=[];this.sliders=[];if(!this.open)return;
    const w=Math.min(352,this.w-24),x=this.w-w-12,y=73+this.safeTop,h=this.scene.mode==='dither'?366:this.scene.mode==='ascii'?275:154;this.panel={x,y,w,h};this.box(x,y,w,h,'#142839f7','#bc9b73');this.text('MIDNIGHT GLOW',x+15,y+23,15,'#f4dca9','left');
    const modeW=(w-35)/4;[['pixel','PIXELS'],['ascii','ASCII'],['hybrid','MIX'],['dither','DITHER']].forEach(([id,label],i)=>this.button({x:x+10+i*(modeW+5),y:y+46,w:modeW,h:38},label,this.scene.mode===id,()=>this.setMode(id),id,11));
    if(this.scene.mode==='ascii'){
      const a=this.scene.asciiSettings;this.text(`Character size · ${a.size}px`,x+16,y+114,12,'#f4dca9','left');this.slider(x+22,y+143,w-44,(a.size-4)/12,v=>this.setAscii('size',4+v*12));
      this.text(`Contrast · ${Math.round(a.contrast*100)}%`,x+16,y+190,12,'#f4dca9','left');this.slider(x+22,y+219,w-44,(a.contrast-.5)/1.5,v=>this.setAscii('contrast',.5+v*1.5));
      this.text('Small characters show more detail',x+w/2,y+254,11,'#adc4bb');return;
    }
    if(this.scene.mode!=='dither'){this.text(this.scene.mode==='pixel'?'Solid pixel shading · soft moonlight':'A different view of the same living scene',x+w/2,y+111,11,'#adc4bb');this.text('Dither has separate controls for each layer',x+w/2,y+134,10,'#d6c4a4');return;}
    const layerW=(w-30)/3;LAYERS.forEach(([id,label],i)=>this.button({x:x+10+i*(layerW+5),y:y+102,w:layerW,h:36},label,this.layer===id,()=>this.setLayer(id),'layer:'+id,id==='foliage'?10:12));
    const settings=this.scene.settings[this.layer];DITHER_PATTERNS.forEach((p,i)=>this.button({x:x+10+i%3*(layerW+5),y:y+158+Math.floor(i/3)*43,w:layerW,h:35},p.label,settings.pattern===p.id,()=>this.setPattern(p.id),'pattern:'+p.id,12));
    this.text(`${LAYERS.find(l=>l[0]===this.layer)[1]} · ${Math.round(settings.strength*100)}%`,x+16,y+260,12,'#f4dca9','left');
    this.slider(x+22,y+287,w-44,settings.strength,v=>this.setStrength(v));
    this.button({x:x+12,y:y+313,w:w-24,h:35},this.scene.highlight?'Show normal garden':'Highlight affected shapes',!!this.scene.highlight,()=>this.toggleHighlight(),'highlight',12);
  }
  draw(){
    if(!this.w)return;const source=this.scene.draw(),c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.imageSmoothingEnabled=false;c.drawImage(source,0,0,this.w,this.h);this.scene.drawOverlay(c,this.scene.scale);
    this.bubbleBoxes=[];this.bubble(this.sim.dialogue.visible('god',this.sim.time),'god');this.bubble(this.sim.dialogue.visible('agent',this.sim.time),'agent');this.controls();
    const s=this.scene.settings;Object.assign(this.canvas.dataset,{artDirection:'midnight-rebuilt',artStyle:this.scene.mode,layout:this.scene.layout.id,renderer:this.scene.shader.backend,ditherPattern:s[this.layer].pattern,dithering:String(s[this.layer].strength),ditherLayer:this.layer,objectDither:String(s.objects.strength),objectPattern:s.objects.pattern,foliageDither:String(s.foliage.strength),foliagePattern:s.foliage.pattern,lightDither:String(s.light.strength),lightPattern:s.light.pattern,asciiSize:String(this.scene.asciiSettings.size),asciiContrast:String(this.scene.asciiSettings.contrast),highlight:this.scene.highlight||'none',round:String(this.sim.round),offerings:String(this.sim.totalOfferings),celebrating:String(this.sim.completedAt!==null),agents:String(this.sim.agents.length),worldSize:`${this.scene.width}x${this.scene.height}`});
  }
}
