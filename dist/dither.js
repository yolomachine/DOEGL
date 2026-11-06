export const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function rankedPattern(id,label,size,score){
  const cells=Array.from({length:size*size},(_,i)=>({i,score:score(i%size,Math.floor(i/size))})).sort((a,b)=>a.score-b.score||a.i-b.i),data=new Uint8Array(size*size);
  cells.forEach(({i},rank)=>{data[i]=Math.floor((rank+.5)*256/cells.length);});return{id,label,size,data};
}
let grainSeed=0x619bc4;
export const DITHER_PATTERNS=[
  {id:'bayer',label:'Bayer',size:4,data:Uint8Array.from(BAYER,n=>n*16)},
  {id:'checker',label:'Checker',size:2,data:Uint8Array.from([0,2,3,1],n=>n*64+32)},
  rankedPattern('diagonal','Diagonal',8,(x,y)=>(x+y)%8),
  rankedPattern('dots','Dots',8,(x,y)=>(x-3.5)**2+(y-3.5)**2),
  rankedPattern('weave','Weave',8,(x,y)=>Math.min(Math.abs(x-y),Math.abs(x+y-7))),
  rankedPattern('grain','Grain',64,()=>{grainSeed=(Math.imul(grainSeed,1664525)+1013904223)>>>0;return grainSeed;})
];
export function ditherPattern(id){return DITHER_PATTERNS.find(p=>p.id===id)||DITHER_PATTERNS[0];}
export function patternThreshold(pattern,x,y){return pattern.data[((y%pattern.size+pattern.size)%pattern.size)*pattern.size+(x%pattern.size+pattern.size)%pattern.size]/16;}
