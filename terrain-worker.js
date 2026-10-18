import {N,STEP,HALF,clamp,smooth,copyRect} from './terrain-core.js?v=2.0.0';
import {adaptiveTimes,sweepMask,makeShadowMeta,packShadows} from './shadow-core.js?v=2.0.0';
import {capturePatch} from './selection-core.js?v=2.0.0';
const pause=()=>new Promise(r=>setTimeout(r,0));
function report(progress,message){self.postMessage({type:'progress',progress,message});}
function curve(points,closed){let p=points.map(v=>[v.x,v.z]);for(let k=0;k<2;k++){const out=closed?[]:[p[0]];for(let i=0;i<p.length-(closed?0:1);i++){const a=p[i],b=p[(i+1)%p.length];out.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);}if(!closed)out.push(p.at(-1));p=out;}if(p.length>192){const stride=p.length/192;p=Array.from({length:192},(_,i)=>p[Math.floor(i*stride)]);}return p;}
async function contour({heights,points,settings}){
  const open=settings.kind==='channel',p=curve(points,!open),segments=p.length-(open?1:0),edge=settings.edge,width=settings.width/2;
  const margin=open?width+edge:edge*2;
  const xs=p.map(v=>v[0]),zs=p.map(v=>v[1]);const r={x0:clamp(Math.floor((Math.min(...xs)-margin+HALF)/STEP),0,N-1),x1:clamp(Math.ceil((Math.max(...xs)+margin+HALF)/STEP),0,N-1),z0:clamp(Math.floor((Math.min(...zs)-margin+HALF)/STEP),0,N-1),z1:clamp(Math.ceil((Math.max(...zs)+margin+HALF)/STEP),0,N-1)};
  const out=copyRect(heights,r),w=r.x1-r.x0+1;
  for(let j=r.z0;j<=r.z1;j++){
    const z=j*STEP-HALF;
    for(let i=r.x0;i<=r.x1;i++){
      const x=i*STEP-HALF;let inside=false,d2=Infinity;
      for(let k=0;k<segments;k++){const a=p[k],b=p[(k+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],u=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);d2=Math.min(d2,(x-a[0]-dx*u)**2+(z-a[1]-dz*u)**2);if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}
      const dist=Math.sqrt(d2),amount=Math.abs(settings.amount),t=smooth(dist/Math.max(4,edge));let delta=0,k=(j-r.z0)*w+i-r.x0;
      if(open)delta=-amount*smooth((width+edge-dist)/Math.max(4,width+edge));
      else if(settings.kind==='mound')delta=inside?amount*(1-Math.exp(-Math.pow(dist/Math.max(4,edge),2))):0;
      else if(settings.kind==='depression'||settings.kind==='basin')delta=inside?-amount*(settings.kind==='basin'?t:1-Math.exp(-Math.pow(dist/Math.max(4,edge),2))):0;
      else if(settings.kind==='crater'){const rim=settings.rim*Math.exp(-Math.pow(dist/Math.max(4,edge*.55),2))*smooth((edge*2-dist)/Math.max(4,edge*.5));delta=rim-(inside?amount*t:0);}
      out[k]=clamp(out[k]+delta,-4096,4096);
    }
    if((j-r.z0)%12===0){report((j-r.z0)/(r.z1-r.z0+1),'Preparando contorno…');await pause();}
  }self.postMessage({type:'contour',rect:r,data:out,curve:p,closed:!open},[out.buffer]);
}
async function bake({heights,resolution,heightHash}){
  report(.01,'Buscando cambios de luz y horizontes…');
  const samples=await adaptiveTimes(heights,{progress:n=>report(.02+.13*Math.min(1,n/160),`Muestreo adaptativo · ${n} instantes`),yieldTask:pause});
  const frames=[];
  for(let i=0;i<samples.length;i++){
    const sun=sweepMask(heights,N,samples[i].sun,resolution);await pause();
    const earth=sweepMask(heights,N,samples[i].earth,resolution);frames.push({sun,earth});
    report(.15+.84*(i+1)/samples.length,`Sombras ${i+1} / ${samples.length} · ${(samples[i].cycle*100).toFixed(1)} %`);await pause();
  }
  const meta=makeShadowMeta(resolution,samples,heightHash),data=packShadows(meta,frames);self.postMessage({type:'bake',data,meta},[data.buffer]);
}
self.onmessage=async({data})=>{try{
  if(data.type==='contour')await contour(data);
  else if(data.type==='bake')await bake(data);
  else if(data.type==='capture'){
    report(.02,'Leyendo el área seleccionada…');await pause();
    const patch=capturePatch(data.heights,data.points,p=>report(p,'Copiando alturas y borde…'));
    self.postMessage({type:'capture',patch},[patch.mask.buffer,patch.delta.buffer,patch.edge.buffer]);
  }else throw Error('Operación desconocida.');
}catch(e){self.postMessage({type:'error',message:e.message});}};
