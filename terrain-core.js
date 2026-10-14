export const N=1025,SIZE=4096,HALF=2048,STEP=4;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
export function decodeRG(p){const h=new Float32Array(N*N);if(p.length!==N*N*4)throw Error('El PNG debe tener 1025 × 1025 píxeles.');for(let i=0;i<h.length;i++)h[i]=(p[i*4]*256+p[i*4+1])/65535*256-128;return h;}
export function boundsOf(h){let min=Infinity,max=-Infinity,out=0;for(const v of h){if(!Number.isFinite(v))throw Error('El terreno contiene alturas no válidas.');min=Math.min(min,v);max=Math.max(max,v);if(v < -128||v>128)out++;}return {min,max,out};}
export function encodeRG(h){const stats=boundsOf(h);if(stats.out)throw Error(`${stats.out.toLocaleString('es')} muestras fuera de −128…128 m. Corrige el rango antes de exportar.`);const p=new Uint8Array(N*N*4);for(let i=0;i<h.length;i++){const q=Math.round((h[i]+128)/256*65535);p[i*4]=q>>8;p[i*4+1]=q&255;p[i*4+2]=0;p[i*4+3]=255;}return p;}
export function heightAt(h,x,z){const fx=clamp((x+HALF)/STEP,0,N-1),fz=clamp((z+HALF)/STEP,0,N-1),ix=Math.min(N-2,Math.floor(fx)),iz=Math.min(N-2,Math.floor(fz)),a=fx-ix,b=fz-iz,i=iz*N+ix;return a+b<=1?h[i]+(h[i+1]-h[i])*a+(h[i+N]-h[i])*b:h[i+N+1]+(h[i+N]-h[i+N+1])*(1-a)+(h[i+1]-h[i+N+1])*(1-b);}
export function normalAt(h,x,z){const a=heightAt(h,x-2,z)-heightAt(h,x+2,z),b=heightAt(h,x,z-2)-heightAt(h,x,z+2),l=Math.hypot(a,4,b);return [a/l,4/l,b/l];}
export const fullRect=()=>({x0:0,z0:0,x1:N-1,z1:N-1});
export function union(a,b){if(!a)return {...b};return {x0:Math.min(a.x0,b.x0),z0:Math.min(a.z0,b.z0),x1:Math.max(a.x1,b.x1),z1:Math.max(a.z1,b.z1)};}
export function copyRect(h,r){const w=r.x1-r.x0+1,out=new Float32Array(w*(r.z1-r.z0+1));for(let z=r.z0;z<=r.z1;z++)out.set(h.subarray(z*N+r.x0,z*N+r.x1+1),(z-r.z0)*w);return out;}
export function putRect(h,r,data){const w=r.x1-r.x0+1;for(let z=r.z0;z<=r.z1;z++)h.set(data.subarray((z-r.z0)*w,(z-r.z0+1)*w),z*N+r.x0);}
export class History {
  constructor(h,limit=64*1024*1024){this.h=h;this.limit=limit;this.undo=[];this.redo=[];this.pending=null;}
  begin(label){if(this.pending)throw Error('Hay una operación pendiente.');this.pending={label,tiles:new Map(),rect:null};}
  capture(r){if(!this.pending)return;this.pending.rect=union(this.pending.rect,r);for(let tz=Math.floor(r.z0/64);tz<=Math.floor(r.z1/64);tz++)for(let tx=Math.floor(r.x0/64);tx<=Math.floor(r.x1/64);tx++){const id=tz*17+tx;if(this.pending.tiles.has(id))continue;const b={x0:tx*64,z0:tz*64,x1:Math.min(N-1,tx*64+63),z1:Math.min(N-1,tz*64+63)};this.pending.tiles.set(id,{r:b,before:copyRect(this.h,b)});}}
  baseline(i){const x=i%N,z=Math.floor(i/N),tx=Math.floor(x/64),tz=Math.floor(z/64),p=this.pending?.tiles.get(tz*17+tx);return p?p.before[(z-p.r.z0)*(p.r.x1-p.r.x0+1)+x-p.r.x0]:this.h[i];}
  cancel(){const p=this.pending;if(!p)return null;for(const t of p.tiles.values())putRect(this.h,t.r,t.before);this.pending=null;return p.rect;}
  commit(){const p=this.pending;if(!p)return false;const tiles=[];let bytes=0;for(const t of p.tiles.values()){const after=copyRect(this.h,t.r);if(!after.some((v,i)=>v!==t.before[i]))continue;tiles.push({...t,after});bytes+=after.byteLength*2;}this.pending=null;if(!tiles.length)return false;this.undo.push({label:p.label,tiles,rect:p.rect,bytes});this.redo=[];while(this.undo.length>1&&this.undo.reduce((s,t)=>s+t.bytes,0)>this.limit)this.undo.shift();return true;}
  step(redo=false){const from=redo?this.redo:this.undo,to=redo?this.undo:this.redo,p=from.pop();if(!p)return null;for(const t of p.tiles)putRect(this.h,t.r,redo?t.after:t.before);to.push(p);return p;}
  clear(){this.undo=[];this.redo=[];this.pending=null;}
}
export function brushStamp(h,original,history,x,z,tool,p,dt){
  const rx=p.diameter/2,rz=rx*(p.shape==='ellipse'?p.aspect:1),angle=p.angle*Math.PI/180,cs=Math.cos(angle),sn=Math.sin(angle),ex=Math.hypot(rx*cs,rz*sn),ez=Math.hypot(rx*sn,rz*cs);
  const r={x0:clamp(Math.floor((x-ex+HALF)/STEP),0,N-1),x1:clamp(Math.ceil((x+ex+HALF)/STEP),0,N-1),z0:clamp(Math.floor((z-ez+HALF)/STEP),0,N-1),z1:clamp(Math.ceil((z+ez+HALF)/STEP),0,N-1)};history.capture(r);
  const sr={x0:Math.max(0,r.x0-2),x1:Math.min(N-1,r.x1+2),z0:Math.max(0,r.z0-2),z1:Math.min(N-1,r.z1+2)},sw=sr.x1-sr.x0+1,src=tool==='smooth'?copyRect(h,sr):null;
  for(let j=r.z0;j<=r.z1;j++)for(let i=r.x0;i<=r.x1;i++){
    const dx=i*STEP-HALF-x,dz=j*STEP-HALF-z,d=Math.hypot((dx*cs+dz*sn)/rx,(-dx*sn+dz*cs)/rz);if(d>=1)continue;
    const w=smooth((1-d)/Math.max(.12,p.falloff)),k=j*N+i,old=h[k],gain=1-Math.exp(-p.force*.3*dt*w);let v=old;
    if(tool==='raise'||tool==='lower'){
      const sign=tool==='raise'?1:-1;
      if(p.accumulate)v=old+sign*p.force*dt*w;
      else {const base=history.baseline(k),desired=base+sign*p.force*w;v=sign>0?Math.max(old,desired):Math.min(old,desired);}
      v=sign>0?Math.min(v,Math.max(old,p.ceiling)):Math.max(v,Math.min(old,p.floor));
    }else if(tool==='level')v=old+(p.target-old)*gain;
    else if(tool==='restore')v=old+(original[k]-old)*gain;
    else if(tool==='smooth'){
      let total=0,weight=0;for(let b=-2;b<=2;b++)for(let a=-2;a<=2;a++){const sx=clamp(i+a,sr.x0,sr.x1),sz=clamp(j+b,sr.z0,sr.z1),wgt=(3-Math.abs(a))*(3-Math.abs(b));total+=src[(sz-sr.z0)*sw+sx-sr.x0]*wgt;weight+=wgt;}v=old+(total/weight-old)*gain;
    }
    h[k]=clamp(v,-4096,4096);
  }return r;
}
// Exact ray vs the same two triangles used by the game. Grid DDA avoids mesh LOD picking errors.
export function rayHeightfield(h,o,d){
  let enter=0,leave=20000;for(const axis of ['x','z']){if(Math.abs(d[axis])<1e-12){if(Math.abs(o[axis])>HALF)return null;}else{let a=(-HALF-o[axis])/d[axis],b=(HALF-o[axis])/d[axis];if(a>b)[a,b]=[b,a];enter=Math.max(enter,a);leave=Math.min(leave,b);}}if(leave<enter)return null;
  if(Math.hypot(d.x,d.z)<1e-10){const y=heightAt(h,o.x,o.z),t=(y-o.y)/d.y;return t>=0?{x:o.x,y,z:o.z}:null;}
  let t=enter+1e-6;for(let count=0;count<2200&&t<=leave;count++){
    const px=o.x+d.x*t,pz=o.z+d.z*t,ix=clamp(Math.floor((px+HALF)/STEP),0,N-2),iz=clamp(Math.floor((pz+HALF)/STEP),0,N-2),k=iz*N+ix;
    let tx=Math.abs(d.x)<1e-12?Infinity:((ix+(d.x>0?1:0))*STEP-HALF-o.x)/d.x,tz=Math.abs(d.z)<1e-12?Infinity:((iz+(d.z>0?1:0))*STEP-HALF-o.z)/d.z,end=Math.min(tx,tz,leave);
    for(let tri=0;tri<2;tri++){
      const ax=tri?(h[k+N+1]-h[k+N])/STEP:(h[k+1]-h[k])/STEP,az=tri?(h[k+N+1]-h[k+1])/STEP:(h[k+N]-h[k])/STEP,c=tri?h[k+1]+h[k+N]-h[k+N+1]:h[k];
      const den=d.y-ax*d.x-az*d.z;if(Math.abs(den)<1e-12)continue;
      const q=(c+ax*(o.x-(ix*STEP-HALF))+az*(o.z-(iz*STEP-HALF))-o.y)/den;
      if(q<enter-1e-6||q<t-2e-6||q>end+2e-6)continue;
      const x=o.x+d.x*q,z=o.z+d.z*q,a=(x+HALF)/STEP-ix,b=(z+HALF)/STEP-iz;
      if(a>=-1e-5&&b>=-1e-5&&a<=1.00001&&b<=1.00001&&(tri?a+b>=.99999:a+b<=1.00001))return {x,y:o.y+d.y*q,z};
    }
    if(!Number.isFinite(end)||end>=leave)break;t=end+1e-5;
  }return null;
}
