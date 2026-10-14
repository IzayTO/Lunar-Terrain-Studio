import * as THREE from './three.module.js';
import {N,SIZE,HALF,STEP,heightAt,normalAt,rayHeightfield,clamp} from './terrain-core.js';
import {solarAt} from './solar.js';
import {bracket,sampleMask} from './shadow-core.js';
const heightGLSL=`uniform sampler2D heightMap;
float corner(vec2 g){return texture2D(heightMap,(clamp(g,vec2(0.),vec2(1024.))+.5)/1025.).r;}
float heightAt(vec2 p){vec2 g=clamp((p+2048.)/4.,vec2(0.),vec2(1024.)),i=min(floor(g),vec2(1023.)),f=g-i;float b=corner(i+vec2(1.,0.)),c=corner(i+vec2(0.,1.));if(f.x+f.y<=1.){float a=corner(i);return a+(b-a)*f.x+(c-a)*f.y;}float d=corner(i+1.);return d+(c-d)*(1.-f.x)+(b-d)*(1.-f.y);}
float visibility(vec3 p,vec3 light){if(light.y<-.02)return 0.;float v=1.,dist=2.;for(int i=0;i<28;i++){vec3 q=p+light*dist;if(max(abs(q.x),abs(q.z))>2048.)break;float gap=q.y-heightAt(q.xz);v=min(v,smoothstep(-.28,.32+dist*.0015,gap));if(v<.005)break;dist=dist*1.37+1.8;}return v;}`;
export class TerrainView {
  constructor(canvas,heights,onStatus){
    this.canvas=canvas;this.h=heights;this.onStatus=onStatus;this.mobile=matchMedia('(pointer:coarse)').matches;this.renderer=new THREE.WebGLRenderer({canvas,antialias:!this.mobile,powerPreference:'default'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.mobile?1.25:1.7));this.renderer.setClearColor(0x080b10);this.renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
    this.scene=new THREE.Scene();this.cameraP=new THREE.PerspectiveCamera(48,1,.5,18000);this.cameraO=new THREE.OrthographicCamera(-1,1,1,-1,.5,18000);this.camera=this.cameraP;this.target=new THREE.Vector3(0,0,0);this.radius=1700;this.theta=.58;this.phi=.82;this.mode='orbit';this.selected=null;this.tiles=[];this.sunHour=8.4;this.dirty=true;this.cacheDirty=true;this.lastCache=0;this.lastLOD=0;this.frameCount=0;this.lastStatus=0;this.baked=null;
    this.heightTexture=new THREE.DataTexture(this.h,N,N,THREE.RedFormat,THREE.FloatType);this.heightTexture.minFilter=this.heightTexture.magFilter=THREE.NearestFilter;this.heightTexture.generateMipmaps=false;this.heightTexture.needsUpdate=true;
    this.live=new THREE.WebGLRenderTarget(this.mobile?384:512,this.mobile?384:512,{depthBuffer:false,stencilBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});this.live.texture.generateMipmaps=false;
    this.shadowUniforms={heightMap:{value:this.heightTexture},sun:{value:new THREE.Vector3()},earth:{value:new THREE.Vector3()}};
    this.cacheScene=new THREE.Scene();this.cacheCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    const cacheMat=new THREE.ShaderMaterial({uniforms:this.shadowUniforms,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'varying vec2 coord;void main(){coord=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`precision highp float;varying vec2 coord;uniform vec3 sun,earth;${heightGLSL}void main(){vec2 xz=coord*4096.-2048.;vec3 n=normalize(vec3(heightAt(xz-vec2(2.,0.))-heightAt(xz+vec2(2.,0.)),4.,heightAt(xz-vec2(0.,2.))-heightAt(xz+vec2(0.,2.))));vec3 p=vec3(xz.x,heightAt(xz),xz.y)+n*.24;gl_FragColor=vec4(visibility(p,sun),visibility(p,earth),0.,1.);}`});
    this.cacheScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),cacheMat));
    const blank=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);blank.needsUpdate=true;
    this.u={sun:{value:new THREE.Vector3()},earth:{value:new THREE.Vector3()},earthPower:{value:0},lightMap:{value:this.live.texture},grid:{value:0},workLight:{value:0},referenceMap:{value:blank},referenceRect:{value:new THREE.Vector4(0,0,1000,1000)},referenceOpacity:{value:0},referenceAngle:{value:0},showBounds:{value:1}};
    this.material=new THREE.ShaderMaterial({uniforms:this.u,toneMapped:false,vertexShader:'varying vec3 world,norm;void main(){world=position;norm=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`precision highp float;varying vec3 world,norm;uniform vec3 sun,earth;uniform float earthPower,grid,workLight,referenceOpacity,referenceAngle,showBounds;uniform sampler2D lightMap,referenceMap;uniform vec4 referenceRect;
    void main(){vec3 n=normalize(norm);vec2 vis=texture2D(lightMap,(world.xz+2048.)/4096.).rg;float s=max(0.,dot(n,sun))*vis.r*step(-.01,sun.y),e=max(0.,dot(n,earth))*vis.g*earthPower;vec3 illumination=vec3(.000025)+vec3(1.,.98,.93)*s*1.38+vec3(.46,.63,1.)*e+vec3(workLight);vec3 color=pow(max(vec3(.2772,.28,.2842)*illumination,vec3(0.)),vec3(1./2.2));
      if(grid>.5){vec2 cell=world.xz/100.;vec2 edge=abs(fract(cell-.5)-.5)/max(fwidth(cell),vec2(.0001));float line=1.-min(1.,min(edge.x,edge.y));color=mix(color,vec3(.34,.46,.53),line*.42);}
      if(showBounds>.5){float m=max(abs(world.x),abs(world.z));float line=1.-smoothstep(0.,max(fwidth(m)*1.8,2.),abs(m-768.));color=mix(color,vec3(.35,.66,.68),line*.4);}
      vec2 d=world.xz-referenceRect.xy;float c=cos(referenceAngle),sA=sin(referenceAngle);vec2 uv=vec2(d.x*c+d.y*sA,-d.x*sA+d.y*c)/referenceRect.zw+.5;if(referenceOpacity>0.&&min(uv.x,uv.y)>=0.&&max(uv.x,uv.y)<=1.){vec4 ref=texture2D(referenceMap,uv);color=mix(color,ref.rgb,referenceOpacity*ref.a);}gl_FragColor=vec4(color,1.);}`});
    this.terrain=new THREE.Group();this.scene.add(this.terrain);
    for(let z=0;z<8;z++)for(let x=0;x<8;x++){const tile={x:x*128,z:z*128,step:0,mesh:null};this.tiles.push(tile);this.buildTile(tile,8);}
    this.cursor=this.makeLine(0x86ddd0);this.outline=this.makeLine(0xf0c985);this.boundary=this.makeLine(0x5d7485);this.cursor.visible=false;this.outline.visible=false;this.updateBoundary();
    this.ray=new THREE.Raycaster();this.ndc=new THREE.Vector2();this.resize();this.updateCamera();
  }
  makeLine(color){const line=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color,depthTest:false,transparent:true,opacity:.9}));line.renderOrder=20;line.frustumCulled=false;this.scene.add(line);return line;}
  setLine(line,points){line.geometry.dispose();line.geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p.x,p.y??heightAt(this.h,p.x,p.z)+1,p.z)));line.visible=points.length>1;this.dirty=true;}
  buildTile(tile,step){if(tile.mesh){this.terrain.remove(tile.mesh);tile.mesh.geometry.dispose();}tile.step=step;const seg=128/step,p=[],normal=[],indices=[],samples=[];
    for(let z=0;z<=seg;z++)for(let x=0;x<=seg;x++){const gx=tile.x+x*step,gz=tile.z+z*step,wx=gx*STEP-HALF,wz=gz*STEP-HALF;p.push(wx,this.h[gz*N+gx],wz);normal.push(...normalAt(this.h,wx,wz));samples.push([gx,gz,0]);}
    for(let z=0;z<seg;z++)for(let x=0;x<seg;x++){const a=z*(seg+1)+x,b=a+1,c=a+seg+1;indices.push(a,c,b,b,c,c+1);}
    const edge=[];for(let x=0;x<=seg;x++)edge.push(x);for(let z=1;z<=seg;z++)edge.push(z*(seg+1)+seg);for(let x=seg-1;x>=0;x--)edge.push(seg*(seg+1)+x);for(let z=seg-1;z>0;z--)edge.push(z*(seg+1));const start=p.length/3;
    for(const i of edge){p.push(p[i*3],p[i*3+1]-12,p[i*3+2]);normal.push(normal[i*3],normal[i*3+1],normal[i*3+2]);samples.push([samples[i][0],samples[i][1],12]);}
    for(let i=0;i<edge.length;i++){const j=(i+1)%edge.length;indices.push(edge[i],start+i,edge[j],edge[j],start+i,start+j);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3).setUsage(THREE.DynamicDrawUsage));g.setIndex(indices);g.computeBoundingSphere();tile.samples=samples;tile.mesh=new THREE.Mesh(g,this.material);this.terrain.add(tile.mesh);
  }
  updateLOD(){for(const t of this.tiles){const x=(t.x+64)*4-HALF,z=(t.z+64)*4-HALF,dist=Math.hypot(x-this.target.x,z-this.target.z,this.radius*.55);const step=dist<500?1:dist<1000?2:dist<2200?4:8;if(t.step!==step)this.buildTile(t,step);}}
  changed(rect){this.heightTexture.needsUpdate=true;this.cacheDirty=true;this.dirty=true;for(const t of this.tiles){if(rect&&(t.x>rect.x1+1||t.x+128<rect.x0-1||t.z>rect.z1+1||t.z+128<rect.z0-1))continue;const g=t.mesh.geometry,p=g.attributes.position,n=g.attributes.normal;let first=Infinity,last=-1;for(let i=0;i<t.samples.length;i++){const [x,z,skirt]=t.samples[i];if(rect&&(x<rect.x0-1||x>rect.x1+1||z<rect.z0-1||z>rect.z1+1))continue;p.setY(i,this.h[z*N+x]-skirt);const v=normalAt(this.h,x*4-HALF,z*4-HALF);n.setXYZ(i,...v);first=Math.min(first,i);last=i;}if(last>=first){p.addUpdateRange(first*3,(last-first+1)*3);n.addUpdateRange(first*3,(last-first+1)*3);p.needsUpdate=n.needsUpdate=true;g.computeBoundingSphere();}}}
  updateBoundary(){const p=[];for(let i=0;i<=64;i++)p.push({x:-HALF+i*64,z:-HALF});for(let i=1;i<=64;i++)p.push({x:HALF,z:-HALF+i*64});for(let i=1;i<=64;i++)p.push({x:HALF-i*64,z:HALF});for(let i=1;i<=64;i++)p.push({x:-HALF,z:HALF-i*64});this.setLine(this.boundary,p);}
  replaceHeights(h){this.h=h;this.heightTexture.image.data=h;this.changed();this.updateBoundary();}
  resize(){const r=this.canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);this.renderer.setSize(this.width,this.height,false);this.updateCamera();}
  updateCamera(){this.target.x=clamp(this.target.x,-2048,2048);this.target.z=clamp(this.target.z,-2048,2048);this.radius=clamp(this.radius,30,7200);this.phi=clamp(this.phi,.008,1.56);this.camera=this.mode==='orbit'?this.cameraP:this.cameraO;
    this.camera.position.set(this.target.x+this.radius*Math.sin(this.phi)*Math.sin(this.theta),this.target.y+this.radius*Math.cos(this.phi),this.target.z+this.radius*Math.sin(this.phi)*Math.cos(this.theta));this.camera.up.set(0,1,0);this.camera.lookAt(this.target);const aspect=this.width/this.height;this.cameraP.aspect=aspect;const span=this.radius*.44;this.cameraO.left=-span*aspect;this.cameraO.right=span*aspect;this.cameraO.top=span;this.cameraO.bottom=-span;this.cameraP.updateProjectionMatrix();this.cameraO.updateProjectionMatrix();this.camera.updateMatrixWorld();this.dirty=true;}
  setView(mode){this.mode=mode;if(mode==='top'){this.phi=.008;this.theta=0;}else if(mode==='side'){this.phi=1.54;this.theta=0;}else{this.phi=.82;this.theta=.58;}this.updateCamera();}
  reset(){this.target.set(0,0,0);this.radius=1700;this.setView('orbit');this.updateLOD();}
  rotate(dx,dy){if(this.mode!=='orbit')this.mode='orbit';this.theta-=dx*.005;this.phi-=dy*.005;this.updateCamera();}
  pan(dx,dy){const scale=this.radius*.8/this.height,cs=Math.cos(this.theta),sn=Math.sin(this.theta);this.target.x+=(-dx*cs-dy*sn)*scale;this.target.z+=(dx*sn-dy*cs)*scale;this.target.y=heightAt(this.h,this.target.x,this.target.z);this.updateCamera();}
  zoom(factor){this.radius*=factor;this.updateCamera();}
  center(p){if(!p)return;this.target.set(p.x,p.y??heightAt(this.h,p.x,p.z),p.z);this.radius=Math.min(this.radius,900);this.updateCamera();}
  pick(clientX,clientY){const r=this.canvas.getBoundingClientRect();this.ndc.set((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.ndc,this.camera);return rayHeightfield(this.h,this.ray.ray.origin,this.ray.ray.direction);}
  brush(p,settings){if(!p){this.cursor.visible=false;return;}const pts=[],a=settings.angle*Math.PI/180,cs=Math.cos(a),sn=Math.sin(a),r=settings.diameter/2,rz=r*(settings.shape==='ellipse'?settings.aspect:1);for(let i=0;i<=64;i++){const t=i/64*Math.PI*2,dx=Math.cos(t)*r,dz=Math.sin(t)*rz;pts.push({x:clamp(p.x+dx*cs-dz*sn,-HALF,HALF),z:clamp(p.z+dx*sn+dz*cs,-HALF,HALF)});}this.setLine(this.cursor,pts);}
  setHour(hour){this.sunHour=hour;const s=solarAt(hour);this.u.sun.value.fromArray(s.sun);this.u.earth.value.fromArray(s.earth);this.u.earthPower.value=s.earthshine;this.shadowUniforms.sun.value.fromArray(s.sun);this.shadowUniforms.earth.value.fromArray(s.earth);this.cacheDirty=true;this.dirty=true;return s;}
  setBaked(value){this.baked=value;this.cacheDirty=true;}
  bakedTexture(){const n=this.baked.meta.resolution,{lo,hi,t}=bracket(this.baked.meta.samples,this.sunHour),a=[this.baked.mask(lo,0),this.baked.mask(lo,1)],b=[this.baked.mask(hi,0),this.baked.mask(hi,1)];
    if(!this.bakePixels||this.bakeN!==n){this.bakeMap?.dispose();this.bakeN=n;this.bakePixels=new Uint8Array(n*n*4);this.bakeMap=new THREE.DataTexture(this.bakePixels,n,n);this.bakeMap.minFilter=this.bakeMap.magFilter=THREE.LinearFilter;}
    for(let i=0;i<n*n;i++){for(let c=0;c<2;c++)this.bakePixels[i*4+c]=Math.round((((a[c][i>>3]>>(i&7))&1)*(1-t)+((b[c][i>>3]>>(i&7))&1)*t)*255);this.bakePixels[i*4+3]=255;}this.bakeMap.needsUpdate=true;this.u.lightMap.value=this.bakeMap;
  }
  async setReference(data,settings){if(!data){this.u.referenceOpacity.value=0;this.refTexture?.dispose();this.refTexture=null;this.dirty=true;return;}const texture=await new THREE.TextureLoader().loadAsync(data);texture.colorSpace=THREE.NoColorSpace;texture.generateMipmaps=false;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.flipY=false;this.refTexture?.dispose();this.refTexture=texture;this.u.referenceMap.value=texture;this.updateReference(settings);}
  updateReference(s){this.u.referenceRect.value.set(s.x,s.z,s.width,s.height);this.u.referenceOpacity.value=this.refTexture&&s.visible?s.opacity:0;this.u.referenceAngle.value=(s.angle||0)*Math.PI/180;this.dirty=true;}
  serialize(){return {target:this.target.toArray(),radius:this.radius,theta:this.theta,phi:this.phi,mode:this.mode};}
  restore(s){if(!s)return;if(Array.isArray(s.target)&&s.target.length===3&&s.target.every(Number.isFinite))this.target.fromArray(s.target);for(const key of ['radius','theta','phi'])if(Number.isFinite(s[key]))this[key]=s[key];if(['top','side','orbit'].includes(s.mode))this.mode=s.mode;this.updateCamera();this.updateLOD();}
  render(now){
    if(this.cacheDirty&&now-this.lastCache>140){if(this.baked)this.bakedTexture();else{this.renderer.setRenderTarget(this.live);this.renderer.render(this.cacheScene,this.cacheCamera);this.renderer.setRenderTarget(null);this.u.lightMap.value=this.live.texture;}this.cacheDirty=false;this.lastCache=now;this.dirty=true;}
    if(this.dirty){if(now-this.lastLOD>400){this.updateLOD();this.lastLOD=now;}this.renderer.render(this.scene,this.camera);this.dirty=false;this.frameCount++;}
    if(now-this.lastStatus>2000){this.onStatus?.({triangles:this.renderer.info.render.triangles,draws:this.renderer.info.render.calls});this.lastStatus=now;}
  }
}
