import {ditherPattern,patternThreshold} from './dither.js';

export const makeCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;};
export const ASSET_SPECS={
  fir:{width:170,material:'foliage'},shrub:{width:150,material:'foliage'},'purple-shrub':{width:140,material:'foliage'},
  fika:{width:165,material:'objects'},archive:{width:140,material:'objects'},pedestal:{width:180,material:'objects'},
  bench:{width:105,material:'objects'},fence:{width:170,material:'objects'},chalkboard:{width:330,material:'objects'},
  maypole:{width:110,material:'objects'},horse:{width:76,material:'objects'},'bits-sign':{width:100,material:'objects'},
  candle:{width:18,material:'objects'},flag:{width:77,groundX:520,material:'objects'},moon:{width:65,material:null},
  grass:{tile:96,material:null},path:{tile:96,material:null},
  cthulhu:{columns:2,rows:2,height:140,material:'objects'},hastur:{columns:2,rows:2,height:110,material:'objects'},yog:{columns:2,rows:2,height:120,material:'objects'},
  robot:{columns:4,rows:2,height:53,material:'objects'},bunny:{columns:4,rows:2,height:43,material:null}
};

function bounds(frame){
  const {width,height,data}=frame;let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<left)throw new Error('Generated sprite has no visible pixels.');
  return{left,top,right,bottom,width:right-left+1,height:bottom-top+1};
}
function binaryAlpha(c){const ctx=c.getContext('2d',{willReadFrequently:true}),f=ctx.getImageData(0,0,c.width,c.height);for(let i=3;i<f.data.length;i+=4)f.data[i]=f.data[i]>=128?255:0;ctx.putImageData(f,0,0);return f;}

function prepareAsset(image,spec){
  const source=makeCanvas(image.width,image.height),ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const frames=[];
  if(spec.tile){const c=makeCanvas(spec.tile,spec.tile),d=c.getContext('2d');d.imageSmoothingEnabled=false;d.drawImage(source,0,0,c.width,c.height);return{frames:[{image:c,anchor:{x:0,y:0},pixels:binaryAlpha(c),material:null,masks:new Map()}],width:c.width,height:c.height};}
  const cols=spec.columns||1,rows=spec.rows||1,cw=Math.floor(image.width/cols),ch=Math.floor(image.height/rows);
  const registrations=[];for(let i=0;i<cols*rows;i++)registrations.push(bounds(ctx.getImageData(i%cols*cw,Math.floor(i/cols)*ch,cw,ch)));
  if(cols===1&&rows===1){
    const b=registrations[0],ratio=spec.width/b.width,c=makeCanvas(spec.width,b.height*ratio),d=c.getContext('2d',{willReadFrequently:true});d.imageSmoothingEnabled=false;d.drawImage(source,b.left,b.top,b.width,b.height,0,0,c.width,c.height);
    frames.push({image:c,anchor:{x:spec.groundX===undefined?c.width/2:(spec.groundX-b.left)*ratio,y:c.height},pixels:binaryAlpha(c),material:spec.material,masks:new Map()});
  }else{
    // A shared scale and cell center preserve pose proportions. Only whole-frame
    // vertical translation registers the planted feet to the same ground line.
    const ratio=spec.height/registrations[0].height,fw=Math.ceil(cw*ratio),fh=Math.ceil(ch*ratio)+6,anchor={x:fw/2,y:fh-4};
    for(let i=0;i<cols*rows;i++){
      const c=makeCanvas(fw,fh),d=c.getContext('2d',{willReadFrequently:true});d.imageSmoothingEnabled=false;
      const dy=anchor.y-(registrations[i].bottom+1)*ratio;d.drawImage(source,i%cols*cw,Math.floor(i/cols)*ch,cw,ch,0,dy,cw*ratio,ch*ratio);
      frames.push({image:c,anchor:{...anchor},pixels:binaryAlpha(c),material:spec.material,masks:new Map()});
    }
  }
  return{frames,width:frames[0].image.width,height:spec.height||frames[0].image.height,registrations,sourceSize:[image.width,image.height]};
}

export async function loadSceneAssets(onProgress=()=>{}){
  let loaded=0;const names=Object.keys(ASSET_SPECS),assets={};
  await Promise.all(names.map(async name=>{const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error(`Could not load ${name} artwork.`));i.src=`assets/rebuild/${name}.png`;});assets[name]=prepareAsset(image,ASSET_SPECS[name]);onProgress(++loaded,names.length);}));
  return assets;
}

export function materialMask(frame,patternId='bayer',override){
  const material=override===undefined?frame.material:override,key=`${material}:${patternId}`;if(frame.masks.has(key))return frame.masks.get(key);
  const c=makeCanvas(frame.image.width,frame.image.height),ctx=c.getContext('2d'),f=ctx.createImageData(c.width,c.height),data=f.data,src=frame.pixels.data,p=ditherPattern(patternId);
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    const i=(y*c.width+x)*4;if(src[i+3]!==255)continue;
    const l=(src[i]*.2126+src[i+1]*.7152+src[i+2]*.0722)/255;
    // Every opaque source pixel writes a mask, including undithered outlines and
    // highlights, so a tree behind it can never bleed through its face or sign.
    const active=material&&l>.115&&l<.78;
    data[i]=active?(material==='foliage'?170:85):0;
    const coverage=material==='foliage'?Math.max(.3,Math.min(.8,.92-l)):Math.max(.08,Math.min(.64,(.76-l)*.8));
    data[i+1]=Math.round(coverage*255);
    const threshold=patternThreshold(p,Math.floor(x/2),Math.floor(y/2))/16;
    data[i+2]=Math.round((material==='foliage'?1-threshold:threshold)*255);data[i+3]=255;
  }
  ctx.putImageData(f,0,0);frame.masks.set(key,c);return c;
}

export function tintedFrames(asset,color){
  const target=[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)];
  return{...asset,frames:asset.frames.map(frame=>{
    const c=makeCanvas(frame.image.width,frame.image.height),ctx=c.getContext('2d'),f=new ImageData(new Uint8ClampedArray(frame.pixels.data),c.width,c.height);
    for(let i=0;i<f.data.length;i+=4){const r=f.data[i],g=f.data[i+1],b=f.data[i+2];if(f.data[i+3]&&g>r*1.12&&g>b*.94){const light=Math.max(.3,Math.min(1.16,g/190));for(let k=0;k<3;k++)f.data[i+k]=Math.min(255,Math.round(target[k]*light));}}
    ctx.putImageData(f,0,0);return{...frame,image:c,pixels:f,masks:new Map()};
  })};
}

export function silhouette(frame,color){const c=makeCanvas(frame.image.width,frame.image.height),ctx=c.getContext('2d');ctx.drawImage(frame.image,0,0);ctx.globalCompositeOperation='source-in';ctx.fillStyle=color;ctx.fillRect(0,0,c.width,c.height);return c;}
