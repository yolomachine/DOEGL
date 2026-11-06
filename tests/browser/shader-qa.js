import {MaterialShader} from '/material-shader.js';
import {loadSceneAssets,materialMask,makeCanvas} from '/scene-assets.js';
import {LivingScene} from '/scene.js';
import {Garden} from '/simulation.js';

const results=[],list=document.querySelector('#results'),status=document.querySelector('#status'),panels=document.querySelector('#panels');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const pixels=c=>c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height);
const differs=(a,b,i)=>a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3];
const settings=(objects=0,foliage=0,light=0)=>({objects:{strength:objects,pattern:'bayer'},foliage:{strength:foliage,pattern:'dots'},light:{strength:light,pattern:'weave'}});
let shader;

function panel(title,frame,description=''){
  const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=title;figure.append(caption);
  const c=makeCanvas(frame.width,frame.height),ctx=c.getContext('2d');ctx.putImageData(frame,0,0);figure.append(c);
  if(description){const p=document.createElement('p');p.textContent=description;figure.append(p);}panels.append(figure);
}
function image(frame){const c=makeCanvas(frame.width,frame.height);c.getContext('2d').putImageData(frame,0,0);return c;}
function field(width,height){
  const c=makeCanvas(width,height),ctx=c.getContext('2d');ctx.fillStyle='#172638';ctx.fillRect(0,0,width,height);
  for(let y=0;y<height;y+=16)for(let x=0;x<width;x+=16)if((x/16+y/16)%2===0){ctx.fillStyle='#1b3043';ctx.fillRect(x,y,16,16);}return c;
}
function gpu(scene,surfaces,options={}){
  const output=shader.render({scene,surfaces,width:scene.width,height:scene.height,moon:{x:0,y:0,r:0},ray:{targetX:0,targetY:0,width:1,power:0},settings:settings(),mode:'dither',...options});
  assert(shader.backend==='webgl',shader.error||'The shader unexpectedly fell back.');assert(output===shader.canvas,'Renderer did not return its actual WebGL canvas.');
  const gl=shader.gl,raw=new Uint8Array(scene.width*scene.height*4);gl.readPixels(0,0,scene.width,scene.height,gl.RGBA,gl.UNSIGNED_BYTE,raw);
  const error=gl.getError();assert(error===gl.NO_ERROR,`WebGL error ${error} during readback.`);
  // readPixels uses a lower-left origin; all comparisons use image top-left.
  const top=new Uint8ClampedArray(raw.length),stride=scene.width*4;
  for(let y=0;y<scene.height;y++)top.set(raw.subarray((scene.height-1-y)*stride,(scene.height-y)*stride),y*stride);
  return new ImageData(top,scene.width,scene.height);
}
function changeReport(a,b,mask,allowedCode){
  let changed=0,escaped=0,maximum=0;
  for(let i=0;i<a.data.length;i+=4)if(differs(a.data,b.data,i)){changed++;if(mask.data[i]!==allowedCode)escaped++;for(let k=0;k<3;k++)maximum=Math.max(maximum,Math.abs(a.data[i+k]-b.data[i+k]));}
  return{changed,escaped,maximum};
}
function changesImage(a,b){const f=new ImageData(a.width,a.height);for(let i=0;i<f.data.length;i+=4){const changed=differs(a.data,b.data,i);f.data[i]=changed?255:14;f.data[i+1]=changed?157:25;f.data[i+2]=changed?91:38;f.data[i+3]=255;}return f;}
function maskImage(mask){const f=new ImageData(mask.width,mask.height);for(let i=0;i<f.data.length;i+=4){const code=mask.data[i];f.data[i]=code===85?255:code===170?66:14;f.data[i+1]=code===85?191:code===170?232:25;f.data[i+2]=code===85?81:code===170?169:38;f.data[i+3]=255;}return f;}
async function test(name,run){
  status.textContent=`Running: ${name}`;const item=document.createElement('li');item.textContent=name;list.append(item);
  try{const detail=await run();item.className='pass';item.dataset.result='pass';item.prepend('PASS — ');results.push({name,status:'pass',...detail});const small=document.createElement('small');small.textContent=JSON.stringify(detail);item.append(small);}
  catch(error){item.className='fail';item.dataset.result='fail';item.prepend('FAIL — ');const small=document.createElement('small');small.textContent=error.message;item.append(small);results.push({name,status:'fail',error:error.message});console.error(name,error);}
  document.querySelector('#report').textContent=JSON.stringify(results,null,2);
}

async function run(){
  const assets=await loadSceneAssets((count,total)=>{status.textContent=`Loading actual game assets: ${count}/${total}`;});
  await test('Actual WebGL shader compiles and renders on this browser',()=>{
    shader=new MaterialShader();assert(shader.backend==='webgl',shader.error||'WebGL unavailable.');
    const scene=field(24,24),surfaces=makeCanvas(24,24),out=gpu(scene,surfaces);assert(out.data.some((v,i)=>i%4!==3&&v>0),'GPU output is blank.');return{backend:shader.backend,pixelsRead:24*24,glError:'NO_ERROR'};
  });
  assert(shader?.backend==='webgl','Further GPU tests cannot run without a compiled WebGL shader.');

  await test('Texture upload orientation and untouched colors are exact',()=>{
    const scene=makeCanvas(96,72),ctx=scene.getContext('2d'),colors=['#d14c45','#47b67b','#3d7cb5','#efcb72'];
    for(let i=0;i<4;i++){ctx.fillStyle=colors[i];ctx.fillRect(i%2*48,Math.floor(i/2)*36,48,36);}ctx.fillStyle='#e6f3ff';ctx.fillRect(3,6,9,5);ctx.fillStyle='#071521';ctx.fillRect(74,53,7,13);
    const source=pixels(scene),result=gpu(scene,makeCanvas(96,72));let errors=0;for(let i=0;i<source.data.length;i+=4)if(differs(source.data,result.data,i))errors++;
    assert(errors===0,`${errors} pixels changed or flipped with every effect disabled.`);panel('GPU orientation probe',result,'Four distinct corners and asymmetric markers survive unchanged.');return{mismatchedPixels:errors,pixelsCompared:96*72};
  });

  await test('Fir dithering stays inside its real alpha silhouette and material support',()=>{
    const frame=assets.fir.frames[0],width=Math.max(320,frame.image.width+92),height=Math.max(300,frame.image.height+62),x=43,y=19;
    const scene=field(width,height),surfaces=makeCanvas(width,height);scene.getContext('2d').drawImage(frame.image,x,y);surfaces.getContext('2d').drawImage(materialMask(frame,'dots'),x,y);
    const source=pixels(scene),mask=pixels(surfaces),result=gpu(scene,surfaces,{settings:settings(0,1,0)}),stats=changeReport(source,result,mask,170);
    let holes=0,changedHoles=0,alphaDisagreements=0,active=0;
    const localMask=pixels(materialMask(frame,'dots'));
    for(let yy=0;yy<frame.image.height;yy++)for(let xx=0;xx<frame.image.width;xx++){
      const local=(yy*frame.image.width+xx)*4,global=((yy+y)*width+xx+x)*4;
      if(localMask.data[local+3]!==frame.pixels.data[local+3])alphaDisagreements++;
      if(localMask.data[local]===170)active++;
      if(frame.pixels.data[local+3]===0){holes++;if(differs(source.data,result.data,global))changedHoles++;}
    }
    assert(active>100,'Fir has insufficient active foliage pixels to exercise the shader.');assert(stats.changed>100,'Full-strength foliage shader did not change the tree.');assert(stats.escaped===0,`${stats.escaped} changed pixels escaped the foliage material.`);
    assert(holes>100,'The generated tree needs actual transparent branch/leaf gaps.');assert(changedHoles===0,`${changedHoles} transparent tree-gap pixels changed.`);assert(alphaDisagreements===0,`${alphaDisagreements} mask alpha pixels differ from the sprite.`);
    panel('Fir source',source);panel('Fir at 100% texture',result,'The effect is bounded to the tree’s material pixels.');panel('Foliage mask',maskImage(mask),'Green pixels come from the actual sprite silhouette.');panel('Changed pixels only',changesImage(source,result),'No rectangle or changed sky pixels should appear.');
    return{...stats,transparentGapPixels:holes,changedGapPixels:changedHoles,maskAlphaDisagreements:alphaDisagreements,pixelsCompared:width*height};
  });

  const mixedWidth=480,mixedHeight=330,mixed=field(mixedWidth,mixedHeight),tree=assets.fir.frames[0],bench=assets.bench.frames[0],tx=252,ty=12,bx=49,by=207;
  mixed.getContext('2d').drawImage(tree.image,tx,ty);mixed.getContext('2d').drawImage(bench.image,bx,by);
  const mixedMask=(objectPattern='bayer',foliagePattern='dots')=>{const c=makeCanvas(mixedWidth,mixedHeight),ctx=c.getContext('2d');ctx.drawImage(materialMask(tree,foliagePattern),tx,ty);ctx.drawImage(materialMask(bench,objectPattern),bx,by);return c;};
  await test('Object and foliage strength controls cannot affect each other',()=>{
    const surfaces=mixedMask(),mask=pixels(surfaces),baseline=gpu(mixed,surfaces,{settings:settings(0,0,0)});
    const object=gpu(mixed,surfaces,{settings:settings(1,0,0)}),foliage=gpu(mixed,surfaces,{settings:settings(0,1,0)}),objectStats=changeReport(baseline,object,mask,85),foliageStats=changeReport(baseline,foliage,mask,170);
    assert(objectStats.changed>20&&foliageStats.changed>100,'One material control did not produce a meaningful change.');assert(objectStats.escaped===0,`${objectStats.escaped} pixels changed outside the object material.`);assert(foliageStats.escaped===0,`${foliageStats.escaped} pixels changed outside the foliage material.`);
    panel('Independent material controls',gpu(mixed,surfaces,{settings:settings(1,1,0)}),'The bench uses object shading; the tree uses foliage shading.');return{objects:objectStats,foliage:foliageStats};
  });
  await test('Changing one material’s texture pattern leaves every other material unchanged',()=>{
    const baseMask=mixedMask(),basePixels=pixels(baseMask),base=gpu(mixed,baseMask,{settings:settings(1,1,0)});
    const object=gpu(mixed,mixedMask('checker','dots'),{settings:settings(1,1,0)}),foliage=gpu(mixed,mixedMask('bayer','weave'),{settings:settings(1,1,0)});
    const objectStats=changeReport(base,object,basePixels,85),foliageStats=changeReport(base,foliage,basePixels,170);
    assert(objectStats.changed>20&&foliageStats.changed>100,'The selected patterns did not produce distinct output.');assert(objectStats.escaped===0&&foliageStats.escaped===0,'A pattern change spilled into another material.');return{objectPatternChange:objectStats,foliagePatternChange:foliageStats};
  });

  await test('Runtime light preserves the moon, sky above it, and every pixel outside its cone envelope',()=>{
    const scene=makeCanvas(256,256),ctx=scene.getContext('2d');ctx.fillStyle='#17283c';ctx.fillRect(0,0,256,256);const surfaces=makeCanvas(256,256),source=pixels(scene),moon={x:128,y:40,r:15},ray={targetX:128,targetY:235,width:100,power:.24,pixelSize:1};
    const smooth=gpu(scene,surfaces,{moon,ray,settings:settings(0,0,0)}),dither=gpu(scene,surfaces,{moon,ray,settings:settings(0,0,1)});
    let changed=0,escaped=0,moonChanges=0,aboveChanges=0,textureDifferences=0,maxIncrease=0,unlit=0;
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const i=(y*256+x)*4,pX=x+.5,pY=y+.5,dy=pY-moon.y,t=Math.max(0,Math.min(1,dy/(ray.targetY-moon.y))),outerHalf=moon.r+(ray.width/2-moon.r)*t;
      // This deliberately generous physical envelope is independent of the
      // shader's feather/falloff implementation, and catches any rectangular spill.
      const outside=dy<=0||pY>=ray.targetY||Math.abs(pX-moon.x)>outerHalf+2,inMoon=Math.hypot(pX-moon.x,pY-moon.y)<=moon.r+1;
      const anyChange=differs(source.data,dither.data,i)||differs(source.data,smooth.data,i);
      if(anyChange){changed++;if(outside)escaped++;if(inMoon)moonChanges++;if(dy<=0)aboveChanges++;}else unlit++;
      if(differs(smooth.data,dither.data,i))textureDifferences++;
      for(let k=0;k<3;k++){const increase=dither.data[i+k]-source.data[i+k];maxIncrease=Math.max(maxIncrease,increase);assert(increase>=0,'The light pass darkened a pixel.');assert(increase<=(255-source.data[i+k])*.25+1,'The full-strength light exceeded its opacity bound.');}
    }
    assert(changed>1000&&unlit>40000,'The ray is missing or does not have bounded geometric support.');assert(escaped===0&&moonChanges===0&&aboveChanges===0,`Ray spill: envelope=${escaped}, moon=${moonChanges}, above=${aboveChanges}`);assert(textureDifferences>500,'The runtime dither slider did not alter the light.');
    panel('Runtime ray: smooth',smooth,'The same analytic cone without dithering.');panel('Runtime ray: woven',dither,'The GPU thresholds only the cone’s light opacity.');
    return{changedPixels:changed,unchangedPixels:unlit,escapedPixels:escaped,changedMoonPixels:moonChanges,changedAboveSourcePixels:aboveChanges,smoothVsDitherPixels:textureDifferences,maximumChannelIncrease:maxIncrease};
  });
  await test('The beam responds to a changed target without changing its source image',()=>{
    const scene=field(256,256),surfaces=makeCanvas(256,256),before=pixels(scene),moon={x:128,y:30,r:14},ray={targetX:70,targetY:235,width:80,power:.24};
    const left=gpu(scene,surfaces,{moon,ray,settings:settings(0,0,1)}),right=gpu(scene,surfaces,{moon,ray:{...ray,targetX:186},settings:settings(0,0,1)}),after=pixels(scene);let changed=0,sourceChanges=0;
    for(let i=0;i<before.data.length;i+=4){if(differs(left.data,right.data,i))changed++;if(differs(before.data,after.data,i))sourceChanges++;}
    assert(changed>1000,'Changing the ray target did not move the generated beam.');assert(sourceChanges===0,'The source image was modified by the effect.');return{beamPixelsMoved:changed,sourceImageChanges:sourceChanges};
  });

  await test('Scenery preserves clear ground and visible props across phone, tablet and desktop sizes',()=>{
    const g=new Garden(91),world=new LivingScene(g,assets),viewports=[[320,568],[390,844],[430,932],[768,1024],[820,1000],[1024,768],[1440,900],[2560,1080]];let intrusions=0,forestPixels=0,checkedPixels=0;
    const check=zones=>{const f=pixels(world.mask);for(let i=0;i<f.data.length;i+=4)if(f.data[i]===170)forestPixels++;for(const z of zones)for(let y=Math.max(0,Math.ceil(z.y));y<Math.min(f.height,z.y+z.h);y++)for(let x=Math.max(0,Math.ceil(z.x));x<Math.min(f.width,z.x+z.w);x++){checkedPixels++;if(f.data[(y*f.width+x)*4]===170)intrusions++;}};
    for(const [w,h]of viewports){
      world.resize(w,h);world.m.fillStyle='#000';world.m.fillRect(0,0,world.width,world.height);for(const p of world.trees)world.sprite(p.asset,p.x,p.y,p.scale,0,{color:p.color});check(world.groundClearings);
      world.m.fillStyle='#000';world.m.fillRect(0,0,world.width,world.height);for(const p of world.foreground)world.sprite(p.asset,p.x,p.y,p.scale);check(world.sceneryKeepouts);
    }
    assert(forestPixels>100000,'The check must preserve real forest, not remove all scenery.');assert(intrusions===0,`${intrusions} foliage pixels intrude on clear ground or foreground prop visibility.`);return{viewports:viewports.length,checkedPixels,forestPixels,intrusions};
  });
  await test('Bench pixels remain fixed while the rest of the scene animates',()=>{
    const g=new Garden(52),world=new LivingScene(g,assets);let compared=0,changed=0;
    for(const [width,height]of [[1440,900],[390,844]]){
      world.resize(width,height);g.agents=[];g.life.bunnies=[];world.fireflies=[];g.effects=[];
      const p=world.layout.props.find(p=>p.id==='bench'),f=assets.bench.frames[0],x=Math.round(p.x-f.anchor.x*p.scale),y=Math.round(p.y-f.anchor.y*p.scale),w=Math.round(f.image.width*p.scale),h=Math.round(f.image.height*p.scale),crop=makeCanvas(w,h),ctx=crop.getContext('2d',{willReadFrequently:true});let reference;
      for(let frame=0;frame<32;frame++){g.time=frame*.137;const output=world.draw();ctx.drawImage(output,x,y,w,h,0,0,w,h);const current=pixels(crop);if(!reference)reference=current;else for(let i=0;i<current.data.length;i+=4){compared++;if(differs(reference.data,current.data,i))changed++;}}
      panel(`Stationary bench · ${width}×${height}`,reference,'32 different animation times; every bench pixel must remain identical.');
    }
    assert(changed===0,`${changed} bench pixels flickered or moved.`);return{frames:64,pixelsCompared:compared,changedPixels:changed};
  });
  await test('Flag cloth waves while the pole stays pixel-stable and the mask follows',()=>{
    const g=new Garden(52),world=new LivingScene(g,assets);world.resize(1440,900);let first,poleChanges=0,clothChanges=0,maskErrors=0;
    const p=world.layout.flag,f=assets.flag.frames[0],x=Math.round(p.x-f.anchor.x*p.scale),y=Math.round(p.y-f.anchor.y*p.scale),w=Math.ceil(f.image.width*p.scale)+2,h=Math.ceil(f.image.height*p.scale)+2,poleRight=Math.floor((f.anchor.x+5)*p.scale),crop=makeCanvas(w,h),ctx=crop.getContext('2d',{willReadFrequently:true});
    for(let frame=0;frame<16;frame++){
      world.ctx.fillStyle='#172638';world.ctx.fillRect(0,0,world.width,world.height);world.m.fillStyle='#000';world.m.fillRect(0,0,world.width,world.height);world.flag(frame*.19);
      ctx.drawImage(world.canvas,x,y,w,h,0,0,w,h);const current=pixels(crop);ctx.drawImage(world.mask,x,y,w,h,0,0,w,h);const mask=pixels(crop);if(!first)first=current;
      for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){const i=(yy*w+xx)*4;if(differs(first.data,current.data,i)){if(xx<poleRight)poleChanges++;else clothChanges++;}if(mask.data[i]===85&&current.data[i]===23&&current.data[i+1]===38&&current.data[i+2]===56)maskErrors++;}
      if(frame===8)panel('Flag in the wind',current,'Only the cloth moves; the pole and its ground anchor stay fixed.');
    }
    assert(poleChanges===0,`Pole moved: ${poleChanges} pixels`);assert(clothChanges>100,'Flag cloth did not move');assert(maskErrors===0,'Flag material mask escaped its waving cloth');return{poleChanges,clothChanges,maskErrors};
  });
  await test('ASCII size and contrast both change the rendered scene without resetting progress',()=>{
    const g=new Garden(7),world=new LivingScene(g,assets);world.resize(390,844);g.progress=[15,30,45,60];const source=world.draw(),samples=[];
    for(const [size,contrast]of [[4,1],[16,1],[8,.5],[8,2]]){world.asciiSettings={size,contrast};samples.push(pixels(world.ascii(source,0)));}
    const changes=(a,b)=>{let n=0;for(let i=0;i<a.data.length;i+=4)if(differs(a.data,b.data,i))n++;return n;},granularity=changes(samples[0],samples[1]),contrast=changes(samples[2],samples[3]);
    assert(granularity>1000&&contrast>1000,'ASCII controls did not affect actual output');assert(g.progress.join(',')==='15,30,45,60','ASCII changes reset the simulation');return{granularityPixels:granularity,contrastPixels:contrast,progressPreserved:true};
  });
  await test('Fence alpha gaps reveal the bunny while opaque rails occlude it',()=>{
    const fence=assets.fence.frames[0],bunny=assets.bunny.frames[0],width=Math.max(250,fence.image.width+60),height=Math.max(160,fence.image.height+100),x=30,y=height-fence.image.height-18;
    const scene=field(width,height),ctx=scene.getContext('2d'),surfaces=makeCanvas(width,height),maskCtx=surfaces.getContext('2d');
    const bunnyX=x+fence.image.width*.5-bunny.anchor.x,bunnyY=y+fence.image.height*.88-bunny.anchor.y;
    ctx.drawImage(bunny.image,Math.round(bunnyX),Math.round(bunnyY));maskCtx.drawImage(materialMask(bunny,'bayer',null),Math.round(bunnyX),Math.round(bunnyY));const behind=pixels(scene);
    ctx.drawImage(fence.image,x,y);maskCtx.drawImage(materialMask(fence,'bayer'),x,y);const composite=pixels(scene),full=gpu(scene,surfaces,{settings:settings(1,0,0)});
    const bunnyOnly=makeCanvas(width,height);bunnyOnly.getContext('2d').drawImage(bunny.image,Math.round(bunnyX),Math.round(bunnyY));const bunnyPixels=pixels(bunnyOnly);
    let gaps=0,gapErrors=0,rails=0,railErrors=0,bunnyOcclusions=0,gpuGapChanges=0;
    for(let yy=0;yy<fence.image.height;yy++)for(let xx=0;xx<fence.image.width;xx++){
      const local=(yy*fence.image.width+xx)*4,i=((yy+y)*width+xx+x)*4,opaque=fence.pixels.data[local+3]===255;
      if(!opaque){gaps++;if(differs(behind.data,composite.data,i))gapErrors++;if(differs(composite.data,full.data,i))gpuGapChanges++;}
      else{rails++;for(let k=0;k<3;k++)if(composite.data[i+k]!==fence.pixels.data[local+k]){railErrors++;break;}if(bunnyPixels.data[i+3]===255)bunnyOcclusions++;}
    }
    assert(gaps>100&&rails>100,'The fence lacks real transparent openings or opaque rails.');assert(bunnyOcclusions>20,'The bunny did not intersect the front rails, so this does not exercise occlusion.');assert(gapErrors===0&&railErrors===0&&gpuGapChanges===0,`Fence errors: gaps=${gapErrors}, rails=${railErrors}, shader gap changes=${gpuGapChanges}`);
    panel('Bunny behind the fence',full,'Transparent fence openings preserve the bunny; opaque rails cover it.');return{transparentOpeningPixels:gaps,opaqueRailPixels:rails,bunnyPixelsOccluded:bunnyOcclusions,gapErrors,railErrors,shaderChangesInGaps:gpuGapChanges};
  });
}

try{await run();}catch(error){results.push({name:'Harness completion',status:'fail',error:error.message});const li=document.createElement('li');li.className='fail';li.textContent=`FAIL — ${error.message}`;list.append(li);console.error(error);}
const failed=results.filter(r=>r.status==='fail').length,passed=results.length-failed;
status.textContent=`${failed?'FAIL':'PASS'} — ${passed} passed, ${failed} failed. GPU readback comparisons complete.`;status.className=failed?'fail':'pass';document.body.dataset.qaStatus=failed?'fail':'pass';document.body.dataset.passed=String(passed);document.body.dataset.failed=String(failed);document.title=`${failed?'FAIL':'PASS'} — Garden shader QA`;document.querySelector('#report').textContent=JSON.stringify({passed,failed,results},null,2);
