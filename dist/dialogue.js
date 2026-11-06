export class DialogueQueue{
  constructor(){this.channels={god:{active:null,pending:[]},agent:{active:null,pending:[]}};this.serial=0;}
  enqueue(channel,message,now){
    const lane=this.channels[channel],entry={...message,id:++this.serial,duration:Math.max(10,Math.min(17,5+message.text.split(/\s+/).length*.55))};
    if(!lane.active){lane.active={...entry,start:now};return;}
    // Only unseen messages may be coalesced. Nothing replaces a visible bubble.
    const duplicate=lane.pending.findIndex(m=>m.ownerId===entry.ownerId);
    if(duplicate>=0)lane.pending[duplicate]=entry;
    else{lane.pending.push(entry);if(lane.pending.length>3)lane.pending.shift();}
  }
  update(now){for(const lane of Object.values(this.channels))if(lane.active&&now>=lane.active.start+lane.active.duration+1){lane.active=lane.pending.length?{...lane.pending.shift(),start:now}:null;}}
  visible(channel,now){const a=this.channels[channel].active;if(!a)return null;const age=now-a.start;return{...a,alpha:Math.max(0,Math.min(1,age/.35,(a.duration+1-age)/1))};}
}
