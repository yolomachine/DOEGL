const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class GardenLife{
  constructor(random){
    this.random=random;this.sun={expression:'smile',gazeX:0,gazeY:0,targetX:0,targetY:0,next:2,blinkAt:3,blinkUntil:0};
    this.bunnies=Array.from({length:3},(_,id)=>({id,x:746+id*28,y:386+id%2*14,targetX:750+id*20,targetY:388,state:'hopping',until:1+id,face:1,phase:id*2,hop:0,actions:0}));
  }
  choose(b,time,celebrate){
    const r=this.random();b.actions++;
    b.state=celebrate?'binky':r<.4?'hopping':r<.59?'munching':r<.74?'grooming':r<.9?'sniffing':'napping';
    const bounds=this.bounds||{left:739,right:817,top:378,bottom:402};b.targetX=b.x;b.targetY=b.y;b.until=time+2+this.random()*5;
    if(!['hopping','sniffing'].includes(b.state))return;
    // Reserve a clear little route before hopping. A resting rabbit is never
    // displaced by a neighbour: blocked rabbits pause and choose another route.
    for(let attempt=0;attempt<48;attempt++){
      const x=bounds.left+this.random()*(bounds.right-bounds.left),y=bounds.top+this.random()*(bounds.bottom-bounds.top);
      if(Math.hypot(x-b.x,y-b.y)<4||!this.clearRoute(b,x,y))continue;
      b.targetX=x;b.targetY=y;return;
    }
    b.state='sniffing';
  }
  spacing(){return this.bounds?.spacing||24;}
  clearAt(b,x,y,reserve=false){
    const gap=this.spacing();return this.bunnies.every(other=>other===b||Math.hypot(x-other.x,(y-other.y)*1.15)>=gap&&(!reserve||Math.hypot(x-other.targetX,(y-other.targetY)*1.15)>=gap));
  }
  clearRoute(b,x,y){
    const steps=Math.max(1,Math.ceil(Math.hypot(x-b.x,y-b.y)/3));
    for(let i=1;i<=steps;i++)if(!this.clearAt(b,b.x+(x-b.x)*i/steps,b.y+(y-b.y)*i/steps,true))return false;
    return true;
  }
  setBounds(bounds){this.bounds=bounds;for(const b of this.bunnies){b.x=bounds.left+(bounds.right-bounds.left)*b.id/(this.bunnies.length-1);b.y=(bounds.top+bounds.bottom)/2;b.targetX=b.x;b.targetY=b.y;b.until=0;}}
  update(dt,g){
    const t=g.time,celebrate=g.completedAt!==null;
    for(const b of this.bunnies){
      if(t>=b.until||(celebrate&&b.state!=='binky'))this.choose(b,t,celebrate);
      if(['hopping','binky','sniffing'].includes(b.state)){
        const dx=b.targetX-b.x,dy=b.targetY-b.y,d=Math.hypot(dx,dy),speed=(b.state==='binky'?40:b.state==='sniffing'?11:25)*dt;
        if(d>1){
          const x=b.x+dx/d*Math.min(speed,d),y=b.y+dy/d*Math.min(speed,d);
          if(this.clearAt(b,x,y)){b.x=x;b.y=y;if(Math.abs(dx)>.3)b.face=dx<0?-1:1;}
          else{b.targetX=b.x;b.targetY=b.y;b.state='sniffing';b.until=t+.8+this.random();}
        }else if(b.state!=='binky'&&b.state!=='sniffing'){b.state='munching';b.until=t+2+this.random()*2;}
      }
      const bounds=this.bounds||{left:738,right:818,top:377,bottom:404};b.x=clamp(b.x,bounds.left,bounds.right);b.y=clamp(b.y,bounds.top,bounds.bottom);
      b.hop=['hopping','binky'].includes(b.state)?Math.max(0,Math.sin(t*(b.state==='binky'?11:8)+b.phase))*(b.state==='binky'?13:7):0;
    }
    const s=this.sun;
    if(t>=s.next){
      const focus=g.agents[Math.floor(this.random()*g.agents.length)];
      s.targetX=this.random()<.65?clamp((focus.x-(g.layout?.moon.x||600))/(g.layout?250:150),-1,1):this.random()*2-1;s.targetY=this.random()<.65?.7:this.random()*1.6-.8;
      s.expression=celebrate?'laugh':['smile','curious','wink','smile','dozy'][Math.floor(this.random()*5)];s.next=t+3+this.random()*5;
    }
    if(celebrate)s.expression='laugh';
    if(t>=s.blinkAt){s.blinkUntil=t+.17;s.blinkAt=t+2+this.random()*5;}
    s.gazeX+=(s.targetX-s.gazeX)*Math.min(1,dt*2);s.gazeY+=(s.targetY-s.gazeY)*Math.min(1,dt*2);
  }
}
