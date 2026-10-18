export class EditorControls {
  constructor(canvas,view,callbacks){this.canvas=canvas;this.view=view;this.c=callbacks;this.pointers=new Map();this.blocked=false;this.active=false;this.pending=null;this.pendingStart=null;this.last=null;this.gesture=null;
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('pointerdown',e=>this.down(e));canvas.addEventListener('pointermove',e=>this.move(e));canvas.addEventListener('pointerup',e=>this.up(e));canvas.addEventListener('pointercancel',e=>this.abort(e));canvas.addEventListener('lostpointercapture',e=>{if(this.pointers.has(e.pointerId))this.abort(e);});
    canvas.addEventListener('pointerleave',()=>{if(!this.pointers.size)this.c.hover(null);});
    canvas.addEventListener('wheel',e=>{e.preventDefault();if(this.c.wheel?.(e))return;view.zoom(Math.exp(Math.max(-.3,Math.min(.3,e.deltaY*.001))));this.c.viewChanged?.();},{passive:false});
    window.addEventListener('blur',()=>this.reset(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)this.reset(true);});
  }
  pair(){const p=[...this.pointers.values()].slice(0,2);return {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)};}
  down(e){e.preventDefault();this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,button:e.button,type:e.pointerType});
    if(this.pointers.size>1){clearTimeout(this.pending);this.pending=null;this.pendingStart=null;if(this.active)this.c.cancelStroke();this.active=false;this.blocked=true;this.gesture=this.pair();return;}
    this.c.modifiers?.(e);this.last={x:e.clientX,y:e.clientY};this.dragKind=e.button===2?'rotate':(e.button===1||this.c.panHeld?.())?'pan':this.c.mode()==='navigate'?'rotate':'sculpt';
    if(this.dragKind==='sculpt'&&!this.blocked){const first={...this.last};const start=()=>{this.pending=null;this.pendingStart=null;if(this.pointers.size!==1||this.blocked)return;this.active=this.c.start(this.view.pick(first.x,first.y),e)!==false;if(this.active&&(first.x!==this.last.x||first.y!==this.last.y))this.c.move(this.view.pick(this.last.x,this.last.y),e);};if(e.pointerType==='touch'){this.pendingStart=start;this.pending=setTimeout(start,110);}else start();}
  }
  move(e){this.c.modifiers?.(e);const p=this.pointers.get(e.pointerId);if(!p){this.c.hover(this.view.pick(e.clientX,e.clientY),e);return;}p.x=e.clientX;p.y=e.clientY;
    if(this.pointers.size>1){const g=this.pair();if(this.gesture){this.view.pan(g.x-this.gesture.x,g.y-this.gesture.y);if(g.d>8&&this.gesture.d>8)this.view.zoom(this.gesture.d/g.d);}this.gesture=g;this.c.viewChanged?.();return;}
    if(this.blocked)return;const dx=e.clientX-this.last.x,dy=e.clientY-this.last.y;this.last={x:e.clientX,y:e.clientY};
    if(this.dragKind==='pan')this.view.pan(dx,dy);else if(this.dragKind==='rotate')this.view.rotate(dx,dy);else if(this.active)this.c.move(this.view.pick(e.clientX,e.clientY),e);
    if(this.dragKind!=='sculpt')this.c.viewChanged?.();
  }
  up(e){if(!this.pointers.has(e.pointerId))return;clearTimeout(this.pending);const starter=this.pendingStart;this.pending=null;this.pendingStart=null;
    if(!this.blocked&&this.pointers.size===1&&this.dragKind==='sculpt'){
      if(starter){this.last={x:e.clientX,y:e.clientY};starter();}
      if(this.active)this.c.end();
    }this.active=false;this.pointers.delete(e.pointerId);if(this.pointers.size===0){this.blocked=false;this.gesture=null;}else this.blocked=true;
  }
  abort(e){this.reset(true);}
  reset(cancel=false){clearTimeout(this.pending);this.pending=null;this.pendingStart=null;if(this.active&&cancel)this.c.cancelStroke();this.active=false;this.pointers.clear();this.blocked=false;this.gesture=null;}
}
