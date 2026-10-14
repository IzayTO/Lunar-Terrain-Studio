import {solarAt,LUNAR_DAY} from './solar.js';
export const SHADOW_FORMAT='lunar-terrain-shadows',SHADOW_VERSION=1;
// Full 4 m source grid directional horizon sweep. Each pass is O(N²).
// Intermediate ray horizons are linearly interpolated between adjacent scanlines.
// This is a documented grid approximation, not an exact continuous ray solver.
export function sweepMask(heights,n,light,outN=n){
  const result=new Uint8Array(Math.ceil(outN*outN/8));
  if(light[1]<-.02)return result;
  const majorX=Math.abs(light[0])>=Math.abs(light[2]),major=light[majorX?0:2],minor=light[majorX?2:0];
  if(Math.abs(major)<1e-8){result.fill(255);return result;}
  const direction=major>0?-1:1,shift=minor/Math.abs(major),drop=light[1]/Math.abs(major)*(4096/(n-1)),stride=(n-1)/(outN-1);
  let prev=new Float32Array(n),next=new Float32Array(n);prev.fill(-Infinity);
  for(let a=major>0?n-1:0;a>=0&&a<n;a+=direction){
    for(let b=0;b<n;b++){
      const q=b+shift,i=Math.floor(q),f=q-i;
      let upstream=-Infinity;
      if(i>=0&&i<n){if(f<1e-9)upstream=prev[i]-drop;else if(i+1<n&&Number.isFinite(prev[i])&&Number.isFinite(prev[i+1]))upstream=prev[i]*(1-f)+prev[i+1]*f-drop;}
      const x=majorX?a:b,z=majorX?b:a,y=heights[z*n+x];next[b]=Math.max(y,upstream);
      if(x%stride===0&&z%stride===0&&y+.24>=upstream){const k=(z/stride)*outN+x/stride;result[k>>3]|=1<<(k&7);}
    }[prev,next]=[next,prev];
  }return result;
}
export function maskDifference(a,b){let changed=0;for(let i=0;i<a.length;i++){let v=a[i]^b[i];v=v-((v>>>1)&85);v=(v&51)+((v>>>2)&51);changed+=((v+(v>>>4))&15);}return changed/(a.length*8);}
export async function adaptiveTimes(h,{maxSamples=160,progress=()=>{},yieldTask=()=>Promise.resolve()}={}){
  const n=129,coarse=new Float32Array(n*n);for(let z=0;z<n;z++)for(let x=0;x<n;x++)coarse[z*n+x]=h[z*8*1025+x*8];
  const records=new Map();
  async function sample(hour){if(records.has(hour))return records.get(hour);const s=solarAt(hour),r={s,mask:sweepMask(coarse,n,s.sun),earth:sweepMask(coarse,n,s.earth)};records.set(hour,r);if(records.size%4===0){progress(records.size);await yieldTask();}return r;}
  const times=[];for(let hour=0;hour<=24;hour++){times.push(hour);await sample(hour);}
  const queue=times.slice(0,-1).map((h,i)=>[h,times[i+1]]);
  while(queue.length&&records.size<maxSamples){
    const [a,b]=queue.shift(),ra=records.get(a),rb=records.get(b),mid=(a+b)/2,s=solarAt(mid),nearHorizon=Math.min(Math.abs(ra.s.sun[1]),Math.abs(rb.s.sun[1]),Math.abs(s.sun[1]))<.14;
    const variation=Math.max(maskDifference(ra.mask,rb.mask),maskDifference(ra.earth,rb.earth));
    const refine=(nearHorizon&&b-a>.0625)||(variation>.012&&b-a>.0625)||b-a>1;
    if(refine){await sample(mid);queue.push([a,mid],[mid,b]);}
  }
  return [...records.keys()].sort((a,b)=>a-b).map(hour=>records.get(hour).s);
}
export function packShadows(meta,frames){const header=new TextEncoder().encode(JSON.stringify(meta));const total=frames.reduce((s,f)=>s+f.sun.length+f.earth.length,0);const bytes=new Uint8Array(8+header.length+total);bytes.set([76,84,83,66]);new DataView(bytes.buffer).setUint32(4,header.length,true);bytes.set(header,8);let at=8+header.length;for(const f of frames){bytes.set(f.sun,at);at+=f.sun.length;bytes.set(f.earth,at);at+=f.earth.length;}return bytes;}
export function readShadows(bytes){
  if(!(bytes instanceof Uint8Array))bytes=new Uint8Array(bytes);
  if(bytes.length<8||String.fromCharCode(...bytes.subarray(0,4))!=='LTSB')throw Error('Paquete de sombras no válido.');
  const length=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(4,true);if(length>1024*1024||length+8>bytes.length)throw Error('Cabecera de sombras incorrecta.');
  const meta=JSON.parse(new TextDecoder().decode(bytes.subarray(8,8+length))),n=meta.resolution,count=meta.samples?.length;
  if(meta.format!==SHADOW_FORMAT||meta.version!==1||meta.worldSize!==4096||![129,257,513,1025].includes(n)||!count||count>256||!meta.heightSHA256?.match(/^[a-f0-9]{64}$/))throw Error('Formato de sombras incompatible.');
  const stride=Math.ceil(n*n/8);if(bytes.length!==8+length+stride*2*count)throw Error('Las sombras están incompletas.');
  let previous=-1;for(const s of meta.samples){if(!Number.isFinite(s.hour)||s.hour<=previous||s.hour<0||s.hour>24||![s.sun,s.earth].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))throw Error('Muestras solares incorrectas.');previous=s.hour;}
  if(meta.samples[0].hour!==0||meta.samples.at(-1).hour!==24)throw Error('Ciclo incompleto.');
  return {meta,bytes,stride,start:8+length,mask(index,channel){const begin=8+length+(index*2+channel)*stride;return bytes.subarray(begin,begin+stride);}};
}
export function sampleMask(mask,n,x,z){const gx=Math.max(0,Math.min(n-1,(x+2048)/4096*(n-1))),gz=Math.max(0,Math.min(n-1,(z+2048)/4096*(n-1))),ix=Math.min(n-2,Math.floor(gx)),iz=Math.min(n-2,Math.floor(gz)),a=gx-ix,b=gz-iz;const at=(x,z)=>(mask[(z*n+x)>>3]>>((z*n+x)&7))&1;return (at(ix,iz)*(1-a)+at(ix+1,iz)*a)*(1-b)+(at(ix,iz+1)*(1-a)+at(ix+1,iz+1)*a)*b;}
export function bracket(samples,hour){hour=((hour%24)+24)%24;let lo=0,hi=samples.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(samples[m].hour<=hour)lo=m;else hi=m;}return {lo,hi,t:(hour-samples[lo].hour)/(samples[hi].hour-samples[lo].hour)};}
export function makeShadowMeta(n,samples,hash){return {format:SHADOW_FORMAT,version:1,worldSize:4096,heightResolution:1025,resolution:n,spacingMeters:4096/(n-1),range:[-2048,2048],rows:'Z ascending',columns:'X ascending',heightSHA256:hash,heightHashEncoding:'row-major RG bytes, no B/A',lunarDay:LUNAR_DAY,cycle:'hour / 24',algorithm:'directional horizon sweep on 1025 grid; interpolated upstream horizon; binary visibility at height + 0.24m',encoding:'LSB-first bit masks; sun then earth per sample; 1 = unoccluded',samples};}
