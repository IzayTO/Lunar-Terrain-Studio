import {heightAt,clamp} from './terrain-core.js?v=2.0.0';
import {normalizeBrush,sanitizePresets,distributedNibs} from './brush-kit.js?v=2.0.0';
import {SceneGuides,normalizeGuides} from './scene-guides.js?v=2.0.0';
import {validatePaste,patchOutline,applyPatch,snappedPoint} from './selection-core.js?v=2.0.0';
const $=id=>document.getElementById(id);
const paintTools=['raise','lower','smooth','level','flatten','restore'];
const TOOL_NAMES={raise:'Elevar',lower:'Hundir',smooth:'Suavizar',level:'Nivelar',flatten:'Aplanar',restore:'Restaurar',contour:'Contorno libre',select:'Punto',lasso:'Selección libre',paste:'Pegar relieve',ghost:'Colocar escala'};

export class StudioTools {
  constructor(api){
    this.a=api;this.s=api.state;this.guides=new SceneGuides(api.view);this.settings=normalizeGuides();this.presets=[];this.area=null;this.clipboard=null;this.pastePoint=null;this.pasteLocked=false;this.turns=0;this.feather=12;this.lastPoint=null;this.mods={shift:false,invert:false,pan:false};this.nibIndex=0;this.terrainDirty=true;this.lastGuideUpdate=0;
    try{this.presets=sanitizePresets(JSON.parse(localStorage.getItem('lunar-brushes-v2')||'[]'));}catch{}
    this.actions={
      'copy-area':()=>this.copyArea(),'paste-area':()=>this.beginPaste(),'apply-paste':()=>this.applyPaste(),'rotate-paste':()=>{this.turns=(this.turns+1)%4;this.previewPaste();},'clear-area':()=>this.clearArea(),
      'place-guides':()=>{if(this.a.requireIdle())this.a.chooseTool('ghost');},'guides-at-selection':()=>this.placeGuides(this.s.selection||{x:0,z:0}),'focus-guides':()=>this.focusGuides(),'focus-spawn':()=>{this.a.view.target.set(0,heightAt(this.a.heights,0,0),0);this.a.view.radius=240;this.a.view.updateCamera();this.a.scheduleSave();},
      'save-brush':()=>this.saveBrush(),'delete-brush':()=>this.deleteBrush(),'export-brushes':()=>this.exportBrushes(),'import-brushes':()=>this.importBrushes(),
      'add-nib':()=>this.addNib(),'remove-nib':()=>this.removeNib(),'distribute-nibs':()=>this.distribute(),'invert-brush':()=>this.invert(),
      'quick-properties':()=>{const open=$('quick-properties').hidden;$('quick-properties').hidden=!open;$('quick-properties-toggle').setAttribute('aria-expanded',String(open));},
      'toggle-grid':()=>{$('grid').checked=!$('grid').checked;$('grid').dispatchEvent(new Event('change'));},
      'toggle-ghosts':()=>{const on=!['human','rover','panel'].some(k=>this.settings[k]);for(const k of ['human','rover','panel'])this.settings[k]=on;this.syncGuides();this.guides.set(this.settings);this.a.scheduleSave();},
      'delete-selection':()=>{if(this.s.tool==='paste')this.a.cancel();else this.clearArea();}
    };
    this.bind();this.syncBrush();this.syncPresets();this.syncGuides();this.syncSelection();
  }
  effectiveTool(tool=this.s.tool){if(!paintTools.includes(tool))return tool;if(this.mods.shift)return 'smooth';if(this.mods.invert&&['raise','lower'].includes(tool))return tool==='raise'?'lower':'raise';return tool;}
  modifiers(e){if(e.pointerType==='touch')return;this.mods.shift=!!e.shiftKey;this.mods.invert=!!(e.ctrlKey||e.metaKey);}
  wheel(e){if(e.ctrlKey||e.metaKey){this.adjust('diameter',e.deltaY<0?1.1:1/1.1);return true;}if(e.altKey){this.adjust('force',e.deltaY<0?1.1:1/1.1);return true;}return false;}
  adjust(key,factor){this.setBrush(key,this.s.brush[key]*factor);}
  setBrush(key,value){if(['target','diameter','force'].includes(key)&&!Number.isFinite(value))return;this.s.brush=normalizeBrush({...this.s.brush,[key]:value});this.syncBrush();this.a.relevant();if(this.lastPoint&&paintTools.includes(this.s.tool))this.a.view.brush(this.lastPoint,this.s.brush,this.effectiveTool());this.a.scheduleSave();}
  invert(){if(['raise','lower'].includes(this.s.tool))this.a.chooseTool(this.s.tool==='raise'?'lower':'raise');else this.a.chooseTool('lower');}
  syncBrush(){
    const p=this.s.brush;
    document.querySelectorAll('[data-brush]').forEach(el=>{const v=p[el.dataset.brush];if(el.type==='checkbox')el.checked=!!v;else if(document.activeElement!==el)el.value=typeof v==='number'?Math.round(v*100)/100:v;});
    for(const [key,value]of Object.entries(p)){const el=$(key);if(!el)continue;if(el.type==='checkbox')el.checked=value;else if(document.activeElement!==el)el.value=value;this.a.updateOutput(el);}
    $('quick-diameter-value').textContent=Math.round(p.diameter)+' m';$('quick-force-value').textContent=p.force.toFixed(1);$('quick-tool-name').textContent=TOOL_NAMES[this.s.tool]||this.s.tool;
    $('target-quick').hidden=!['flatten','level'].includes(this.s.tool);$('force-quick').hidden=this.s.tool==='flatten';
    $('multiple-editor').hidden=!p.multiple;$('nib-count-label').textContent=p.nibs.length+' huellas';this.nibIndex=clamp(this.nibIndex,0,p.nibs.length-1);this.syncNib();
    document.querySelectorAll('[data-tool]').forEach(b=>{const active=b.dataset.tool===this.s.tool;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    document.body.dataset.tool=this.s.tool;
  }
  toolChanged(){this.syncBrush();if(this.s.tool!=='paste'){this.guides.clearPaste();this.a.view.outline.visible=false;this.pastePoint=null;}this.syncSelection();}
  syncNib(){const n=this.s.brush.nibs[this.nibIndex];if(!n)return;for(const [id,key]of [['nib-size','size'],['nib-weight','weight'],['nib-effect','effect']])$(id).value=n[key];$('nib-selected').textContent=`Huella ${this.nibIndex+1} de ${this.s.brush.nibs.length}`;this.drawPattern();}
  drawPattern(){const canvas=$('pattern-canvas'),c=canvas.getContext('2d'),w=canvas.width;const p=this.s.brush;c.clearRect(0,0,w,w);c.fillStyle='#10171b';c.fillRect(0,0,w,w);c.strokeStyle='#263638';c.lineWidth=1;for(let i=0;i<=8;i++){const t=i*w/8;c.beginPath();c.moveTo(t,0);c.lineTo(t,w);c.moveTo(0,t);c.lineTo(w,t);c.stroke();}c.strokeStyle='#49625f';c.beginPath();c.arc(w/2,w/2,w*.46,0,Math.PI*2);c.stroke();
    p.nibs.forEach((n,i)=>{const x=(.5+n.x*.92)*w,z=(.5+n.z*.92)*w,r=n.size*w*.46;c.beginPath();if(p.shape==='square')c.rect(x-r,z-r,2*r,2*r);else c.ellipse(x,z,r,p.shape==='ellipse'?r*p.aspect:r,0,0,Math.PI*2);const color=n.effect==='lower'?'#daa581':n.effect==='raise'?'#9ccebe':'#aec4da';c.fillStyle=color+(i===this.nibIndex?'45':'18');c.strokeStyle=color;c.lineWidth=i===this.nibIndex?2.5:1;c.fill();c.stroke();c.fillStyle=color;c.font='12px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(String(i+1),x,z);});
  }
  addNib(){if(this.s.brush.nibs.length>=16){this.a.toast('El máximo es 16 huellas por pincel.');return;}this.s.brush.nibs.push({x:0,z:0,size:.2,weight:1,effect:'inherit'});this.s.brush.multiple=true;this.nibIndex=this.s.brush.nibs.length-1;this.syncBrush();this.a.scheduleSave();}
  removeNib(){if(this.s.brush.nibs.length<=1){this.a.toast('Conserva al menos una huella.');return;}this.s.brush.nibs.splice(this.nibIndex,1);this.nibIndex=0;this.syncBrush();this.a.scheduleSave();}
  distribute(){this.s.brush.nibs=distributedNibs(Number($('nib-count').value),Date.now());this.s.brush.multiple=true;this.nibIndex=0;this.syncBrush();this.a.scheduleSave();}
  saveBrush(){this.a.modal('Guardar mi pincel','<label>Nombre<input id="new-brush-name" type="text" maxlength="40" placeholder="Mi grupo de cráteres" autocomplete="off"></label><p>Conserva las huellas, su distribución, la herramienta y todos los ajustes actuales.</p>',[{label:'Cancelar'},{label:'Guardar pincel',primary:true,run:()=>{const name=$('new-brush-name').value.trim()||'Mi pincel';if(this.presets.length>=24){this.a.toast('Puedes guardar hasta 24 pinceles. Elimina uno para añadir otro.');return;}const preset={id:'brush-'+Date.now().toString(36),name,tool:paintTools.includes(this.s.tool)?this.s.tool:'raise',brush:normalizeBrush(this.s.brush)};this.presets.push(preset);this.syncPresets(preset.id);this.persistPresets();this.a.toast('Pincel guardado. Ya aparece en el acceso rápido.');}}]);setTimeout(()=>$('new-brush-name')?.focus(),50);}
  persistPresets(){try{localStorage.setItem('lunar-brushes-v2',JSON.stringify(this.presets));}catch{this.a.toast('Guarda el proyecto para conservar tus pinceles.');}this.a.scheduleSave();}
  syncPresets(selected=''){for(const el of document.querySelectorAll('[data-presets]')){el.replaceChildren(new Option('Mis pinceles…',''));for(const p of this.presets)el.add(new Option(p.name,p.id));el.value=selected;}}
  loadPreset(id){const preset=this.presets.find(p=>p.id===id);if(!preset||!this.a.requireIdle())return;this.s.brush=normalizeBrush(preset.brush);this.a.chooseTool(preset.tool);this.syncBrush();this.syncPresets(id);this.a.scheduleSave();}
  deleteBrush(){const id=$('saved-brushes').value||$('quick-presets').value;if(!id){this.a.toast('Elige primero un pincel guardado.');return;}this.presets=this.presets.filter(p=>p.id!==id);this.syncPresets();this.persistPresets();}
  exportBrushes(){const file=new Blob([JSON.stringify({format:'lunar-brushes',version:1,presets:this.presets},null,2)],{type:'application/json'});this.a.download(file,'Mis-pinceles-lunares.json');}
  importBrushes(){const input=$('brush-file');input.value='';input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>200000)throw Error('El archivo de pinceles es demasiado grande.');const data=JSON.parse(await file.text());if(data.format!=='lunar-brushes')throw Error('Selecciona un archivo de pinceles lunares.');const loaded=sanitizePresets(data.presets);this.presets=sanitizePresets([...this.presets,...loaded.map((p,i)=>({...p,id:'import-'+Date.now()+'-'+i}))]);this.syncPresets();this.persistPresets();this.a.toast('Pinceles importados.');}catch(e){this.a.toast(e.message);}};input.click();}
  syncGuides(){for(const [k,v]of Object.entries(this.settings)){const el=$('guide-'+k);if(el){if(el.type==='checkbox')el.checked=v;else if(document.activeElement!==el)el.value=v;}}$('bounds').checked=this.settings.map;$('grid-step').value=this.settings.gridStep;const any=['human','rover','panel'].some(k=>this.settings[k]);$('reference-status').textContent=any?`Ancladas en X ${this.settings.x.toFixed(1)}, Z ${this.settings.z.toFixed(1)} m`:'Activa una figura y colócala junto al relieve.';}
  placeGuides(point){const p=point||this.lastPoint||{x:0,z:0};this.settings.x=clamp(p.x,-2035,2035);this.settings.z=clamp(p.z,-2035,2035);if(!['human','rover','panel'].some(k=>this.settings[k]))this.settings.human=this.settings.rover=this.settings.panel=true;this.syncGuides();this.guides.set(this.settings);this.a.scheduleSave();this.a.toast('Referencias colocadas. Permanecen aquí mientras esculpes.');}
  focusGuides(){const v=this.a.view;v.target.set(this.settings.x,heightAt(this.a.heights,this.settings.x,this.settings.z)+1.2,this.settings.z);v.radius=19;v.setView('orbit');this.a.viewChanged();}
  setArea(points){this.area=points.map(p=>({x:p.x,z:p.z}));this.areaLine();this.syncSelection();this.a.scheduleSave();this.a.toast('Área seleccionada. Pulsa Copiar o Ctrl/⌘ C.');}
  areaLine(){this.a.view.areaOutline.visible=!!this.area;if(this.area)this.a.view.setLine(this.a.view.areaOutline,[...this.area,this.area[0]]);}
  clearArea(){this.area=null;this.a.view.areaOutline.visible=false;this.a.view.dirty=true;this.syncSelection();this.a.scheduleSave();}
  syncSelection(){const available=!!this.clipboard,pasting=this.s.tool==='paste';$('copy-area').disabled=!this.area;$('paste-area').disabled=!available;$('quick-copy').disabled=!this.area;$('quick-paste').disabled=!available;$('paste-controls').hidden=!pasting;$('apply-paste').disabled=!pasting||!this.pastePoint||!this.pasteCheck?.ok;$('selection-status').textContent=this.area?'Área libre marcada · lista para copiar':available?`Copia lista · ${(this.clipboard.width-1)*4} × ${(this.clipboard.height-1)*4} m`:'Dibuja un contorno con Selección libre.';$('operation-bar').hidden=!pasting;$('paste-summary').textContent=this.pastePoint?(this.pasteCheck?.reason||'Elige el destino'):'Toca una superficie plana para colocar la copia.';$('quick-apply-paste').disabled=!this.pastePoint||!this.pasteCheck?.ok;$('operation-bar').classList.toggle('invalid',!!this.pastePoint&&!this.pasteCheck?.ok);}
  copyArea(){if(!this.area){this.a.chooseTool('lasso');this.a.toast('Dibuja el contorno del terreno que quieres copiar.');return;}if(!this.a.requireIdle())return;this.a.runWorker('capture',{heights:this.a.heights.slice(),points:this.area},data=>{this.clipboard=data.patch;this.syncSelection();this.a.toast(`Relieve copiado · ${(data.patch.width-1)*4} × ${(data.patch.height-1)*4} m. El original sigue intacto.`);});}
  beginPaste(){if(!this.clipboard){this.a.toast('Selecciona y copia primero una región.');return;}if(!this.a.requireIdle())return;this.pastePoint=null;this.pasteLocked=false;this.turns=0;this.a.chooseTool('paste');this.a.toast('Toca una zona plana. Revisa la copia y pulsa Aplicar.');this.syncSelection();}
  previewPaste(){if(!this.pastePoint||!this.clipboard)return;this.pasteCheck=validatePaste(this.a.heights,this.clipboard,this.pastePoint,this.turns);this.guides.previewPatch(this.clipboard,this.pastePoint,this.pasteCheck,this.turns,this.feather);const pts=patchOutline(this.clipboard,this.pastePoint,this.turns);this.a.view.outline.material.color.set(this.pasteCheck.ok?0x9bd8c8:0xef9386);this.a.view.setLine(this.a.view.outline,[...pts,pts[0]]);this.syncSelection();}
  applyPaste(){if(!this.a.requireIdle()||!this.pastePoint||!this.clipboard)return;const check=validatePaste(this.a.heights,this.clipboard,this.pastePoint,this.turns);if(!check.ok){this.a.toast(check.reason);this.previewPaste();return;}const history=this.a.history;history.begin('Pegar relieve');try{const rect=applyPatch(this.a.heights,history,this.clipboard,this.pastePoint,{turns:this.turns,feather:this.feather});history.commit();this.a.view.changed(rect);this.a.markChanged();this.cancelTransient();this.a.chooseTool('lasso');this.a.toast('Relieve pegado. Deshacer restaura la superficie anterior.');}catch(e){history.cancel();this.a.toast(e.message);}}
  pointerStart(p){if(this.s.tool==='paste'){this.pastePoint=snappedPoint(p);this.pasteLocked=true;this.previewPaste();return true;}if(this.s.tool==='ghost'){this.placeGuides(p);return true;}return false;}
  hover(p,e){if(p)this.lastPoint=p;if(this.s.tool==='paste'&&p&&!this.pasteLocked&&e?.pointerType!=='touch'){const point=snappedPoint(p),now=performance.now();if(now-(this.lastPasteHover||0)>90&&(!this.pastePoint||point.x!==this.pastePoint.x||point.z!==this.pastePoint.z)){this.pastePoint=point;this.lastPasteHover=now;this.previewPaste();}}if(this.s.tool==='ghost'&&p)this.a.view.brush(p,{...this.s.brush,diameter:12,multiple:false,shape:'circle'});}
  cancelTransient(){this.guides.clearPaste();this.pastePoint=null;this.pasteLocked=false;this.pasteCheck=null;this.a.view.outline.visible=false;this.syncSelection();}
  terrainChanged(){this.terrainDirty=true;this.areaLine();if(this.s.tool==='paste')this.previewPaste();}
  tick(now){this.guides.updateLabelScale();if(this.terrainDirty&&now-this.lastGuideUpdate>90){this.guides.update();this.lastGuideUpdate=now;this.terrainDirty=false;}}
  metadata(){return {guides:{...this.settings},presets:this.presets,area:this.area,editorVersion:'2.0.0'};}
  restore(meta){this.settings=normalizeGuides(meta.guides||{map:meta.bounds!==false});this.guides.set(this.settings);this.syncGuides();if(Array.isArray(meta.presets)){this.presets=sanitizePresets(meta.presets);this.syncPresets();try{localStorage.setItem('lunar-brushes-v2',JSON.stringify(this.presets));}catch{}}this.area=Array.isArray(meta.area)&&meta.area.length>=3&&meta.area.length<=400?meta.area.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.max(Math.abs(p.x),Math.abs(p.z))<=2048):null;this.clipboard=null;this.cancelTransient();if(this.area?.length<3)this.area=null;this.areaLine();this.syncBrush();this.syncSelection();}
  keydown(e){
    const mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase(),typing=e.target.closest?.('input,select,textarea,[contenteditable="true"]');
    if($('dialog').open)return false;
    if(typing){if(mod&&['s','o'].includes(k)){e.preventDefault();const action=k==='o'?'open':e.shiftKey?'save-copy':'save';Promise.resolve(this.a.actions[action]?.()).catch(err=>this.a.toast(err.message));return true;}return false;}
    this.mods.shift=e.shiftKey;this.mods.invert=mod;
    let action=null;
    if(mod&&k==='c')action='copy-area';else if(mod&&k==='v')action='paste-area';else if(mod&&e.shiftKey&&k==='s')action='save-copy';else if(mod&&k==='o')action='open';
    else if(k==='delete'||k==='backspace')action='delete-selection';else if(k==='h')action='toggle-ghosts';else if(k==='g')action='toggle-grid';else if(k==='x')action='invert-brush';else if(k==='enter'&&this.s.tool==='paste')action='apply-paste';else if(k==='tab'){document.body.classList.toggle('panel-closed');this.a.view.resize();e.preventDefault();return true;}
    if(action){e.preventDefault();if(!e.repeat)Promise.resolve(this.a.actions[action]?.()).catch(err=>this.a.toast(err.message));return true;}
    if(mod)return false;
    if(e.code==='Space'){e.preventDefault();this.mods.pan=true;return true;}
    if(k==='['||k===']'||e.code==='BracketLeft'||e.code==='BracketRight'){e.preventDefault();const down=k==='['||e.code==='BracketLeft';this.adjust(e.shiftKey?'force':'diameter',down?1/1.12:1.12);return true;}
    if(k==='q'||k==='e'){e.preventDefault();if(this.s.tool==='paste'){this.turns=(this.turns+(k==='q'?3:1))%4;this.previewPaste();}else this.setBrush('angle',(this.s.brush.angle+(k==='q'?345:15))%360);return true;}
    if(['1','3','7'].includes(k)){e.preventDefault();this.a.view.setView(k==='7'?'top':'side');if(k==='3'){this.a.view.theta=Math.PI/2;this.a.view.updateCamera();}this.a.viewChanged();return true;}
    const tools={r:'raise',d:'lower',s:'smooth',l:'flatten',c:'contour',v:'select',a:'lasso'};
    if(tools[k]){e.preventDefault();if(!e.repeat)this.a.chooseTool(tools[k]);return true;}
    if(k==='?'){e.preventDefault();this.a.actions.help();return true;}return false;
  }
  keyup(e){this.mods.shift=!!e.shiftKey;this.mods.invert=!!(e.ctrlKey||e.metaKey);if(e.code==='Space')this.mods.pan=false;if(this.lastPoint&&paintTools.includes(this.s.tool))this.a.view.brush(this.lastPoint,this.s.brush,this.effectiveTool());}
  bind(){
    document.querySelectorAll('[data-brush]').forEach(el=>el.addEventListener('input',()=>{if(el.type==='number'&&el.value==='')return;this.setBrush(el.dataset.brush,el.type==='checkbox'?el.checked:el.tagName==='SELECT'?el.value:Number(el.value));}));
    document.querySelectorAll('[data-presets]').forEach(el=>el.addEventListener('change',()=>this.loadPreset(el.value)));
    for(const k of Object.keys(this.settings)){const el=$('guide-'+k);if(el)el.addEventListener('input',()=>{if(el.type==='number'&&el.value==='')return;this.settings=normalizeGuides({...this.settings,[k]:el.type==='checkbox'?el.checked:Number(el.value)});this.guides.set(this.settings);this.syncGuides();this.a.scheduleSave();});}
    $('grid-step').addEventListener('change',e=>{this.settings.gridStep=Number(e.target.value);this.guides.set(this.settings);this.a.scheduleSave();});
    $('paste-feather').addEventListener('input',e=>{this.feather=Number(e.target.value);$('paste-feather-value').textContent=this.feather+' m';this.previewPaste();});
    for(const [id,key]of [['nib-size','size'],['nib-weight','weight'],['nib-effect','effect']])$(id).addEventListener('input',e=>{const n=this.s.brush.nibs[this.nibIndex];n[key]=key==='effect'?e.target.value:Number(e.target.value);const half=Math.max(0,.5-n.size/2);n.x=clamp(n.x,-half,half);n.z=clamp(n.z,-half,half);this.drawPattern();this.a.relevant();this.a.scheduleSave();});
    const canvas=$('pattern-canvas');let dragging=false;
    const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width-.5,z:(e.clientY-r.top)/r.height-.5};};
    canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);const p=point(e);let best=Infinity;this.s.brush.nibs.forEach((n,i)=>{const d=Math.hypot(n.x*.92-p.x,n.z*.92-p.z);if(d<best){best=d;this.nibIndex=i;}});dragging=true;this.syncNib();});
    canvas.addEventListener('pointermove',e=>{if(!dragging)return;const p=point(e),n=this.s.brush.nibs[this.nibIndex],half=Math.max(0,.5-n.size/2);n.x=clamp(p.x/.92,-half,half);n.z=clamp(p.z/.92,-half,half);this.drawPattern();});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{if(dragging){dragging=false;this.a.scheduleSave();}});
    window.addEventListener('keyup',e=>this.keyup(e));window.addEventListener('blur',()=>this.mods={shift:false,invert:false,pan:false});
  }
}
