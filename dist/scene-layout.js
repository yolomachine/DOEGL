const point=(x,y)=>({x:Math.round(x),y:Math.round(y)});

// This is a single world whose geometry is laid out for the viewport. There is
// no reference-image viewport, backing photograph, crop window or pasted border.
export function createSceneLayout(width,height){
  const portrait=width/height<.82,w=width,h=height,actorScale=portrait?.76:1;
  const layout={id:portrait?'portrait':'desktop',width:w,height:h,portrait,actorScale,speed:portrait?1.05:1.4,clearance:portrait?6:8,solids:[],props:[]};
  const add=(id,asset,x,y,scale,footW,footH=22)=>{const p={id,asset,...point(x,y),scale};layout.props.push(p);if(footW)layout.solids.push({id,x:p.x-footW/2,y:p.y-footH,w:footW,h:footH});return p;};
  const godScale=portrait?.78:1,pedScale=portrait?.73:1;
  const main=point(w*.5,h*(portrait?.345:.585)),left=point(w*(portrait?.22:.32),h*(portrait?.49:.565)),right=point(w*(portrait?.78:.68),left.y);
  layout.shrines={};
  for(const [id,p,size]of [['cthulhu',main,pedScale*1.13],['hastur',left,pedScale*.87],['yog',right,pedScale*.92]]){
    const footprint=180*size,footH=30*size;add(id,'pedestal',p.x,p.y,size,footprint,footH);
    const giftY=p.y+23*actorScale,spread=portrait?23:40;
    layout.shrines[id]={x:p.x,y:p.y-80*size,foot:p.y-58*size,scale:id==='cthulhu'?godScale:godScale*.92,spots:[point(p.x-spread,giftY),point(p.x,giftY+12),point(p.x+spread,giftY)],pedestalScale:size};
  }
  const archive=add('archive','archive',w*(portrait?.205:.145),h*(portrait?.685:.55),portrait?.70:1,portrait?88:132,portrait?30:36);
  const fika=add('bakery','fika',w*(portrait?.81:.865),h*(portrait?.685:.55),portrait?.69:1,portrait?105:158,portrait?27:35);
  const bits=add('bits','bits-sign',w*(portrait?.5:.18),h*(portrait?.645:.68),portrait?.76:1,portrait?70:90,18);
  layout.sources={vowels:point(archive.x,archive.y+20),buns:point(fika.x,fika.y+20),bits:point(bits.x,bits.y+20)};
  const bench=add('bench','bench',w*(portrait?.48:.73),h*(portrait?.805:.76),portrait?.79:1,portrait?75:100,20);
  add('pole','maypole',w*(portrait?.11:.10),h*(portrait?.825:.85),portrait?.68:1,12,14);
  add('horse','horse',w*(portrait?.27:.23),h*(portrait?.835:.87),portrait?.65:1,portrait?45:70,24);
  const board=add('board','chalkboard',w*.5,h*(portrait?.974:.967),portrait?.94:1.04,portrait?310:340,portrait?102:115);
  layout.board=board;
  const pen=point(w*(portrait?.79:.88),h*(portrait?.815:.815)),penW=portrait?119:170,penH=portrait?45:58;
  layout.pen={x:pen.x-penW/2,y:pen.y-penH,w:penW,h:penH,scale:penW/170};
  layout.solids.push({id:'pen',x:layout.pen.x-3,y:layout.pen.y-7,w:penW+6,h:penH+8});
  layout.rabbitScale=portrait?.82:1.05;
  layout.rabbits={left:layout.pen.x+18,right:layout.pen.x+penW-18,top:layout.pen.y+14,bottom:pen.y-11,spacing:40*layout.rabbitScale};
  layout.rest=[point(bench.x-23,bench.y+18),point(bench.x,bench.y+23),point(bench.x+23,bench.y+18)];
  layout.bunnyVisit=point(layout.pen.x-18,pen.y+12);
  layout.bounds={left:portrait?13:35,right:w-(portrait?13:35),top:main.y-28,bottom:board.y-(portrait?106:116)-10};
  layout.wait={x:w*.38,y:h*(portrait?.56:.67),w:w*.24,h:portrait?33:42};
  layout.wander={x:w*(portrait?.33:.28),y:h*(portrait?.70:.68),w:w*(portrait?.28:.39),h:h*(portrait?.08:.13)};
  layout.starts=Array.from({length:12},(_,i)=>[w*(portrait?.34:.29)+(i%4)*(portrait?37:62),h*(portrait?.70:.69)+Math.floor(i/4)*(portrait?22:26)]);
  const moonRadius=portrait?28:34;
  layout.moon={...point(w*(portrait?.76:.86),moonRadius+24),r:moonRadius};
  layout.ray={targetX:w*(portrait?.40:.48),targetY:h*(portrait?.48:.64),width:w*(portrait?.53:.27),power:.23,pixelSize:2};
  layout.groundTop=Math.min(h*(portrait?.31:.43),Math.min(...layout.solids.map(p=>p.y))-48);layout.godSpeech=point(w*(portrait?.34:.46),h*(portrait?.07:.23));
  layout.candles=[];
  for(const shrine of Object.values(layout.shrines))for(const side of [-1,1])layout.candles.push({...point(shrine.x+side*89*shrine.pedestalScale,layout.props.find(p=>p.x===shrine.x&&p.asset==='pedestal').y-13*shrine.pedestalScale),scale:portrait?.65:.88});
  for(const p of [archive,fika])for(const side of [-1,1])layout.candles.push({...point(p.x+side*(p.asset==='archive'?67:79)*p.scale,p.y-2),scale:portrait?.55:.72});
  layout.flag={...point(main.x+(portrait?78:130),main.y-(portrait?26:36)),scale:portrait?.46:1.05};
  return layout;
}

export function sceneDepthOrder(entries){return [...entries].sort((a,b)=>a.depth-b.depth||(a.order||0)-(b.order||0));}
