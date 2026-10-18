import * as THREE from './three.module.js';
import {heightAt,clamp} from './terrain-core.js?v=2.0.0';
import {snappedPoint} from './selection-core.js?v=2.0.0';

export const GUIDE_DEFAULTS={spawn:true,player:true,detail:false,map:true,gridStep:100,human:false,rover:false,panel:false,x:0,z:0,angle:0,eyeHeight:1.68,opacity:.24};
export function normalizeGuides(value={}){const g={...GUIDE_DEFAULTS};for(const k of ['spawn','player','detail','map','human','rover','panel'])if(typeof value[k]==='boolean')g[k]=value[k];for(const [k,a,b]of [['x',-2035,2035],['z',-2035,2035],['angle',0,360],['eyeHeight',.8,2.3],['opacity',.08,.7]])if(Number.isFinite(value[k]))g[k]=clamp(value[k],a,b);if([4,10,25,50,100,250].includes(value.gridStep))g.gridStep=value.gridStep;return g;}

function solid(parts,color){
  const positions=[];
  const add=(geometry,p=[0,0,0],rot=[0,0,0])=>{const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),new THREE.Vector3(1,1,1)),g=geometry.index?geometry.toNonIndexed():geometry;g.applyMatrix4(matrix);const a=g.attributes.position.array;for(const v of a)positions.push(v);g.dispose();if(g!==geometry)geometry.dispose();};
  const box=(s,p,r)=>add(new THREE.BoxGeometry(...s),p,r);
  const tube=(a,b,r)=>{const pa=new THREE.Vector3(...a),pb=new THREE.Vector3(...b),g=new THREE.CylinderGeometry(r,r,pa.distanceTo(pb),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),pb.clone().sub(pa).normalize()));add(g,pa.add(pb).multiplyScalar(.5).toArray());};
  parts({add,box,tube});const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeBoundingBox();
  const group=new THREE.Group(),fill=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide,toneMapped:false})),edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,38),new THREE.LineBasicMaterial({color,transparent:true,opacity:.7,depthWrite:false,toneMapped:false}));
  group.add(fill,edges);group.userData.fill=fill;group.userData.edges=edges;return group;
}
export function makeHuman(){return solid(({add,box,tube})=>{
  add(new THREE.SphereGeometry(.115,12,8),[0,1.685,0]);box([.38,.47,.22],[0,1.235,0]);box([.3,.2,.21],[0,.92,0]);
  for(const s of [-1,1]){tube([s*.12,.88,0],[s*.14,.5,.015],.07);tube([s*.14,.5,.015],[s*.15,.12,0],.055);box([.12,.11,.25],[s*.15,.055,-.055]);tube([s*.25,1.43,0],[s*.31,1.12,0],.055);tube([s*.31,1.12,0],[s*.34,.87,-.03],.045);}
},0x9edbc9);}
export function makeRover(){return solid(({add,box,tube})=>{
  box([1.56,.16,2.73],[0,.57,0]);box([1.25,.16,1.76],[0,.37,.12]);
  for(const x of [-.87,.87])for(const z of [-1.05,1.05]){add(new THREE.CylinderGeometry(.39,.39,.29,16),[x,.39,z],[0,0,Math.PI/2]);tube([Math.sign(x)*.45,.51,z],[x,.35,z],.034);}
  for(const x of [-.39,.39]){box([.59,.13,.56],[x,.92,.02]);box([.57,.66,.12],[x,1.28,.30],[-.11,0,0]);tube([x-.24,.62,.31],[x-.24,1.64,.36],.023);tube([x+.24,.62,.31],[x+.24,1.64,.36],.023);}
  box([1.07,.26,.35],[0,1.10,-.72],[-.17,0,0]);box([1.35,.43,.49],[0,.87,1.02]);tube([.65,.69,.99],[.65,2.33,.99],.022);add(new THREE.SphereGeometry(.052,8,6),[.65,2.33,.99]);
  tube([.67,.64,-.88],[.67,1.79,-.84],.026);add(new THREE.CylinderGeometry(.30,.26,.065,16),[.67,1.84,-.88],[Math.PI/2-.35,0,0]);
  add(new THREE.TorusGeometry(.15,.016,6,16),[-.39,1.34,-.41],[-.4,0,0]);
},0xa7bfec);}
export function makePanel(){return solid(({box})=>{box([4,2.8,.16],[0,1.4,0]);for(const x of [-1.955,1.955])box([.09,2.8,.19],[x,1.4,0]);box([4,.14,.19],[0,.18,0]);},0xe7bf8c);}
function label(text,color){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;const c=canvas.getContext('2d');c.font='500 25px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#10171ee8';c.fillRect(0,0,512,64);c.fillStyle=color;c.fillText(text,256,32);const texture=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));sprite.scale.set(4.8,.6,1);return sprite;}

export class SceneGuides{
  constructor(view){this.view=view;this.settings=normalizeGuides();this.models={human:makeHuman(),rover:makeRover(),panel:makePanel()};this.labels={human:label('PERSONA · ESCALA HUMANA','#b4e0d0'),rover:label('ROVER · ≈ 2,9 × 2 m','#b3c9ef'),panel:label('PANEL · 4 × 2,8 m','#e6c299')};this.group=new THREE.Group();for(const key of Object.keys(this.models))this.group.add(this.models[key],this.labels[key]);view.scene.add(this.group);this.spawn=view.makeLine(0xa0dac8);this.ring=view.makeLine(0xd7b382);this.spawnLabel=label('APARICIÓN · X 0 / Z 0','#b4e0d0');view.scene.add(this.spawnLabel);this.paste=new THREE.Group();view.scene.add(this.paste);this.update();}
  set(settings){this.settings=normalizeGuides(settings);this.update();}
  update(){const v=this.view,h=v.h,s=this.settings,a=s.angle*Math.PI/180,c=Math.cos(a),sn=Math.sin(a);let offset=0;const enabled=Object.keys(this.models).filter(k=>s[k]);const spacing=5.2;
    for(const key of Object.keys(this.models)){const model=this.models[key],tag=this.labels[key];model.visible=tag.visible=s[key];if(!s[key])continue;const dx=(offset++-(enabled.length-1)/2)*spacing,x=s.x+dx*c,z=s.z+dx*sn,y=heightAt(h,x,z);model.position.set(x,y,z);model.rotation.y=-a;const scale=key==='human'?s.eyeHeight/1.68:1;model.scale.setScalar(scale);model.userData.fill.material.opacity=s.opacity;model.userData.edges.material.opacity=Math.min(1,s.opacity+.45);tag.position.set(x,y+(key==='panel'?3.3:key==='rover'?2.9:1.8*scale+.5),z);}
    const sh=heightAt(h,0,0)+.15;v.setLine(this.spawn,[{x:-14,y:sh,z:0},{x:14,y:sh,z:0},{x:0,y:sh,z:0},{x:0,y:sh,z:-14},{x:0,y:sh,z:14}]);this.spawn.visible=s.spawn;this.spawnLabel.visible=s.spawn;this.spawnLabel.position.set(0,heightAt(h,0,-20)+.5,-20);this.updateLabelScale();
    const points=[];for(let i=0;i<=256;i++){const t=i/256*Math.PI*2,x=Math.cos(t)*600,z=Math.sin(t)*600;points.push({x,z,y:heightAt(h,x,z)+.25});}v.setLine(this.ring,points);this.ring.visible=s.player;v.u.showBounds.value=s.detail?1:0;v.boundary.visible=s.map;v.u.gridStep.value=s.gridStep;v.dirty=true;
  }
  updateLabelScale(){const width=clamp(this.view.radius*.04,3,65);if(width!==this.labelWidth){this.spawnLabel.scale.set(width,width/8,1);this.labelWidth=width;this.view.dirty=true;}}
  clearPaste(){for(const o of [...this.paste.children]){this.paste.remove(o);o.geometry?.dispose();o.material?.dispose();}this.patch=null;this.view.dirty=true;}
  previewPatch(patch,point,check,turns=0,feather=12){
    if(this.patch!==patch||this.patchFeather!==feather){this.clearPaste();const positions=[],indices=[],step=Math.max(1,Math.ceil(Math.max(patch.width,patch.height)/160)),cols=Math.ceil((patch.width-1)/step)+1,rows=Math.ceil((patch.height-1)/step)+1,mask=[];
      for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const x=Math.min(i*step,patch.width-1),z=Math.min(j*step,patch.height-1),k=z*patch.width+x,t=feather?clamp(patch.edge[k]/feather,0,1):1;positions.push((x-patch.ox)*4,patch.delta[k]*t*t*(3-2*t),(z-patch.oz)*4);mask.push(patch.mask[k]);}
      for(let j=0;j<rows-1;j++)for(let i=0;i<cols-1;i++){const a=j*cols+i,b=a+1,c=a+cols,d=c+1;if(mask[a]&&mask[b]&&mask[c])indices.push(a,c,b);if(mask[b]&&mask[c]&&mask[d])indices.push(b,c,d);}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();this.pasteMesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x89d6c5,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));this.paste.add(this.pasteMesh);this.patch=patch;this.patchFeather=feather;
    }
    const p=snappedPoint(point);this.paste.position.set(p.x,(Number.isFinite(check.base)?check.base:heightAt(this.view.h,p.x,p.z))+.12,p.z);this.paste.rotation.y=-turns*Math.PI/2;this.pasteMesh.material.color.set(check.ok?0x89d6c5:0xf18c80);this.paste.visible=true;this.view.dirty=true;
  }
}
