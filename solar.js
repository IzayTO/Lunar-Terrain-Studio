// Exact orbit and linkedPhase expressions from both pinned Sky Explorer sources.
// Axes: +Y up, row 0 = Z -2048, column 0 = X -2048. No solar mesh.
export const LUNAR_DAY=29.53059, TAU=Math.PI*2;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
class Vector {
  constructor(x=0,y=0,z=0){this.set(x,y,z);}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
  normalize(){const l=Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)||1;const k=1/l;this.x*=k;this.y*=k;this.z*=k;return this;}
  dot(v){return this.x*v.x+this.y*v.y+this.z*v.z;}
  toArray(){return [this.x,this.y,this.z];}
}
export function linkedPhase(sun,earth){
  const a=Math.acos(clamp(sun.dot(earth),-1,1))/TAU;
  const along=-(earth.z*sun.x-earth.x*sun.z)*.4226182617+(earth.x*sun.y-earth.y*sun.x)*.906307787;
  return along<0?1-a:a;
}
export class SolarOrbit {
  constructor(){this.sun=new Vector();this.moon=new Vector();}
  orbit(hour){const h=(hour-12)/24*TAU,lat=25*Math.PI/180,dec=.0269*Math.sin(h);
    this.sun.set(-Math.sin(h)*Math.cos(dec),Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(h),Math.sin(lat)*Math.cos(dec)*Math.cos(h)-Math.cos(lat)*Math.sin(dec)).normalize();
    const lon=(40+5.1*Math.sin(h)) *Math.PI/180,latitude=lat+3.3*Math.sin(h+.8)*Math.PI/180;
    this.moon.set(-Math.sin(lon),Math.cos(latitude)*Math.cos(lon),Math.sin(latitude)*Math.cos(lon)).normalize();
  }
  at(hour){
    this.orbit(hour);
    const illumination=(1-this.sun.dot(this.moon))/2;
    return {hour,cycle:hour/24,sun:this.sun.toArray(),earth:this.moon.toArray(),phase:linkedPhase(this.sun,this.moon),illumination,earthshine:Math.pow(illumination,1.45)*.036};
  }
}
const orbit=new SolarOrbit();
export const solarAt=hour=>orbit.at(hour);
export function phaseName(p){return ['Nueva','Creciente','Cuarto creciente','Gibosa creciente','Llena','Gibosa menguante','Cuarto menguante','Menguante'][Math.round(p*8)%8];}
