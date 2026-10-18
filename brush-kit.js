import {clamp,brushStamp,union} from './terrain-core.js?v=2.0.0';

export const DEFAULT_BRUSH=Object.freeze({diameter:200,force:8,ceiling:100,floor:-100,target:0,falloff:.7,shape:'circle',aspect:.5,angle:0,stabilize:.25,accumulate:true,flattenSource:'target',multiple:false,nibs:[]});
const number=(v,initial,min,max)=>Number.isFinite(v)?clamp(v,min,max):initial;
export function normalizeBrush(value={}) {
  const p={...DEFAULT_BRUSH};
  for(const [k,a,b]of [['diameter',16,1200],['force',.5,50],['ceiling',-4096,4096],['floor',-4096,4096],['target',-4096,4096],['falloff',.12,1],['aspect',.2,1],['angle',0,360],['stabilize',0,.9]])p[k]=number(value[k],p[k],a,b);
  p.shape=['circle','ellipse','square'].includes(value.shape)?value.shape:'circle';
  p.flattenSource=value.flattenSource==='touch'?'touch':'target';
  p.accumulate=value.accumulate!==false;p.multiple=!!value.multiple;
  p.nibs=(Array.isArray(value.nibs)?value.nibs:[]).slice(0,16).map(n=>({x:number(n.x,0,-.48,.48),z:number(n.z,0,-.48,.48),size:number(n.size,.22,.08,1),weight:number(n.weight,1,.1,2),effect:['raise','lower'].includes(n.effect)?n.effect:'inherit'}));
  if(!p.nibs.length)p.nibs=distributedNibs(5,17);
  return p;
}
export function distributedNibs(count=5,seed=17) {
  count=clamp(Math.round(count),1,16);let n=seed>>>0;
  const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  return Array.from({length:count},(_,i)=>{const angle=i*2.3999632297+random()*.24,r=count===1?0:Math.sqrt((i+.4)/count)*.34;return {x:Math.cos(angle)*r,z:Math.sin(angle)*r,size:clamp(.58/Math.sqrt(count)*( .85+random()*.3),.12,.5),weight:1,effect:'inherit'};});
}
export function brushHeads(x,z,p,tool) {
  if(!p.multiple||!p.nibs?.length)return [{x,z,tool,settings:p}];
  const a=p.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return p.nibs.map(n=>({x:x+(n.x*c-n.z*s)*p.diameter,z:z+(n.x*s+n.z*c)*p.diameter,tool:['raise','lower'].includes(tool)&&n.effect!=='inherit'?n.effect:tool,settings:{...p,multiple:false,nibs:[],diameter:Math.max(8,p.diameter*n.size),force:p.force*n.weight}}));
}
export function stampBrush(h,original,history,x,z,tool,p,dt) {
  let rect=null;
  for(const nib of brushHeads(x,z,p,tool))rect=union(rect,brushStamp(h,original,history,nib.x,nib.z,nib.tool,nib.settings,dt));
  return rect;
}
export function brushSpacing(p) {return Math.max(1,Math.min(...brushHeads(0,0,p,'raise').map(n=>n.settings.diameter))*.07);}
export function sanitizePresets(input) {
  return (Array.isArray(input)?input:[]).slice(0,24).filter(v=>v&&typeof v.name==='string').map((v,i)=>({id:typeof v.id==='string'?v.id.slice(0,64):'brush-'+i,name:v.name.slice(0,40),tool:['raise','lower','smooth','level','flatten','restore'].includes(v.tool)?v.tool:'raise',brush:normalizeBrush(v.brush)}));
}
