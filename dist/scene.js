import {makeCanvas,materialMask,tintedFrames,silhouette} from './scene-assets.js';
import {createSceneLayout,sceneDepthOrder} from './scene-layout.js';
import {randomGenerator,SKILLS} from './simulation.js';
import {MaterialShader} from './material-shader.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const BAR_COLORS=['#9adbb2','#c3dd8d','#baa6e7','#ff9a9a'];

export class LivingScene{
  constructor(sim,assets){
    this.sim=sim;this.assets=assets;this.canvas=makeCanvas(1,1);this.mask=makeCanvas(1,1);this.ctx=this.canvas.getContext('2d',{alpha:false});this.m=this.mask.getContext('2d',{alpha:false});this.shader=new MaterialShader();
    this.crew=sim.agents.map(a=>tintedFrames(assets.robot,a.color));this.silhouettes=new Map();this.asciiSprites=new Map();this.itemSprites=new Map();
    this.settings={objects:{strength:.6,pattern:'checker'},foliage:{strength:.8,pattern:'grain'},light:{strength:.5,pattern:'bayer'}};
    this.asciiSettings={size:8,contrast:1.15};
    this.mode='dither';this.highlight=null;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.asciiCanvas=makeCanvas(1,1);this.sample=makeCanvas(1,1);this.lastAscii=-1;
  }
  resize(cssWidth,cssHeight){
    const portrait=cssWidth/cssHeight<.82;this.scale=portrait?Math.min(cssWidth/420,cssHeight/820):Math.min(cssWidth/1120,cssHeight/780);
    this.width=Math.round(cssWidth/this.scale);this.height=Math.round(cssHeight/this.scale);
    this.canvas.width=this.mask.width=this.width;this.canvas.height=this.mask.height=this.height;
    this.ctx.imageSmoothingEnabled=this.m.imageSmoothingEnabled=false;
    this.layout=createSceneLayout(this.width,this.height);this.sim.setLayout(this.layout);this.makeScenery();
  }
  makeScenery(){
    const l=this.layout,r=randomGenerator(7831),w=this.width,h=this.height;this.trees=[];this.foreground=[];this.stars=[];this.pathCanvas=null;
    // Rebuild clearings from this viewport's actual object geometry. Complete
    // trees are placed behind the clear ground, never clipped into rectangles.
    this.groundClearings=l.solids.map(p=>({x:p.x-12,y:p.y-12,w:p.w+24,h:p.h+30}));
    this.sceneryKeepouts=l.props.map(p=>{
      const b=this.sceneryBounds(p),god=l.shrines[p.id];
      if(god){const top=god.foot-this.assets[p.id].height*god.scale-20;b.h+=b.y-top;b.y=top;}
      return{x:b.x-10,y:b.y-10,w:b.w+20,h:b.h+24};
    });
    if(l.flag){const b=this.sceneryBounds({...l.flag,asset:'flag'});this.sceneryKeepouts.push({x:b.x-5,y:b.y-5,w:b.w+10,h:b.h+10});}
    const placeBehind=p=>{for(const clearing of [...this.groundClearings].sort((a,b)=>b.y-a.y))if(overlaps(this.sceneryBounds(p),clearing))p.y=clearing.y-8;this.trees.push(p);};
    for(let i=0;i<Math.ceil(w*h/10000);i++)this.stars.push({x:Math.floor(r()*w),y:Math.floor(r()*l.groundTop*.85),size:r()<.13?2:1,phase:r()*7});
    // Every tree is an independent alpha sprite, even in the distant forest.
    for(let row=0;row<3;row++)for(let x=-100;x<w+100;x+=70+r()*45){
      const scale=(.64+row*.14+r()*.32)*(l.portrait?.85:1),tree={asset:'fir',x,y:l.groundTop-35+row*47+r()*24,scale,color:['#363452','#263653',null][row],depth:-30+row};
      // Closest ground first, then work backwards. Moving the entire tree back
      // can encounter another clearing, so revisit every reserved ground band.
      placeBehind(tree);
    }
    for(let i=0;i<(l.portrait?8:16);i++){
      const side=i%2,spread=l.portrait?37:Math.min(100,w*.07),x=side?w-r()*spread:r()*spread,y=l.groundTop+55+r()*(h-l.groundTop-75);
      const plant={asset:i%4===0?'fir':i%3===0?'purple-shrub':'shrub',x,y,scale:(i%4===0?.75:.62)+r()*.35,depth:y};
      if(this.sceneryKeepouts.some(zone=>overlaps(this.sceneryBounds(plant),zone)))placeBehind(plant);else this.foreground.push(plant);
    }
    for(let x=-45;x<w+90;x+=70+r()*30){const plant={asset:r()<.35?'purple-shrub':'shrub',x,y:h+25+r()*30,scale:.68+r()*.25,depth:h+30};for(const zone of this.sceneryKeepouts)if(overlaps(this.sceneryBounds(plant),zone))plant.y+=zone.y+zone.h-this.sceneryBounds(plant).y+2;this.foreground.push(plant);}
    this.fireflies=Array.from({length:l.portrait?22:46},()=>({x:r()*w,y:l.groundTop+r()*(h-l.groundTop),phase:r()*7,size:r()<.2?3:2}));
  }
  sceneryBounds(p){const f=this.frame(p.asset);return{x:Math.round(p.x-f.anchor.x*p.scale),y:Math.round(p.y-f.anchor.y*p.scale),w:Math.round(f.image.width*p.scale),h:Math.round(f.image.height*p.scale)};}
  frame(asset,index=0){return(typeof asset==='string'?this.assets[asset]:asset).frames[index%((typeof asset==='string'?this.assets[asset]:asset).frames.length)];}
  sprite(asset,x,y,scale=1,index=0,options={}){
    const f=this.frame(asset,index),material=options.material===undefined?f.material:options.material,pattern=this.settings[material]?.pattern||'bayer';
    const px=Math.round(x),py=Math.round(y),image=options.color?this.flat(f,options.color):this.mode==='hybrid'&&material==='foliage'?this.hybridFoliage(f):f.image;
    const dx=Math.round(px-f.anchor.x*scale),dy=Math.round(py-f.anchor.y*scale),dw=Math.round(f.image.width*scale),dh=Math.round(f.image.height*scale);
    for(const [c,img]of [[this.ctx,image],[this.m,materialMask(f,pattern,options.color?null:material)]]){
      c.save();if(options.flip){c.translate(dx+dw,dy);c.scale(-1,1);c.drawImage(img,0,0,dw,dh);}else c.drawImage(img,dx,dy,dw,dh);c.restore();
    }
    return{frame:f,x:dx,y:dy,w:dw,h:dh};
  }
  flat(frame,color){const key=frame.image.width+':'+color;let cache=this.silhouettes.get(frame);if(!cache){cache=new Map();this.silhouettes.set(frame,cache);}if(!cache.has(key))cache.set(key,silhouette(frame,color));return cache.get(key);}
  hybridFoliage(frame){
    if(this.asciiSprites.has(frame))return this.asciiSprites.get(frame);
    const c=makeCanvas(frame.image.width,frame.image.height),ctx=c.getContext('2d'),glyphs=makeCanvas(c.width,c.height),g=glyphs.getContext('2d'),src=frame.pixels.data;
    ctx.drawImage(frame.image,0,0);g.font='bold 8px monospace';g.textAlign='center';g.textBaseline='middle';
    for(let y=4;y<c.height;y+=8)for(let x=4;x<c.width;x+=7){const i=(y*c.width+x)*4;if(!src[i+3]||src[i+1]<52)continue;g.fillStyle=src[i+1]>105?'#b5ce9a':'#75a387';g.fillText(['*','+',':'][Math.floor(x/7+y/8)%3],x,y);}
    g.globalCompositeOperation='destination-in';g.drawImage(frame.image,0,0);ctx.globalAlpha=.6;ctx.drawImage(glyphs,0,0);this.asciiSprites.set(frame,c);return c;
  }
  rect(x,y,w,h,color){this.ctx.fillStyle=color;this.ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));this.m.fillStyle='#000';this.m.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  label(text,x,y,size=12,color='#ffe5ad'){for(const [c,fill]of [[this.ctx,color],[this.m,'#000']]){c.font=`bold ${Math.round(size)}px monospace`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=fill;c.fillText(text,Math.round(x),Math.round(y));}}
  shadow(x,y,w,h=8){const c=this.ctx;c.fillStyle='#081c2b55';c.beginPath();c.ellipse(Math.round(x),Math.round(y),w/2,h/2,0,0,Math.PI*2);c.fill();}
  glow(x,y,r,power=.3){const c=this.ctx,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(255,192,88,${power})`);g.addColorStop(1,'rgba(255,175,78,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  background(t){
    const c=this.ctx,m=this.m,l=this.layout,w=this.width,h=this.height;
    m.fillStyle='#000';m.fillRect(0,0,w,h);
    const sky=c.createLinearGradient(0,0,0,l.groundTop+100);sky.addColorStop(0,'#111930');sky.addColorStop(.7,'#1c2f55');sky.addColorStop(1,'#514168');c.fillStyle=sky;c.fillRect(0,0,w,h);
    for(const s of this.stars){c.globalAlpha=this.reduced?.8:.65+Math.sin(t*.5+s.phase)*.25;c.fillStyle=s.size===2?'#ffe7a5':'#82abc4';c.fillRect(s.x,s.y,s.size,s.size);if(s.size===2){c.fillRect(s.x-2,s.y+1,6,1);c.fillRect(s.x+1,s.y-2,1,6);}}c.globalAlpha=1;
    c.fillStyle='#303e67';for(const [cx,cy,cw]of [[w*.2,h*.12,105],[w*.71,h*.21,86]]){c.fillRect(cx-cw/2,cy,cw,8);c.fillRect(cx-cw*.34,cy-9,cw*.66,11);c.fillRect(cx-cw*.16,cy-16,cw*.3,10);}
    // A texture tiles across one continuous ground plane at a fixed world scale.
    const grass=c.createPattern(this.assets.grass.frames[0].image,'repeat');c.fillStyle=grass;c.beginPath();c.moveTo(0,l.groundTop);c.bezierCurveTo(w*.22,l.groundTop-24,w*.64,l.groundTop+40,w,l.groundTop-12);c.lineTo(w,h);c.lineTo(0,h);c.closePath();c.fill();
    this.paths();
    for(const tree of this.trees)this.sprite(tree.asset,tree.x,tree.y,tree.scale,0,{color:tree.color});
    const moon=l.moon;this.glow(moon.x,moon.y,moon.r*2.2,.16);this.sprite('moon',moon.x,moon.y+moon.r,moon.r*2/this.assets.moon.width,0,{material:null});
    this.moonFace();
    for(const light of l.candles)this.glow(light.x,light.y-19*light.scale,32*light.scale,.18);
  }
  paths(){
    if(this.pathCanvas){this.ctx.drawImage(this.pathCanvas,0,0);return;}
    const l=this.layout,w=this.width,h=this.height,c=(this.pathCanvas=makeCanvas(w,h)).getContext('2d'),paths=[];
    const route=(start,segments)=>{const p=new Path2D();p.moveTo(...start);for(const s of segments)p.bezierCurveTo(...s);paths.push(p);};
    const a=l.props.find(p=>p.id==='archive'),f=l.props.find(p=>p.id==='bakery'),bits=l.props.find(p=>p.id==='bits'),bench=l.props.find(p=>p.id==='bench');
    if(l.portrait){
      route([l.shrines.cthulhu.x,l.props.find(p=>p.id==='cthulhu').y-3],[[w*.58,h*.40,w*.32,h*.43,w*.43,h*.53],[w*.49,h*.59,w*.65,h*.61,w*.53,h*.70],[w*.43,h*.76,w*.49,h*.79,bench.x,bench.y+9]]);
      route([a.x,a.y-3],[[w*.18,h*.76,w*.66,h*.77,f.x,f.y-3]]);
      route([l.shrines.hastur.x,l.props.find(p=>p.id==='hastur').y-3],[[w*.23,h*.54,w*.33,h*.55,w*.43,h*.53]]);
      route([l.shrines.yog.x,l.props.find(p=>p.id==='yog').y-3],[[w*.76,h*.55,w*.56,h*.59,w*.53,h*.59]]);
      route([w*.12,h*.80],[[w*.31,h*.76,w*.57,h*.86,l.pen.x+9,l.pen.y+l.pen.h+7]]);
    }else{
      // Two gentle crossing trails echo the original garden. Short approaches
      // merge into them instead of radiating from a large central junction.
      route([a.x,a.y-4],[[w*.24,h*.63,w*.35,h*.67,w*.48,h*.65],[w*.65,h*.63,w*.77,h*.60,f.x,f.y-4]]);
      route([w*.10,h*.77],[[w*.28,h*.77,w*.34,h*.67,w*.45,h*.66],[w*.56,h*.65,w*.68,h*.78,l.pen.x+9,l.pen.y+l.pen.h+8]]);
      route([bits.x,bits.y-4],[[w*.18,h*.73,w*.24,h*.74,w*.28,h*.73]]);
      for(const id of ['hastur','cthulhu','yog']){const p=l.props.find(p=>p.id===id);route([p.x,p.y-3],[[p.x-12,p.y+25,p.x+13,h*.64,p.x,h*(id==='hastur'?.652:id==='yog'?.616:.648)]]);}
      route([bench.x,bench.y-2],[[bench.x,bench.y+17,w*.73,h*.78,w*.76,h*.79]]);
    }
    c.lineCap='round';c.lineJoin='round';
    for(const [width,fill]of [[l.portrait?19:25,'#183b39'],[l.portrait?15:21,'#92734b'],[l.portrait?13:18,c.createPattern(this.assets.path.frames[0].image,'repeat')]]){c.strokeStyle=fill;c.lineWidth=width;for(const p of paths)c.stroke(p);}
    // Sparse, stable path-only pebbles. Clipping uses the actual curved road.
    c.globalCompositeOperation='source-atop';const r=randomGenerator(5731);
    for(let i=0;i<w*h/75;i++){c.fillStyle=i%3?'#8e704433':'#ffe2a555';c.fillRect(Math.floor(r()*w),Math.floor(r()*h),i%4===0?2:1,1);}c.globalCompositeOperation='source-over';
    this.ctx.drawImage(this.pathCanvas,0,0);
  }
  flag(t){
    const p=this.layout.flag,f=this.frame('flag'),start=Math.ceil(f.anchor.x+7),end=f.image.width,top=Math.ceil(f.image.height*.33),pattern=this.settings.objects.pattern;
    const x=Math.round(p.x-f.anchor.x*p.scale),y=Math.round(p.y-f.anchor.y*p.scale);
    // Wind deforms the complete source image only to the right of its rigid
    // pole. Color and material support receive precisely the same displacement.
    for(const [c,source]of [[this.ctx,f.image],[this.m,materialMask(f,pattern)]]){
      c.save();c.translate(x,y);c.scale(p.scale,p.scale);c.drawImage(source,0,0,start,f.image.height,0,0,start,f.image.height);
      c.drawImage(source,start,top,end-start,f.image.height-top,start,top,end-start,f.image.height-top);
      for(let xx=start;xx<end;xx++){const u=(xx-start)/(end-start),wave=this.reduced?0:Math.round((Math.sin(t*3.2-u*5.5)+Math.sin(t*1.7-u*3)*.35)*4*u);c.drawImage(source,xx,0,1,top,xx,wave,1,top);}
      c.restore();
    }
  }
  moonFace(){
    const c=this.ctx,l=this.layout.moon,s=this.sim.life.sun,k=l.r/33,blink=this.sim.time<s.blinkUntil;
    c.save();c.translate(l.x,l.y);c.scale(k,k);c.fillStyle='#705039';const ex=Math.round(s.gazeX*2),ey=Math.round(s.gazeY*2);
    for(const x of [-11,11])if(blink||s.expression==='laugh'||s.expression==='dozy'||s.expression==='wink'&&x===11){c.fillRect(x-3,ey,6,2);c.fillRect(x-4,ey-2,2,2);c.fillRect(x+2,ey-2,2,2);}else c.fillRect(x-2+ex,ey-3,4,5);
    if(s.expression==='curious')c.fillRect(-2,10,4,5);else if(s.expression==='laugh'){c.fillRect(-6,9,12,5);c.fillRect(-4,14,8,3);}else{c.fillRect(-7,10,3,3);c.fillRect(4,10,3,3);c.fillRect(-4,13,8,2);}c.restore();
  }
  shrine(prop,t){
    this.shadow(prop.x,prop.y,170*prop.scale,13*prop.scale);this.sprite('pedestal',prop.x,prop.y,prop.scale);
    this.label(prop.id==='yog'?'YOG-SOTHOTH':prop.id.toUpperCase(),prop.x,prop.y-37*prop.scale,prop.id==='yog'?11*prop.scale:13*prop.scale);
    const s=this.layout.shrines[prop.id],index=this.sim.completedAt!==null?2+Math.floor(t*2.7+s.x)%2:((t+s.x*.01)%6.5<.18?1:0),hop=this.sim.completedAt!==null&&!this.reduced?Math.abs(Math.sin(t*8+s.x))*3:0;
    this.sprite(prop.id,s.x,s.foot-hop,s.scale,this.reduced?0:index);
    const shrine=this.sim.shrines.find(a=>a.id===prop.id);if(prop.id==='cthulhu'||this.sim.time-shrine.lastGift<6||this.sim.completedAt!==null)this.heart(s.x,s.foot-this.assets[prop.id].height*s.scale-11+(this.reduced?0:Math.sin(t*2+s.x)*2),this.layout.portrait?1.1:1.35);
  }
  prop(p,t){
    if(this.layout.shrines[p.id])return this.shrine(p,t);
    if(p.asset!=='maypole')this.shadow(p.x,p.y,(this.assets[p.asset].width-12)*p.scale,9);
    const b=this.sprite(p.asset,p.x,p.y,p.scale);
    if(p.id==='board')this.boardRect=b;
  }
  heart(x,y,scale=1){
    const shape=['01100110','11111111','11111111','01111110','00111100','00011000'],c=this.ctx,m=this.m,unit=2*scale;
    c.fillStyle='#111b32';m.fillStyle='#000';for(let row=0;row<shape.length;row++)for(let col=0;col<8;col++)if(shape[row][col]==='1'){const xx=Math.round(x+(col-4)*unit),yy=Math.round(y+(row-3)*unit);c.fillRect(xx-1,yy-1,unit+2,unit+2);m.fillRect(xx-1,yy-1,unit+2,unit+2);}
    c.fillStyle='#ff83b0';for(let row=0;row<shape.length;row++)for(let col=0;col<8;col++)if(shape[row][col]==='1')c.fillRect(Math.round(x+(col-4)*unit),Math.round(y+(row-3)*unit),Math.ceil(unit),Math.ceil(unit));
  }
  item(kind,x,y,scale){
    let icon=this.itemSprites.get(kind);
    if(!icon){
      const image=makeCanvas(36,32),c=image.getContext('2d');c.textAlign='center';c.textBaseline='middle';c.font='bold 19px monospace';c.lineWidth=4;c.strokeStyle='#101a30';
      const text=kind==='bits'?'01':kind==='vowels'?'ö':'@';c.strokeText(text,18,16);c.fillStyle=kind==='bits'?'#b2f4d4':kind==='vowels'?'#fff1ce':'#ffcf87';c.fillText(text,18,16);
      const mask=makeCanvas(36,32),m=mask.getContext('2d');m.drawImage(image,0,0);m.globalCompositeOperation='source-in';m.fillStyle='#000';m.fillRect(0,0,36,32);icon={image,mask};this.itemSprites.set(kind,icon);
    }
    for(const [c,image]of [[this.ctx,icon.image],[this.m,icon.mask]]){c.save();c.translate(Math.round(x),Math.round(y));c.scale(scale,scale);c.drawImage(image,-18,-16);c.restore();}
  }
  agent(a,t){
    const scale=this.layout.actorScale,party=a.state==='dancing',walking=a.state==='walking';
    let frame=party?6+Math.floor(t*3+a.phase)%2:walking?2+Math.floor(t*8+a.phase)%4:((t+a.phase)%5.2<.15?1:0);if(this.reduced)frame=0;
    const hop=this.reduced?0:party?Math.abs(Math.sin(t*8+a.phase))*4:0;
    this.shadow(a.x,a.y,28*scale,7*scale);
    if(this.mode==='hybrid'){
      for(const [i,line]of [' .i. ',party?'[^.^]':'[o.o]',a.carry?'/{+}\\':'/{:}\\',walking&&Math.sin(t*8+a.phase)>0?' / > ':' < \\ '].entries())this.label(line,a.x,a.y-(3-i)*10*scale,11*scale,a.color);
    }else this.sprite(this.crew[a.id],a.x,a.y-hop,scale,frame,{flip:a.face<0});
    if(a.carry)this.item(a.carry,a.x+23*scale,a.y-31*scale-hop,scale);
    if(a.task?.type==='rest'&&a.state==='working')this.label('z z',a.x+20*scale,a.y-52*scale,10*scale,'#ead199');
  }
  bunny(b,t){
    const s=this.layout.rabbitScale,states={sniffing:1,munching:2,grooming:3,napping:6,binky:7,hopping:4};let frame=states[b.state]||0;if(b.state==='hopping')frame=4+Math.floor(t*7+b.phase)%2;if(this.reduced)frame=0;
    this.shadow(b.x,b.y,24*s,6);this.sprite('bunny',b.x,b.y-(this.reduced?0:b.hop*.7),s,frame,{flip:b.face<0,material:null});
  }
  fence(which){const p=this.layout.pen,y=which==='back'?p.y:p.y+p.h;this.sprite('fence',p.x+p.w/2,y,p.scale);}
  effects(t){
    const c=this.ctx;for(const e of this.sim.effects){const age=(this.sim.time-e.start)/e.life;c.save();c.globalAlpha=clamp((1-age)*2,0,1);if(e.kind==='heart')this.heart(e.x,e.y-age*30,.8);else this.item(e.item,e.x+(e.target.x-e.x)*age,e.y+(e.target.y-e.y)*age-Math.sin(age*Math.PI)*45,this.layout.actorScale);c.restore();}
    for(const f of this.fireflies){const a=this.reduced?.45:Math.max(0,Math.sin(t*.7+f.phase))*.7;c.globalAlpha=a;c.fillStyle='#ffe6a0';c.fillRect(Math.round(f.x),Math.round(f.y),f.size,f.size);}c.globalAlpha=1;
  }
  draw(){
    const t=this.reduced?0:this.sim.time,l=this.layout;if(!l)return this.canvas;
    this.ctx.setTransform(1,0,0,1,0,0);this.m.setTransform(1,0,0,1,0,0);this.background(t);
    const entries=[...l.props.map(p=>({id:p.id,depth:p.y,draw:()=>this.prop(p,t)})),...this.sim.agents.map(a=>({id:'agent-'+a.id,depth:a.y,draw:()=>this.agent(a,t)})),...this.sim.life.bunnies.map(b=>({id:'bunny-'+b.id,depth:b.y,draw:()=>this.bunny(b,t)})),...this.foreground.map((p,i)=>({id:'plant-'+i,depth:p.depth,draw:()=>this.sprite(p.asset,p.x,p.y,p.scale)})),...l.candles.map((p,i)=>({id:'candle-'+i,depth:p.y,draw:()=>this.sprite('candle',p.x,p.y,p.scale)})),{id:'fence-back',depth:l.pen.y,order:-2,draw:()=>this.fence('back')},{id:'fence-front',depth:l.pen.y+l.pen.h,order:2,draw:()=>this.fence('front')}];
    if(l.flag)entries.push({id:'flag',depth:l.flag.y,draw:()=>this.flag(t)});
    this.lastDepthOrder=sceneDepthOrder(entries);for(const entry of this.lastDepthOrder)entry.draw();this.effects(t);
    let result=this.shader.render({scene:this.canvas,surfaces:this.mask,width:this.width,height:this.height,time:t,moon:l.moon,ray:l.ray,settings:this.settings,mode:this.mode,highlight:this.highlight});
    if(this.mode==='ascii')result=this.ascii(result,t);
    return result;
  }
  ascii(source,t){
    const {size:step,contrast}=this.asciiSettings,key=`${Math.floor(t*20)}:${step}:${contrast}:${this.width}:${this.height}`;
    if(this.lastAscii===key)return this.asciiCanvas;this.lastAscii=key;
    const sw=Math.ceil(this.width/step),sh=Math.ceil(this.height/step);this.sample.width=sw;this.sample.height=sh;const s=this.sample.getContext('2d',{willReadFrequently:true});s.drawImage(source,0,0,sw,sh);const pixels=s.getImageData(0,0,sw,sh).data;
    this.asciiCanvas.width=this.width;this.asciiCanvas.height=this.height;const c=this.asciiCanvas.getContext('2d');c.fillStyle='#11192d';c.fillRect(0,0,this.width,this.height);c.font=`bold ${step+1}px monospace`;c.textAlign='center';c.textBaseline='middle';
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const i=(y*sw+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2],v=clamp(((r*.25+g*.6+b*.15)/255-.28)*contrast+.28,0,1);if(v<.14)continue;c.fillStyle=v>.65?'#ffe4ac':g>r*1.1?'#7bbda4':b>r*1.1?'#a0a6d6':'#daae91';c.fillText(' .:+*#@'[Math.min(6,Math.floor(v*7))],(x+.5)*step,(y+.5)*step);}
    return this.asciiCanvas;
  }
  drawOverlay(c,scale){
    const b=this.boardRect;if(!b)return;const x=b.x*scale,y=b.y*scale,w=b.w*scale,h=b.h*scale;
    c.save();c.textAlign='center';c.textBaseline='middle';c.font=`bold ${clamp(19*scale,14,26)}px monospace`;c.fillStyle='#ffe4a9';c.fillText(this.sim.completedAt===null?'LYCKA TILL!':'HEJA DIG! ♥',x+w/2,y+h*.225);
    c.font=`bold ${clamp(10*scale,9,13)}px monospace`;c.fillStyle='#c7d9c7';c.fillText(this.sim.completedAt===null?'EXAM COURAGE':'YOU’VE GOT THIS!',x+w/2,y+h*.36);
    const margin=w*.09,gap=w*.035,bw=(w-2*margin-3*gap)/4,bh=Math.max(5,h*.075),by=y+h*.55;
    this.sim.progress.forEach((v,i)=>{const bx=x+margin+i*(bw+gap);c.fillStyle='#f6dda5';c.fillRect(bx-1,by-1,bw+2,bh+2);c.fillStyle='#1e3c46';c.fillRect(bx,by,bw,bh);c.fillStyle=BAR_COLORS[i];c.fillRect(bx,by,bw*v/100,bh);c.font=`bold ${clamp(10*scale,9,13)}px monospace`;c.fillStyle='#ffe6b4';c.fillText(SKILLS[i].sv,bx+bw/2,y+h*.46);});
    if(this.sim.completedAt!==null){const colors=['#ff83ad','#ffe39a','#a2e3ce','#b8a1ec','#fff1ce'],t=this.reduced?2:this.sim.time-this.sim.completedAt;for(let i=0;i<(this.layout.portrait?70:125);i++){const xx=(i*137.7+Math.sin(t*1.4+i)*15)%this.width,yy=(i*97.3+t*(25+i%9*4))%this.height;c.fillStyle=colors[i%5];c.fillRect(xx*scale,yy*scale,3*scale,5*scale);}}
    c.restore();
  }
}
