const $=id=>document.getElementById(id);

const LEO_ACCESS_KEY='sa_dot_leo_authorised_v1';
let leoSessionUnlocked=false;
function safeLeoAccessRead(){try{return localStorage.getItem(LEO_ACCESS_KEY)==='yes'}catch(_){return leoSessionUnlocked}}
function safeLeoAccessWrite(){leoSessionUnlocked=true;try{localStorage.setItem(LEO_ACCESS_KEY,'yes')}catch(_){}}
function showLeoAccessScreen(){
  const gate=$('leoAccessScreen');
  const boot=$('leoAccessBoot');
  if(boot)boot.classList.add('hidden');
  if(gate)gate.classList.remove('hidden','unlocking');
  setTimeout(()=>$('leoAccessCode')?.focus(),60);
}
function hideLeoAccessScreen(){
  const gate=$('leoAccessScreen');
  if(gate)gate.classList.add('hidden');
}
let leoBootFinishTimer=null;
let leoBootKeyHandler=null;
function playLeoAccessBoot(){
  const boot=$('leoAccessBoot');
  if(!boot){hideLeoAccessScreen();return}
  hideLeoAccessScreen();

  if(leoBootFinishTimer){clearTimeout(leoBootFinishTimer);leoBootFinishTimer=null}
  if(leoBootKeyHandler){document.removeEventListener('keydown',leoBootKeyHandler);leoBootKeyHandler=null}

  boot.classList.remove('hidden','complete','closing');
  void boot.offsetWidth;
  boot.classList.add('complete');

  const finish=()=>{
    if(boot.classList.contains('closing'))return;
    boot.classList.add('closing');
    if(leoBootFinishTimer){clearTimeout(leoBootFinishTimer);leoBootFinishTimer=null}
    if(leoBootKeyHandler){document.removeEventListener('keydown',leoBootKeyHandler);leoBootKeyHandler=null}
    setTimeout(()=>{
      boot.classList.add('hidden');
      boot.classList.remove('complete','closing');
    },320);
  };

  boot.onclick=finish;
  leoBootKeyHandler=e=>{
    if(e.key==='Enter'||e.key==='Escape'){
      finish();
    }
  };
  document.addEventListener('keydown',leoBootKeyHandler);
  leoBootFinishTimer=setTimeout(finish,2600);
}
function unlockLeoPortal(){
  const code=String($('leoAccessCode')?.value||'').trim().toLowerCase();
  const err=$('leoAccessError');
  if(code!=='dotpd'){
    if(err)err.textContent='ACCESS DENIED · Invalid LEO access code.';
    $('leoAccessCode')?.classList.add('denied');
    setTimeout(()=>$('leoAccessCode')?.classList.remove('denied'),450);
    return;
  }
  if(err)err.textContent='';
  safeLeoAccessWrite();
  initLeoMenu();
  playLeoAccessBoot();
}
function initialiseLeoAccess(){
  const input=$('leoAccessCode');
  if(input && input.dataset.bound!=='1'){
    input.dataset.bound='1';
    input.addEventListener('keydown',e=>{if(e.key==='Enter')unlockLeoPortal()});
  }
  if(safeLeoAccessRead()){
    initLeoMenu();
    playLeoAccessBoot();
  }else{
    showLeoAccessScreen();
  }
}
$('policePlate')?.addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g,'')});
async function submitTow(){
 const plate=$('policePlate').value.trim().toUpperCase(),vehicle=$('towVehicle').value.trim(),colour=$('towColour').value.trim(),locationText=$('towLocation').value.trim(),officer=$('towOfficer').value.trim();
 $('towError').textContent='';
 if(!plate||!vehicle||!locationText||!officer){$('towError').textContent='Registration, vehicle, location and officer/callsign are required.';return}
 const row={registration:plate,vehicle,colour:colour||'Not recorded',reason:$('towReason').value,priority:$('towPriority').value,location:locationText,agency:$('towAgency').value,requesting_officer:officer,destination:$('towDestination').value,notes:$('towNotes').value.trim(),status:'PENDING'};
 const reference=location.protocol==='file:'?'TR-DEMO':'TR-'+String(Date.now()).slice(-6);
 if(location.protocol!=='file:'){
   const {data,error}=await sb.rpc('submit_tow_request',{p_reference:reference,p_registration:row.registration,p_vehicle:row.vehicle,p_colour:row.colour,p_reason:row.reason,p_priority:row.priority,p_location:row.location,p_agency:row.agency,p_requesting_officer:row.requesting_officer,p_destination:row.destination,p_notes:row.notes});
   if(error){$('towError').textContent='Request could not be transmitted: '+error.message;return}
 }
 await playTowTransmission(reference,row);
 startTowTracking(reference,row);
}
function resetLeoSubViews(){
  stopTowTracking();
  document.querySelector('#towService .plate-stage')?.classList.remove('hidden');
  document.querySelector('#towService .police-form-card')?.classList.remove('hidden');
  $('towSuccess')?.classList.add('hidden');
  $('towTransmit')?.classList.add('hidden');
  $('towTracker')?.classList.add('hidden');
  document.querySelector('#closureService .police-form-card')?.classList.remove('hidden');
  $('closureSuccess')?.classList.add('hidden');
}
function openLeoService(which){
  const valid=['home','tow','closure','dmv','release'];
  if(!valid.includes(which))which='home';
  ['leoHome','towService','closureService','dmvService','releaseService'].forEach(id=>$(id)?.classList.add('hidden'));
  if(which==='home'){
    resetLeoSubViews();
    $('leoHome')?.classList.remove('hidden');
  }else{
    const target={tow:'towService',closure:'closureService',dmv:'dmvService',release:'releaseService'}[which];
    $(target)?.classList.remove('hidden');
    if(which==='release')loadLeoReleases();
  }
  window.scrollTo({top:0,behavior:'smooth'});
}
function initLeoMenu(){
  // Always start from a known-good menu state on a fresh page load / browser restore.
  ['towService','closureService','dmvService','releaseService','towTransmit','towTracker'].forEach(id=>$(id)?.classList.add('hidden'));
  $('leoHome')?.classList.remove('hidden');
}
window.addEventListener('DOMContentLoaded',()=>{initLeoMenu();initialiseLeoAccess()});
window.addEventListener('pageshow',e=>{if(e.persisted){initLeoMenu();initialiseLeoAccess()}});
async function submitClosure(){const get=id=>document.getElementById(id)?.value?.trim()||'';const err=document.getElementById('closureError');const payload={reference:'RC-'+String(Date.now()).slice(-6),location:get('closureLocation'),closure_type:get('closureType'),reason:get('closureReason'),priority:get('closurePriority'),agency:get('closureAgency'),requesting_officer:get('closureOfficer'),notes:get('closureNotes'),status:'PENDING'};if(!payload.location||!payload.requesting_officer){err.textContent='Location and officer / callsign are required.';return}err.textContent='';if(location.protocol==='file:'){document.getElementById('closureRef').textContent=payload.reference;document.querySelector('#closureService .police-form-card').classList.add('hidden');document.getElementById('closureSuccess').classList.remove('hidden');return}const {error}=await sb.rpc('submit_road_closure_request',{p_reference:payload.reference,p_location:payload.location,p_closure_type:payload.closure_type,p_reason:payload.reason,p_priority:payload.priority,p_agency:payload.agency,p_requesting_officer:payload.requesting_officer,p_notes:payload.notes,p_duration:get('closureDuration')});if(error){err.textContent='Request could not be transmitted: '+error.message;return}document.getElementById('closureRef').textContent=payload.reference;document.querySelector('#closureService .police-form-card').classList.add('hidden');document.getElementById('closureSuccess').classList.remove('hidden')}



let activeTowRef=null,towTrackTimer=null,towTrackFallback=null,demoTowStage=0;
const TOW_STEPS=['PENDING','CLAIMED','EN ROUTE','ON SCENE','COMPLETE'];
const TOW_ORDER={PENDING:0,CLAIMED:1,'EN ROUTE':2,'ON SCENE':3,COMPLETE:4,COMPLETED:4,IMPOUNDED:4,CANCELLED:4};
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function playTowTransmission(ref,row){
 document.querySelector('#towService .plate-stage')?.classList.add('hidden');
 document.querySelector('#towService .police-form-card')?.classList.add('hidden');
 $('towSuccess')?.classList.add('hidden');$('towTracker')?.classList.add('hidden');$('towTransmit')?.classList.remove('hidden');
 const bar=$('transmitBar'),log=$('transmitLog'),title=$('transmitTitle');
 bar.style.width='8%'; title.textContent='TRANSMITTING REQUEST...'; log.innerHTML='<span>Establishing secure connection...</span>';
 await sleep(420);bar.style.width='36%';log.innerHTML+='<span class="ok">✓ CONNECTED TO SA DOT OPERATIONS</span>';
 await sleep(480);bar.style.width='68%';log.innerHTML+='<span class="ok">✓ ENCRYPTED REQUEST TRANSMITTED</span>';
 await sleep(480);bar.style.width='100%';log.innerHTML+='<span class="ok">✓ REQUEST LOGGED · '+escapeLeo(ref)+'</span>';title.textContent='REQUEST ACCEPTED';
 await sleep(650);$('towTransmit')?.classList.add('hidden');
 document.querySelector('#towService .plate-stage')?.classList.remove('hidden');
 document.querySelector('#towService .police-form-card')?.classList.remove('hidden');
}
function startTowTracking(ref,fallback){
 stopTowTracking(); activeTowRef=String(ref||'').toUpperCase(); towTrackFallback=fallback||null; demoTowStage=0;
 ['leoHome','closureService','dmvService','releaseService','towTransmit'].forEach(id=>$(id)?.classList.add('hidden'));
 $('towService')?.classList.remove('hidden');document.querySelector('#towService .plate-stage')?.classList.add('hidden');document.querySelector('#towService .police-form-card')?.classList.add('hidden');$('towSuccess')?.classList.add('hidden');$('towTracker')?.classList.remove('hidden');
 refreshTowTracking(true);towTrackTimer=setInterval(()=>refreshTowTracking(false),5000);window.scrollTo({top:0,behavior:'smooth'});
}
function stopTowTracking(){if(towTrackTimer){clearInterval(towTrackTimer);towTrackTimer=null}activeTowRef=null;document.querySelector('#towService .plate-stage')?.classList.remove('hidden');document.querySelector('#towService .police-form-card')?.classList.remove('hidden');$('towTracker')?.classList.add('hidden')}
async function trackExistingTow(){
 const ref=($('existingTowRef')?.value||'').trim().toUpperCase(),err=$('existingTowError');if(err)err.textContent='';
 if(!/^TR-[A-Z0-9-]{2,}$/.test(ref)){if(err)err.textContent='Enter a valid tow reference, e.g. TR-0042.';return}
 if(location.protocol==='file:'){startTowTracking(ref,{registration:'4GTD991',vehicle:'BMW M3',colour:'Blue',priority:'URGENT',location:'Sandy Shores',agency:'BCSO',requesting_officer:'O. Smith 5372',destination:'Sandy Shores Impound',status:'PENDING'});return}
 const {data,error}=await sb.from('tow_requests').select('*').eq('reference',ref).maybeSingle();
 if(error||!data){if(err)err.textContent=error?'Could not retrieve request: '+error.message:'No tow request found with that reference.';return}
 startTowTracking(ref,data);
}
async function refreshTowTracking(manual){
 if(!activeTowRef)return;let row=null;
 if(location.protocol==='file:'){
   const demoStatuses=['PENDING','CLAIMED','EN ROUTE','ON SCENE','IMPOUNDED'];if(!manual)demoTowStage=Math.min(demoTowStage+1,demoStatuses.length-1);
   row={...(towTrackFallback||{}),reference:activeTowRef,status:demoStatuses[demoTowStage],claimed_by:demoTowStage>0?'dot1':null,created_at:new Date(Date.now()-7*60000).toISOString()};
 }else{
   const {data,error}=await sb.from('tow_requests').select('*').eq('reference',activeTowRef).maybeSingle();
   if(error){$('trackHeadline').textContent='Tracking link error: '+error.message;return}if(!data){$('trackHeadline').textContent='Request record could not be found.';return}row=data;
 }
 renderTowTracker(row);
}
function renderTowTracker(r){
 const status=String(r.status||'PENDING').toUpperCase(),idx=TOW_ORDER[status]??0,displayStatus=status==='PENDING'?'AWAITING DOT UNIT':status==='IMPOUNDED'?'VEHICLE IMPOUNDED':status==='COMPLETE'||status==='COMPLETED'?'TOW COMPLETE':status;
 $('trackRef').textContent=r.reference||activeTowRef;$('trackStatusBadge').textContent=displayStatus;$('trackStatusBadge').className='track-badge '+status.toLowerCase().replace(/ /g,'-');
 const headlines={PENDING:'Request received. Awaiting a DOT unit.',CLAIMED:'A DOT operator has claimed your request.','EN ROUTE':'DOT unit is responding to your location.','ON SCENE':'DOT unit is on scene.',IMPOUNDED:'Tow complete. Vehicle transferred to SA DOT Impound.',COMPLETE:'Tow completed. No active impound created.',COMPLETED:'Tow completed. No active impound created.',CANCELLED:'This request has been cancelled.'};$('trackHeadline').textContent=headlines[status]||'DOT Operations is processing this request.';
 $('trackProgress').innerHTML=TOW_STEPS.map((s,i)=>`<div class="track-step ${i<idx?'done':i===idx?'current':''}"><i>${i<idx?'✓':i+1}</i><span>${s==='PENDING'?'REQUESTED':s}</span></div>`).join('');
 $('trackDetails').innerHTML=`<dt>Registration</dt><dd>${escapeLeo(r.registration||'—')}</dd><dt>Vehicle</dt><dd>${escapeLeo((r.colour||'')+' '+(r.vehicle||''))}</dd><dt>Location</dt><dd>${escapeLeo(r.location||'—')}</dd><dt>Priority</dt><dd>${escapeLeo(r.priority||'ROUTINE')}</dd><dt>Agency / Officer</dt><dd>${escapeLeo((r.agency||'—')+' · '+(r.requesting_officer||'—'))}</dd>`;
 $('trackDot').innerHTML=`<dt>Current Stage</dt><dd>${escapeLeo(displayStatus)}</dd><dt>Assigned DOT Unit</dt><dd>${escapeLeo(r.claimed_by||'Awaiting assignment')}</dd><dt>Destination</dt><dd>${escapeLeo(r.destination||'Nearest DOT Impound')}</dd><dt>Last Checked</dt><dd>${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</dd>`;
 const final=$('trackFinal');if(['IMPOUNDED','COMPLETE','COMPLETED','CANCELLED'].includes(status)){final.classList.remove('hidden');final.className='track-final '+(status==='IMPOUNDED'?'impounded':status==='CANCELLED'?'cancelled':'complete');final.innerHTML=status==='IMPOUNDED'?'<b>TOW COMPLETE</b><strong>VEHICLE IMPOUNDED</strong><span>Vehicle transferred to SA DOT Impound.</span>':status==='CANCELLED'?'<b>REQUEST CLOSED</b><strong>REQUEST CANCELLED</strong><span>Contact DOT Operations if further assistance is required.</span>':'<b>TOW COMPLETE</b><strong>RECOVERY COMPLETE</strong><span>No impound record was created.</span>'}else final.classList.add('hidden');
}

document.getElementById('dmvPlate')?.addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g,'')});
function leoSpeak(text){try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=.88;u.pitch=.82;u.volume=1;speechSynthesis.speak(u)}catch(e){}}
async function runDmvCheck(){
 const plate=(document.getElementById('dmvPlate')?.value||'').trim().toUpperCase(); const out=document.getElementById('dmvResult'); if(!plate)return;
 out.className='dmv-result scanning'; out.innerHTML='<b>QUERYING DMV / DOT NETWORK...</b><span>'+plate+'</span>';
 await new Promise(r=>setTimeout(r,700));
 let rec=null;
 if(location.protocol==='file:') { if(['TEST01','4GTD991','SCAT'].includes(plate)) rec={registration:plate,vehicle:plate==='4GTD991'?'BMW M3':'Bravado Buffalo',colour:plate==='4GTD991'?'White':'Red',status:'UNPAID',impound_lot:'Sandy Shores Impound',reason:'Police Seizure'}; }
 else { const q=await sb.from('impounds').select('*').eq('registration',plate).neq('status','RELEASED').order('created_at',{ascending:false}).limit(1); rec=q.data?.[0]||null; }
 if(rec){ out.className='dmv-result dmv-alert'; out.innerHTML=`<small>ACTIVE DOT HOLD</small><h2>VEHICLE IMPOUNDED</h2><div><b>${rec.registration}</b> · ${rec.colour||''} ${rec.vehicle||''}</div><p>${rec.impound_lot||'SA DOT Impound'} · ${rec.reason||'Active impound record'}</p><strong>SEIZE IMMEDIATELY</strong>`; leoSpeak('Vehicle impounded. Seize immediately.'); }
 else { out.className='dmv-result dmv-clear'; out.innerHTML=`<small>DMV / DOT RESPONSE</small><h2>NO ACTIVE DOT IMPOUND</h2><div><b>${plate}</b></div><p>No unreleased vehicle impound record was found.</p>`; }
}

// v4.24 restricted LEO release desk — DOT operator styling, release-only access
let leoReleaseRecords=[];
let selectedLeoRelease=null;
const leoDemoReleases=[
 {id:9001,registration:'4GTD991',vehicle:'BMW M3',colour:'White',impound_lot:'Sandy Shores Impound',fee:495,paid_at:new Date(Date.now()-18*60000).toISOString(),payment_reference:'PAY-839201'},
 {id:9002,registration:'SCAT',vehicle:'Dodge Charger',colour:'Red',impound_lot:'Los Santos Impound',fee:495,paid_at:new Date(Date.now()-41*60000).toISOString(),payment_reference:'PAY-611842'},
 {id:9003,registration:'84AUDI',vehicle:'Audi RS6',colour:'Grey',impound_lot:'Davis Impound',fee:495,paid_at:new Date(Date.now()-67*60000).toISOString(),payment_reference:'PAY-220418'}
];
async function loadLeoReleases(){
 const host=document.getElementById('leoReleaseRows'); if(!host)return;
 host.innerHTML='<div class="release-empty">Checking DOT release queue...</div>';
 if(location.protocol==='file:'){leoReleaseRecords=[...leoDemoReleases];selectedLeoRelease=leoReleaseRecords[0]?.id||null;renderLeoReleases();return}
 const {data,error}=await sb.from('impounds').select('id,registration,vehicle,colour,impound_lot,fee,paid_at,payment_reference,status').eq('status','PAID').order('paid_at',{ascending:true});
 if(error){host.innerHTML='<div class="release-empty error">Could not load release queue: '+escapeLeo(error.message)+'</div>';return}
 leoReleaseRecords=data||[]; if(!leoReleaseRecords.some(x=>x.id===selectedLeoRelease))selectedLeoRelease=leoReleaseRecords[0]?.id||null; renderLeoReleases();
}
function escapeLeo(v=''){return String(v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}
const VEHICLE_LIBRARY={
 muscle:['mustang','shelby','gt500','mach 1','camaro','challenger','charger','hellcat','corvette','ct5-v','ct4-v','viper','bravado buffalo','bravado gauntlet','declasse vigero','dominator','vapid dominator','coquette'],
 pickup:['f-150','f150','f-250','f250','f-350','f350','raptor','silverado','sierra','ram 1500','ram 2500','ram 3500','tacoma','tundra','ranger','maverick','colorado','canyon','ridgeline','frontier','titan','gladiator','vapid sadler','vapid guardian','declasse yosemite','bravado bison'],
 wagon:['rs6','rs4 avant','a6 avant','a4 avant','allroad','e-class estate','c-class estate','3 series touring','5 series touring','v60','v90','golf variant','passat estate','octavia estate','superb estate','panamera sport turismo','taycan cross turismo','range rover','range rover sport','defender','discovery','x1','x3','x5','x6','x7','q3','q5','q7','q8','glc','gle','gls','gla','cayenne','macan','xc40','xc60','xc90','tiguan','touareg','atlas','explorer','expedition','tahoe','suburban','traverse','equinox','blazer','bronco','escape','edge','grand cherokee','cherokee','wrangler','wagoneer','durango','rav4','highlander','4runner','sequoia','cr-v','pilot','passport','hr-v','rogue','pathfinder','armada','murano','cx-5','cx-50','cx-90','forester','outback','ascent','tucson','santa fe','palisade','sportage','sorento','telluride','ev9','gv70','gv80','gallivanter baller','benefactor dubsta','obey rocoto'],
 euro:['m2','m3','m4','m5','m8','3 series','4 series','5 series','7 series','8 series','a3','a4','a5','a6','a7','a8','s3','s4','s5','s6','s7','s8','rs3','rs4','rs5','r8','e-tron gt','c-class','e-class','s-class','cla','cls','c63','e63','amg gt','golf','gti','golf r','jetta','arteon','passat','polo','911','718','cayman','boxster','panamera','taycan','s60','s90','v40','mini cooper','clubman','countryman','giulia','500','punto','208','308','508','clio','megane','talisman','c3','c4','c5','octavia','superb','fabia','leon','ibiza','formentor','jaguar xe','jaguar xf','übermacht','ubermacht','obey','benefactor','pfister'],
 sedan:['camry','corolla','avalon','supra','gr86','civic','type r','accord','integra','tlx','nsx','gt-r','gtr','skyline','nissan z','370z','350z','sentra','altima','maxima','versa','wrx','sti','brz','impreza','legacy','mx-5','miata','mazda3','mazda6','rx-7','rx7','rx-8','rx8','evo','lancer evolution','lexus is','lexus es','lexus ls','lexus rc','lexus lc','elantra','elantra n','sonata','stinger','k5','forte','g70','ioniq 5','model 3','model s','model y','model x','malibu','impala','cruze','fusion','taurus','focus','300','pacifica','enclave','regal','lacrosse','ct4','ct5','prius','mirai','karin','dinka','emperor','premier']
};
const VEHICLE_COLOURS={black:['black','jet black','onyx'],white:['white','cream','ivory','pearl'],silver:['silver','platinum','aluminium','aluminum'],grey:['grey','gray','charcoal','graphite','gunmetal'],blue:['blue','navy','cobalt','azure','cyan','teal'],red:['red','crimson','burgundy','maroon'],green:['green','lime','olive'],yellow:['yellow','gold'],orange:['orange','copper'],purple:['purple','violet','plum'],brown:['brown','bronze'],pink:['pink','magenta'],beige:['beige','tan','sand']};
function vehicleColourKey(raw){let c=String(raw||'').toLowerCase();for(const [key,names] of Object.entries(VEHICLE_COLOURS))if(names.some(n=>c.includes(n)))return key;return 'grey'}
function vehicleBodyKey(raw){let v=String(raw||'').toLowerCase();for(const key of ['muscle','pickup','wagon','euro','sedan'])if(VEHICLE_LIBRARY[key].some(n=>v.includes(n)))return key;if(/ford|chevrolet|chevy|gmc|ram|vapid/.test(v))return 'sedan';if(/bmw|mercedes|benz|audi|volkswagen|vw|porsche|volvo|jaguar|alfa|fiat|peugeot|renault|citroen|skoda|seat|cupra/.test(v))return 'euro';return 'sedan'}
function smartVehicleImage(r){const body=vehicleBodyKey((r.vehicle||'')+' '+(r.make||'')+' '+(r.model||'')),colour=vehicleColourKey(r.colour);return `assets/vehicles/${body}-${colour}.jpg`}

function leoVehicleImage(r){return smartVehicleImage(r)}
function renderLeoReleases(){
 const host=document.getElementById('leoReleaseRows'),detail=document.getElementById('leoReleaseDetail'),stats=document.getElementById('leoReleaseStats');if(!host)return;
 const q=(document.getElementById('leoReleaseSearch')?.value||'').trim().toLowerCase();
 const rows=leoReleaseRecords.filter(r=>!q||(`${r.registration} ${r.vehicle} ${r.colour} IMP-${r.id}`).toLowerCase().includes(q));
 if(stats)stats.innerHTML=`<div class="rs ready"><i>🔑</i><b>${leoReleaseRecords.length}</b><span>READY FOR RELEASE<small>Payment verified</small></span></div><div class="rs today"><i>✓</i><b>${leoReleaseRecords.filter(r=>r.paid_at&&Date.now()-new Date(r.paid_at)<86400000).length}</b><span>PAID TODAY<small>Last 24 hours</small></span></div><div class="rs"><i>▣</i><b>LEO</b><span>ACCESS LEVEL<small>Vehicle release only</small></span></div>`;
 host.innerHTML=rows.map(r=>{const img=leoVehicleImage(r),paid=r.paid_at?new Date(r.paid_at).toLocaleString('en-GB',{hour:'2-digit',minute:'2-digit'}):'Verified';return `<button class="release-row ${selectedLeoRelease===r.id?'selected':''}" onclick="selectLeoRelease(${r.id})"><img src="${img}" alt="Vehicle reference"><b>${escapeLeo(r.registration)}</b><span><strong>${escapeLeo(r.vehicle||'Vehicle')}</strong></span><span><i class="colour-dot" style="background:${escapeLeo((r.colour||'grey').toLowerCase())}"></i>${escapeLeo(r.colour||'—')}</span><small>${paid}</small><strong>$${Number(r.fee||495).toFixed(0)}</strong><em>›</em></button>`}).join('')||'<div class="release-empty">No paid vehicles are currently awaiting release.</div>';
 const r=leoReleaseRecords.find(x=>x.id===selectedLeoRelease);
 if(!detail)return;if(!r){detail.innerHTML='<div class="release-empty">Select a vehicle ready for collection.</div>';return}
 const img=leoVehicleImage(r),paid=r.paid_at?new Date(r.paid_at).toLocaleString('en-GB'):'Verified';
 detail.innerHTML=`<div class="release-ready">● READY FOR RELEASE <small>IMP-${String(r.id).padStart(4,'0')}</small></div><div class="release-photo"><img src="${img}" alt="Vehicle reference"></div><h2>${escapeLeo(r.vehicle||'Vehicle')}</h2><div class="release-meta"><b>${escapeLeo(r.registration)}</b><span>${escapeLeo(r.colour||'—')}</span><span>${escapeLeo(r.impound_lot||'SA DOT Impound')}</span></div><div class="release-info paid-box"><h4>PAYMENT VERIFIED ✓</h4><dl><dt>Release Fee</dt><dd>$${Number(r.fee||495).toFixed(2)}</dd><dt>Paid</dt><dd>${paid}</dd><dt>Reference</dt><dd>${escapeLeo(r.payment_reference||'ON FILE')}</dd></dl></div><button class="release-primary big" onclick="leoReleaseVehicle(${r.id})">🔑 &nbsp; RELEASE VEHICLE</button><div class="leo-access-note">LEO RELEASE ACCESS · No other DOT operator functions are available from this terminal.</div>`;
}
function selectLeoRelease(id){selectedLeoRelease=id;renderLeoReleases()}
async function leoReleaseVehicle(id){
 const r=leoReleaseRecords.find(x=>x.id===id);if(!r)return;
 const callsign=prompt('RELEASING OFFICER CALLSIGN\n\nEnter your callsign to authorise release of '+r.registration+':','');
 if(callsign===null)return; const cs=callsign.trim(); if(!cs){alert('A callsign is required to release this vehicle.');return}
 if(!confirm(`AUTHORISE RELEASE\n\n${r.colour||''} ${r.vehicle||'Vehicle'} · ${r.registration}\nPayment verified\nReleasing callsign: ${cs}\n\nRelease this vehicle?`))return;
 if(location.protocol==='file:'){leoReleaseRecords=leoReleaseRecords.filter(x=>x.id!==id);selectedLeoRelease=leoReleaseRecords[0]?.id||null;renderLeoReleases();alert(`${r.registration} RELEASED\n\nAuthorised by ${cs}`);return}
 try{const res=await fetch('/.netlify/functions/leo-release',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:'dotpd',impound_id:id,callsign:cs})});const out=await res.json();if(!res.ok)throw new Error(out.error||'Release failed.');leoReleaseRecords=leoReleaseRecords.filter(x=>x.id!==id);selectedLeoRelease=leoReleaseRecords[0]?.id||null;renderLeoReleases();alert(`${r.registration} RELEASED\n\nAuthorised by ${cs}`)}catch(e){alert('Vehicle could not be released: '+e.message)}
}

