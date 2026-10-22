const query = selector => document.querySelector(selector);
const all = selector => document.querySelectorAll(selector);
const byId = id => document.getElementById(id);

// Reuse the same preceptor options in all three dropdowns.
['notePreceptor', 'noteCodesPreceptor', 'noteSwipePreceptor'].forEach(id => {
  byId(id).append(byId('preceptorOptions').content.cloneNode(true));
});

// Radiograph findings use their own tooth selection and saved chart state.
const rxPrimaryMap = {4:"A",5:"B",6:"C",7:"D",8:"E",9:"F",10:"G",11:"H",12:"I",13:"J",20:"K",21:"L",22:"M",23:"N",24:"O",25:"P",26:"Q",27:"R",28:"S",29:"T"};
const rxMixedPermanent = [3,14,19,30,7,8,9,10,23,24,25,26];
const rxFindingNames = ["Decay","Root tip","Composite","Amalgam","Zirconia","PFM crown","Metal crown","RCT","Bridge","Implant","PARL","PARO","Chipped","Broken","Impacted","Unerupted","Ectopic eruption"];
const rxBoneNames = {generalized:"Generalized horizontal bone loss",localized:"Localized horizontal bone loss",vertical:"Vertical bone loss",fracture:"Jaw fracture",sinus:"Pneumatized sinus",appliance:"Orthodontic appliance",miniplate:"Dental miniplate",radiolucent:"Radiolucent lesion",radiopaque:"Radiopaque lesion","mixed-lesion":"Mixed radiolucent radiopaque lesion"};
const rxQ = query;
const rxAll = selector => [...document.querySelectorAll(selector)];
let rxState = rxDefaultState();
const rxSelected = new Set();
const rxFindingHistory = [];
let rxPreviousReportText = "";
let rxRecentFinding = "";
function rxDefaultState() {
  return {mode:"permanent",teeth:Object.fromEntries(Array.from({length:32},(_,i)=>[i+1,{age:"permanent",missing:false,inactive:false}])),findings:[],bridges:[],bone:{},oralPathology:"",wear:{generalized:false,localized:false,teeth:""},dentition:{maxillae:"Partially dentate/edentulous",mandible:"Partially dentate/edentulous"},report:null};
}
function rxLabel(number, state = rxState) {
  return state.teeth[number]?.age === "primary" ? rxPrimaryMap[number] || "" : String(number);
}
function readRadiographState() { return JSON.parse(JSON.stringify(rxState)); }
function restoreRadiographState(saved) {
  rxState = rxDefaultState(); rxSelected.clear(); rxFindingHistory.length=0; rxRecentFinding="";
  if (saved && typeof saved === "object") {
    rxState.wear={generalized:saved.wear?.generalized===true,localized:saved.wear?.localized===true,teeth:typeof saved.wear?.teeth==="string" ? saved.wear.teeth : ""};
    const dentitionOptions=["Full primary","Mixed dentition","Full permanent","Partially dentate/edentulous","Edentulous"];
    for(const jaw of ['maxillae','mandible']) {
      let value=typeof saved.dentition==='string' ? saved.dentition : saved.dentition?.[jaw];
      if (['Partially dentate','Partially edentulous'].includes(value)) value='Partially dentate/edentulous';
      rxState.dentition[jaw]=dentitionOptions.includes(value) ? value : 'Partially dentate/edentulous';
    }
    rxState.report = typeof saved.report === "string" ? saved.report : null;
    if (["permanent","primary","mixed","custom"].includes(saved.mode)) rxState.mode=saved.mode;
    for (let n=1;n<=32;n++) {
      rxState.teeth[n]={age:saved.teeth?.[n]?.age === "primary" ? "primary" : "permanent",missing:saved.teeth?.[n]?.missing === true,inactive:saved.teeth?.[n]?.inactive === true};
      if(saved.mode === "mixed" && !rxPrimaryMap[n] && rxState.teeth[n].age === "primary") rxState.teeth[n]={...rxState.teeth[n],age:"permanent",inactive:true};
    }
    rxState.findings = Array.isArray(saved.findings) ? saved.findings.filter(r=>r && Number.isInteger(r.tooth) && r.tooth>=1 && r.tooth<=32 && rxFindingNames.includes(r.name) && typeof r.label==="string").map(r=>({tooth:r.tooth,label:r.label,name:r.name})) : [];
    rxState.bridges = Array.isArray(saved.bridges) ? saved.bridges.filter(bridge=>
      Array.isArray(bridge?.teeth) && bridge.teeth.length>=2 && bridge.teeth.every(n=>Number.isInteger(n) && n>=1 && n<=32) &&
      new Set(bridge.teeth).size===bridge.teeth.length && bridge.teeth.every(n=>(n<=16)===(bridge.teeth[0]<=16)) &&
      Array.isArray(bridge.labels) && bridge.labels.length===bridge.teeth.length && bridge.labels.every(x=>typeof x==='string'))
      .map(bridge=>({teeth:[...bridge.teeth],labels:[...bridge.labels]})) : [];
    if(!Array.isArray(saved.bridges)) {
      for(const upper of [true,false]) {
        const old=rxState.findings.filter(r=>r.name==='Bridge' && (r.tooth<=16)===upper).sort((a,b)=>a.tooth-b.tooth);
        if(old.length>=2)rxState.bridges.push({teeth:old.map(r=>r.tooth),labels:old.map(r=>r.label)});
      }
      rxState.findings=rxState.findings.filter(r=>r.name!=='Bridge');
    }
    Object.keys(rxBoneNames).forEach(key=>{
      const b=saved.bone?.[key];
      if (b?.selected === true) rxState.bone[key]={selected:true,details:typeof b.details==="string" && b.details ? b.details : key !== "generalized" && Array.isArray(b.sites) ? b.sites.join(", ") : "",sites:Array.isArray(b.sites) ? b.sites.filter(x=>["Maxillae","Mandible"].includes(x)) : []};
    });
  }
  rxAll('.rx-bone-choice').forEach(input=>{ input.checked=rxState.bone[input.value]?.selected===true; });
  rxQ('#rxLocalizedTeeth').value=rxState.bone.localized?.details || "";
  rxAll('.rx-generalized-site').forEach(input=>{input.checked=rxState.bone.generalized?.sites?.includes(input.value) || false;});
  rxState.oralPathology = ["yes","no"].includes(saved?.oralPathology) ? saved.oralPathology : ['radiolucent','radiopaque','mixed-lesion'].some(key=>rxState.bone[key]?.selected) ? "yes" : "";
  if(rxState.oralPathology === "no") ['radiolucent','radiopaque','mixed-lesion'].forEach(key=>{delete rxState.bone[key];});
  rxAll('.rx-pathology-choice').forEach(input=>{input.checked=input.value===rxState.oralPathology;});
  rxAll('.rx-location-input').forEach(input=>{input.value=rxState.bone[input.dataset.bone]?.details || "";});
  rxAll('.rx-bone-choice').forEach(input=>{input.checked=rxState.bone[input.value]?.selected===true;});
  rxAll('.rx-dentition-choice').forEach(input=>{input.checked=input.value===rxState.dentition[input.dataset.jaw];});
  rxQ('#rxGeneralizedWear').checked=rxState.wear.generalized;
  rxQ('#rxLocalizedWear').checked=rxState.wear.localized;
  rxQ('#rxWearTeeth').value=rxState.wear.teeth;
  rxQ('#rxWearDetails').hidden=!rxState.wear.localized;
  rxRender(); rxUpdateBoneVisibility();
}
function rxSetMode(mode) {
  rxState.mode=mode;rxSelected.clear();
  for(let n=1;n<=32;n++) {
    const dormant = mode === "mixed" && !rxPrimaryMap[n] && !rxMixedPermanent.includes(n);
    rxState.teeth[n].age = mode === "permanent" || dormant || (mode === "mixed" && rxMixedPermanent.includes(n)) ? "permanent" : "primary";
    rxState.teeth[n].inactive = dormant;
  }
  rxRender();rxCommit();
}
function rxRender(preserveReport=false) {
  const groups={rxUpperRight:[1,2,3,4,5,6,7,8],rxUpperLeft:[9,10,11,12,13,14,15,16],rxLowerRight:[32,31,30,29,28,27,26,25],rxLowerLeft:[24,23,22,21,20,19,18,17]};
  Object.entries(groups).forEach(([id,numbers])=>{
    const area=rxQ('#'+id);area.replaceChildren();
    numbers.forEach(n=>{
      const label=rxLabel(n);const slot=document.createElement('div');slot.className='rx-tooth-slot';
      if(!label){slot.classList.add('rx-empty-slot');area.append(slot);return;}
      const button=document.createElement('button');button.type='button';button.className='rx-tooth-rectangle';button.textContent=label;button.dataset.rxTooth=String(n);
      button.setAttribute('aria-label','Radiograph tooth '+label+(rxState.teeth[n].missing ? ', missing' : ''));
      button.setAttribute('aria-pressed',String(rxSelected.has(n)));
      button.classList.toggle('rx-missing',rxState.teeth[n].missing);
      button.classList.toggle('rx-dormant',rxState.teeth[n].inactive);
      if(rxState.teeth[n].inactive) button.setAttribute('aria-label','Radiograph tooth '+label+', not yet erupted; select and use Change age to show');
      const records=rxState.findings.filter(r=>r.tooth===n && r.label===label);
      button.classList.toggle('rx-has-findings',records.length>0 || rxState.bridges.some(bridge=>bridge.teeth.includes(n) && bridge.labels[bridge.teeth.indexOf(n)]===label));
      button.addEventListener('click',()=>{rxSelected.has(n) ? rxSelected.delete(n) : rxSelected.add(n);rxRender();});
      slot.append(button);
      area.append(slot);
    });
  });
  rxAll('[data-rx-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.rxMode===rxState.mode)));
  rxQ('#rxRecentFinding').textContent=rxRecentFinding;
  rxQ('#rxUndo').disabled=rxFindingHistory.length===0;
  rxQ('#rxMissing').disabled=rxSelected.size===0;
  rxQ('#rxMissing').textContent=rxSelected.size && [...rxSelected].every(n=>rxState.teeth[n].missing) ? 'Unmissing' : 'Missing';
  rxQ('#rxChangeAge').disabled=rxSelected.size===0;
  rxAll('.rx-finding-button').forEach(button=>{button.disabled=rxSelected.size===0 || [...rxSelected].some(n=>rxState.teeth[n].missing || rxState.teeth[n].inactive);});
  rxRenderBridges();
  if(!preserveReport)rxUpdateReport();
  rxQ('#rxStatus').textContent=rxSelected.size ? 'Selected teeth: '+[...rxSelected].map(n=>rxLabel(n)).join(', ') : 'Select one or more teeth to add tooth findings.';
}
function rxRenderBridges() {
  rxAll('.rx-bridge-line').forEach(line=>line.remove());
  const canvas=rxQ('.rx-quadrants');
  const canvasRect=canvas.getBoundingClientRect();
  rxState.bridges.forEach(bridge=>{
    const teeth=bridge.teeth.filter((n,index)=>rxLabel(n)===bridge.labels[index]);
    if(teeth.length!==bridge.teeth.length)return;
    const rectangles=teeth.map(n=>rxQ('.rx-tooth-rectangle[data-rx-tooth="'+n+'"]')).filter(Boolean).map(button=>button.getBoundingClientRect());
    if(rectangles.length<2)return;
    const left=Math.min(...rectangles.map(r=>r.left+r.width/2));
    const right=Math.max(...rectangles.map(r=>r.left+r.width/2));
    const line=document.createElement('div');line.className='rx-bridge-line';
    line.style.left=(left-canvasRect.left)+'px';line.style.top=(rectangles[0].top-canvasRect.top+7)+'px';line.style.width=(right-left)+'px';
    line.setAttribute('aria-hidden','true');canvas.append(line);
  });
}
window.addEventListener('resize',rxRenderBridges);
function rxUpdateBoneVisibility() {
  rxQ('#rxGeneralizedSites').hidden=!rxQ('.rx-bone-choice[value="generalized"]').checked;
  rxQ('#rxLocalized').hidden=!rxQ('.rx-bone-choice[value="localized"]').checked;
  const pathology=rxQ('.rx-pathology-choice[value="yes"]').checked;
  rxQ('#rxPathologyOptions').hidden=!pathology;
  rxAll('.rx-location-input').forEach(input=>{
    const lesion=['radiolucent','radiopaque','mixed-lesion'].includes(input.dataset.bone);
    rxQ('#rx-detail-'+input.dataset.bone).hidden=!(rxQ('.rx-bone-choice[value="'+input.dataset.bone+'"]').checked && (!lesion || pathology));
  });
}
function rxReadBoneControls() {
  const bone={};
  rxState.oralPathology=rxQ('.rx-pathology-choice:checked')?.value || '';
  rxAll('.rx-bone-choice').filter(i=>i.checked).forEach(input=>{
    const lesion=['radiolucent','radiopaque','mixed-lesion'].includes(input.value);
    if(lesion && rxState.oralPathology !== 'yes')return;
    bone[input.value]={selected:true,details:input.value==='localized' ? rxQ('#rxLocalizedTeeth').value : rxQ('#rx-location-'+input.value)?.value || '',sites:input.value==='generalized' ? rxAll('.rx-generalized-site').filter(i=>i.checked).map(i=>i.value) : []};
  });rxState.bone=bone;rxUpdateBoneVisibility();rxCommit();
}
function radiographExamText(state) {
  if(!state)return '';
  if(typeof state.report === 'string')return state.report;
  const bone=Object.entries(rxBoneNames).filter(([key])=>state.bone?.[key]?.selected).map(([key,name])=>{
    const b=state.bone[key];return name+(b.details ? (state.noteFormatting ? ' '+noteBlank(b.details) : ': '+b.details) : '')+(key==='generalized' && b.sites?.length ? ': '+b.sites.join(', ') : '');
  });
  const groups=new Map();
  (state.findings || []).filter(record=>record.name!=='Bridge').forEach(record=>{
    const key=record.tooth+'|'+record.label;
    if(!groups.has(key))groups.set(key,{tooth:record.tooth,label:record.label,names:new Set()});
    groups.get(key).names.add(record.name);
  });
  const missing=[];
  for(let n=1;n<=32;n++)if(state.teeth?.[n]?.missing && rxLabel(n,state))missing.push(rxLabel(n,state));
  const findingOrder=['Decay','Chipped','Broken','Root tip','Composite','Amalgam','Zirconia','PFM crown','Metal crown','Implant','RCT','PARL','PARO','Impacted','Unerupted','Ectopic eruption'];
  const displayName=name=>['Composite','Amalgam','Zirconia'].includes(name) ? name.toLowerCase() : name;
  const matchingFindings=new Map();
  [...groups.values()].sort((a,b)=>a.tooth-b.tooth).forEach(group=>{
    const names=[...group.names].sort((a,b)=>findingOrder.indexOf(a)-findingOrder.indexOf(b));
    const key=names.join('|');
    if(!matchingFindings.has(key))matchingFindings.set(key,{names,labels:[]});
    matchingFindings.get(key).labels.push(group.label);
  });
  const teeth=[...matchingFindings.values()].map(group=>group.labels.map(label=>'#'+label).join(', ')+'-'+group.names.map(displayName).join(', '));
  (state.bridges || []).forEach(bridge=>{
    const members=bridge.teeth.map((tooth,index)=>({tooth,label:bridge.labels[index]})).sort((a,b)=>a.tooth-b.tooth);
    teeth.push('Bridge #'+members[0].label+'-'+members.at(-1).label);
  });
  if(state.wear?.generalized)teeth.unshift('Generalized occlusal wear');
  if(state.wear?.localized)teeth.unshift('Localized occlusal wear'+(state.wear.teeth ? (state.noteFormatting ? ' '+noteBlank(state.wear.teeth) : ': '+state.wear.teeth) : ''));
  const upper=state.dentition?.maxillae || '';
  const lower=state.dentition?.mandible || '';
  const wording=value=>value==='Full permanent' ? 'Full permanent dentition' : value;
  const dentition=upper && upper===lower ? wording(upper)+' in both arches' : [upper ? wording(upper)+' in the maxillae' : '',lower ? wording(lower)+' in the mandible' : ''].filter(Boolean).join('. ');
  const firstLine=[dentition,missing.length ? 'Missing #'+missing.join(', ')+'.' : ''].filter(Boolean).join('. ');
  if(state.oralPathology === 'yes' && !['radiolucent','radiopaque','mixed-lesion'].some(key=>state.bone?.[key]?.selected))bone.push('Oral pathologic lesion');
  return [firstLine,...(bone.length ? [bone.join('. ')] : []),...teeth].join('\n');
}
rxAll('[data-rx-mode]').forEach(button=>button.addEventListener('click',()=>rxSetMode(button.dataset.rxMode)));
rxQ('#rxMissing').addEventListener('click',()=>{
  const missing=![...rxSelected].every(n=>rxState.teeth[n].missing);
  rxSelected.forEach(n=>{rxState.teeth[n].missing=missing;});rxSelected.clear();rxRender();rxCommit();
});
rxQ('#rxChangeAge').addEventListener('click',()=>{
  rxSelected.forEach(n=>{
    if(rxPrimaryMap[n])rxState.teeth[n].age=rxState.teeth[n].age==='primary' ? 'permanent' : 'primary';
    else rxState.teeth[n].inactive=!rxState.teeth[n].inactive;
  });
  rxState.mode='custom';rxSelected.clear();rxRender();rxCommit();
});
function rxRecordFindingChange(before) {
  if(JSON.stringify(before.findings)===JSON.stringify(rxState.findings) && JSON.stringify(before.bridges)===JSON.stringify(rxState.bridges) && (!before.missing || Object.keys(before.missing).every(n=>before.missing[n]===rxState.teeth[n].missing)))return;
  rxFindingHistory.push(before);
  if(rxFindingHistory.length>30)rxFindingHistory.shift();
}
rxQ('#rxUndo').addEventListener('click',()=>{
  const previous=rxFindingHistory.pop();
  if(!previous)return;
  rxRecentFinding=previous.recentFinding || '';
  rxState.findings=previous.findings;
  rxState.bridges=previous.bridges;
  if(previous.missing)Object.entries(previous.missing).forEach(([number,missing])=>{rxState.teeth[number].missing=missing;});
  rxSelected.clear();
  rxRender();rxCommit();
});
rxAll('.rx-finding-button').forEach(button=>button.addEventListener('click',()=>{
  if(!rxSelected.size)return;
  const name=button.dataset.rxFinding;
  const findingNotification=[...rxSelected].sort((a,b)=>a-b).map(n=>'#'+rxLabel(n)).join(', ')+' '+name;
  const before=JSON.parse(JSON.stringify({findings:rxState.findings,bridges:rxState.bridges,recentFinding:rxRecentFinding}));
  if(name==='Bridge' && rxSelected.size<2){rxQ('#rxStatus').textContent='Select at least two teeth for a bridge.';return;}
  if(name==='Bridge') {
    const teeth=[...rxSelected].sort((a,b)=>a-b);
    if(teeth.some(n=>(n<=16)!==(teeth[0]<=16))){rxQ('#rxStatus').textContent='Choose bridge teeth in the same arch.';return;}
    const labels=teeth.map(n=>rxLabel(n));
    if(!rxState.bridges.some(bridge=>bridge.teeth.join(',')===teeth.join(',') && bridge.labels.join(',')===labels.join(',')))rxState.bridges.push({teeth,labels});
    rxRecordFindingChange(before);rxRecentFinding=findingNotification;rxSelected.clear();rxRender();rxCommit();return;
  }
  rxSelected.forEach(tooth=>{
    const label=rxLabel(tooth);
    if(!rxState.findings.some(r=>r.tooth===tooth && r.label===label && r.name===name))rxState.findings.push({tooth,label,name});
  });rxRecordFindingChange(before);rxRecentFinding=findingNotification;rxSelected.clear();rxRender();rxCommit();
}));
rxAll('.rx-bone-choice, .rx-pathology-choice, .rx-generalized-site').forEach(input=>input.addEventListener('change',()=>{
  if(input.classList.contains('rx-pathology-choice') && !input.checked) ['radiolucent','radiopaque','mixed-lesion'].forEach(key=>{rxQ('.rx-bone-choice[value="'+key+'"]').checked=false;});
  rxReadBoneControls();
}));
rxAll('.rx-location-input').forEach(input=>input.addEventListener('input',rxReadBoneControls));
rxQ('#rxLocalizedTeeth').addEventListener('input',rxReadBoneControls);
function rxReadWear() {
  rxState.wear={generalized:rxQ('#rxGeneralizedWear').checked,localized:rxQ('#rxLocalizedWear').checked,teeth:rxQ('#rxWearTeeth').value};
  rxQ('#rxWearDetails').hidden=!rxState.wear.localized;
  rxCommit();
}
rxAll('.rx-dentition-choice').forEach(input=>input.addEventListener('change',()=>{rxState.dentition[input.dataset.jaw]=input.value;rxCommit();}));
rxQ('#rxGeneralizedWear').addEventListener('change',rxReadWear);
rxQ('#rxLocalizedWear').addEventListener('change',rxReadWear);
rxQ('#rxWearTeeth').addEventListener('input',rxReadWear);
rxRender();rxUpdateBoneVisibility();

function rxUpdateReport() {
  const report=rxQ('#rxReport');
  const text=rxState.report !== null ? rxState.report : radiographExamText(rxState);
  if(report.textContent !== text)report.textContent=text;
  rxPreviousReportText=text;
}
function rxCommit() {
  rxState.report=null;
  rxUpdateReport();
  saveOdontogram(true);
}
function rxReportEntries(text) {
  const entries=new Set();
  text.split(/\r?\n/).forEach(line=>{
    const match=line.match(/^\s*((?:#(?:\d+|[A-T]))(?:\s*,\s*#(?:\d+|[A-T]))*)\s*-\s*(.+?)\s*$/i);
    if(!match)return;
    const labels=[...match[1].matchAll(/#(\d+|[A-T])/gi)].map(m=>m[1].toUpperCase());
    const names=match[2].split(',').map(name=>name.trim().replace(/\.+$/,'').toLowerCase());
    labels.forEach(label=>names.forEach(name=>entries.add(label+'|'+name)));
  });
  return entries;
}
function rxReportMissingLabels(text) {
  const labels=new Set();
  for(const match of text.matchAll(/\bMissing\s+([^\n.]+)/gi)) {
    for(const label of match[1].matchAll(/#?(\d+|\b[A-T]\b)/gi))labels.add(label[1].toUpperCase());
  }
  return labels;
}
function rxReportHasBridge(text,bridge) {
  const members=bridge.teeth.map((tooth,index)=>({tooth,label:bridge.labels[index]})).sort((a,b)=>a.tooth-b.tooth);
  const wanted=('Bridge #'+members[0].label+'-'+members.at(-1).label).toLowerCase();
  return text.split(/\r?\n/).some(line=>line.trim().replace(/\.+$/,'').toLowerCase()===wanted);
}
rxQ('#rxReport').addEventListener('input',()=>{
  const text=rxQ('#rxReport').innerText;
  const oldEntries=rxReportEntries(rxPreviousReportText),newEntries=rxReportEntries(text);
  const oldMissing=rxReportMissingLabels(rxPreviousReportText),newMissing=rxReportMissingLabels(text);
  const before=JSON.parse(JSON.stringify({findings:rxState.findings,bridges:rxState.bridges,recentFinding:rxRecentFinding,missing:Object.fromEntries(Object.entries(rxState.teeth).map(([n,tooth])=>[n,tooth.missing]))}));
  rxState.findings=rxState.findings.filter(record=>{
    const key=record.label.toUpperCase()+'|'+record.name.toLowerCase();
    return !oldEntries.has(key) || newEntries.has(key);
  });
  rxState.bridges=rxState.bridges.filter(bridge=>!rxReportHasBridge(rxPreviousReportText,bridge) || rxReportHasBridge(text,bridge));
  Object.entries(rxState.teeth).forEach(([number,tooth])=>{
    const label=rxLabel(Number(number)).toUpperCase();
    if(tooth.missing && oldMissing.has(label) && !newMissing.has(label))tooth.missing=false;
  });
  rxRecordFindingChange(before);
  rxState.report=text;
  rxPreviousReportText=text;
  rxRender(true);
  saveOdontogram(true);
});
function radiologyReportForNote(state) {
  return radiographExamText(state ? {...state,noteFormatting:true} : state);
}
rxQ('#copyRadiologyReport').addEventListener('click',async()=>{
  const report=rxQ('#rxReport');
  const status=rxQ('#rxCopyStatus');
  const text=report.innerText;
  try {
    await navigator.clipboard.writeText(text);
    status.textContent='Copied.';
  } catch {
    const selection=window.getSelection();
    const range=document.createRange();range.selectNodeContents(report);
    selection.removeAllRanges();selection.addRange(range);
    let copied=false;
    try { copied=document.execCommand('copy'); } catch {}
    status.textContent=copied ? 'Copied.' : 'Report selected. Press Command+C or Ctrl+C to copy.';
  }
});

function noteBlank(value) {
  const text=typeof value==='string' ? value.trim() : '';
  return text;
}
function cohriBlank(value) {
  const text=typeof value==='string' ? value.trim() : '';
  return text ? '('+text+')' : '';
}
function finishNoteLines(html) {
  return html.replace(/\r?\n/g,'<br>').split('<br>').map(line=>{
    line=line.trim();
    const text=line.replace(/<[^>]*>/g,'').trim();
    if(!text || text.endsWith('.'))return line;
    return line.replace(/:(<\/strong>)?$/, '$1')+'.';
  }).join('<br>');
}

const extraOralFields = [["tmjTenderness", "Tenderness", "TMJ"], ["tmjSounds", "Clicking/popping sound", "TMJ"], ["mandibularFunction", "Difficulty on mandibular function", "TMJ"], ["deviation", "Deviations when the mouth is opening/closing", "TMJ"], ["muscleTenderness", "Tenderness on muscles of mastication", "Head and neck"], ["lymphadenopathy", "Lymphadenopathy on neck and head", "Head and neck"], ["softTissue", "Scars/ current injuries/moles/soft tissue findings", "Head and neck"]];
function readExtraOralExam() {
  return Object.fromEntries(extraOralFields.map(([key])=>[key,{
    choice:query(`input[name="eo-${key}"]:checked`)?.value || '',
    details:byId('eo-details-'+key).value
  }]));
}
function updateExtraOralFields() {
  extraOralFields.forEach(([key])=>{byId('eo-details-'+key).hidden=query(`input[name="eo-${key}"]:checked`)?.value!=='yes';});
}
function restoreExtraOralExam(saved={}) {
  extraOralFields.forEach(([key])=>{
    all(`input[name="eo-${key}"]`).forEach(input=>{input.checked=input.value===saved?.[key]?.choice;});
    byId('eo-details-'+key).value=typeof saved?.[key]?.details==='string' ? saved[key].details : '';
  });
  updateExtraOralFields();
}
function extraOralExamText(cohri) {
  const groups=[];
  for(const group of ['TMJ','Head and neck']) {
    const findings=extraOralFields.filter(([, ,category])=>category===group).map(([key,label])=>{
      const item=cohri.extraOralStructured?.[key];
      if(!['yes','no'].includes(item?.choice))return '';
      if(item.choice==='no') return 'No '+label.charAt(0).toLowerCase()+label.slice(1);
      return label+(item.details.trim() ? ' '+noteBlank(item.details) : '');
    }).filter(Boolean);
    if(findings.length)groups.push(group+': '+findings.join('. ')+'.');
  }
  if(cohri.extraOralExam?.trim())groups.push(noteBlank(cohri.extraOralExam));
  return groups.join('\n');
}

const intraOralGroups = {"significant": {"label": "Significant findings", "choices": [["no", "No"], ["yes", "Yes"]]}, "lesions": {"label": "Oral lesions", "choices": [["no", "No"], ["yes", "Yes"]]}, "cancer": {"label": "Oral cancer screening", "choices": [["negative", "Negative"], ["positive", "Positive"]]}, "gingiva": {"label": "Gingiva", "choices": [["pink", "Pink color, firm, stippling gingiva"], ["soft", "Soft, spongy gingiva"]]}, "ridge": {"label": "Alveolar ridge", "choices": [["normal", "Normal, firm, pink color, no swelling"], ["exposed", "Bone exposed"], ["resorption", "Ridge resorption"], ["irregular", "Sharp, thin, irregular"]]}, "palatal": {"label": "Palatal torus", "choices": [["no", "No"], ["yes", "Yes"]]}, "palatal-shape": {"label": "Palatal torus shape", "choices": [["flat", "Flat/spindle"], ["nodular", "Nodular"], ["lobular", "Lobular"]]}, "mandibular": {"label": "Mandibular tori", "choices": [["no", "No"], ["yes", "Yes"]]}, "mandibular-side": {"label": "Mandibular tori distribution", "choices": [["bilateral", "Bilateral"], ["unilateral", "Unilateral"]]}, "mandibular-size": {"label": "Mandibular tori size", "choices": [["small", "Small"], ["prominent", "Prominent"]]}, "plaque": {"label": "Calculus and plaque accumulation", "choices": [["healthy-localized", "Healthy gum with localized plaque"], ["localized", "Localized calculus and plaque accumulation"], ["generalized", "Generalized calculus and plaque accumulation"]]}};
function readIntraOralExam() {
  const choices=Object.fromEntries(Object.keys(intraOralGroups).map(key=>[key,query(`input[name="io-${key}"]:checked`)?.value || '']));
  if(choices.palatal!=='yes')choices['palatal-shape']='';
  if(choices.mandibular!=='yes'){choices['mandibular-side']='';choices['mandibular-size']='';}
  const details=Object.fromEntries([...all('.io-detail, .io-buccal-detail')].map(input=>[input.dataset.ioDetail,input.value]));
  const occlusion=Object.fromEntries([...all(".io-occlusion-input")].map(input=>[input.dataset.occlusion,input.value]));
  const angular=['I','II','III'].includes(occlusion.class);
  occlusion.laterality=angular ? query('input[name="io-class-laterality"]:checked')?.value || '' : '';
  occlusion.side=occlusion.laterality==='unilateral' ? query('input[name="io-class-side"]:checked')?.value || '' : '';
  if(!occlusion.side)occlusion.remainingClass='';
  return {choices,details,occlusion};
}
function updateOcclusalClassFields() {
  const angular=['I','II','III'].includes(byId('ioOcclusalClass').value);
  const unilateral=angular && query('input[name="io-class-laterality"]:checked')?.value==='unilateral';
  const side=unilateral ? query('input[name="io-class-side"]:checked')?.value : '';
  byId('ioClassLaterality').hidden=!angular;
  byId('ioClassSide').hidden=!unilateral;
  byId('ioRemainingClassRow').hidden=!side;
  byId('ioRemainingClassLabel').textContent=side ? 'Class for the '+(side==='right' ? 'left' : 'right')+' side' : 'Class for remaining side';
}
function updateIntraOralFields() {
  updateOcclusalClassFields();
  const selected=key=>query(`input[name="io-${key}"]:checked`)?.value || '';
  byId('ioPalatalOptions').hidden=selected('palatal')!=='yes';
  byId('ioMandibularOptions').hidden=selected('mandibular')!=='yes';
  all('.io-detail').forEach(input=>{input.hidden=selected('ridge')!==input.dataset.ioDetail;});
  all('.io-buccal-detail').forEach(input=>{input.hidden=selected(input.dataset.ioDetail)!==(input.dataset.ioDetail==='cancer' ? 'positive' : 'yes');});
}
function restoreIntraOralExam(saved={}) {
  Object.keys(intraOralGroups).forEach(key=>all(`input[name="io-${key}"]`).forEach(input=>{input.checked=input.value===saved?.choices?.[key];}));
  all('.io-detail, .io-buccal-detail').forEach(input=>{input.value=typeof saved?.details?.[input.dataset.ioDetail]==='string' ? saved.details[input.dataset.ioDetail] : '';});
  all(".io-occlusion-input").forEach(input=>{input.value=typeof saved?.occlusion?.[input.dataset.occlusion]==="string" ? saved.occlusion[input.dataset.occlusion] : "";});
  for(const [name,key] of [['io-class-laterality','laterality'],['io-class-side','side']])all(`input[name="${name}"]`).forEach(input=>{input.checked=input.value===saved?.occlusion?.[key];});
  updateIntraOralFields();
}
function intraOralExamText(cohri) {
  const data=cohri.intraOralStructured || {}, choices=data.choices || {};
  const label=key=>intraOralGroups[key].choices.find(([value])=>value===choices[key])?.[1] || '';
  const lines=[];
  const buccal=['significant','lesions','cancer'].map(key=>{
    if(!choices[key])return '';
    if(key==='cancer')return 'Oral cancer screening: '+label(key)+(choices[key]==='positive' && data.details?.cancer?.trim() ? ' '+noteBlank(data.details.cancer) : '');
    return choices[key]==='no' ? 'No '+intraOralGroups[key].label.toLowerCase() : data.details?.[key]?.trim() || '';
  }).filter(Boolean);
  if(buccal.length)lines.push('Buccal mucosa/vestibule: '+buccal.join('. ')+'.');
  if(choices.gingiva)lines.push('Gingiva: '+label('gingiva')+'.');
  if(choices.plaque)lines.push(label('plaque')+'.');
  if(choices.ridge)lines.push('Alveolar ridge: '+label('ridge')+(choices.ridge!=='normal' && data.details?.[choices.ridge]?.trim() ? ' '+noteBlank(data.details[choices.ridge]) : '')+'.');
  if(choices.palatal)lines.push(choices.palatal==='no' ? 'No palatal torus.' : 'Palatal torus'+(label('palatal-shape') ? ' '+label('palatal-shape').toLowerCase() : '')+'.');
  if(choices.mandibular)lines.push(choices.mandibular==='no' ? 'No mandibular tori.' : 'Mandibular tori'+([label('mandibular-side'),label('mandibular-size')].filter(Boolean).length ? ' '+[label('mandibular-side'),label('mandibular-size')].filter(Boolean).join(', ').toLowerCase() : '')+'.');
  const occlusion=data.occlusion || {};
  let classText=occlusion.class?.trim() ? 'Class '+occlusion.class.trim() : '';
  if(['I','II','III'].includes(occlusion.class)) {
    if(occlusion.laterality==='bilateral')classText+=' bilateral';
    if(occlusion.laterality==='unilateral'){
      classText+=' unilateral'+(occlusion.side ? ' on the '+occlusion.side+' side' : '');
      if(occlusion.side && occlusion.remainingClass)classText+='; Class '+occlusion.remainingClass+' on the '+(occlusion.side==='right' ? 'left' : 'right')+' side';
    }
  }
  const occlusalText=[classText,occlusion.overbite?.trim() ? 'Overbite '+noteBlank(occlusion.overbite.trim()+'%') : '',occlusion.overjet?.trim() ? 'Overjet '+noteBlank(occlusion.overjet.trim()+' mm') : ''].filter(Boolean);
  if(occlusalText.length)lines.push('Occlusal classification: '+occlusalText.join(', ')+'.');
  return lines.join('\n');
}

const medicalConditionOptions = [["joint", "Total joint replacement"], ["heart", "Heart diseases/cardiac surgery"], ["cancer", "Cancer/malignant diseases"], ["chemo-radiation", "Chemothery/radiation"], ["hypertension", "Hypertension"], ["cholesterol", "High cholesterol"], ["diabetes", "Diabetes"], ["hyperthyroidism", "Hyperthyroidism"], ["hypothyroidism", "Hypothyroidism"], ["gerd", "GERD"]];
function updateMedicalHistoryFields() {
  medicalConditionOptions.forEach(([key])=>{byId('mh-'+key+'-details').hidden=!query('.mh-choice[value="'+key+'"]').checked;});
  byId('mhDiabetesOptions').hidden=!query('.mh-choice[value="diabetes"]').checked;
}
function readMedicalHistory() {
  const selected=[...all('.mh-choice')].filter(input=>input.checked).map(input=>input.value);
  const details=Object.fromEntries(medicalConditionOptions.map(([key])=>[key,byId('mh-'+key+'-details').value]));
  return {selected,details,jointDetails:details.joint,heartDetails:details.heart,
    diabetesType:selected.includes('diabetes') ? query('input[name="mh-diabetes-type"]:checked')?.value || '' : ''};
}
function restoreMedicalHistory(saved={}) {
  all('.mh-choice').forEach(input=>{input.checked=Array.isArray(saved?.selected) && saved.selected.includes(input.value);});
  medicalConditionOptions.forEach(([key])=>{
    const value=saved?.details?.[key] ?? (key==='joint' ? saved?.jointDetails : key==='heart' ? saved?.heartDetails : '');
    byId('mh-'+key+'-details').value=typeof value==='string' ? value : '';
  });
  all('.mh-diabetes-type').forEach(input=>{input.checked=input.value===saved?.diabetesType;});
  updateMedicalHistoryFields();
}
function medicalHistoryText(data={}) {
  return medicalConditionOptions.filter(([key])=>data?.selected?.includes(key)).map(([key,label])=>{
    const detail=data?.details?.[key] ?? (key==='joint' ? data?.jointDetails : key==='heart' ? data?.heartDetails : '');
    return label+(key==='diabetes' && data.diabetesType ? ' '+data.diabetesType : '')+(detail?.trim() ? ' '+cohriBlank(detail) : '');
  }).join('. ');
}

const medicationOptionNames = [["smoking", "Smoking"], ["alcohol", "Alcohol"], ["drugs", "Marijuana/Street drugs"], ["bisphosphonate", "Bisphosphonate drugs"], ["anticoagulant", "Aspirin/Anticoagulant agents"]];
function readMedicationOptions() {
  return Object.fromEntries(medicationOptionNames.map(([key])=>[key,{selected:query('.medication-choice[value="'+key+'"]').checked,details:byId('medication-'+key+'-details').value}]));
}
function updateMedicationOptions() {
  medicationOptionNames.forEach(([key])=>{byId('medication-'+key+'-details').hidden=!query('.medication-choice[value="'+key+'"]').checked;});
}
function restoreMedicationOptions(saved={}) {
  all('.medication-choice').forEach(input=>{input.checked=saved?.[input.value]?.selected===true;});
  medicationOptionNames.forEach(([key])=>{byId('medication-'+key+'-details').value=typeof saved?.[key]?.details==='string' ? saved[key].details : '';});
  updateMedicationOptions();
}
function medicationOptionsText(saved={}) {
  return medicationOptionNames.filter(([key])=>saved?.[key]?.selected).map(([key,label])=>label+(saved[key].details?.trim() ? ' '+cohriBlank(saved[key].details) : '')).join('. ');
}

const acceptanceStatements = {"conditional": "The patient is conditionally accepted pending further consults. Consent forms were signed and the next appointment was scheduled for COE.", "nonaccepted": "The patient is non-accepted/non-teaching, and the non-teach form was filled out and scanned in the patient chart."};
function updateAcceptanceFormFields() {
  byId('decisionMedicalDetails').hidden=query('input[name="decision-medical-consult"]:checked')?.value!=='yes';
  byId('decisionReferralSpecialist').hidden=query('input[name="decision-referral"]:checked')?.value!=='yes';
  byId('decisionReferralReasonLabel').hidden=byId('decisionReferralSpecialist').hidden;
}
function updateHistoryReview() {
  const established = query('input[name="visit-type"]:checked')?.value === 'Emergency/Established patient';
  all('.history-review').forEach(control => {
    control.hidden = !established;
    const choice = query('input[name="review-' + control.dataset.review + '"]:checked')?.value;
    const content = byId('reviewContent-' + control.dataset.review);
    const blurred = established && choice !== 'change';
    content.classList.toggle('review-blurred', blurred);
    content.inert = blurred;
  });
}
function dentalHistoryHeading(visitType) {
  return visitType?.startsWith('Emergency/') ? 'History of emergency' : 'History of chief complaint';
}
function updateVisitAppearance() {
  const selected = query('input[name="visit-type"]:checked');
  const historyHeading = dentalHistoryHeading(selected?.value);
  query('label[for="premedicationDetails"]').textContent = historyHeading;
  byId('premedicationDetails').setAttribute('aria-label', historyHeading);
  document.body.classList.toggle('visit-unselected', !selected);
  document.body.classList.toggle('visit-emergency', Boolean(selected?.value.startsWith('Emergency/')));
  document.body.classList.toggle('visit-emergency-established', selected?.value === 'Emergency/Established patient');
  all('.visit-type-button').forEach(button => {
    button.setAttribute('aria-pressed', String(byId(button.dataset.visitInput).checked));
  });
  all('.clinical-panel').forEach(panel => { panel.inert = !selected; });
  updateHistoryReview();
  syncConditionalNV();
}
function updateAcceptanceOptions() {
  updateVisitAppearance();
  updateAcceptanceFormFields();
  const visitType = query('input[name="visit-type"]:checked')?.value;
  const emergency = Boolean(visitType?.startsWith('Emergency/'));
  byId('screeningAcceptance').disabled = visitType !== 'New patient screening';
  byId('screeningAcceptance').hidden = emergency;
  byId('acceptanceDecisionHeading').textContent = emergency ? 'Limited treatment' : 'Acceptance/Decision';
}
function acceptanceDecisionText(data={},visitType) {
  const lines=[];
  if((visitType === undefined || visitType === "New patient screening") && acceptanceStatements[data?.screening])lines.push(acceptanceStatements[data.screening]);
  lines.push(...limitedTreatmentLines(data.limited));
  if(data?.medicalConsult?.choice === 'yes')lines.push('Medical consult form: '+(data.medicalConsult.details?.trim() || ''));
  if(data?.referral?.choice === 'yes')lines.push('Referral form: '+('Referred for '+(data.referral.specialist || '')+' with the reason - '+(data.referral.reason?.trim() || '')));
  return lines.join('\n');
}
function acceptanceDecisionNoteHTML(data={},visitType,escape) {
  const lines=[];
  if(visitType==='New patient screening' && acceptanceStatements[data?.screening])lines.push('<strong style="color:'+(data.screening==='conditional' ? '#2563eb' : '#dc2626')+'">'+escape(acceptanceStatements[data.screening])+'</strong>');
  lines.push(...limitedTreatmentLines(data.limited).map(line => {
    for (const heading of ['Antibiotic prescription:', 'Local anesthesia:', 'Extraction:', 'Post-operative care:', 'Pulpal debridement (D3221)', 'Incision and drainage of abscess (D7510)']) {
      if (line.startsWith(heading)) return '<br><strong>' + heading + '</strong> ' + escape(line.slice(heading.length).trim());
    }
    return escape(line);
  }));
  if(data?.medicalConsult?.choice === 'yes')lines.push('<strong>Medical consult form: '+escape(data.medicalConsult.details?.trim() || '')+'</strong>');
  if(data?.referral?.choice === 'yes')lines.push('<strong>Referral form: '+('Referred for '+escape(data.referral.specialist || '')+' with the reason - '+escape(data.referral.reason?.trim() || ''))+'</strong>');
  return lines.join('<br>');
}

let providedTreatments = null;
let noteOverride = null;

function setDentitionButtons(mode) {
  all(".dentition-button").forEach(button => {
    const active = button.dataset.dentition === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function setAttributes(element, attributes) {
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
}

function refreshChart() {
  ensureProvidedTreatments();
  noteOverride = null;
  updateFindingButtons();
  renderFindings();
  updateNote();
  updatePreparationFields();
  saveOdontogram(true);
}

function finishSelection() {
  clearTemporarySelection();
  selections = [];
  refreshChart();
}

let selections = [];
let findings = [];
let nextBatchId = 1;
let chartEdits = {};
const anteriorTeeth = [ 6, 7, 8, 9, 10, 11, 22, 23, 24, 25, 26, 27 ];
const maxillaryTeeth = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ];
const mandibularTeeth = [ 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17 ];
const primaryToothMap = {
  4: "A", 5: "B", 6: "C", 7: "D", 8: "E", 9: "F", 10: "G", 11: "H", 12: "I", 13: "J",
  20: "K", 21: "L", 22: "M", 23: "N", 24: "O", 25: "P", 26: "Q", 27: "R", 28: "S", 29: "T"
};
const positionFindings = [ "mobility", "tilted", "rotated", "super-eruption", "erupting" ];
const mixedPermanentTeeth = [ 3, 14, 19, 30, 7, 8, 9, 10, 23, 24, 25, 26 ];
createArch("maxillary", maxillaryTeeth);
createArch("mandibular", mandibularTeeth);
updateFindingButtons();

function createArch(containerID, teeth) {
  const container = byId(containerID);
  teeth.forEach((toothNumber, index) => {
    const tooth = createTooth(toothNumber);
    if (index === 7) tooth.classList.add("midline");
    container.appendChild(tooth);
  });
}

function createTooth(toothNumber) {
  const wrapper = document.createElement("div");
  wrapper.className = "tooth";
  wrapper.dataset.tooth = toothNumber;
  const isAnterior = anteriorTeeth.includes(toothNumber);
  const centerSurface = isAnterior ? "I" : "O";
  const outerSurface = isAnterior ? "F" : "B";
  const isRightSide = (toothNumber >= 1 && toothNumber <= 8) || (toothNumber >= 25 && toothNumber <= 32);
  const leftSurface = isRightSide ? "D" : "M";
  const rightSurface = isRightSide ? "M" : "D";
  const isMandibular = toothNumber >= 17 && toothNumber <= 32;
  const topSurface = isMandibular ? "L" : outerSurface;
  const bottomSurface = isMandibular ? outerSurface : "L";
  wrapper.innerHTML = ` <svg class="tooth-diagram" viewBox="0 0 120 205" data-tooth="${toothNumber}" >
    <path class="surface" data-surface="${topSurface}" d="M 13.515 13.515 Q 17.029 10 22 10 H 98 Q 102.971 10 106.485 13.515 L 85 35 H 35 Z" ></path>
    <path class="surface" data-surface="${leftSurface}" d="M 13.515 13.515 L 35 35 V 85 L 13.515 106.485 Q 10 102.971 10 98 V 22 Q 10 17.029 13.515 13.515 Z" ></path>
    <rect class="surface" data-surface="${centerSurface}" x="35" y="35" width="50" height="50" ></rect>
    <path class="surface" data-surface="${rightSurface}" d="M 106.485 13.515 Q 110 17.029 110 22 V 98 Q 110 102.971 106.485 106.485 L 85 85 V 35 Z" ></path>
    <path class="surface" data-surface="${bottomSurface}" d="M 13.515 106.485 L 35 85 H 85 L 106.485 106.485 Q 102.971 110 98 110 H 22 Q 17.029 110 13.515 106.485 Z" ></path>
    <g class="endo-coronal-network">
    <path class="endo-coronal-links" d="M60 60 L60 23 M60 60 L23 60 M60 60 L97 60 M60 60 L60 98" ></path>
    <circle cx="60" cy="23" r="9"></circle>
    <circle cx="23" cy="60" r="9"></circle>
    <circle cx="60" cy="60" r="9"></circle>
    <circle cx="97" cy="60" r="9"></circle>
    <circle cx="60" cy="98" r="9"></circle></g>
    <text x="60" y="28">${topSurface}</text>
    <text x="23" y="65">${leftSurface}</text>
    <text x="60" y="65">${centerSurface}</text>
    <text x="97" y="65">${rightSurface}</text>
    <text x="60" y="103">${bottomSurface}</text>
    <rect class="surface cervical-surface" data-surface="C" x="15" y="135" width="90" height="40" rx="3" ></rect>
    <text class="cervical-label" x="60" y="155" >C</text>
    <g class="lengthening-arrows">
    <path d="M35 181 V197 M29 191 L35 197 L41 191" ></path>
    <path d="M60 181 V197 M54 191 L60 197 L66 191" ></path>
    <path d="M85 181 V197 M79 191 L85 197 L91 191" ></path></g>
    <g class="endo-symbol">
    <path class="endo-root" d="M43 130 Q60 125 77 130 L68 169 Q60 184 52 169 Z" ></path>
    <path class="endo-canal" d="M50 135 H70 M60 135 L60 174" ></path></g>
    <g class="pulpotomy-symbol">
    <path class="endo-root" d="M43 130 Q60 125 77 130 L68 169 Q60 184 52 169 Z" ></path>
    <rect class="pulp-chamber" x="49" y="132" width="22" height="10" rx="2" ></rect></g>
    <g class="post-core-symbol">
    <path class="endo-root" d="M43 130 Q60 125 77 130 L68 169 Q60 184 52 169 Z" ></path>
    <path class="post-canal" d="M60 155 V174" ></path>
    <rect class="core-block" x="47" y="130" width="26" height="12" rx="2" ></rect>
    <path class="post-shaft" d="M60 140 V159" ></path></g>
    <g class="implant-symbol" transform="translate(0 121) scale(1 .38)" >
    <path d="M48 14 H72 V29 L77 35 H43 L48 29 Z" fill="#ccefed" ></path>
    <path d="M40 36 H80 V48 L72 127 Q60 147 48 127 L40 48 Z" fill="#e8f6f5" ></path>
    <path d="M39 49 L80 55 M41 62 L78 68 M42 75 L77 81 M44 88 L76 94 M45 101 L74 107 M47 114 L72 120 M50 126 L68 132" fill="none" ></path></g>
    <rect class="crown-outline" x="6" y="6" width="108" height="108" rx="8" ></rect>
    <path class="extraction-cross" d="M10 10 L110 175 M110 10 L10 175" ></path></svg>
    <div class="tooth-number" data-tooth="${toothNumber}" data-age="permanent" >#${toothNumber}</div>
    <div class="root-markers" data-tooth="${toothNumber}" ></div>
    <div class="watch-marker" data-tooth="${toothNumber}" >
    <svg viewBox="0 0 32 20" role="img" aria-label="Watch tooth" >
    <path d="M2 10 Q16 -5 30 10 Q16 25 2 10 Z"></path>
    <circle cx="16" cy="10" r="4"></circle></svg></div>
    <div class="position-display" data-tooth="${toothNumber}" ></div> `;
  return wrapper;
}

function getToothLabel(toothNumber) {
  const numberElement = query( `.tooth-number[data-tooth="${toothNumber}"]` );
  if ( numberElement && numberElement.dataset.age === "primary" ) return "#" + primaryToothMap[toothNumber];
  return "#" + toothNumber;
}
document.addEventListener("click", event => {
  const surface = event.target.closest(".surface");
  if (!surface) return;
  const svg = surface.closest(".tooth-diagram");
  const toothNumber = Number(svg.dataset.tooth);
  const surfaceName = surface.dataset.surface;
  if (hasWholeSelections()) {
    clearTemporarySelection();
    selections = [];
  }
  let toothSelection = selections.find((item) => item.tooth === toothNumber && item.whole === false);
  if (!toothSelection) {
    toothSelection = {
      tooth: toothNumber, surfaces: [], whole: false };
    selections.push(toothSelection);
  }
  if (toothSelection.surfaces.includes(surfaceName)) {
    toothSelection.surfaces = toothSelection.surfaces.filter((item) => item !== surfaceName);
    surface.classList.remove("selected");
  } else {
    toothSelection.surfaces.push(surfaceName);
    surface.classList.add("selected");
  }
  if (toothSelection.surfaces.length === 0) selections = selections.filter((item) => item !== toothSelection);
  updateFindingButtons();
});
document.addEventListener("click", event => {
  const number = event.target.closest(".tooth-number");
  if (!number) return;
  const toothNumber = Number(number.dataset.tooth);
  if (hasSurfaceSelections()) {
    clearTemporarySelection();
    selections = [];
  }
  const existing = selections.find((item) => item.tooth === toothNumber && item.whole === true);
  if (existing) {
    selections = selections.filter((item) => item !== existing);
    number.classList.remove("selected");
  } else {
    selections.push({
      tooth: toothNumber, surfaces: [], whole: true });
    number.classList.add("selected");
  }
  updateFindingButtons();
});

function hasWholeSelections() {
  return selections.some(item => item.whole === true);
}

function hasSurfaceSelections() {
  return selections.some(item => item.whole === false);
}

function clearTemporarySelection() {
  all(".surface.selected, .tooth-number.selected")
  .forEach(element => element.classList.remove("selected"));
}

function isToothMissing(toothNumber) {
  const tooth = query( `.tooth[data-tooth="${toothNumber}"]` );
  return Boolean(tooth && tooth.hidden) || findings.some((record) => record.tooth === toothNumber && record.whole === true && record.finding === "missing");
}

function ensureProvidedTreatments() {
  if (query('input[name="cohri-provided"]:checked')?.value !== "change" || providedTreatments !== null) return;
  const previous = byId("providedDetails").value;
  const legacy = [...previous.matchAll(/(Composite|Amalgam|RMGI|IRM)\s*#+\s*(\d{1,2}|[A-T])(?:[\s-]+([MODBLFIC]+)\b)?/gi)].map(match => {
    const label = match[2].toUpperCase();
    const number = /^\d+$/.test(label) ? Number(label) : Number(Object.keys(primaryToothMap).find(key => primaryToothMap[key] === label));
    return { tooth: number, toothLabel: "#" + label, finding: match[1], surfaces: (match[3] || "").toUpperCase().split(""), whole: !match[3], treatment: true, batchId: nextBatchId++ };
  }).filter(record => record.tooth >= 1 && record.tooth <= 32);
  providedTreatments = legacy.length ? legacy : findings.filter(record => record.treatment).map(record => ({ ...record, surfaces: [...record.surfaces] }));
}

function renderRecordTags(containerId, treatment) {
  const container = byId(containerId);
  container.replaceChildren();
  const records = containerId === "providedTreatmentTags" ? providedTreatments || [] : findings;
  records.forEach((record, index) => {
    if (Boolean(record.treatment) !== treatment) return;
    const label = "#" + String(record.toothLabel || record.tooth).replace(/^#+/, "");
    const surfaces = orderedSurfaces(record.surfaces).join("");
    const material = ["composite", "amalgam", "sealant", "irm"].includes(record.finding.toLowerCase());
    const description = treatment ? `${record.finding} ${label}${surfaces ? "-" + surfaces : ""}`
      : `${label}${surfaces ? "-" + surfaces : ""} ${material ? "existing " : ""}${record.finding}`;
    const tag = document.createElement("span");
    tag.className = "diagnosis-tag";
    const choose = document.createElement("button");
    choose.type = "button";
    choose.className = "diagnosis-tag-select";
    choose.textContent = description;
    const selected = selections.some(selection => selection.tooth === record.tooth && selection.whole === record.whole &&
      orderedSurfaces(selection.surfaces).join("") === surfaces);
    choose.setAttribute("aria-pressed", String(selected));
    choose.addEventListener("click", () => {
      clearTemporarySelection();
      selections = selected ? [] : [{ tooth: record.tooth, surfaces: [...record.surfaces], whole: record.whole, diagnosis: treatment ? null : record.finding }];
      if (!selected) {
        if (record.whole) query(`.tooth-number[data-tooth="${record.tooth}"]`)?.classList.add("selected");
        else record.surfaces.forEach(surface => {
          query(`.tooth-diagram[data-tooth="${record.tooth}"] .surface[data-surface="${surface}"]`)?.classList.add("selected");
        });
      }
      updateFindingButtons();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "diagnosis-tag-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Delete " + description);
    remove.addEventListener("click", () => {
      records.splice(index, 1);
      finishSelection();
    });
    tag.append(choose, remove);
    container.append(tag);
  });
}

function renderDiagnosisTags() {
  renderRecordTags("diagnosisTags", false);
  renderRecordTags("plannedTreatmentTags", true);
  renderRecordTags("providedTreatmentTags", true);
}

function plannedFillingSurfaces(selection, treatment) {
  const surfaces = [...selection.surfaces];
  if (treatment !== "Composite" || !surfaces.some(surface => ["M", "D"].includes(surface))) return surfaces;
  const isCaries = name => /decay|caries/i.test(name || "");
  const caries = selection.diagnosis !== undefined ? isCaries(selection.diagnosis)
    : findings.some(record => !record.treatment && record.tooth === selection.tooth && isCaries(record.finding) &&
        record.surfaces.some(surface => ["M", "D"].includes(surface) && surfaces.includes(surface)));
  if (caries) {
    const anterior = (selection.tooth >= 6 && selection.tooth <= 11) || (selection.tooth >= 22 && selection.tooth <= 27);
    const additional = anterior ? "L" : "O";
    if (!surfaces.includes(additional)) surfaces.push(additional);
  }
  return orderedSurfaces(surfaces);
}

function updateFindingButtons() {
  const surface = hasSurfaceSelections();
  const whole = selections.length > 0 && !surface;
  const setDisabled = (selector, disabled) => {
    all(selector).forEach(button => { button.disabled = disabled; });
  };
  setDisabled(".watch-treatment", !hasWholeSelections() && !surface);
  setDisabled(".surface-treatment", !surface);
  setDisabled(".whole-treatment", !hasWholeSelections());
  setDisabled(".surface-finding", !surface);
  setDisabled(".whole-finding", !whole);
  const unmissing = whole && selections.every(item => isToothMissing(item.tooth));
  const missingButton = byId("missingMain");
  missingButton.textContent = unmissing ? "(M) Unmissing" : "(M) Missing";
  missingButton.dataset.name = unmissing ? "unmissing" : "missing";
  renderDiagnosisTags();
}
all(".finding").forEach(function(button) {
  button.addEventListener("click", function() {
    if (selections.length === 0) return;
    const finding = this.dataset.name;
    if (finding === "unmissing") {
      delete chartEdits["missing-teeth"];
      const selectedToothNumbers = selections.map((selection) => selection.tooth);
      findings = findings.filter((record) => !( selectedToothNumbers.includes(record.tooth) && record.whole === true && record.finding === "missing" ));
      selectedToothNumbers.forEach(toothNumber => {
        const tooth = query( `.tooth[data-tooth="${toothNumber}"]` );
        if (tooth) tooth.hidden = false;
      });
      finishSelection();
      return;
    }
    if (finding === "missing") delete chartEdits["missing-teeth"];
    const batchId = nextBatchId++;
    if (finding === "Bridge") {
      const selectedTeeth = selections .map((selection) => selection.tooth) .sort((a, b) => a - b);
      if (selectedTeeth.length < 2) {
        alert("Please select at least two teeth for a bridge.");
        return;
      }
      const bridgeStart = selectedTeeth[0];
      const bridgeEnd = selectedTeeth[selectedTeeth.length - 1];
      findings.push({
        tooth: bridgeStart, bridgeTeeth: selectedTeeth, bridgeStart, bridgeEnd, bridgeStartLabel: getToothLabel(bridgeStart), bridgeEndLabel: getToothLabel(bridgeEnd), surfaces: [], whole: true, finding: "Bridge", batchId });
    } else {
      selections.forEach(selection => {
        findings.push({
          tooth: selection.tooth, toothLabel: getToothLabel(selection.tooth), surfaces: [...selection.surfaces], whole: selection.whole, finding, batchId });
      });
    }
    finishSelection();
  });
});
byId("changeAge").addEventListener( "click", () => {
  if (!hasWholeSelections()) {
    alert("Please select one or more tooth numbers first.");
    return;
  }
  selections.forEach(selection => {
    const tooth = query( `.tooth[data-tooth="${selection.tooth}"]` );
    const number = tooth.querySelector(".tooth-number");
    const showPermanent = tooth.hidden || number.dataset.age === "primary";
    setToothAge( selection.tooth, showPermanent ? "permanent" : "primary" );
  });
  clearTemporarySelection();
  selections = [];
  all(".dentition-button").forEach( button => {
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
  });
  refreshChart();
});

function setToothAge(toothNumber, age) {
  const tooth = query( `.tooth[data-tooth="${toothNumber}"]` );
  const number = tooth.querySelector(".tooth-number");
  const primary = age === "primary";
  const letter = primaryToothMap[toothNumber];
  tooth.hidden = primary && !letter;
  number.dataset.age = primary && letter ? "primary" : "permanent";
  number.textContent = "#" + (primary && letter ? letter : toothNumber);
}

function setDentition(mode) {
  clearTemporarySelection();
  selections = [];
  all(".tooth").forEach(tooth => {
    const toothNumber = Number(tooth.dataset.tooth);
    const permanent = mode === "permanent" || ( mode === "mixed" && mixedPermanentTeeth.includes(toothNumber) );
    setToothAge( toothNumber, permanent ? "permanent" : "primary" );
  });
  setDentitionButtons(mode);
  refreshChart();
}
all(".dentition-button").forEach( button => {
  button.addEventListener("click", () => { setDentition(button.dataset.dentition); });
});
all(".treatment").forEach(button => {
  button.addEventListener("click", () => {
    if (button.disabled || selections.length === 0) return;
    const bridgeTeeth = ["Bridge", "bridge"].includes(button.dataset.treatment) ? selections.map(selection => selection.tooth) : null;
    if (bridgeTeeth && bridgeTeeth.length < 2) {
      alert("Please select at least two teeth for a bridge.");
      return;
    }
    ensureProvidedTreatments();
    const records = query('input[name="cohri-provided"]:checked')?.value === "change" ? providedTreatments : findings;
    const batchId = nextBatchId++;
    selections.forEach(selection => {
      const label = getToothLabel(selection.tooth);
      const record = {
        tooth: selection.tooth, toothLabel: label, surfaces: plannedFillingSurfaces(selection, button.dataset.treatment), whole: selection.whole, finding: button.dataset.treatment, treatment: true, bridgeTeeth, batchId };
      const duplicate = records.some((r) => r.treatment && r.tooth === record.tooth && r.toothLabel === label && r.finding === record.finding && r.whole === record.whole && [...r.surfaces].sort().join(",") === [...record.surfaces].sort().join(","));
      if (!duplicate) records.push(record);
      delete chartEdits[ "tooth-" + record.tooth + "-" + label ];
    });
    finishSelection();
  });
});

function getRecordColor(record) {
  const selector = record.treatment ? ".treatment" : ".finding";
  const button = Array.from( all(selector) ).find(button => {
    const name = record.treatment ? button.dataset.treatment : button.dataset.name;
    return name === record.finding;
  });
  return button
  ? getComputedStyle(button).backgroundColor
  : null;
}

function markCrown(toothNumber, color) {
  const tooth = query( `.tooth-diagram[data-tooth="${toothNumber}"]` );
  if (!tooth || !color) return;
  tooth.classList.add("has-crown-outline");
  tooth.querySelector(".crown-outline").style.stroke = color;
}

function renderFindings() {
  all(".tooth").forEach(tooth => { tooth.classList.remove("has-watch-marker"); });
  const surfaceClasses = {
    "stain": "stain", "caries": "caries", "cavity": "caries",
    "decay": "caries", "decalcified": "decalcified", "incipient caries": "incipient-caries",
    "recurrent caries": "recurrent-caries", "gross caries": "gross-caries", "composite": "composite",
    "amalgam": "amalgam", "sealant": "sealant", "IRM": "irm",
    "wear": "wear", "chipped": "chipped", "abfraction": "abfraction", "erosion": "erosion",
    "crack line": "crack-line", "broken": "broken"
  };
  const wholeClasses = {
    "SSC": "ssc", "Zirconia crown": "zirconia-crown", "PFM crown": "pfm-crown",
    "Metal crown": "metal-crown", "RCT": "rct", "post & core": "post-core",
    "implant": "implant", "missing": "missing", "root tip": "root-tip",
    "PARL": "parl", "PARO": "paro", "ankylosis": "ankylosis"
  };
  const crownFindings = [ "SSC", "Zirconia crown", "PFM crown", "Metal crown", "implant" ];
  const crownTreatments = [ "CBU", "SSC", "Zirconia", "PFM", "Metal", "Bridge", "bridge", "Implant", "implant" ];
  const fillingTreatments = [ "Composite", "Amalgam", "RMGI", "IRM" ];
  all(".cervical-label").forEach( label => { label.textContent = "C"; });
  all(".root-markers").forEach( marker => { marker.innerHTML = ""; });
  all(".surface").forEach( surface => {
    surface.classList.remove( ...new Set(Object.values(surfaceClasses)) );
    surface.style.removeProperty("fill");
  });
  all(".tooth-diagram").forEach( tooth => {
    tooth.classList.remove( ...Object.values(wholeClasses), "bridge", "extraction-planned", "has-crown-outline", "has-implant-symbol", "has-endo-symbol", "has-lengthening-arrows", "has-pulpotomy-symbol", "has-post-core-symbol", "has-endo-coronal" );
    tooth.style.removeProperty("--endo-color");
    tooth.querySelector(".crown-outline") .style.removeProperty("stroke");
  });
  findings.forEach(record => {
    const color = getRecordColor(record);
    const tooth = query( `.tooth-diagram[data-tooth="${record.tooth}"]` );
    if (!tooth) return;
    if ( ["Pulpotomy", "RCT", "post & core"].includes(record.finding) ) {
      tooth.classList.add("has-endo-coronal");
      tooth.style.setProperty( "--endo-color", color || "#66bb6a" );
    }
    if (record.finding === "RCT") tooth.classList.add("has-endo-symbol");
    if (record.finding === "Pulpotomy") tooth.classList.add("has-pulpotomy-symbol");
    if (record.finding === "post & core") tooth.classList.add("has-post-core-symbol");
    if ( record.treatment && record.finding === "Crown lengthening" ) tooth.classList.add("has-lengthening-arrows");
    if (record.treatment) {
      if (record.finding === "Watch" && record.whole) tooth.closest(".tooth") .classList.add("has-watch-marker");
      if (record.finding === "Extraction") tooth.classList.add("extraction-planned");
      if (["Implant", "implant"].includes(record.finding)) tooth.classList.add("has-implant-symbol");
      if (crownTreatments.includes(record.finding)) markCrown(record.tooth, color);
      if (fillingTreatments.includes(record.finding) && color) {
        record.surfaces.forEach(name => {
          const surface = tooth.querySelector( `.surface[data-surface="${name}"]` );
          if (surface) surface.style.fill = color;
        });
      }
      return;
    }
    if (record.whole) {
      if (positionFindings.includes(record.finding)) return;
      if ( record.finding === "Bridge" && record.bridgeTeeth ) {
        record.bridgeTeeth.forEach(number => { markCrown(number, color); });
        return;
      }
      if ( ["PARL", "PARO", "ankylosis"].includes(record.finding) ) {
        const markers = query( `.root-markers[data-tooth="${record.tooth}"]` );
        const alreadyPresent = Array.from( markers.children ).some((dot) => dot.dataset.finding === record.finding);
        if (!alreadyPresent) {
          const dot = document.createElement("span");
          dot.className = "root-marker";
          dot.dataset.finding = record.finding;
          dot.style.backgroundColor = color;
          dot.title = record.finding;
          dot.setAttribute("aria-label", record.finding);
          markers.appendChild(dot);
        }
        return;
      }
      if (record.finding === "implant") tooth.classList.add("has-implant-symbol");
      if (crownFindings.includes(record.finding)) markCrown(record.tooth, color);
      if (wholeClasses[record.finding]) tooth.classList.add(wholeClasses[record.finding]);
      if (record.finding === "root tip") tooth.querySelector(".cervical-label").textContent = "R";
      return;
    }
    record.surfaces.forEach(name => {
      const surface = tooth.querySelector( `.surface[data-surface="${name}"]` );
      if (!surface) return;
      if (surfaceClasses[record.finding]) surface.classList.add(surfaceClasses[record.finding]);
      if ( ["composite", "amalgam", "sealant", "IRM"] .includes(record.finding) && color ) surface.style.fill = color;
    });
  });
  renderPositions();
  renderBridges();
}

function renderPositions() {
  all(".position-display").forEach( display => { display.innerHTML = ""; });
  all(".tooth-number").forEach( number => { number.classList.remove("has-mobility"); });
  findings.forEach(record => {
    if (!positionFindings.includes(record.finding)) return;
    const display = query( `.position-display[data-tooth="${record.tooth}"]` );
    if (!display) return;
    const item = document.createElement("span");
    item.className = "position-item";
    item.textContent = record.finding.charAt(0).toUpperCase() + record.finding.slice(1);
    display.appendChild(item);
    if (record.finding === "mobility") {
      const toothNumber = query( `.tooth-number[data-tooth="${record.tooth}"]` );
      if (toothNumber) toothNumber.classList.add("has-mobility");
    }
  });
}

function renderBridges() {
  all(".bridge-overlay").forEach( overlay => { overlay.remove(); });
  const bridgeGroups = new Map();
  findings.filter((record) => ["Bridge", "bridge"].includes(record.finding)).forEach(record => {
    const key = (record.treatment ? "treatment-" : "finding-") + record.batchId;
    if (!bridgeGroups.has(key)) {
      bridgeGroups.set(key, {
        record, teeth: new Set() });
    }
    (record.bridgeTeeth || [record.tooth]).forEach( number => { bridgeGroups.get(key).teeth.add(number); });
  });
  const ns = "http://www.w3.org/2000/svg";
  all(".arch").forEach(arch => {
    const bounds = arch.getBoundingClientRect();
    const overlay = document.createElementNS(ns, "svg");
    overlay.classList.add("bridge-overlay");
    overlay.setAttribute("width", arch.scrollWidth);
    overlay.setAttribute("height", arch.clientHeight);
    overlay.setAttribute("aria-hidden", "true");
    bridgeGroups.forEach(group => {
      const color = getRecordColor(group.record) || "#ffa726";
      const teeth = [...group.teeth] .map(number => {
        const card = arch.querySelector( `.tooth[data-tooth="${number}"]` );
        if (!card) return null;
        const diagram = card.querySelector(".tooth-diagram");
        const box = diagram.getBoundingClientRect();
        const scale = box.width / 120;
        const pontic = isToothMissing(number);
        if (!pontic) markCrown(number, color);
        return {
          x: box.left - bounds.left + arch.scrollLeft + box.width / 2, y: box.top - bounds.top + arch.scrollTop + 60 * scale, edge: pontic ? 5 : 54 * scale, pontic };
      }) .filter(Boolean) .sort((a, b) => a.x - b.x);
      if (teeth.length < 2) return;
      for (let index = 0; index < teeth.length - 1; index++) {
        const left = teeth[index];
        const right = teeth[index + 1];
        const line = document.createElementNS(ns, "line");
        setAttributes(line, {
          x1: left.x + left.edge, y1: left.y, x2: right.x - right.edge, y2: right.y, stroke: color, "stroke-width": "3", "stroke-linecap": "round" });
        overlay.appendChild(line);
      }
      teeth.filter((tooth) => tooth.pontic).forEach(tooth => {
        const circle = document.createElementNS(ns, "circle");
        setAttributes(circle, { cx: tooth.x, cy: tooth.y, r: "5", fill: color });
        overlay.appendChild(circle);
      });
    });
    arch.appendChild(overlay);
  });
}
let bridgeResizeFrame;
window.addEventListener("resize", () => {
  cancelAnimationFrame(bridgeResizeFrame);
  bridgeResizeFrame = requestAnimationFrame(renderBridges);
});

const findingShortcuts = {
  d: "decay", c: "composite", a: "amalgam",
  r: "RCT", z: "Zirconia crown", b: "Bridge",
  w: "wear", m: "missingMain", t: "root tip",
  p: "PFM crown", i: "incipient caries"
};
all('input[type="radio"][aria-keyshortcuts="N"]').forEach(input => {
  const row = input.closest(".cohri-row");
  row.classList.add("n-shortcut-row");
  row.tabIndex = 0;
  row.setAttribute("aria-keyshortcuts", input.name === "cohri-provided" ? "N" : "N Y");
});
all('.intra-oral-exam .io-row, .intra-oral-exam .io-ridge-options, #ioPalatalOptions').forEach(row=>{
  if(!row.querySelector('.io-choice'))return;
  row.classList.add('n-shortcut-row');
  row.tabIndex=0;
  row.setAttribute('aria-keyshortcuts','N');
  if(row.classList.contains('io-ridge-options')){
    row.setAttribute('role','group');row.setAttribute('aria-label','Alveolar ridge');
  }
  row.querySelector('.io-choice').setAttribute('aria-keyshortcuts','N');
});
document.addEventListener("click", event => {
  if (!(event.target instanceof Element)) return;
  const row = event.target.closest(".n-shortcut-row");
  if (row && !event.target.closest("input, label, button, select, textarea, [contenteditable]")) row.focus();
});

document.addEventListener("keydown", event => {
  if ( event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing ) return;
  const key = event.key.toLowerCase();
  if (key === "n" || key === "y") {
    const typing = "input:not([type='radio']):not([type='checkbox']):not([type='button']):not([type='submit']), textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']";
    if (document.activeElement?.closest(typing) ||
        (event.target instanceof Element && event.target.closest(typing)) || byId("clearAllDialog").open) return;
    const row = document.activeElement?.closest(".n-shortcut-row") || event.target.closest?.(".n-shortcut-row");
    const values = key === "n" ? ["no-change", "none", "no", "same-as-planned"] : ["yes", "change"];
    const intraOral = key === "n" && row?.closest(".intra-oral-exam") && row.querySelector(".io-choice");
    const option = intraOral ? row.querySelector(".io-choice") : row?.querySelector(values.map(value => `input[type="radio"][value="${value}"]`).join(","));
    if (!option || option.disabled || (key === "y" && option.name === "cohri-provided")) return;
    event.preventDefault();
    if (key === "n") {
      option.checked = true;
      if (row.classList.contains("extra-oral-row")) updateExtraOralFields();
      if (intraOral) updateIntraOralFields();
      updateCOHRIFields();
      updateTreatmentProvidedFields();
      saveOdontogram(true);
      advanceFormLine(option);
    } else if (!option.checked) option.click();
    else {
      const details = row.querySelector(".cohri-details:not([hidden])");
      if (details) details.focus();
      else advanceFormLine(option);
    }
    return;
  }
  const editingSelector = "input, textarea, select, " + "[contenteditable]:not([contenteditable='false']), " + "[role='textbox']";
  const active = document.activeElement;
  if (active && active.closest(editingSelector)) return;
  if ( event.target instanceof Element && event.target.closest(editingSelector) ) return;
  const name = findingShortcuts[event.key.toLowerCase()];
  if (!name) return;
  const button = name === "missingMain" ? byId("missingMain") : Array.from(all(".finding")) .find((button) => button.dataset.name === name);
  if ( !button || button.disabled || selections.length === 0 ) return;
  event.preventDefault();
  button.click();
});

const cohriGroups = {
  history: { text: true, input: "historyDetails" },
  medication: { text: true, input: "medicationDetails" },
  premedication: { text: true, input: "premedicationDetails" },
  provided: { show: "change", input: "providedDetails" }
};

function updateCOHRIFields() {
  Object.entries(cohriGroups).forEach(([name, group]) => {
    const choice = query(`input[name="cohri-${name}"]:checked`);
    byId(group.input).hidden = !group.text && (name === "provided" || choice?.value !== group.show);
    if (name === "provided") byId("providedTreatmentTags").hidden = choice?.value !== "change";
  });
}

function updateInitialObservation() {
  const age = query('input[name="initial-age"]:checked')?.value || "";
  byId("adultBehaviour").hidden = age !== "adult";
  byId("childBehaviour").hidden = !["children", "infant"].includes(age);
  byId("mobilityAidOptions").hidden = query('input[name="initial-aid"]:checked')?.value !== "yes";
}
function readInitialObservation() {
  const choice = name => query(`input[name="${name}"]:checked`)?.value || "";
  const age = query('input[name="initial-age"]:checked')?.value || "";
  return { age, behaviour: choice(age === "adult" ? "initial-adult" : "initial-child"),
    hygiene: choice("initial-hygiene"), gait: choice("initial-gait"),
    aid: choice("initial-aid"), aidType: choice("initial-aid") === "yes" ? choice("initial-aid-type") : "" };
}
function restoreInitialObservation(data = {}) {
  all('input[name="initial-age"]').forEach(input => { input.checked = input.value === data.age; });
  const values = { "initial-adult": data.age === "adult" ? data.behaviour : "", "initial-child": data.age !== "adult" ? data.behaviour : "",
    "initial-hygiene": data.hygiene, "initial-gait": data.gait, "initial-aid": data.aid, "initial-aid-type": data.aidType };
  Object.entries(values).forEach(([name, value]) => all(`input[name="${name}"]`).forEach(input => { input.checked = input.value === value; }));
  updateInitialObservation();
}
function initialObservationText(data = {}) {
  const label = (name, value) => [...all(`input[name="${name}"]`)].find(input => input.value === value)?.parentElement.textContent.trim() || "";
  const age = { adult: "Adult", children: "Children", infant: "Infant/Toddler (Lap to lap exam)" }[data.age] || "";
  const behaviour = label(data.age === "adult" ? "initial-adult" : "initial-child", data.behaviour);
  return [age, behaviour, label("initial-hygiene", data.hygiene), label("initial-gait", data.gait),
    data.aid === "yes" ? `Uses a mobility aid${data.aidType ? ": " + data.aidType : ""}` : data.aid === "no" ? "No mobility aid" : ""].filter(Boolean).join(". ");
}
function readCOHRI() {
  const data = Object.fromEntries(Object.entries(cohriGroups).map(([name, group]) => [name, {
    choice: group.text ? "text" : query(`input[name="cohri-${name}"]:checked`)?.value || "",
    details: byId(group.input).value
  }]));
  return { ...data, reviewStatus:Object.fromEntries(['history','allergy','medication'].map(key=>[key,query('input[name="review-'+key+'"]:checked')?.value || ''])), acceptanceDecision:{screening:query('input[name="acceptance-screening"]:checked')?.value || "",limited:readLimitedTreatment(),medicalConsult:{choice:query('input[name="decision-medical-consult"]:checked')?.value || "",details:byId("decisionMedicalDetails").value},referral:{choice:query('input[name="decision-referral"]:checked')?.value || "",specialist:byId("decisionReferralSpecialist").value,reason:byId("decisionReferralReason").value}}, medicationOptions:readMedicationOptions(), dentalHistoryOptions:[...all(".dental-history-choice")].filter(input=>input.checked).map(input=>input.value), medicalConditions: readMedicalHistory(), allergy: {options:[...all(".allergy-choice")].filter(input=>input.checked).map(input=>input.value),details:byId("allergyDetails").value}, visitType: query('input[name="visit-type"]:checked')?.value || "", chiefComplaint: byId("chiefComplaint").value, extraOralExam: byId("extraOralExam").value, intraOralExam: byId("intraOralExam").value, intraOralStructured: readIntraOralExam(), extraOralStructured: readExtraOralExam(), radiographs: [...all(".radiograph-choice")].filter(input => input.checked).map(input => input.value), radiographExam: readRadiographState(), initialObservation: readInitialObservation() };
}
function restoreCOHRI(data = {}) {
  all('.history-review-choice').forEach(input => {
    input.checked = input.value === data.reviewStatus?.[input.name.slice(7)];
  });
  Object.entries(cohriGroups).forEach(([name, group]) => {
    const saved = data?.[name];
    all(`input[name="cohri-${name}"]`).forEach(input => { input.checked = input.value === saved?.choice; });
    byId(group.input).value = typeof saved?.details === "string" ? saved.details : "";
  });
  all('input[name="visit-type"]').forEach(input=>{input.checked=input.value===(data?.visitType === "Emergency/NPS" ? "Emergency/New patient" : data?.visitType);});
  byId("chiefComplaint").value = typeof data?.chiefComplaint === "string" ? data.chiefComplaint : "";
  byId("extraOralExam").value = typeof data?.extraOralExam === "string" ? data.extraOralExam : "";
  all(".radiograph-choice").forEach(input => { input.checked = Array.isArray(data?.radiographs) && data.radiographs.includes(input.value); });
  byId("intraOralExam").value=typeof data?.intraOralExam==="string" ? data.intraOralExam : "";
  all(".dental-history-choice").forEach(input=>{input.checked=Array.isArray(data?.dentalHistoryOptions) && data.dentalHistoryOptions.includes(input.value);});
  all(".allergy-choice").forEach(input=>{input.checked=Array.isArray(data?.allergy?.options) && data.allergy.options.includes(input.value);});
  byId("allergyDetails").value=typeof data?.allergy?.details==="string" ? data.allergy.details : "";
  all('input[name="acceptance-screening"]').forEach(input=>{input.checked=input.value===data?.acceptanceDecision?.screening;});
  restoreLimitedTreatment(data?.acceptanceDecision?.limited);
  for(const [name,key] of [['decision-medical-consult','medicalConsult'],['decision-referral','referral']])all(`input[name="${name}"]`).forEach(input=>{input.checked=input.value===data?.acceptanceDecision?.[key]?.choice;});
  byId('decisionMedicalDetails').value=typeof data?.acceptanceDecision?.medicalConsult?.details==='string' ? data.acceptanceDecision.medicalConsult.details : '';
  byId('decisionReferralSpecialist').value=typeof data?.acceptanceDecision?.referral?.specialist==='string' ? data.acceptanceDecision.referral.specialist : '';
  byId('decisionReferralReason').value=typeof data?.acceptanceDecision?.referral?.reason==='string' ? data.acceptanceDecision.referral.reason : '';

  restoreMedicationOptions(data?.medicationOptions);
  restoreMedicalHistory(data?.medicalConditions);
  restoreIntraOralExam(data?.intraOralStructured);
  restoreExtraOralExam(data?.extraOralStructured);
  restoreRadiographState(data?.radiographExam);
  restoreInitialObservation(data?.initialObservation);
  updateAcceptanceOptions();
  updateCOHRIFields();
}
all(".initial-choice").forEach(input => input.addEventListener("change", () => {
  if (input.name === "initial-age") all('input[name="initial-adult"], input[name="initial-child"]').forEach(option => { option.checked = false; });
  if (input.name === "initial-aid" && input.value === "no") all('input[name="initial-aid-type"]').forEach(option => { option.checked = false; });
  updateInitialObservation();
  saveOdontogram(true);
}));
updateInitialObservation();
all(".radiograph-choice").forEach(input => input.addEventListener("change", () => saveOdontogram(true)));

all(".cohri-choice").forEach(input => {
  input.addEventListener("change", () => {
    ensureProvidedTreatments();
    updateCOHRIFields();
    renderDiagnosisTags();
    saveOdontogram(true);
  });
});
updateCOHRIFields();

function updatePreparationFields() {
  const changed = query('input[name="cohri-provided"]:checked')?.value === "change";
  const records = changed ? providedTreatments || [] : findings.filter(record => record.treatment);
  const hasProximal = records.some(record => record.surfaces.some(surface => ["M", "D"].includes(surface)));
  byId("proximalPrep").hidden = !hasProximal;
}

byId("providedDetails").addEventListener("input", updatePreparationFields);
all('input[name="cohri-provided"]').forEach(input => input.addEventListener("change", updatePreparationFields));

function updateTreatmentProvidedFields() {
  byId('noteAssistant').hidden = !byId('noteAssistantEnabled').checked;
  ['Codes','Swipe'].forEach(role=>{
    byId('note'+role+'Fields').hidden=!byId('note'+role+'Different').checked;
    byId('note'+role+'Other').hidden=byId('note'+role+'Preceptor').value!=='Others';
  });
  byId("notePreceptorOther").hidden=byId("notePreceptor").value!=="Others";
  updatePreparationFields();
  byId("nerveBlockDetails").hidden = !byId("nerveBlock").checked;
  byId("infiltrationDetails").hidden = !byId("localInfiltration").checked;
  ["Right", "Left"].forEach(side => {
    byId("nerve" + side + "Blocks").hidden = !byId("nerve" + side).checked;
  });
}

function readTreatmentProvided() {
  return Object.fromEntries([...all(".provided-input")].map(input => [input.id,
    ["checkbox", "radio"].includes(input.type) ? input.checked : input.value
  ]));
}

function restoreTreatmentProvided(data = {}) {
  data = { ...data, noteAssistantEnabled: typeof data.noteAssistantEnabled === 'boolean' ? data.noteAssistantEnabled : Boolean(data.noteAssistant?.trim()) };
  all(".provided-input").forEach(input => {
    const saved = data?.[input.id];
    if (["checkbox", "radio"].includes(input.type)) {
      input.checked = typeof saved === "boolean" ? saved : input.defaultChecked;
    } else if (input.tagName === "SELECT") {
      const fallback = [...input.options].find(option => option.defaultSelected)?.value || input.options[0].value;
      input.value = typeof saved === "string" && [...input.options].some(option => option.value === saved)
        ? saved : fallback;
    } else input.value = typeof saved === "string" ? saved : input.defaultValue;
  });
  if(typeof data?.notePreceptor==='string' && data.notePreceptor && ![...byId('notePreceptor').options].some(option=>option.value===data.notePreceptor)){
    byId('notePreceptor').value='Others';byId('notePreceptorOther').value=data.notePreceptor;
  }
  updateTreatmentProvidedFields();
}

all(".provided-input").forEach(input => {
  input.addEventListener("change", () => {
    updateTreatmentProvidedFields();
    saveOdontogram(true);
  });
});
updateTreatmentProvidedFields();

const odontogramStorageKey = "odontogram-filling-autosave-v1";
let restoringOdontogram = false;
const autosaveMessage = byId("autosaveMessage");

function orderedSurfaces(surfaces) {
  const order = surfaces.includes("M") ? "MOIDBFLC" : "DOIBFLCM";
  return [...surfaces].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

function procedureCompletedText(s) {
  const c=s.cohri || {};
  const hasText=value=>typeof value==='string' && Boolean(value.trim());
  const child=['children','infant'].includes(c.initialObservation?.age);
  const hasCOHRI=Object.values(s.vitals || {}).some(hasText) || ['history','medication','premedication'].some(key=>hasText(c[key]?.details)) ||
    Boolean(c.medicalConditions?.selected?.length) || Object.values(c.medicationOptions || {}).some(item=>item?.selected) ||
    Boolean(c.allergy?.options?.length) || hasText(c.allergy?.details) || Boolean(c.dentalHistoryOptions?.length);
  const completed=[];
  if(hasCOHRI && (child || c.initialObservation?.age==='adult'))completed.push(child ? 'Completed COHRI-P' : 'Completed COHRI-A');
  completed.push(...(c.radiographs || []));
  if(hasText(c.extraOralExam) || Object.values(c.extraOralStructured || {}).some(item=>Boolean(item?.choice)))completed.push('E/O screening');
  if(hasText(c.intraOralExam) || Object.values(c.intraOralStructured?.choices || {}).some(Boolean) || Object.values(c.intraOralStructured?.occlusion || {}).some(hasText))completed.push('I/O screening');
  const limited = c.acceptanceDecision?.limited;
  if (limited && !limited.none) {
    if (limited.antibiotic) completed.push('Antibiotic prescription');
    if (limited.extraction) completed.push('Emergency extraction');
    if (limited.pulpotomy) completed.push('Pulpal debridement (D3221)');
    if (limited.incisionDrainage) completed.push('Incision and drainage of abscess (D7510)');
  }
  completed.push('OHI','nutritional counseling');
  const recipient=child ? 'parents/guardian' : 'patient';
  return completed.join(', ')+'.\nFindings reviewed with the '+recipient+' about risk and benefits of recommended treatment options discussed.';
}

function generateClinicalNote(s) {
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[char]));
  const field = value => escape(value);
  const bold = value => `<strong>${escape(value)}</strong>`;
  const p = s.provided, c = s.cohri;
  const reviewedStatus = name => c.visitType === 'Emergency/Established patient' && c.reviewStatus?.[name] !== 'change'
    ? (c.reviewStatus?.[name] === 'no-change' ? 'No change' : '') : null;
  const status = name => {
    if (['history','medication'].includes(name) && reviewedStatus(name) !== null) return reviewedStatus(name);
    const item = c[name];
    if (cohriGroups[name]?.text) return name === "history" ? [medicalHistoryText(c.medicalConditions),item?.details?.trim() || ""].filter(Boolean).join(". ") : name === "medication" ? [medicationOptionsText(c.medicationOptions),item?.details?.trim() || ""].filter(Boolean).join(". ") : name === "premedication" ? (c.dentalHistoryOptions || []).join(". ") : item?.details?.trim() || "";
    if (!item?.choice) return "";
    if (item.choice === "no-change") return "No change";
    if (item.choice === "none") return "None";
    return item.details.trim() || (item.choice === "yes" ? "Yes" : "Change");
  };
  const hasText = value => String(value ?? "").trim().length > 0;
  const section = (label, value, newLine = false) => hasText(value)
    ? [`${bold(label)}${newLine ? "<br>" : " "}${field(value).replace(/\r?\n/g, "<br>")}`] : [];
  const appointment = [
    hasText(c.visitType) ? field(c.visitType) : "",
    hasText(c.chiefComplaint) ? `with the chief complaint of "${field(c.chiefComplaint)}"` : ""
  ].filter(Boolean).join(" ");
  const vitals = [
    hasText(s.vitals.bp) ? `BP: ${s.vitals.bp} mmHg` : "",
    hasText(s.vitals.pulse) ? `Pulse: ${s.vitals.pulse} bpm` : "",
    hasText(s.vitals.temperature) ? `Temperature: ${s.vitals.temperature} F` : ""
  ].filter(Boolean).join(". ");
  const lines = [
    ...(appointment ? [`${bold("Appointment for")}: ${appointment}`, ""] : []),
    ...section("Initial observation:", initialObservationText(c.initialObservation)),
    ...section("Vitals:", vitals),
    ...section("Medical history:", status("history")),
    ...section("Allergy:", reviewedStatus("allergy") ?? [...(c.allergy?.options || []), c.allergy?.details?.trim() || ""].filter(Boolean).join(". ")),
    ...section("Other medication and social history:", status("medication")),
    ...section("Dental history:", status("premedication")),
    ...section(dentalHistoryHeading(c.visitType) + ":", c.premedication?.details),
    ...section("Radiograph taken:", (c.radiographs || []).join(", ")),
    ...section("Radiology Report:", radiologyReportForNote(c.radiographExam)),
    ...section("Extra-oral screening:", extraOralExamText(c), true),
    ...section("Intra-oral screening:", intraOralExamText(c)),
    ...section("Limited oral exam:", c.intraOralExam),
    ...(acceptanceDecisionText(c.acceptanceDecision,c.visitType) ? ["",`${bold(c.visitType?.startsWith("Emergency/") ? "Limited treatment:" : "Acceptance/Decision:")}<br>${acceptanceDecisionNoteHTML(c.acceptanceDecision,c.visitType,escape)}`] : []),
    ...(appointment || vitals ? [""] : []),
    `${bold("Procedure completed:")} ${field(procedureCompletedText(s)).replace(/\r?\n/g, "<br>")}`
  ];
  const rolePreceptor=role=>p['note'+role+'Preceptor']==='Others' ? p['note'+role+'Other'] || '' : p['note'+role+'Preceptor'] || '';
  const additionalPreceptors=[p.noteCodesDifferent && rolePreceptor('Codes') ? rolePreceptor('Codes')+' - for completed codes' : '',p.noteSwipeDifferent && rolePreceptor('Swipe') ? rolePreceptor('Swipe')+' - for swiping note' : ''].filter(Boolean);
  lines.push("", `${bold("NV:")} ${escape(noteBlank(p.noteNV))}`, `${bold("Student Dr:")} ${escape(p.noteStudent || "")}`, ...(p.noteAssistantEnabled ? [`${bold("Assistant:")} ${escape(noteBlank(p.noteAssistant))}`] : []), `${bold("Preceptor:")} ${escape(p.notePreceptor === "Others" ? noteBlank(p.notePreceptorOther) : p.notePreceptor)}`,
    ...(additionalPreceptors.length ? [bold('('+additionalPreceptors.join(', ')+')')] : []),
    `${bold("Clinic:")} POD2 - 242`);

  return finishNoteLines(lines.join("<br>"));
}

function cleanNoteHTML(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowed = new Set(["STRONG", "B", "EM", "I", "U", "BR", "DIV", "P", "UL", "OL", "LI"]);
  function clean(node) {
    if (node.nodeType === 3) return document.createTextNode(node.textContent);
    const fragment = document.createDocumentFragment();
    if (node.nodeType !== 1 || ["SCRIPT", "STYLE", "IFRAME", "OBJECT"].includes(node.tagName)) return fragment;
    const result = allowed.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : fragment;
    if (["STRONG", "B"].includes(node.tagName)) {
      const color=node.style.color.replace(/\s/g, "").toLowerCase();
      if (["#2563eb", "rgb(37,99,235)"].includes(color)) result.style.color="#2563eb";
      if (["#dc2626", "rgb(220,38,38)"].includes(color)) result.style.color="#dc2626";
    }
    node.childNodes.forEach(child => result.appendChild(clean(child)));
    return result;
  }
  const output = document.createElement("div");
  template.content.childNodes.forEach(node => output.appendChild(clean(node)));
  return output.innerHTML;
}

function updateNote() {
  if (noteOverride !== null) {
    if (byId("generatedNote").innerHTML !== noteOverride) byId("generatedNote").innerHTML = noteOverride;
    return;
  }
  const label = id => {
    const select = byId(id);
    return select.options[select.selectedIndex]?.textContent || "";
  };
  byId("generatedNote").innerHTML = generateClinicalNote({
    findings, providedRecords: providedTreatments, cohri: readCOHRI(), provided: readTreatmentProvided(),
    vitals: Object.fromEntries([...all(".vitals-input")].map(input => [input.dataset.vital, input.value])),
    nerveLA: label("nerveLA"), infiltrationLA: label("infiltrationLA")
  });
}

function saveOdontogram(regenerate = false) {
  if (regenerate === true) noteOverride = null;
  updateNote();
  if (restoringOdontogram) return;
  const data = {
    version: 1,
    noteHtml: noteOverride,
    providedTreatmentRecords: providedTreatments,
    cohri: readCOHRI(),
    treatmentProvided: readTreatmentProvided(),
    vitals: Object.fromEntries([...all(".vitals-input")].map(input => [input.dataset.vital, input.value])),
    findings,
    nextBatchId,
    chartEdits,
    teeth: Array.from( all(".tooth") ).map(tooth => {
      return {
        number: Number(tooth.dataset.tooth), age: tooth.querySelector(".tooth-number").dataset.age, hidden: tooth.hidden };
    }),
    mode:
    query(".dentition-button.active")
    ?.dataset.dentition || null
  };
  try {
    localStorage.setItem( odontogramStorageKey, JSON.stringify(data) );
    autosaveMessage.textContent = "Saved on this device.";
  } catch (error) {
    autosaveMessage.textContent = "Autosave unavailable. This browser could not save the odontogram.";
  }
}

function restoreOdontogram() {
  restoringOdontogram = true;
  try {
    const raw = localStorage.getItem(odontogramStorageKey);
    if (!raw) {
      autosaveMessage.textContent = "Autosave ready on this device.";
      return;
    }
    const data = JSON.parse(raw);
    if ( data.version !== 1 || !Array.isArray(data.findings) || !Array.isArray(data.teeth) ) throw new Error("Invalid saved chart");
    const validFindings = data.findings.every((record) => record && Number.isInteger(record.tooth) && record.tooth >= 1 && record.tooth <= 32 && typeof record.finding === "string" && Array.isArray(record.surfaces) && typeof record.whole === "boolean" && Number.isInteger(record.batchId));
    if (!validFindings) throw new Error("Invalid saved findings");
    all(".vitals-input").forEach(input => {
      input.value = typeof data.vitals?.[input.dataset.vital] === "string"
        ? data.vitals[input.dataset.vital] : "";
    });
    providedTreatments = Array.isArray(data.providedTreatmentRecords) ? data.providedTreatmentRecords.filter(record =>
      record && Number.isInteger(record.tooth) && record.tooth >= 1 && record.tooth <= 32 &&
      typeof record.finding === "string" && Array.isArray(record.surfaces) && record.surfaces.every(surface => typeof surface === "string") && typeof record.whole === "boolean"
    ).map(record => ({ ...record, treatment: true, surfaces: [...record.surfaces] })) : null;
    restoreCOHRI(data.cohri);
    restoreTreatmentProvided(data.treatmentProvided);
    findings = data.findings;
    chartEdits = Object.fromEntries( Object.entries(data.chartEdits || {}) .filter((entry) => typeof entry[1] === "string") );
    nextBatchId = Math.max( Number(data.nextBatchId) || 1, 1 + findings.reduce((max, record) => Math.max(max, record.batchId), 0) );
    data.teeth.forEach(saved => {
      if ( !Number.isInteger(saved.number) || saved.number < 1 || saved.number > 32 ) return;
      setToothAge( saved.number, saved.age === "primary" ? "primary" : "permanent" );
      query( `.tooth[data-tooth="${saved.number}"]` ).hidden = Boolean(saved.hidden);
    });
    setDentitionButtons(data.mode);
    selections = [];
    clearTemporarySelection();
    refreshChart();
    noteOverride = typeof data.noteHtml === "string" ? cleanNoteHTML(data.noteHtml) : null;
    updateNote();
    autosaveMessage.textContent = "Saved odontogram restored.";
  } catch (error) {
    autosaveMessage.textContent = "The saved odontogram could not be restored. " + "Your stored copy has not been changed.";
  } finally {
    restoringOdontogram = false;
  }
}
["input", "focusout"].forEach(type => document.addEventListener(type, event => {
  if (event.target.closest(".vitals-input, .cohri-details, .cohri-choice, .provided-input, .intake-input")) saveOdontogram(true);
}));
window.addEventListener("pagehide", saveOdontogram);

restoreOdontogram();
updateNote();
renderDiagnosisTags();
byId("generatedNote").addEventListener("input", () => {
  noteOverride = cleanNoteHTML(byId("generatedNote").innerHTML);
  saveOdontogram();
});
byId("copyNote").addEventListener("click", async () => {
  const note = byId("generatedNote");
  note.classList.remove('note-copy-blink');
  void note.offsetWidth; // Restart the highlight on repeated clicks.
  note.classList.add('note-copy-blink');
  try {
    const plain = note.innerText;
    const html = `<div style="font-family:'Times New Roman',Times,serif;font-size:14px;line-height:1.65;color:#000">${note.innerHTML.replaceAll("<strong>", '<strong style="font-weight:700">')}</div>`;
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
      await navigator.clipboard.write([new ClipboardItem({
        "text/plain": new Blob([plain], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" })
      })]);
    } else {
      const range = document.createRange();
      range.selectNodeContents(note);
      const selection = window.getSelection();
      selection.removeAllRanges(); selection.addRange(range);
      if (!document.execCommand("copy")) throw new Error("Copy unavailable");
    }
    byId("noteCopyStatus").textContent = "Note copied.";
  } catch {
    const range = document.createRange();
    range.selectNodeContents(note);
    const selection = window.getSelection();
    selection.removeAllRanges(); selection.addRange(range);
    byId("noteCopyStatus").textContent = "Note selected. Copy to clipboard.";
  }
});
const clearAllDialog = byId("clearAllDialog");
byId("clearAll").addEventListener( "click", () => { clearAllDialog.showModal(); });
byId("cancelClearAll").addEventListener( "click", () => { clearAllDialog.close(); });
byId("confirmClearAll").addEventListener( "click", () => {
  providedTreatments = null;
  restoreCOHRI();
  restoreTreatmentProvided();
  all(".vitals-input").forEach(input => { input.value = ""; });
  findings = [];
  chartEdits = {};
  selections = [];
  nextBatchId = 1;
  clearTemporarySelection();
  for (let number = 1; number <= 32; number++) {
    setToothAge(number, "permanent");
  }
  setDentitionButtons("permanent");
  refreshChart();
  clearAllDialog.close();
});
all(".finding-section, .treatment-section")
.forEach(section => {
  if (section.querySelector(".category-pair")) return;
  const rows = [...section.children] .filter(row => row.classList.contains("finding-row"));
  for (let i = 0; i < rows.length; i += 2) {
    const pair = document.createElement("div");
    pair.className = "category-pair";
    rows[i].before(pair);
    pair.append(rows[i]);
    if (rows[i + 1]) pair.append(rows[i + 1]);
  }
});

function alignMidline() {
  const canvas = query(".dentition-canvas");
  const tooth8 = query('#maxillary .tooth-diagram[data-tooth="8"]');
  const tooth9 = query('#maxillary .tooth-diagram[data-tooth="9"]');
  if (!canvas || !tooth8 || !tooth9) return;
  const midpoint = ( tooth8.getBoundingClientRect().right + tooth9.getBoundingClientRect().left ) / 2;
  canvas.style.setProperty( "--tooth-midline", `${midpoint - canvas.getBoundingClientRect().left}px` );
}
requestAnimationFrame(alignMidline);
window.addEventListener("resize", alignMidline);

function advanceFormLine(current) {
  const scope = current.closest(".intake-panel, .cohri-panel, .treatment-provided");
  if (!scope || scope.classList.contains("note-panel")) return;
  const controls = [...document.querySelectorAll(".intake-panel input, .intake-panel select, .cohri-panel input, .cohri-panel textarea, .cohri-panel select, .treatment-provided:not(.note-panel) input, .treatment-provided:not(.note-panel) textarea, .treatment-provided:not(.note-panel) select")];
  const row = current.closest(".n-shortcut-row") || current.closest(".cohri-row");
  const start = controls.indexOf(current);
  const next = controls.slice(start + 1).find(input => {
    if (input.disabled || input.hidden || input.closest("[hidden]") || !input.getClientRects().length) return false;
    if (current.type === "radio" && (input.closest(".n-shortcut-row") || input.closest(".cohri-row")) === row) return false;
    return true;
  });
  if (!next) return;
  const nextRow = next.closest(".n-shortcut-row");
  if (next.type === "radio" && nextRow) nextRow.focus();
  else next.focus();
}

document.addEventListener("change", event => {
  const input = event.target;
  if (!(input instanceof Element) || !input.matches(".cohri-choice, .provided-input")) return;
  if (input.type === "radio") {
    const details = input.closest(".cohri-row")?.querySelector(".cohri-details:not([hidden])");
    if (details) details.focus();
    else if (input.name === "cohri-provided" && input.value === "change") return;
    else advanceFormLine(input);
  } else if (input.tagName === "SELECT") advanceFormLine(input);
});

document.addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) return;
  const input = event.target;
  if (!(input instanceof Element) || !input.matches(".vitals-input, .cohri-details, .provided-input, .intake-input")) return;
  if (input.tagName === "TEXTAREA") return;
  event.preventDefault();
  saveOdontogram(true);
  advanceFormLine(input);
});
// Move upward between form rows when the caret is on the first text line.
document.addEventListener("keydown", event => {
  if (event.key !== "ArrowUp" || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing) return;
  const current = event.target;
  if (!(current instanceof Element) || !current.matches('input[type="text"], input[type="number"], textarea')) return;
  if (current.closest(".note-panel")) return;
  const caret = current.selectionStart;
  if (current.tagName === "TEXTAREA" && (caret !== current.selectionEnd || current.value.slice(0, caret).includes("\n"))) return;
  const controls = [...document.querySelectorAll(".intake-panel input, .intake-panel select, .cohri-panel input, .cohri-panel textarea, .exam-area textarea, .treatment-provided:not(.note-panel) input, .treatment-provided:not(.note-panel) select")]
    .filter(input => !input.disabled && !input.hidden && !input.closest("[hidden]") && input.getClientRects().length);
  const index = controls.indexOf(current);
  if (index <= 0) return;
  const previous = controls[index - 1];
  event.preventDefault();
  previous.focus();
  if (typeof previous.setSelectionRange === "function" && ["text", "textarea"].includes(previous.type)) {
    previous.setSelectionRange(previous.value.length, previous.value.length);
  }
});

all('.eo-choice').forEach(input=>input.addEventListener('change',()=>{
  updateExtraOralFields();
  if(input.value==='yes')byId('eo-details-'+input.name.slice(3)).focus();
  saveOdontogram(true);
}));
updateExtraOralFields();

all('.visit-type-choice').forEach(input=>input.addEventListener('change',()=>{updateAcceptanceOptions();saveOdontogram(true);}));

all('.io-choice').forEach(input=>input.addEventListener('change',()=>{
  if(input.name==='io-palatal' && input.value==='no')all('input[name="io-palatal-shape"]').forEach(option=>{option.checked=false;});
  if(input.name==='io-mandibular' && input.value==='no')all('input[name="io-mandibular-side"], input[name="io-mandibular-size"]').forEach(option=>{option.checked=false;});
  updateIntraOralFields();
  if(input.name==='io-ridge' && input.value!=='normal')byId('io-ridge-'+input.value).focus();
  if(['io-significant','io-lesions'].includes(input.name) && input.value==='yes')byId('io-details-'+input.name.slice(3)).focus();
  if(input.name==='io-cancer' && input.value==='positive')byId('io-details-cancer').focus();
  saveOdontogram(true);
}));
updateIntraOralFields();

all('.io-class-choice, #ioOcclusalClass, #ioRemainingClass').forEach(input=>input.addEventListener('change',()=>{
  updateOcclusalClassFields();
  saveOdontogram(true);
}));
updateOcclusalClassFields();

all('.mh-choice, .mh-diabetes-type').forEach(input=>input.addEventListener('change',()=>{
  updateMedicalHistoryFields();
  if(input.classList.contains('mh-choice') && input.checked)byId('mh-'+input.value+'-details').focus();
  if(input.classList.contains('mh-choice') && input.value==='diabetes' && !input.checked)all('.mh-diabetes-type').forEach(option=>{option.checked=false;});
  saveOdontogram(true);
}));
updateMedicalHistoryFields();

all('.medication-choice').forEach(input=>input.addEventListener('change',()=>{
  updateMedicationOptions();
  if(input.checked)byId('medication-'+input.value+'-details').focus();
  saveOdontogram(true);
}));
updateMedicationOptions();

all('.allergy-choice, .dental-history-choice, .decision-choice').forEach(input =>
  input.addEventListener('change', () => { syncConditionalNV(); saveOdontogram(true); })
);

updateAcceptanceOptions();

all('.decision-form-choice, .decision-form-select').forEach(input=>input.addEventListener('change',()=>{
  updateAcceptanceFormFields();
  if(input.name==='decision-medical-consult' && input.value==='yes')byId('decisionMedicalDetails').focus();
  if(input.name==='decision-referral' && input.value==='yes')byId('decisionReferralSpecialist').focus();
  saveOdontogram(true);
}));
updateAcceptanceFormFields();

[['notePreceptor', 'notePreceptorOther'], ['noteCodesPreceptor', 'noteCodesOther'], ['noteSwipePreceptor', 'noteSwipeOther']].forEach(([selectId, otherId]) => {
  byId(selectId).addEventListener('change', () => {
    if (byId(selectId).value === 'Others') byId(otherId).focus();
  });
});

byId('generatedNote').addEventListener('animationend',event=>{
  if(event.animationName==='note-copy-blink')byId('generatedNote').classList.remove('note-copy-blink');
});

all('.visit-type-button').forEach(button => button.addEventListener('click', () => {
  const input = byId(button.dataset.visitInput);
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}));
updateVisitAppearance();

all('.history-review-choice').forEach(input => input.addEventListener('change', () => {
  updateHistoryReview();
  saveOdontogram(true);
}));
updateHistoryReview();

function syncConditionalNV() {
  if(query('input[name="visit-type"]:checked')?.value === 'New patient screening' && query('input[name="acceptance-screening"]:checked')?.value === 'conditional') byId('noteNV').value = 'COE';
}
function readLimitedTreatment() {
  return {provided:readEmergencyProvided(),none:byId('limitedNone').checked,antibiotic:byId('limitedAntibiotic').checked,antibioticType:byId('limitedAntibioticType').value,other:byId('limitedAntibioticOther').value,extraction:byId('limitedExtraction').checked,incisionDrainage:byId('limitedIncisionDrainage').checked,pulpotomy:byId('limitedPulpotomy').checked,pulpotomyDetails:byId('limitedPulpotomyDetails').value,mode:byId('limitedExtractionChart').dataset.mode === 'primary' ? 'primary' : 'permanent',teeth:JSON.parse(byId('limitedExtractionChart').dataset.teeth || '[]')};
}
function restoreLimitedTreatment(data={}) {
  data = data || {};
  restoreEmergencyProvided(data.provided);
  for(const [key,id] of [['none','limitedNone'],['antibiotic','limitedAntibiotic'],['extraction','limitedExtraction'],['pulpotomy','limitedPulpotomy'],['incisionDrainage','limitedIncisionDrainage']])byId(id).checked=Boolean(data[key]);
  byId('limitedAntibioticType').value=data.antibioticType==='Other'?'Other':'Amoxicillin 500 mg TID in 7 days';
  byId('limitedAntibioticOther').value=data.other || '';
  byId('limitedPulpotomyDetails').value=data.pulpotomyDetails || '';
  byId('limitedExtractionChart').dataset.mode=['permanent','primary'].includes(data.mode)?data.mode:'permanent';
  byId('limitedExtractionChart').dataset.teeth=JSON.stringify(Array.isArray(data.teeth)?data.teeth:[]);
  updateLimitedTreatment();
}
function limitedTreatmentLines(data={}) {
  if(!data)return [];
  if(data.none)return ['No treatment was provided today.'];
  const lines=[];
  if(data.antibiotic)lines.push('Antibiotic prescription: '+(data.antibioticType==='Other' ? data.other?.trim() || 'Other' : data.antibioticType || 'Amoxicillin 500 mg TID in 7 days'));
  if(data.extraction)lines.push('Emergency extraction'+(data.teeth?.length ? ': '+data.teeth.map(t=>'#'+t).join(', ') : ''));
  if(data.extraction)lines.push(...emergencyProvidedLines(data.provided));
  if(data.pulpotomy)lines.push('Pulpal debridement (D3221)'+(data.pulpotomyDetails?.trim() ? ': '+data.pulpotomyDetails.trim() : ''));
  if(data.incisionDrainage)lines.push('Incision and drainage of abscess (D7510)');
  return lines.length ? ['Emergency/Limited Treatment:',...lines] : [];
}
function updateLimitedTreatment() {
  byId('limitedAntibioticFields').hidden=!byId('limitedAntibiotic').checked;
  byId('limitedAntibioticOther').hidden=byId('limitedAntibioticType').value!=='Other';
  byId('limitedExtractionChart').hidden=!byId('limitedExtraction').checked;
  byId('emergencyProvidedPanel').hidden=!byId('limitedExtraction').checked;
  byId('limitedPulpotomyDetails').hidden=!byId('limitedPulpotomy').checked;
  updateEmergencyProvided();
  drawLimitedChart();
}
function drawLimitedChart() {
  const data=readLimitedTreatment();
  const primary={4:'A',5:'B',6:'C',7:'D',8:'E',9:'F',10:'G',11:'H',12:'I',13:'J',20:'K',21:'L',22:'M',23:'N',24:'O',25:'P',26:'Q',27:'R',28:'S',29:'T'};
  for(const [id,numbers] of [['limitedUpper',Array.from({length:16},(_,i)=>i+1)],['limitedLower',Array.from({length:16},(_,i)=>32-i)]]) {
    byId(id).replaceChildren();
    numbers.forEach(n=>{
      const permanent=data.mode==='permanent';
      const label=permanent?String(n):primary[n];if(!label)return;
      const button=document.createElement('button');button.type='button';button.className='limited-tooth';
      button.setAttribute('aria-label','Extract tooth '+label);button.setAttribute('aria-pressed',String(data.teeth.includes(label)));
      button.innerHTML='<span>#'+label+'</span>';
      button.addEventListener('click',()=>{byId('limitedExtractionChart').dataset.teeth=JSON.stringify(data.teeth.includes(label)?data.teeth.filter(t=>t!==label):[...data.teeth,label]);drawLimitedChart();saveOdontogram(true);});
      byId(id).append(button);
    });
  }
  all('[data-limited-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.limitedMode===data.mode)));
  byId('limitedSelected').textContent=data.teeth.length?'Selected: '+data.teeth.map(t=>'#'+t).join(', '):'Select teeth for emergency extraction';
}
all('.limited-choice').forEach(input=>input.addEventListener('change',()=>{
  if(input.id==='limitedNone'&&input.checked)all('.limited-choice').forEach(other=>{if(other!==input)other.checked=false;});
  else if(input.checked)byId('limitedNone').checked=false;
  updateLimitedTreatment();saveOdontogram(true);
}));
byId('limitedAntibioticType').addEventListener('change',()=>{updateLimitedTreatment();saveOdontogram(true);});
all('[data-limited-mode]').forEach(button=>button.addEventListener('click',()=>{
  byId('limitedExtractionChart').dataset.mode=button.dataset.limitedMode;
  byId('limitedExtractionChart').dataset.teeth='[]';drawLimitedChart();saveOdontogram(true);
}));
updateLimitedTreatment();

// Read and restore extraction fields without mixing them with the legacy form.
function emergencyProvidedFields() {
  return [...all('#emergencyProvidedPanel .emergency-provided-input')];
}
function isChoiceField(input) {
  return ['radio', 'checkbox'].includes(input.type);
}
function readEmergencyProvided() {
  return Object.fromEntries(emergencyProvidedFields().map(input => [
    input.id.replace('emergency-', ''),
    isChoiceField(input) ? input.checked : input.value
  ]));
}
function restoreEmergencyProvided(data = {}) {
  emergencyProvidedFields().forEach(input => {
    const saved = data?.[input.id.replace('emergency-', '')];
    if (isChoiceField(input)) {
      input.checked = typeof saved === 'boolean' ? saved : input.defaultChecked;
    } else {
      const fallback = input.tagName === 'SELECT'
        ? [...input.options].find(option => option.defaultSelected)?.value || input.options[0]?.value || ''
        : input.defaultValue;
      input.value = typeof saved === 'string' ? saved : fallback;
    }
  });
  updateEmergencyProvided();
}
function updateEmergencyProvided() {
 document.getElementById('painReliefPrint').hidden = !document.getElementById('emergency-painReliefProvided').checked;
  for(const [target,source] of [['nerveBlockDetails','nerveBlock'],['infiltrationDetails','localInfiltration'],['nerveRightBlocks','nerveRight'],['nerveLeftBlocks','nerveLeft'],['bladeDetails','flap'],['burDetails','surgicalBurYes'],['sutureTypeDetails','sutureUsedYes'],['forcepsOtherDetails','forcepsChoice3']])byId('emergency-'+target).hidden=!byId('emergency-'+source).checked;
}
function emergencyProvidedLines(p={}) {
  if(!p)return [];
  const lines=[];
  if(p.consent)lines.push('Verbal and informed consent provided.');
  if(p.inhaledNOYes)lines.push('Inhaled NO: Yes.');
  const anesthesia=[];
  const anesthetics={lidocaine:'2% Lidocaine with 1:100K epi',articaine:'4% of Articaine with 1:100K epi',mepivacaine:'3% of Mepivacaine (plain)',bupivacaine:'0.5% of Bupivacaine with 1:200K epi'};
  const quantity=key=>{
    const value=String(p[key] || '').trim();
    return value ? value+' '+(Number(value)===1?'carpule':'carpules') : '[Quantity needed] carpules';
  };
  if(p.topicalBenzocaine)anesthesia.push('Topical benzocaine around the tooth and '+(p.nerveBlock?'block injection':'injection')+' locations.');
  if(p.nerveBlock){
    const locations=[];
    for(const [side,short] of [['Right','R'],['Left','L']])if(p['nerve'+side]){
      ['PSA block','MSA block','ASA block','Palatal block','IAN block','Buccal block','Mental block'].forEach((block,index)=>{
        if(p['nerve'+side+index])locations.push('('+short+') '+block);
      });
    }
    anesthesia.push(quantity('nerveCarpules')+' of '+(anesthetics[p.nerveLA] || anesthetics.lidocaine)+' was administered via '+(locations.join(', ') || '[Block location needed]')+'.');
  }
  if(p.localInfiltration)anesthesia.push((p.nerveBlock?'Then local infiltration':'Local infiltration')+' with '+quantity('infiltrationCarpules')+' of '+(anesthetics[p.infiltrationLA] || anesthetics.articaine)+' was administered around the tooth.');
  if(anesthesia.length)lines.push('Local anesthesia: '+anesthesia.join(' '));
  const extraction=[];
  if(p.flap)extraction.push((p.blade || '15')+' blade was used to create a flap.');
  if(p.flapReflected)extraction.push('The flap was reflected with Molt 2 and 9.');
  extraction.push('Small and large elevators were used to luxate the tooth.');
  const forceps=['#150','#151','#23 Cowhorn'].filter((_,i)=>p['forcepsChoice'+i]);
  if(p.forcepsChoice3)forceps.push(...['#150S','#151S','#3 MEAD','#1107','#18R','#18L'].filter((_,i)=>p['forcepsExtra'+i]));
  if(forceps.length)extraction.push(forceps.join(', ')+' forceps were used to extract teeth.');
  if(p.surgicalBurYes)extraction.push('The tooth was sectioned with '+(p.bur || '701')+' surgical bur and removed in parts.');
  if(p.cryerYes)extraction.push('Cryer elevators were utilized to remove root tips and fractured tooth.');
  extraction.push('The tooth and socket were checked to ensure no remaining root tips.','Socket compressed using gauze with finger pressure.');
  if(p.sutureUsedNo)extraction.push('No suture was used to close sockets.');
  else if(p.sutureUsedYes)extraction.push((p.sutureType || '3-0 Chromic gut')+' sutures were used to close sockets.');
  if(p.additional?.trim())extraction.push(p.additional.trim());
  lines.push('Extraction: '+extraction.join(' '));
  const care=[];
  if(p.postop && p.painReliefProvided)care.push('The patient was provided with post-op instructions and pain relief regime (Ibuprofen and Tylenol every 4-6 hours if needed).');
  else if(p.postop)care.push('The patient was provided with post-op instructions.');
  else if(p.painReliefProvided)care.push('The patient was provided with pain relief regime (Ibuprofen and Tylenol every 4-6 hours if needed).');
  if(care.length && p.sutureUsedYes && ['3-0 Chromic gut','4-0 Chromic gut'].includes(p.sutureType))care.push('The patient was also informed that suture will dissolve on its own within 2 weeks.');
  if(care.length)lines.push('Post-operative care: '+care.join(' '));
  return lines;
}
emergencyProvidedFields().forEach(input=>{
  input.addEventListener('change',()=>{updateEmergencyProvided();saveOdontogram(true);});
  if(!isChoiceField(input))input.addEventListener('input',()=>saveOdontogram(true));
});
updateEmergencyProvided();


// Responsive fitting for category rows and Note controls.
;// Preserve one line per category without adding horizontal scrolling.
(() => {
  const sections = [...document.querySelectorAll('.finding-section, .treatment-section, .rx-tooth-lines, .note-panel, .chart-side-panel')];
  let frame;
  const fit = () => {
    frame = null;
    sections.forEach(section => {
      if (!section.clientWidth) return;
      const sectionStyle = getComputedStyle(section);
      const sectionWidth = section.clientWidth - parseFloat(sectionStyle.paddingLeft) - parseFloat(sectionStyle.paddingRight);
      section.querySelectorAll('.finding-row, .rx-tooth-options:not(.rx-wear-options), .note-fields-row').forEach(row => {
        row.classList.add(row.classList.contains('note-fields-row') ? 'fit-note-fields' : 'fit-category-line');
        row.style.zoom = '1';
        // A category may be inside a smaller multi-column finding group.
        let available = sectionWidth;
        for (let parent = row.parentElement; parent && parent !== section; parent = parent.parentElement) {
          if (getComputedStyle(parent).display === 'contents') continue;
          const style = getComputedStyle(parent);
          const width = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
          if (width > 0) available = Math.min(available, width);
        }
        const natural = Math.max(row.offsetWidth, row.scrollWidth);
        row.style.zoom = String(Math.min(1, Math.max(0, available - 2) / (natural || 1)));
      });
    });
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(fit); };
  const widths = new WeakMap();
  const observer = new ResizeObserver(entries => {
    entries.forEach(entry => {
      if (widths.get(entry.target) !== entry.contentRect.width) {
        widths.set(entry.target, entry.contentRect.width); schedule();
      }
    });
  });
  sections.forEach(section => observer.observe(section));
  window.addEventListener('resize', schedule);
  if (document.fonts) document.fonts.ready.then(schedule);
  schedule();
})();
