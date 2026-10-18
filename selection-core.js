import {N,STEP,HALF,heightAt,clamp,smooth} from './terrain-core.js?v=2.0.0';

export const FLAT_TOLERANCE=.02; // 2 cm: permits RG quantisation, never a visible slope.
export function pointInPolygon(x,z,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;}return inside;}
export function edgeDistance(x,z,points){let distance=Infinity;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);distance=Math.min(distance,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));}return distance;}
export function capturePatch(h,points,progress=()=>{}){
  if(points.length<3)throw Error('Dibuja un área cerrada más grande.');
  const r={x0:clamp(Math.floor((Math.min(...points.map(p=>p.x))+HALF)/STEP),0,N-1),x1:clamp(Math.ceil((Math.max(...points.map(p=>p.x))+HALF)/STEP),0,N-1),z0:clamp(Math.floor((Math.min(...points.map(p=>p.z))+HALF)/STEP),0,N-1),z1:clamp(Math.ceil((Math.max(...points.map(p=>p.z))+HALF)/STEP),0,N-1)};
  const width=r.x1-r.x0+1,height=r.z1-r.z0+1,mask=new Uint8Array(width*height),delta=new Float32Array(width*height),edge=new Float32Array(width*height);
  const boundary=points.map(p=>heightAt(h,p.x,p.z)).sort((a,b)=>a-b),base=boundary[Math.floor(boundary.length/2)];
  let count=0;
  for(let j=0;j<height;j++){for(let i=0;i<width;i++){const x=(r.x0+i)*STEP-HALF,z=(r.z0+j)*STEP-HALF,k=j*width+i;if(pointInPolygon(x,z,points)){mask[k]=1;delta[k]=h[(r.z0+j)*N+r.x0+i]-base;edge[k]=edgeDistance(x,z,points);count++;}}if(j%16===0)progress(j/height);}
  if(count<4)throw Error('El área debe incluir al menos cuatro muestras del terreno.');
  const center={x:(r.x0+Math.floor((width-1)/2))*STEP-HALF,z:(r.z0+Math.floor((height-1)/2))*STEP-HALF};
  return {width,height,mask,delta,edge,base,count,center,ox:Math.floor((width-1)/2),oz:Math.floor((height-1)/2),points:points.map(p=>({x:p.x-center.x,z:p.z-center.z}))};
}
export function rotatedOffset(x,z,turns){switch((turns%4+4)%4){case 1:return [-z,x];case 2:return [-x,-z];case 3:return [z,-x];default:return [x,z];}}
export function snappedPoint(p){return {x:Math.round(p.x/STEP)*STEP,z:Math.round(p.z/STEP)*STEP};}
export function patchOutline(patch,point,turns=0){const center=snappedPoint(point);return patch.points.map(p=>{const [x,z]=rotatedOffset(p.x,p.z,turns);return {x:x+center.x,z:z+center.z};});}
export function validatePaste(h,patch,point,turns=0){
  const center=snappedPoint(point),cx=Math.round((center.x+HALF)/STEP),cz=Math.round((center.z+HALF)/STEP);let min=Infinity,max=-Infinity,total=0,count=0,rect={x0:N,z0:N,x1:0,z1:0};
  for(let j=0;j<patch.height;j++)for(let i=0;i<patch.width;i++){if(!patch.mask[j*patch.width+i])continue;const [dx,dz]=rotatedOffset(i-patch.ox,j-patch.oz,turns),x=cx+dx,z=cz+dz;if(x<0||x>=N||z<0||z>=N)return {ok:false,reason:'La selección se sale del mapa.',center};const v=h[z*N+x];min=Math.min(min,v);max=Math.max(max,v);total+=v;count++;rect.x0=Math.min(rect.x0,x);rect.x1=Math.max(rect.x1,x);rect.z0=Math.min(rect.z0,z);rect.z1=Math.max(rect.z1,z);}
  const spread=max-min;return {ok:count>0&&spread<=FLAT_TOLERANCE,reason:spread>FLAT_TOLERANCE?`La zona tiene ${spread.toFixed(2)} m de desnivel. Aplánala primero.`:'Zona plana · lista para pegar',center,rect,base:total/Math.max(1,count),spread};
}
export function applyPatch(h,history,patch,point,{turns=0,feather=12}={}){
  const check=validatePaste(h,patch,point,turns);if(!check.ok)throw Error(check.reason);
  const cx=Math.round((check.center.x+HALF)/STEP),cz=Math.round((check.center.z+HALF)/STEP);
  const valueAt=k=>check.base+patch.delta[k]*(feather>0?smooth(patch.edge[k]/feather):1);
  // Validate before capturing/writing without allocating a million [index,value] pairs.
  for(let k=0;k<patch.mask.length;k++){if(!patch.mask[k])continue;const value=valueAt(k);if(!Number.isFinite(value)||Math.abs(value)>4096)throw Error('La copia supera el rango de trabajo del editor.');}
  history.capture(check.rect);
  for(let j=0;j<patch.height;j++)for(let i=0;i<patch.width;i++){const k=j*patch.width+i;if(!patch.mask[k])continue;const [dx,dz]=rotatedOffset(i-patch.ox,j-patch.oz,turns);h[(cz+dz)*N+cx+dx]=valueAt(k);}return check.rect;
}
