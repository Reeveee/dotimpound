const $=id=>document.getElementById(id);
const CAD_STORAGE_KEY='sadot_cad_audio_enabled';
let cadAudioEnabled=localStorage.getItem(CAD_STORAGE_KEY)!=='0',cadAudioCtx=null,cadPrimed=false;
let cadSeenTowIds=new Set(),cadSeenClosureIds=new Set(),cadSeenPaymentIds=new Set();
let roadsideSession=null,roadsideHistory=[];
let roadsideBatteryStep=0,roadsideTyreReadings=null,roadsideTyreSelected=null,roadsideFuseBad=null,roadsideFuseScanned=false,roadsideWinchProgress=0,roadsideFuelLevel=0;
const esc=v=>String(v??'—').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));const ago=m=>new Date(Date.now()-m*60000).toISOString();let me=null,tab='dashboard',records=[],payments=[],members=[],tows=[],closures=[],expandedImpound=null,selectedRelease=null,pendingReleaseId=null;const isAdmin=()=>me?.role==='admin';
async function init(){
if(location.protocol==='file:'){
  me={id:'demo-admin',username:'admin',role:'admin',enabled:true};
  records=[
    {id:4002,registration:'8XKD291',vehicle:'Dodge Charger',colour:'Red',reason:'Reckless Driving',impound_lot:'Sandy Shores Impound',impounded_by:'O.Smith #5372',fee:495,status:'UNPAID',created_at:ago(22)},
    {id:4001,registration:'4GTD991',vehicle:'BMW M3',colour:'White',reason:'Illegal Parking',impound_lot:'Los Santos Impound',impounded_by:'D.Miller #3188',fee:325,status:'PAID',created_at:ago(64),paid_at:ago(18),payment_reference:'PAY-4GTD991'},
    {id:4000,registration:'3PLM672',vehicle:'Audi RS6',colour:'Grey',reason:'Reckless Driving',impound_lot:'Sandy Shores Impound',impounded_by:'O.Smith #5372',fee:495,status:'PAID',created_at:ago(105),paid_at:ago(81),payment_reference:'PAY-3PLM672'},
    {id:3997,registration:'5VPD220',vehicle:'Ford F-150',colour:'White',reason:'Police Impound',impound_lot:'Paleto Bay Impound',impounded_by:'D.Miller #3188',fee:495,status:'PAID',created_at:ago(155),paid_at:ago(42),payment_reference:'PAY-5VPD220'},
    {id:3996,registration:'2KRN814',vehicle:'Toyota Camry',colour:'Blue',reason:'Traffic Offence',impound_lot:'Los Santos Impound',impounded_by:'dot7',fee:495,status:'PAID',created_at:ago(230),paid_at:ago(96),payment_reference:'PAY-2KRN814'},
    {id:3999,registration:'7KSA104',vehicle:'Ford F-150',colour:'White',reason:'Abandoned Vehicle',impound_lot:'Paleto Bay Impound',impounded_by:'dot4',fee:450,status:'UNPAID',created_at:ago(190)},
    {id:3998,registration:'9PLM672',vehicle:'Toyota Camry',colour:'Blue',reason:'Illegal Parking',impound_lot:'Los Santos Impound',impounded_by:'dot2',fee:300,status:'RELEASED',created_at:ago(1320),released_at:ago(1180)}
  ];payments=[{id:1,registration:'3PLM672',amount:495,reference:'PAY-3PLM672',paid_at:ago(81)},{id:2,registration:'4GTD991',amount:325,reference:'PAY-4GTD991',paid_at:ago(18)},{id:3,registration:'5VPD220',amount:495,reference:'PAY-5VPD220',paid_at:ago(42)},{id:4,registration:'2KRN814',amount:495,reference:'PAY-2KRN814',paid_at:ago(96)}];members=[];expandedImpound=4000;
  closures=[];
  tows=[];
  $('offlineDemo')?.classList.remove('hidden'); towingReportData.driver.operatorName=''; towingReportData.driver.date=defaultToday(); roadsideHistory=readRoadsideHistory();updateCadAudioUi();primeCadSnapshots(); render();switchTab('dashboard');return;
}
const {data:{session}}=await sb.auth.getSession();
if(!session){location.replace('login.html');return}
// Resolve the operator from the CURRENT authenticated user's UUID. Never use
// a cached/default username for a live session.
const {data:staff,error}=await sb.from('dot_staff').select('*').eq('id',session.user.id).single();
if(error||!staff?.enabled){sessionStorage.removeItem('dot_operator');await sb.auth.signOut();location.replace('login.html');return}
me=staff;
sessionStorage.setItem('dot_operator',JSON.stringify({id:me.id,username:me.username,role:me.role}));
towingReportData.driver.operatorName=getSavedOperatorName();
towingReportData.driver.date=defaultToday();
reportHistory=readReportHistory();
roadsideHistory=readRoadsideHistory();updateCadAudioUi();
await refresh();primeCadSnapshots();await loadChecklistHistory();restoreChecklistDraft()}

async function logout(){
  sessionStorage.removeItem('dot_operator');
  if(location.protocol==='file:'){
    try{localStorage.setItem('sadot_local_demo_signed_out','1')}catch(_){}
    location.replace('index.html');
    return;
  }
  try{
    if(window.sb?.auth?.signOut) await window.sb.auth.signOut({scope:'local'});
  }catch(e){
    console.warn('Sign out failed:',e);
  }
  try{
    Object.keys(localStorage).filter(k=>k.startsWith('sb-')&&k.includes('auth-token')).forEach(k=>localStorage.removeItem(k));
  }catch(_){}
  location.replace('login.html');
}
async function refresh(){
  const [r,p,m,t,c]=await Promise.all([
    sb.from('impounds').select('*').order('created_at',{ascending:false}),
    sb.from('payments').select('*').order('paid_at',{ascending:false}),
    isAdmin()?sb.from('dot_staff').select('*').order('created_at',{ascending:true}):Promise.resolve({data:[]}),
    sb.from('tow_requests').select('*').order('created_at',{ascending:false}),
    sb.from('road_closure_requests').select('*').order('created_at',{ascending:false})
  ]);
  records=r.data||[]; payments=p.data||[]; members=m.data||[];
  tows=t.data||[]; closures=c.data||[];
  if(t.error) console.error('Tow requests failed to load:',t.error);
  if(c.error) console.error('Road closure requests failed to load:',c.error);
  render();
}

let dispatchPollBusy=false;
function primeCadSnapshots(){
 cadSeenTowIds=new Set((tows||[]).map(x=>String(x.id)));
 cadSeenClosureIds=new Set((closures||[]).map(x=>String(x.id)));
 cadSeenPaymentIds=new Set((payments||[]).map(x=>String(x.id||x.reference||x.payment_reference||x.paid_at)));
 cadPrimed=true;
}
function roadsideReasonMatch(reason){return /disabled|roadside|mechanical|battery|tyre|tire|fuel|winch/i.test(String(reason||''))}
function isRoadsideTow(row){return !!row&&roadsideReasonMatch(row.reason)&&!['COMPLETE','IMPOUNDED','CANCELLED'].includes(String(row.status||'').toUpperCase())}
function processCadChanges(nextTows,nextClosures,nextPayments){
 if(!cadPrimed){tows=nextTows;closures=nextClosures;payments=nextPayments;primeCadSnapshots();return}
 const newTows=nextTows.filter(x=>!cadSeenTowIds.has(String(x.id)));
 const newClosures=nextClosures.filter(x=>!cadSeenClosureIds.has(String(x.id)));
 const newPayments=nextPayments.filter(x=>!cadSeenPaymentIds.has(String(x.id||x.reference||x.payment_reference||x.paid_at)));
 newTows.forEach(x=>{
  if(String(x.priority||'').toUpperCase()==='EMERGENCY'){playCadTone('emergency');showCadNotice('EMERGENCY DOT REQUEST',`${x.reference||'New request'} · ${x.location||'Location pending'}`,'emergency')}
  else if(roadsideReasonMatch(x.reason)){playCadTone('roadside');showCadNotice('ROADSIDE ASSISTANCE REQUEST',`${x.registration||'Vehicle'} · ${x.location||'Location pending'}`,'roadside')}
  else{playCadTone('tow');showCadNotice('NEW TOW REQUEST',`${x.registration||'Vehicle'} · ${x.location||'Location pending'}`,'tow')}
 });
 newClosures.forEach(x=>{playCadTone('closure');showCadNotice('NEW ROAD CLOSURE',`${x.reference||'Closure'} · ${x.location||'Location pending'}`,'closure')});
 newPayments.forEach(x=>{playCadTone('paid');showCadNotice('VEHICLE PAYMENT RECEIVED',`${x.registration||'Vehicle'} · cleared for release`,'paid')});
 tows=nextTows;closures=nextClosures;payments=nextPayments;primeCadSnapshots();
}
async function refreshDispatchRequests(){
  if(location.protocol==='file:'||!me||dispatchPollBusy)return;
  dispatchPollBusy=true;
  try{
    const [t,c,p]=await Promise.all([
      sb.from('tow_requests').select('*').order('created_at',{ascending:false}),
      sb.from('road_closure_requests').select('*').order('created_at',{ascending:false}),
      sb.from('payments').select('*').order('paid_at',{ascending:false})
    ]);
    const nextT=t.error?tows:(t.data||[]),nextC=c.error?closures:(c.data||[]),nextP=p.error?payments:(p.data||[]);
    if(t.error)console.error('Tow request poll failed:',t.error);
    if(c.error)console.error('Road closure poll failed:',c.error);
    if(p.error)console.error('Payment poll failed:',p.error);
    processCadChanges(nextT,nextC,nextP);
    if(['dashboard','tows','closures','roadside','payments'].includes(tab))render();
    else renderPostalPrototypePins();
  }finally{dispatchPollBusy=false}
}
setInterval(refreshDispatchRequests,5000);
function switchTab(t){
  if(t==='members'&&!isAdmin())return;
  tab=t;
  document.querySelectorAll('.side-tab[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===t));
  $('dashboardPanel')?.classList.toggle('hidden',t!=='dashboard');
  $('vehiclePanel')?.classList.toggle('hidden',t!=='vehicles');
  $('towPanel')?.classList.toggle('hidden',t!=='tows');
  $('roadsidePanel')?.classList.toggle('hidden',t!=='roadside');
  $('closurePanel')?.classList.toggle('hidden',t!=='closures');
  $('paymentPanel')?.classList.toggle('hidden',t!=='payments');
  $('checklistPanel')?.classList.toggle('hidden',t!=='checklist');
  $('discordPanel')?.classList.toggle('hidden',t!=='discord');
  $('accountPanel')?.classList.toggle('hidden',t!=='account');
  $('sopPanel')?.classList.toggle('hidden',t!=='sop');
  $('memberPanel')?.classList.toggle('hidden',t!=='members');
  if(t==='checklist'){renderChecklist();setTimeout(()=>{initChecklistVehicle3D();sendChecklistVehicleState()},120)}
  if(t==='account')renderAccountPanel();
  if(t==='roadside')renderRoadsidePanel();
  render();
}


// ===================== CAD AUDIO / NOTIFICATIONS =====================
function updateCadAudioUi(){
 const btn=$('cadAudioBtn'),state=$('cadAudioState'),icon=$('cadAudioIcon');
 if(btn)btn.classList.toggle('muted',!cadAudioEnabled);
 if(state)state.textContent=cadAudioEnabled?'ON':'MUTED';
 if(icon)icon.textContent=cadAudioEnabled?'🔊':'🔇';
}
function ensureCadAudio(){
 if(!cadAudioCtx){const AC=window.AudioContext||window.webkitAudioContext;if(AC)cadAudioCtx=new AC()}
 if(cadAudioCtx?.state==='suspended')cadAudioCtx.resume().catch(()=>{});
 return cadAudioCtx;
}
function toggleCadAudio(){
 cadAudioEnabled=!cadAudioEnabled;localStorage.setItem(CAD_STORAGE_KEY,cadAudioEnabled?'1':'0');updateCadAudioUi();
 if(cadAudioEnabled){ensureCadAudio();playCadTone('paid');showCadNotice('CAD AUDIO ENABLED','Digital dispatch tones are active.','paid')}
 else showCadNotice('CAD AUDIO MUTED','Visual dispatch alerts will remain active.','muted');
}
function cadBeep(freq,start,duration,gain=.045,type='sine'){
 const ctx=ensureCadAudio();if(!ctx||!cadAudioEnabled)return;
 const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,ctx.currentTime+start);
 g.gain.setValueAtTime(0.0001,ctx.currentTime+start);g.gain.exponentialRampToValueAtTime(gain,ctx.currentTime+start+.012);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+start+duration);
 o.connect(g);g.connect(ctx.destination);o.start(ctx.currentTime+start);o.stop(ctx.currentTime+start+duration+.03);
}
function playCadTone(kind='tow'){
 if(!cadAudioEnabled)return;
 if(kind==='tow'){cadBeep(740,0,.12,.045,'square');cadBeep(920,.16,.14,.04,'square')}
 else if(kind==='closure'){cadBeep(520,0,.16,.05,'triangle');cadBeep(420,.19,.19,.05,'triangle')}
 else if(kind==='roadside'){cadBeep(660,0,.08,.04,'sine');cadBeep(790,.11,.08,.04,'sine');cadBeep(990,.22,.13,.045,'sine')}
 else if(kind==='paid'){cadBeep(880,0,.08,.032,'sine');cadBeep(1180,.1,.16,.034,'sine')}
 else if(kind==='supervisor'){cadBeep(690,0,.12,.045,'square')}
 else if(kind==='emergency'){[0,.22,.44].forEach((t,i)=>{cadBeep(i%2?780:1040,t,.16,.065,'square')})}
}
function showCadNotice(title,sub,type='tow'){
 let host=$('cadNoticeStack');
 if(!host){host=document.createElement('div');host.id='cadNoticeStack';host.className='cad-notice-stack';document.body.appendChild(host)}
 const n=document.createElement('div');n.className='cad-notice '+type;n.innerHTML=`<i></i><div><small>SA DOT CAD</small><b>${esc(title)}</b><span>${esc(sub)}</span></div>`;host.prepend(n);
 setTimeout(()=>n.classList.add('show'),20);setTimeout(()=>{n.classList.remove('show');setTimeout(()=>n.remove(),250)},5000);
}
document.addEventListener('pointerdown',()=>{if(cadAudioEnabled)ensureCadAudio()},{once:true});

// ===================== ROADSIDE ASSISTANCE =====================
function roadsideHistoryKey(){return 'sadot_roadside_history_'+(me?.id||me?.username||'operator')}
function readRoadsideHistory(){try{return JSON.parse(localStorage.getItem(roadsideHistoryKey())||'[]')||[]}catch{return []}}
function writeRoadsideHistory(){localStorage.setItem(roadsideHistoryKey(),JSON.stringify((roadsideHistory||[]).slice(0,20)))}
function getRoadsideCalls(){return (tows||[]).filter(isRoadsideTow)}
function roadsideStatusButton(t){
 const st=String(t.status||'PENDING').toUpperCase();
 if(st==='PENDING')return `<button onclick="roadsideAdvanceTow(${t.id},'CLAIMED')">CLAIM CALL</button>`;
 if(st==='CLAIMED')return `<button onclick="roadsideAdvanceTow(${t.id},'EN ROUTE')">MARK EN ROUTE</button>`;
 if(st==='EN ROUTE')return `<button onclick="roadsideAdvanceTow(${t.id},'ON SCENE')">ARRIVE ON SCENE</button>`;
 if(st==='ON SCENE')return `<button class="start" onclick="startRoadsideFromTow(${t.id})">START ASSISTANCE →</button>`;
 return '';
}
async function roadsideAdvanceTow(id,status){await towStatus(id,status);renderRoadsidePanel()}
function renderRoadsidePanel(){
 if(!$('roadsidePanel'))return;
 const calls=getRoadsideCalls();
 if($('roadsideBadge')){$('roadsideBadge').textContent=calls.length;$('roadsideBadge').classList.toggle('hidden',calls.length===0)}
 if($('roadsideQueueCount'))$('roadsideQueueCount').textContent=`${calls.length} ACTIVE`;
 const q=$('roadsideQueue');if(q)q.innerHTML=calls.length?calls.map(t=>`<article class="roadside-call ${String(t.priority||'routine').toLowerCase()}"><div class="roadside-call-top"><span>${esc(t.reference||('TR-'+t.id))}</span><em>${esc(t.status||'PENDING')}</em></div><b>${esc(t.registration||'VEHICLE')}</b><p>${esc(t.vehicle||'Vehicle')} · ${esc(t.reason||'Roadside assistance')}</p><small>${esc(t.location||'Location pending')}</small>${roadsideStatusButton(t)}</article>`).join(''):`<div class="roadside-empty"><span>✓</span><b>No roadside calls waiting</b><small>Disabled-vehicle requests will appear here automatically.</small></div>`;
 roadsideHistory=readRoadsideHistory();const h=$('roadsideHistory');if(h)h.innerHTML=roadsideHistory.length?roadsideHistory.slice(0,5).map(x=>`<div><i>✓</i><span><b>${esc(x.type)}</b><small>${esc(x.plate||'WALK-UP')} · ${esc(x.outcome)} · ${new Date(x.completed_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</small></span></div>`).join(''):`<div class="roadside-history-empty">No completed assists this shift.</div>`;
 if(!roadsideSession)renderRoadsideWelcome();
}
function renderRoadsideWelcome(){
 const host=$('roadsideGameHost');if(!host)return;
 host.innerHTML=`<div class="roadside-welcome"><div class="roadside-screen-logo">SA DOT</div><small>SAFETY PATROL SERVICE TERMINAL</small><h2>ROADSIDE ASSISTANCE</h2><p>Select an on-scene dispatch call from the left, or start a walk-up assist for a vehicle you encounter during patrol.</p><div class="roadside-ready"><i></i><span><b>TABLET READY</b><small>Interactive service procedures available</small></span></div><button onclick="openStandaloneRoadsideSetup()">START WALK-UP ASSIST →</button></div>`;
}
function openStandaloneRoadsideSetup(){
 roadsideSession={source:'walkup',towId:null,plate:'',vehicle:'',location:'',started_at:new Date().toISOString(),type:null};
 const host=$('roadsideGameHost');if(!host)return;
 host.innerHTML=`<div class="roadside-stage enter"><div class="roadside-stage-head"><small>NEW WALK-UP ASSIST</small><h2>Vehicle Details</h2><p>Log the vehicle before beginning the roadside procedure.</p></div><div class="roadside-setup-grid"><label>PLATE<input id="roadsidePlate" placeholder="e.g. 4GTD991"></label><label>VEHICLE<input id="roadsideVehicle" placeholder="e.g. Bravado Buffalo"></label><label class="wide">LOCATION / POSTAL<input id="roadsideLocation" placeholder="e.g. Postal 3004 · East Joshua Road"></label></div><div class="roadside-bottom-actions"><button class="secondary" onclick="cancelRoadsideSession()">CANCEL</button><button onclick="confirmStandaloneRoadside()">CONTINUE →</button></div></div>`;
}
function confirmStandaloneRoadside(){
 roadsideSession.plate=$('roadsidePlate')?.value.trim().toUpperCase()||'UNREGISTERED';roadsideSession.vehicle=$('roadsideVehicle')?.value.trim()||'Vehicle';roadsideSession.location=$('roadsideLocation')?.value.trim()||'Patrol location';renderRoadsideServiceSelect();
}
function startRoadsideFromTow(id){
 const t=tows.find(x=>x.id===id);if(!t)return;
 roadsideSession={source:'tow',towId:id,plate:t.registration||'',vehicle:t.vehicle||'Vehicle',location:t.location||'',started_at:new Date().toISOString(),type:null,reference:t.reference||('TR-'+id)};
 switchTab('roadside');renderRoadsideServiceSelect();
}
function cancelRoadsideSession(){roadsideSession=null;resetRoadsideGameState();renderRoadsidePanel()}
function resetRoadsideGameState(){roadsideBatteryStep=0;roadsideTyreReadings=null;roadsideTyreSelected=null;roadsideFuseBad=null;roadsideFuseScanned=false;roadsideWinchProgress=0;roadsideFuelLevel=0}
const ROADSIDE_SERVICES={battery:['BATTERY / JUMP START','⚡','Test voltage, connect the booster correctly and restart the vehicle.'],tyre:['TYRE PRESSURE','◉','Find the low tyre and inflate it into the safe pressure range.'],fuse:['FUSE / ELECTRICAL','▦','Run a continuity scan, locate the failed fuse and replace it.'],winch:['WINCH RECOVERY','↗','Choose a safe recovery point and hold the winch inside the tension window.'],fuel:['FUEL DELIVERY','▰','Deliver a small emergency fuel supply and confirm the vehicle restarts.']};
function renderRoadsideServiceSelect(){
 const host=$('roadsideGameHost');if(!host||!roadsideSession)return;resetRoadsideGameState();
 host.innerHTML=`<div class="roadside-stage enter"><div class="roadside-call-banner"><div><small>${roadsideSession.source==='tow'?'DISPATCH CALL':'WALK-UP ASSIST'}</small><b>${esc(roadsideSession.plate)} · ${esc(roadsideSession.vehicle)}</b><span>${esc(roadsideSession.location)}</span></div><em>${esc(roadsideSession.reference||'PATROL')}</em></div><div class="roadside-stage-head"><small>SELECT PROCEDURE</small><h2>What assistance is required?</h2><p>Choose the service and the tablet will guide you through a short interactive procedure.</p></div><div class="roadside-service-grid">${Object.entries(ROADSIDE_SERVICES).map(([k,v])=>`<button onclick="startRoadsideGame('${k}')"><i>${v[1]}</i><span><b>${v[0]}</b><small>${v[2]}</small></span><em>START →</em></button>`).join('')}</div><div class="roadside-bottom-actions"><button class="secondary" onclick="cancelRoadsideSession()">CANCEL ASSIST</button></div></div>`;
}
function startRoadsideGame(type){roadsideSession.type=type;resetRoadsideGameState();if(type==='tyre')roadsideTyreReadings={FL:33,FR:34,RL:32,RR:19+Math.floor(Math.random()*5)};if(type==='fuse')roadsideFuseBad=Math.floor(Math.random()*12);renderRoadsideGame()}
function roadsideGameHeader(title,sub){return `<div class="roadside-game-top"><button onclick="renderRoadsideServiceSelect()">← SERVICES</button><div><small>ACTIVE PROCEDURE</small><b>${title}</b><span>${sub}</span></div><em>${esc(roadsideSession?.plate||'')}</em></div>`}
function renderRoadsideGame(){
 const host=$('roadsideGameHost');if(!host||!roadsideSession)return;const t=roadsideSession.type;
 if(t==='battery')host.innerHTML=roadsideGameHeader('BATTERY / JUMP START','Follow the booster connection sequence.')+batteryGameMarkup();
 if(t==='tyre')host.innerHTML=roadsideGameHeader('TYRE PRESSURE','Identify and correct the low-pressure tyre.')+tyreGameMarkup();
 if(t==='fuse')host.innerHTML=roadsideGameHeader('FUSE / ELECTRICAL','Scan the fuse panel and replace the failed circuit.')+fuseGameMarkup();
 if(t==='winch')host.innerHTML=roadsideGameHeader('WINCH RECOVERY','Set safe line tension before recovering the vehicle.')+winchGameMarkup();
 if(t==='fuel')host.innerHTML=roadsideGameHeader('FUEL DELIVERY','Deliver five litres of emergency fuel.')+fuelGameMarkup();
}
function batteryGameMarkup(){return `<div class="roadside-game enter"><div class="battery-vehicle"><div class="battery-unit"><small>BATTERY STATUS</small><b id="batteryVoltage">--.- V</b><div class="battery-terminals"><button class="positive ${roadsideBatteryStep>=1?'connected':''}" onclick="roadsideBatteryAction('red')">＋<span>RED CLAMP</span></button><button class="negative ${roadsideBatteryStep>=2?'connected':''}" onclick="roadsideBatteryAction('black')">−<span>BLACK / GROUND</span></button></div></div><div class="battery-cable-line ${roadsideBatteryStep>=2?'live':''}"></div><div class="booster-pack"><i>⚡</i><b>SA DOT BOOSTER</b><span id="batteryStatus">${roadsideBatteryStep===0?'Connect RED clamp to positive terminal.':roadsideBatteryStep===1?'Now connect BLACK clamp to chassis ground.':roadsideBatteryStep===2?'Connections secure. Run battery test.':'Boosting system ready.'}</span></div></div><div class="roadside-game-controls"><button onclick="roadsideBatteryAction('test')" ${roadsideBatteryStep<2?'disabled':''}>RUN BATTERY TEST</button><button id="batteryBoostBtn" onclick="roadsideBatteryAction('boost')" ${roadsideBatteryStep<3?'disabled':''}>APPLY BOOST</button><button id="batteryIgnitionBtn" onclick="roadsideBatteryAction('ignition')" ${roadsideBatteryStep<4?'disabled':''}>TURN IGNITION</button></div><div class="roadside-game-message" id="roadsideGameMessage">Correct connection order prevents sparks and protects the vehicle electronics.</div></div>`}
function roadsideBatteryAction(a){const m=$('roadsideGameMessage');if(a==='red'){roadsideBatteryStep=Math.max(1,roadsideBatteryStep);renderRoadsideGame()}else if(a==='black'){if(roadsideBatteryStep<1){if(m)m.textContent='Connect the RED positive clamp first.';playCadTone('closure');return}roadsideBatteryStep=Math.max(2,roadsideBatteryStep);renderRoadsideGame()}else if(a==='test'&&roadsideBatteryStep>=2){if(m)m.textContent='Testing battery voltage...';setTimeout(()=>{roadsideBatteryStep=3;renderRoadsideGame();if($('batteryVoltage'))$('batteryVoltage').textContent='10.8 V'},800)}else if(a==='boost'&&roadsideBatteryStep>=3){if(m)m.textContent='Booster charging system...';const b=$('batteryBoostBtn');if(b)b.textContent='BOOSTING...';setTimeout(()=>{roadsideBatteryStep=4;renderRoadsideGame()},1200)}else if(a==='ignition'&&roadsideBatteryStep>=4){roadsideGameComplete('Battery boosted successfully. Engine restarted.')}}
function tyreGameMarkup(){const pos={FL:'FRONT LEFT',FR:'FRONT RIGHT',RL:'REAR LEFT',RR:'REAR RIGHT'};return `<div class="roadside-game enter"><div class="tyre-car"><div class="tyre-car-body"><b>VEHICLE</b></div>${Object.entries(pos).map(([k,v])=>`<button class="tyre-node ${roadsideTyreSelected===k?'selected':''} ${roadsideTyreReadings[k]<28?'low':''}" data-pos="${k}" onclick="roadsideScanTyre('${k}')"><span>${v}</span><b>${roadsideTyreSelected===k?roadsideTyreReadings[k]+' PSI':'TEST'}</b></button>`).join('')}</div><div id="tyreInflateArea" class="tyre-inflate ${roadsideTyreSelected&&roadsideTyreReadings[roadsideTyreSelected]<28?'':'hidden'}"><label>REGULATOR TARGET <b id="tyreTargetReadout">32 PSI</b><input id="tyreTarget" type="range" min="26" max="38" value="32" oninput="$('tyreTargetReadout').textContent=this.value+' PSI'"></label><button onclick="roadsideInflateTyre()">CONNECT AIR & INFLATE →</button></div><div class="roadside-game-message" id="roadsideGameMessage">Tap each tyre to read its pressure. Normal operating range: 31–35 PSI.</div></div>`}
function roadsideScanTyre(pos){roadsideTyreSelected=pos;renderRoadsideGame();const psi=roadsideTyreReadings[pos];const m=$('roadsideGameMessage');if(m)m.textContent=psi<28?`${pos} reads ${psi} PSI. Low pressure confirmed — connect the air line.`:`${pos} reads ${psi} PSI. Pressure is within operating range.`}
function roadsideInflateTyre(){const target=Number($('tyreTarget')?.value||0),m=$('roadsideGameMessage');if(target<31||target>35){if(m)m.textContent='Set the regulator between 31 and 35 PSI before inflating.';playCadTone('closure');return}if(m)m.textContent='Inflating tyre...';setTimeout(()=>{roadsideTyreReadings[roadsideTyreSelected]=target;roadsideGameComplete(`Tyre inflated to ${target} PSI and checked for stability.`)},1200)}
function fuseGameMarkup(){return `<div class="roadside-game enter"><div class="fuse-panel"><div class="fuse-panel-head"><span>ENGINE BAY FUSE BOX</span><button onclick="roadsideRunFuseScan()">RUN CONTINUITY SCAN</button></div><div class="fuse-grid">${Array.from({length:12},(_,i)=>`<button class="fuse-cell ${roadsideFuseScanned&&i===roadsideFuseBad?'suspect':''}" onclick="roadsideChooseFuse(${i})"><small>${String(i+1).padStart(2,'0')}</small><b>${[5,10,15,20,25,30][i%6]}A</b><i></i></button>`).join('')}</div></div><div class="roadside-game-message" id="roadsideGameMessage">Run the continuity scan before replacing a fuse.</div></div>`}
function roadsideRunFuseScan(){const m=$('roadsideGameMessage');if(m)m.textContent='Scanning circuits...';setTimeout(()=>{roadsideFuseScanned=true;renderRoadsideGame();const mm=$('roadsideGameMessage');if(mm)mm.textContent='Continuity fault detected. Replace the highlighted suspect fuse.'},1100)}
function roadsideChooseFuse(i){const m=$('roadsideGameMessage');if(!roadsideFuseScanned){if(m)m.textContent='Run the continuity scan first.';return}if(i!==roadsideFuseBad){if(m)m.textContent=`Fuse ${i+1} tests good. Continue diagnosis.`;playCadTone('closure');return}if(m)m.textContent='Removing failed fuse and installing replacement...';setTimeout(()=>roadsideGameComplete(`Fuse ${i+1} replaced. Electrical circuit restored.`),950)}
function winchGameMarkup(){return `<div class="roadside-game enter"><div class="winch-scene"><div class="recovery-truck"><span>DOT</span><b>WINCH</b></div><div class="winch-line"><i style="width:${roadsideWinchProgress}%"></i></div><div class="stuck-car">VEHICLE</div></div><div class="winch-control"><div class="winch-zone"><span>LOW</span><div><i></i></div><span>HIGH</span></div><label>LINE TENSION <b id="winchTensionReadout">60%</b><input id="winchTension" type="range" min="20" max="90" value="60" oninput="$('winchTensionReadout').textContent=this.value+'%'"></label><button onclick="roadsideWinchPull()">WINCH IN</button></div><div class="roadside-game-message" id="roadsideGameMessage">Keep line tension in the green 55–70% window while recovering the vehicle.</div></div>`}
function roadsideWinchPull(){const t=Number($('winchTension')?.value||0),m=$('roadsideGameMessage');if(t<55){if(m)m.textContent='Tension too low — line is slack. Increase tension.';playCadTone('closure');return}if(t>70){if(m)m.textContent='Tension too high — reduce load before continuing.';playCadTone('emergency');return}roadsideWinchProgress=Math.min(100,roadsideWinchProgress+25);if(roadsideWinchProgress>=100){roadsideGameComplete('Vehicle recovered to a safe position with controlled line tension.');return}renderRoadsideGame();const mm=$('roadsideGameMessage');if(mm)mm.textContent=`Recovery ${roadsideWinchProgress}% complete. Maintain safe tension and continue.`}
function fuelGameMarkup(){return `<div class="roadside-game enter"><div class="fuel-pump"><div class="fuel-can"><div class="fuel-fill" style="height:${Math.min(100,roadsideFuelLevel/5*100)}%"></div><b>${roadsideFuelLevel.toFixed(1)} L</b></div><div class="fuel-target"><small>EMERGENCY DELIVERY</small><b>5.0 L TARGET</b><span>Use the pump control until the minimum delivery is reached.</span></div></div><div class="roadside-game-controls fuel-controls"><button onclick="roadsideFuelPump()" ${roadsideFuelLevel>=5?'disabled':''}>PUMP +1 L</button><button onclick="roadsideFuelFinish()" ${roadsideFuelLevel<5?'disabled':''}>SECURE CAP & TEST START →</button></div><div class="roadside-game-message" id="roadsideGameMessage">Metered emergency fuel delivery. Target: 5 litres.</div></div>`}
function roadsideFuelPump(){roadsideFuelLevel=Math.min(5,roadsideFuelLevel+1);renderRoadsideGame();playCadTone('paid')}
function roadsideFuelFinish(){roadsideGameComplete('Emergency fuel delivered. Fuel cap secured and engine restart confirmed.')}
function roadsideGameComplete(summary){playCadTone('roadside');const host=$('roadsideGameHost');if(!host)return;const [title]=ROADSIDE_SERVICES[roadsideSession.type]||['ROADSIDE ASSIST'];host.innerHTML=`<div class="roadside-complete enter"><div class="roadside-complete-ring">✓</div><small>SERVICE PROCEDURE COMPLETE</small><h2>${title}</h2><p>${esc(summary)}</p><div class="roadside-complete-meta"><div><span>OPERATOR</span><b>${esc(getSavedOperatorName())}</b></div><div><span>UNIT</span><b>${esc(me?.username||'DOT')}</b></div><div><span>VEHICLE</span><b>${esc(roadsideSession.plate||'WALK-UP')}</b></div></div><h3>Select scene outcome</h3><div class="roadside-outcome-grid"><button onclick="finalizeRoadsideOutcome('VEHICLE DROVE AWAY')">✓ VEHICLE DROVE AWAY</button><button onclick="finalizeRoadsideOutcome('TOW STILL REQUIRED')">▰ TOW STILL REQUIRED</button><button onclick="finalizeRoadsideOutcome('REFERRED TO MECHANIC')">⚒ REFER TO MECHANIC</button><button onclick="finalizeRoadsideOutcome('OWNER DECLINED')">× OWNER DECLINED</button></div></div>`}
function finalizeRoadsideOutcome(outcome){
 const [title]=ROADSIDE_SERVICES[roadsideSession.type]||['ROADSIDE ASSIST'];const record={id:'RA-'+Date.now(),type:title,plate:roadsideSession.plate,vehicle:roadsideSession.vehicle,location:roadsideSession.location,outcome,operator:me?.username||'DOT',completed_at:new Date().toISOString(),towId:roadsideSession.towId};roadsideHistory=readRoadsideHistory();roadsideHistory.unshift(record);writeRoadsideHistory();
 const host=$('roadsideGameHost'),linked=roadsideSession.towId,needsTow=outcome==='TOW STILL REQUIRED';if(host)host.innerHTML=`<div class="roadside-filed enter"><div>✓</div><small>ASSISTANCE LOG FILED</small><h2>${esc(outcome)}</h2><p>${needsTow?'The linked recovery request has been left open for towing.':'Roadside work has been recorded. You can optionally close the linked dispatch request.'}</p><div class="roadside-bottom-actions">${linked&&!needsTow?`<button onclick="closeRoadsideLinkedTow(${linked})">CLOSE LINKED REQUEST ✓</button>`:''}${linked&&needsTow?`<button onclick="switchTab('tows')">OPEN TOW REQUEST →</button>`:''}<button class="secondary" onclick="cancelRoadsideSession()">RETURN TO ROADSIDE</button></div></div>`;renderRoadsidePanel();
}
async function closeRoadsideLinkedTow(id){await towStatus(id,'COMPLETE');cancelRoadsideSession();showCadNotice('ROADSIDE CALL CLEARED','Linked dispatch request marked complete.','paid')}
setInterval(()=>{if($('roadsideTabletClock'))$('roadsideTabletClock').textContent=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})},1000);

function selectDiscordReportType(type){
  const config={
    towing:{title:'DOT Towing Report',text:'Build a Discord-ready towing report, step by step, then export it as an image.'},
    sign:{title:'DOT Truck Incident Report',text:'Complete the truck incident report one section at a time, then copy the feed or export a Discord-ready image.'}
  };
  const item=config[type];
  if(!item)return;
  currentDiscordReportType=type;
  document.querySelectorAll('.discord-report-card:not(.disabled)').forEach(card=>card.classList.remove('selected'));
  document.querySelector(`.discord-report-card.${type}`)?.classList.add('selected');
  if($('discordGeneratorTitle'))$('discordGeneratorTitle').textContent=item.title;
  if($('discordGeneratorText'))$('discordGeneratorText').textContent=item.text;
  $('discordGeneratorPreview')?.classList.remove('hidden');
  $('discordTowingBuilder')?.classList.toggle('hidden',type!=='towing');
  $('discordSignBuilder')?.classList.toggle('hidden',type!=='sign');
  if(type==='towing'){initTowingReportBuilder();setReportStyle(reportStyle,false);}
  if(type==='sign'){initSignTruckReportBuilder();}
  $('discordGeneratorPreview')?.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function clearDiscordReportType(){
  currentDiscordReportType=null;
  currentReportRecordId=null;
  document.querySelectorAll('.discord-report-card').forEach(card=>card.classList.remove('selected'));
  $('discordGeneratorPreview')?.classList.add('hidden');
  $('discordTowingBuilder')?.classList.add('hidden');
  $('discordSignBuilder')?.classList.add('hidden');
}

let currentDiscordReportType=null;
let discordReportStep=0;
let reportStyle='operations';
let reportHistory=[];
let currentReportRecordId=null;
let discordTypeTimer=null;
let discordPreviewAuto=true;
let discordPreviewDebounce=null;
const DISCORD_TOW_STEPS=[
  {id:'driver',label:'Driver Information'},
  {id:'owner',label:'Vehicle Owner'},
  {id:'vehicle',label:'Vehicle Information'},
  {id:'location',label:'Incident Location'},
  {id:'reason',label:'Reason for Tow'},
  {id:'condition',label:'Vehicle Condition'},
  {id:'details',label:'Tow Details'},
  {id:'law',label:'Law Enforcement'},
  {id:'signatures',label:'Signatures / Status'}
];
const defaultToday=()=>{
  const d=new Date();
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  const yyyy=d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

function operatorProfileKey(){return 'sadot_operator_profile_'+(me?.id||me?.username||'operator')}
function operatorReportHistoryKey(){return 'sadot_report_history_'+(me?.id||me?.username||'operator')}
function getOperatorProfile(){try{return JSON.parse(localStorage.getItem(operatorProfileKey())||'{}')||{}}catch{return {}}}
function getSavedOperatorName(){
  const profile=getOperatorProfile();
  return String(profile?.name||'').trim() || String(me?.username||'DOT Operator').trim();
}
function getSavedOperatorProfileName(){
  const profile=getOperatorProfile();
  return String(profile?.name||'').trim();
}
function readReportHistory(){try{return JSON.parse(localStorage.getItem(operatorReportHistoryKey())||'[]')||[]}catch{return []}}
function writeReportHistory(){localStorage.setItem(operatorReportHistoryKey(),JSON.stringify(reportHistory.slice(0,30)))}
function saveOperatorProfile(){
  const name=$('accountOperatorName')?.value?.trim()||'';
  localStorage.setItem(operatorProfileKey(),JSON.stringify({name,updated_at:new Date().toISOString()}));
  const saved=getSavedOperatorName();
  if($('profileDisplayName'))$('profileDisplayName').textContent=saved||'SA DOT OPERATOR';
  towingReportData.driver.operatorName=saved;
  if($('reportOperatorName'))$('reportOperatorName').value=saved;
  if(typeof signReportData!=='undefined'&&signReportData?.employee){
    signReportData.employee.name=getSavedOperatorProfileName();
    if(currentDiscordReportType==='sign')renderSignCurrentStep();
  }
  currentSignatureSet=null;
  renderAccountPanel();
  if(currentDiscordReportType==='towing')renderDiscordCurrentStep();
  const n=$('accountProfileSaved');if(n){n.textContent='Profile saved. New towing reports and the DOT operator signature will use this name automatically.';n.classList.remove('hidden')}
}
function renderAccountPanel(){
  if(!me||!$('accountPanel'))return;
  reportHistory=readReportHistory();
  const profile=getOperatorProfile();
  if($('accountDesktopUser'))$('accountDesktopUser').textContent=(profile.name?profile.name+' · ':'')+me.username;
  if($('accountChecklistCount'))$('accountChecklistCount').textContent=`${checklistHistory.length} file${checklistHistory.length===1?'':'s'}`;
  if($('accountReportCount'))$('accountReportCount').textContent=`${reportHistory.length} file${reportHistory.length===1?'':'s'}`;
  if($('profileDisplayName'))$('profileDisplayName').textContent=profile.name||'SA DOT OPERATOR';
}
function openAccountPanel(){closeProfileMenu();switchTab('account');runAccountBoot()}
function runAccountBoot(){
  const b=$('accountTabletBoot');if(!b)return;
  b.classList.remove('hidden','account-boot-out');void b.offsetWidth;b.classList.add('account-boot-live');
  setTimeout(()=>b.classList.add('account-boot-out'),1050);
  setTimeout(()=>{b.classList.add('hidden');b.classList.remove('account-boot-live','account-boot-out')},1450);
}
function closeAccountFolder(){$('accountFolderWindow')?.classList.add('hidden')}
function openAccountFolder(type){
  const win=$('accountFolderWindow'),title=$('accountFolderTitle'),path=$('accountFolderPath'),host=$('accountFolderContent');if(!win||!host)return;
  win.classList.remove('hidden');
  if(type==='checklists'){
    title.textContent='Past Checklists';path.textContent='C:/SADOT/ACCOUNT/PAST_CHECKLISTS';
    host.innerHTML=checklistHistory.length?`<div class="account-file-list">${checklistHistory.map((x,i)=>`<button class="account-file" onclick="openAccountChecklist(${i})"><i>✓</i><span><b>${esc(x.unit_number||'UNIT')} · ${esc(x.vehicle||'Vehicle')}</b><small>${new Date(x.completed_at).toLocaleString('en-GB')} · ${Object.values(x.checks||{}).filter(v=>v==='issue').length?'ISSUES RECORDED':'ALL SYSTEMS PASS'}</small></span><em>OPEN ›</em></button>`).join('')}</div>`:'<div class="account-empty-folder">This folder is empty. Completed vehicle inspections will appear here.</div>';
  }else if(type==='reports'){
    reportHistory=readReportHistory();title.textContent='Past Reports';path.textContent='C:/SADOT/ACCOUNT/PAST_REPORTS';
    host.innerHTML=reportHistory.length?`<div class="account-file-list">${reportHistory.map((r,i)=>`<button class="account-file" onclick="openPastReport(${i})"><i>▤</i><span><b>${esc(r.type||'DOT Towing Report')}</b><small>${new Date(r.created_at).toLocaleString('en-GB')} · ${esc(r.vehicle_label||'No vehicle')} · ${esc(r.location_label||'No location')}</small></span><em>OPEN ›</em></button>`).join('')}</div>`:'<div class="account-empty-folder">This folder is empty. Generated Discord reports will be stored here.</div>';
  }else{
    const p=getOperatorProfile();title.textContent='Operator Profile';path.textContent='C:/SADOT/ACCOUNT/PROFILE';
    host.innerHTML=`<div class="account-profile-form"><div class="account-profile-user"><small>SIGNED-IN ACCOUNT</small><b>${esc(me.username)}</b><span>${esc(me.role.toUpperCase())}</span></div><label><span>Operator / Character Name</span><input id="accountOperatorName" value="${esc(p.name||'')}" placeholder="O. Smith"><small>This name prefills DOT Operator Name and is used for your operator signature on generated reports.</small></label><button type="button" onclick="saveOperatorProfile()">SAVE PROFILE</button><div id="accountProfileSaved" class="account-profile-saved hidden"></div></div>`;
  }
}
function openAccountChecklist(index){closeAccountFolder();loadSavedChecklist(index)}
function openPastReport(index){
  reportHistory=readReportHistory();const r=reportHistory[index];if(!r)return;
  if(r.report_kind==='truck_incident'){
    signReportData=JSON.parse(JSON.stringify(r.data||createSignReportDefaults()));currentSignReportRecordId=r.id||null;signReportStep=0;
    switchTab('discord');selectDiscordReportType('sign');renderSignReportStep();return;
  }
  towingReportData=JSON.parse(JSON.stringify(r.data||createTowReportDefaults()));currentSignatureSet=normaliseSignatureSet(r.signatureSet||null);currentReportRecordId=r.id||null;reportStyle=r.style||'operations';
  switchTab('discord');selectDiscordReportType('towing');setReportStyle(reportStyle,false);discordReportStep=0;
  if($('reportOperatorName'))$('reportOperatorName').value=towingReportData.driver.operatorName||getOperatorProfile().name||'';
  if($('reportDate'))$('reportDate').value=towingReportData.driver.date||defaultToday();renderDiscordCurrentStep();
}
function saveCurrentReportToHistory(){
  reportHistory=readReportHistory();const id=currentReportRecordId||('RPT-'+Date.now());currentReportRecordId=id;
  const r={id,type:'DOT Towing Report',created_at:new Date().toISOString(),style:reportStyle,signatureSet:currentSignatureSet,data:JSON.parse(JSON.stringify(towingReportData)),vehicle_label:[towingReportData.vehicle.make,towingReportData.vehicle.model,towingReportData.vehicle.plate].filter(Boolean).join(' ')||'Vehicle not entered',location_label:towingReportData.location.street||towingReportData.location.postal||'Location not entered'};
  const i=reportHistory.findIndex(x=>x.id===id);if(i>=0)reportHistory[i]=r;else reportHistory.unshift(r);writeReportHistory();renderAccountPanel();
}
function setReportStyle(style,rerender=true){
  reportStyle=style==='highway'?'highway':'operations';
  document.querySelectorAll('[data-report-style]').forEach(b=>b.classList.toggle('active',b.dataset.reportStyle===reportStyle));
  if(rerender&&$('discordExportMeta')&&!$('discordExportMeta').classList.contains('hidden'))$('discordExportMeta').textContent='Report style changed. Generate again to apply the new SA DOT variant.';
}

function createTowReportDefaults(){
  return {
    driver:{operatorName:getSavedOperatorName(),date:defaultToday()},
    owner:{ownerName:'',phone:'',license:''},
    vehicle:{make:'',model:'',color:'',plate:''},
    location:{street:'',postal:''},
    reason:{disabled:'N',collision:'N',illegal:'N',abandoned:'N',police:'N',mechanical:'N',roadside:'N',other:''},
    condition:{none:'N',minor:'N',moderate:'N',severe:'N',damageNotes:''},
    details:{pickup:'',dropoff:'',impoundLot:'N',mechanicShop:'N',ownerRequested:'N',policeHold:'N'},
    law:{involved:'N',agency:'',officerName:'',badgeNumber:'',additionalNotes:''},
    signatures:{dotOperator:'',vehicleOwner:'',officerScene:'',completed:'Y',cancelled:'N',pendingInvestigation:'N'}
  };
}
let towingReportData=createTowReportDefaults();
function syncHeaderIntoReportData(){
  towingReportData.driver.operatorName=$('reportOperatorName')?.value?.trim()||'';
  towingReportData.driver.date=$('reportDate')?.value?.trim()||defaultToday();
}
function populateDiscordHeaderFields(){
  if($('discordSignedInUser'))$('discordSignedInUser').textContent=me?.username||'operator';
  const savedName=getSavedOperatorName();
  if(!currentReportRecordId)towingReportData.driver.operatorName=savedName;
  else if(!towingReportData.driver.operatorName)towingReportData.driver.operatorName=savedName;
  if($('reportOperatorName'))$('reportOperatorName').value=towingReportData.driver.operatorName||savedName;
  if($('reportDate'))$('reportDate').value=towingReportData.driver.date||defaultToday();
  ['reportOperatorName','reportDate'].forEach(id=>{
    const el=$(id);if(!el||el.dataset.bound==='1')return;
    el.dataset.bound='1';
    el.addEventListener('input',()=>{syncHeaderIntoReportData();scheduleDiscordPreview('soft');});
  });
}
function escapeValue(v){return esc(v||'');}
function yesNoField(name,label,value){
  return `<label class="discord-yn-field"><span>${label}</span><select data-path="${name}" onchange="updateTowingField(this)"><option value="Y" ${value==='Y'?'selected':''}>Yes</option><option value="N" ${value!=='Y'?'selected':''}>No</option></select></label>`;
}
function textField(name,label,value,placeholder=''){
  return `<label><span>${label}</span><input type="text" data-path="${name}" value="${escapeValue(value)}" placeholder="${escapeValue(placeholder)}" oninput="updateTowingField(this)"></label>`;
}
function textAreaField(name,label,value,placeholder=''){
  return `<label class="wide"><span>${label}</span><textarea data-path="${name}" placeholder="${escapeValue(placeholder)}" oninput="updateTowingField(this)">${escapeValue(value)}</textarea></label>`;
}
function getStepMarkup(stepId){
  const d=towingReportData;
  switch(stepId){
    case 'driver':
      return `<div class="discord-step-panel"><div class="discord-step-title"><small>SECTION 1</small><h4>Driver Information</h4><p>DOT Operator Name is prefilled from Account → Operator Profile. The signed-in account is recorded separately.</p></div><div class="discord-step-grid">${textField('driver.operatorName','DOT Operator Name',d.driver.operatorName,'O. Smith')}${textField('driver.date','Date',d.driver.date,'MM/DD/YYYY')}</div></div>`;
    case 'owner':
      return `<div class="discord-step-panel"><div class="discord-step-title"><small>SECTION 2</small><h4>Vehicle Owner Information</h4><p>Fill in the owner details for the report.</p></div><div class="discord-step-grid">${textField('owner.ownerName','Owner Name',d.owner.ownerName,'John Smith')}${textField('owner.phone','Phone Number',d.owner.phone,'(555) 123-4567')}${textField('owner.license','Driver License Number',d.owner.license,'S1234567')}</div></div>`;
    case 'vehicle':
      return `<div class="discord-step-panel"><div class="discord-step-title"><small>SECTION 3</small><h4>Vehicle Information</h4><p>Capture the core vehicle information.</p></div><div class="discord-step-grid">${textField('vehicle.make','Vehicle Make',d.vehicle.make,'BMW')}${textField('vehicle.model','Vehicle Model',d.vehicle.model,'M3')}${textField('vehicle.color','Vehicle Color',d.vehicle.color,'Blue')}${textField('vehicle.plate','Vehicle Plate Number',d.vehicle.plate,'XYZ123')}</div></div>`;
    case 'location':
      return `<div class="discord-step-panel"><div class="discord-step-title"><small>SECTION 4</small><h4>Incident Location</h4><p>Set the location where the tow originated.</p></div><div class="discord-step-grid">${textField('location.street','Street / Highway',d.location.street,'Route 68 / Marina Dr')}${textField('location.postal','Nearest Postal',d.location.postal,'3012')}</div></div>`;
    case 'reason':
      return `<div class="discord-step-panel"><div class="discord-step-title"><small>SECTION 5</small><h4>Reason for Tow</h4><p>Select all reasons that apply. Use Other for anything outside the main list.</p></div><div class="discord-step-grid yn-grid">${yesNoField('reason.disabled','Disabled Vehicle',d.reason.disabled)}${yesNoField('reason.collision','Traffic Collision',d.reason.collision)}${yesNoField('reason.illegal','Illegal Parking',d.reason.illegal)}${yesNoField('reason.abandoned','Abandoned Vehicle',d.reason.abandoned)}${yesNoField('reason.police','Police Impound Request',d.reason.police)}${yesNoField('reason.mechanical','Mechanical Failure',d.reason.mechanical)}${yesNoField('reason.roadside','Roadside Assistance',d.reason.roadside)}${textField('reason.other','Other',d.reason.other,'Optional')}</div></div>`;
    case 'condition':
      return `<div class="discord-step-panel"><div class="discord-step-title"><small>SECTION 6</small><h4>Vehicle Condition</h4><p>Mark the condition and add damage notes if needed.</p></div><div class="discord-step-grid yn-grid">${yesNoField('condition.none','No Visible Damage',d.condition.none)}${yesNoField('condition.minor','Minor Damage',d.condition.minor)}${yesNoField('condition.moderate','Moderate Damage',d.condition.moderate)}${yesNoField('condition.severe','Severe Damage',d.condition.severe)}${textAreaField('condition.damageNotes','Damage Notes',d.condition.damageNotes,'Describe any visible damage')}</div></div>`;
    case 'details':
      return `<div class="discord-step-panel"><div class="discord-step-title"><small>SECTION 7</small><h4>Tow Details</h4><p>Record pickup and drop-off details.</p></div><div class="discord-step-grid yn-grid">${textField('details.pickup','Pickup Location',d.details.pickup,'Route 68 Shoulder')}${textField('details.dropoff','Drop-Off Location',d.details.dropoff,'Sandy Shores Impound')}${yesNoField('details.impoundLot','Impound Lot',d.details.impoundLot)}${yesNoField('details.mechanicShop','Mechanic Shop',d.details.mechanicShop)}${yesNoField('details.ownerRequested','Owner Requested Location',d.details.ownerRequested)}${yesNoField('details.policeHold','Police Hold',d.details.policeHold)}</div></div>`;
    case 'law':
      const show=d.law.involved==='Y';
      return `<div class="discord-step-panel"><div class="discord-step-title"><small>SECTION 8</small><h4>Law Enforcement Involvement</h4><p>If law enforcement was involved, turn this on and fill in the details.</p></div><div class="discord-step-grid yn-grid">${yesNoField('law.involved','Law Enforcement Involvement',d.law.involved)}</div><div class="discord-conditional-block ${show?'':'hidden'}" id="lawFieldsBlock"><div class="discord-step-grid">${textField('law.agency','Agency',d.law.agency,'LSPD / BCSO / SASP')}${textField('law.officerName','Officer Name',d.law.officerName,'O. Smith')}${textField('law.badgeNumber','Badge Number',d.law.badgeNumber,'5372')}${textAreaField('law.additionalNotes','Additional Notes',d.law.additionalNotes,'Optional notes')}</div></div></div>`;
    case 'signatures':
      return `<div class="discord-step-panel"><div class="discord-step-title"><small>SECTION 9</small><h4>Report Status & Auto Signatures</h4><p>The DOT operator signature is generated from the name saved in Account → Operator Profile. Owner and officer signatures use the random signature pool.</p></div><div class="discord-step-grid yn-grid">${yesNoField('signatures.completed','Completed',d.signatures.completed)}${yesNoField('signatures.cancelled','Cancelled',d.signatures.cancelled)}${yesNoField('signatures.pendingInvestigation','Pending Investigation',d.signatures.pendingInvestigation)}</div><div class="discord-signature-preview" id="discordSignaturePreview"><div><small>DOT Operator Signature</small><span id="sigPreviewOperatorName" class="profile-signature-preview">${escapeValue(getSavedOperatorName())}</span><em>From saved account name</em></div><div><small>Vehicle Owner Signature</small><img id="sigPreviewOwner" alt="Vehicle owner signature preview"><em>Random signature style</em></div><div><small>Officer on Scene Signature</small><img id="sigPreviewOfficer" alt="Officer signature preview"><em>${d.law.involved==='Y'?'Random signature style':'Not required'}</em></div></div><div class="discord-signature-tools"><button type="button" class="discord-nav secondary" onclick="shuffleSignatureSet()">Shuffle Owner / Officer Signatures</button><span>Operator signature always follows the saved account name.</span></div></div>`;
    default:return '';
  }
}
function getPreviewText(){
  syncHeaderIntoReportData();
  const d=towingReportData;
  const yes=v=>v==='Y'?'Yes':'No';
  const reasonRows=[
    `Disabled Vehicle: ${yes(d.reason.disabled)}`,
    `Traffic Collision: ${yes(d.reason.collision)}`,
    `Illegal Parking: ${yes(d.reason.illegal)}`,
    `Abandoned Vehicle: ${yes(d.reason.abandoned)}`,
    `Police Impound Request: ${yes(d.reason.police)}`,
    `Mechanical Failure: ${yes(d.reason.mechanical)}`,
    `Roadside Assistance: ${yes(d.reason.roadside)}`,
    `Other: ${d.reason.other||'—'}`
  ];
  const conditionRows=[
    `No Visible Damage: ${yes(d.condition.none)}`,
    `Minor Damage: ${yes(d.condition.minor)}`,
    `Moderate Damage: ${yes(d.condition.moderate)}`,
    `Severe Damage: ${yes(d.condition.severe)}`,
    `Damage Notes: ${d.condition.damageNotes||'—'}`
  ];
  const towRows=[
    `Pickup Location: ${d.details.pickup||'—'}`,
    `Drop-Off Location: ${d.details.dropoff||'—'}`,
    `Impound Lot: ${yes(d.details.impoundLot)}`,
    `Mechanic Shop: ${yes(d.details.mechanicShop)}`,
    `Owner Requested Location: ${yes(d.details.ownerRequested)}`,
    `Police Hold: ${yes(d.details.policeHold)}`
  ];
  const lawRows = d.law.involved==='Y'
    ? [`Law Enforcement Involvement: Yes`,`Agency: ${d.law.agency||'—'}`,`Officer Name: ${d.law.officerName||'—'}`,`Badge Number: ${d.law.badgeNumber||'—'}`,`Additional Notes: ${d.law.additionalNotes||'—'}`]
    : [`Law Enforcement Involvement: No`];
  const statusRows=[`Completed: ${yes(d.signatures.completed)}`,`Cancelled: ${yes(d.signatures.cancelled)}`,`Pending Investigation: ${yes(d.signatures.pendingInvestigation)}`];
  return [
    'SADOT TOWING REPORT',
    '',
    '[Driver Information]',
    `Signed In User: ${me?.username||'operator'}`,
    `DOT Operator Name: ${d.driver.operatorName||'—'}`,
    `Date: ${d.driver.date||'—'}`,
    '',
    '[Vehicle Owner Information]',
    `Owner Name: ${d.owner.ownerName||'—'}`,
    `Phone Number: ${d.owner.phone||'—'}`,
    `Driver License Number: ${d.owner.license||'—'}`,
    '',
    '[Vehicle Information]',
    `Vehicle Make: ${d.vehicle.make||'—'}`,
    `Vehicle Model: ${d.vehicle.model||'—'}`,
    `Vehicle Color: ${d.vehicle.color||'—'}`,
    `Vehicle Plate Number: ${d.vehicle.plate||'—'}`,
    '',
    '[Incident Location]',
    `Street/Highway: ${d.location.street||'—'}`,
    `Nearest Postal: ${d.location.postal||'—'}`,
    '',
    '[Reason for Tow]',
    ...reasonRows,
    '',
    '[Vehicle Condition]',
    ...conditionRows,
    '',
    '[Tow Details]',
    ...towRows,
    '',
    '[Law Enforcement Involvement]',
    ...lawRows,
    '',
    '[Signatures]',
    `DOT Operator: ${getSavedOperatorName()} (account signature)`,
    `Vehicle Owner: Auto-generated signature`,
    `Officer on scene: ${d.law.involved==='Y' ? 'Auto-generated signature' : 'N/A'}`,
    '',
    '[Report Status]',
    ...statusRows
  ].join('\n');
}
function setDiscordPreviewStatus(text){
  const el=$('discordPreviewStatus'); if(el) el.textContent=text;
}
function updateDiscordPreviewControls(){
  const btn=$('discordPreviewAutoBtn');
  if(!btn)return;
  btn.textContent=`Auto Preview: ${discordPreviewAuto?'ON':'OFF'}`;
  btn.classList.toggle('active',discordPreviewAuto);
}
function animateDiscordTypeText(text,mode='soft'){
  const box=$('discordTypePreview');
  if(!box)return;
  if(discordTypeTimer){clearInterval(discordTypeTimer); discordTypeTimer=null;}
  if(mode!=='type'){
    box.textContent=text;
    box.scrollTop=0;
    return;
  }
  box.textContent='';
  let i=0;
  discordTypeTimer=setInterval(()=>{
    box.textContent=text.slice(0,i);
    box.scrollTop=box.scrollHeight;
    i+=4;
    if(i>text.length){clearInterval(discordTypeTimer); discordTypeTimer=null; box.textContent=text;}
  },9);
}
function renderDiscordTypePreview(mode='soft'){
  const text=getPreviewText();
  animateDiscordTypeText(text,mode);
}
function scheduleDiscordPreview(mode='soft'){
  if(discordPreviewDebounce){clearTimeout(discordPreviewDebounce);discordPreviewDebounce=null;}
  if(!discordPreviewAuto){setDiscordPreviewStatus('AUTO PREVIEW PAUSED');return;}
  setDiscordPreviewStatus('SYNCING PREVIEW...');
  discordPreviewDebounce=setTimeout(()=>{
    renderDiscordTypePreview(mode);
    setDiscordPreviewStatus('LIVE PREVIEW UPDATED');
    setTimeout(()=>{ if(discordPreviewAuto) setDiscordPreviewStatus('AUTO-SYNC ACTIVE'); },900);
  },650);
}
function toggleDiscordAutoPreview(){
  discordPreviewAuto=!discordPreviewAuto;
  updateDiscordPreviewControls();
  if(discordPreviewAuto){
    setDiscordPreviewStatus('AUTO-SYNC ACTIVE');
    scheduleDiscordPreview('soft');
  }else{
    if(discordPreviewDebounce){clearTimeout(discordPreviewDebounce);discordPreviewDebounce=null;}
    setDiscordPreviewStatus('AUTO PREVIEW PAUSED');
  }
}
function manualDiscordPreviewRefresh(){
  if(discordPreviewDebounce){clearTimeout(discordPreviewDebounce);discordPreviewDebounce=null;}
  renderDiscordTypePreview('type');
  setDiscordPreviewStatus('MANUAL REFRESH COMPLETE');
  setTimeout(()=>{ if(discordPreviewAuto) setDiscordPreviewStatus('AUTO-SYNC ACTIVE'); },1000);
}
async function copyDiscordPreviewAll(){
  // Copy the full generated text, not whatever point the typing animation is currently at.
  const text=getPreviewText();
  const btn=$('discordPreviewCopyBtn');
  const original=btn?.textContent||'Copy All';
  let copied=false;

  try{
    if(navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(text);
      copied=true;
    }
  }catch(_){ copied=false; }

  if(!copied){
    const area=document.createElement('textarea');
    area.value=text;
    area.setAttribute('readonly','');
    area.style.position='fixed';
    area.style.opacity='0';
    area.style.pointerEvents='none';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0,area.value.length);
    try{ copied=document.execCommand('copy'); }catch(_){ copied=false; }
    area.remove();
  }

  if(btn){
    btn.textContent=copied?'Copied ✓':'Copy Failed';
    btn.classList.toggle('copied',copied);
    btn.classList.toggle('copy-failed',!copied);
    setTimeout(()=>{
      btn.textContent=original;
      btn.classList.remove('copied','copy-failed');
    },1400);
  }
  setDiscordPreviewStatus(copied?'FULL REPORT COPIED TO CLIPBOARD':'COPY FAILED');
  setTimeout(()=>{
    setDiscordPreviewStatus(discordPreviewAuto?'AUTO-SYNC ACTIVE':'AUTO PREVIEW PAUSED');
  },1400);
}
function renderDiscordStepTabs(){
  const host=$('discordStepTabs'); if(!host)return;
  host.innerHTML=DISCORD_TOW_STEPS.map((s,idx)=>`<button type="button" class="discord-step-chip ${idx===discordReportStep?'active':''}" onclick="goToDiscordReportStep(${idx})">${idx+1}. ${s.label}</button>`).join('');
}
function renderDiscordCurrentStep(){
  if(currentDiscordReportType!=='towing') return;
  const step=DISCORD_TOW_STEPS[discordReportStep];
  const stepCount=DISCORD_TOW_STEPS.length;
  const percent=Math.round(((discordReportStep+1)/stepCount)*100);
  if($('discordStepCounter')) $('discordStepCounter').textContent=`STEP ${discordReportStep+1} / ${stepCount}`;
  if($('discordProgressFill')) $('discordProgressFill').style.width=`${((discordReportStep+1)/stepCount)*100}%`;
  if($('discordStepPercent')) $('discordStepPercent').textContent=`${percent}%`;
  if($('discordSectionIndex')) $('discordSectionIndex').textContent=`${discordReportStep+1} / ${stepCount}`;
  if($('discordSectionLabel')) $('discordSectionLabel').textContent=step.label;
  if($('discordSectionHint')) $('discordSectionHint').textContent=discordReportStep===stepCount-1?'Finalise the report status, preview the signatures and export your Discord image.':'Answer this section, then continue to the next task on the tablet.';
  const stepMarkup=getStepMarkup(step.id);
  if($('discordStepContent')) $('discordStepContent').innerHTML=`
    <div class="discord-step-tablet-shell discord-step-enter booting" id="discordStepShell">
      <div class="discord-step-tablet-camera"></div>
      <div class="discord-step-boot-overlay" id="discordStepBootOverlay">
        <div class="discord-step-boot-card">
          <small>SA DOT TABLET</small>
          <b>Loading ${step.label}</b>
          <span>Preparing interactive section ${discordReportStep+1} of ${stepCount}</span>
          <div class="discord-step-boot-progress"><i></i></div>
        </div>
      </div>
      <div class="discord-step-tablet-screen">
        <div class="discord-step-stage-header">
          <div>
            <small>SECTION ${discordReportStep+1}</small>
            <b>${step.label}</b>
          </div>
          <div class="discord-step-stage-chip">TASK READY</div>
        </div>
        <div class="discord-step-stage-copy">Work through the questions below and move to the next screen when complete.</div>
        <div class="discord-step-tablet-screen-inner">${stepMarkup}</div>
      </div>
    </div>`;

  if(discordStepBootTimer){ clearTimeout(discordStepBootTimer); discordStepBootTimer = null; }
  discordStepBootTimer = setTimeout(()=>{
    const shell=$('discordStepShell');
    const overlay=$('discordStepBootOverlay');
    if(shell) shell.classList.remove('booting');
    if(shell) shell.classList.add('ready');
    if(overlay) overlay.classList.add('hide');
  }, 700);

  if($('discordPrevBtn')) $('discordPrevBtn').disabled=discordReportStep===0;
  if($('discordNextBtn')) $('discordNextBtn').textContent=discordReportStep===stepCount-1?'Review & Finish →':'Continue →';
  renderDiscordStepTabs();
  renderDiscordTypePreview('type');
  setDiscordPreviewStatus('AUTO-SYNC ACTIVE');
  updateDiscordPreviewControls();
  if(step.id==='signatures'){ if(!currentSignatureSet) shuffleSignatureSet(); else applySignaturePreview(); }
}

function initTowingReportBuilder(){
  currentDiscordReportType='towing';
  if(!towingReportData)towingReportData=createTowReportDefaults();
  if(!currentReportRecordId)towingReportData.driver.operatorName=getSavedOperatorName();
  else if(!towingReportData.driver.operatorName)towingReportData.driver.operatorName=getSavedOperatorName();
  if(!towingReportData.driver.date)towingReportData.driver.date=defaultToday();
  populateDiscordHeaderFields();
  syncHeaderIntoReportData();
  updateDiscordPreviewControls();
  renderDiscordCurrentStep();
}

function goToDiscordReportStep(idx){
  syncHeaderIntoReportData();
  discordReportStep=Math.max(0,Math.min(DISCORD_TOW_STEPS.length-1,idx));
  renderDiscordCurrentStep();
}
function nextDiscordReportStep(){ if(discordReportStep<DISCORD_TOW_STEPS.length-1){ discordReportStep++; renderDiscordCurrentStep(); } else { renderDiscordTypePreview(); setDiscordPreviewStatus('REPORT READY FOR EXPORT'); document.querySelector('.export-card')?.scrollIntoView({behavior:'smooth',block:'nearest'}); } }
function prevDiscordReportStep(){ if(discordReportStep>0){ discordReportStep--; renderDiscordCurrentStep(); } }
function setByPath(obj,path,val){
  const parts=path.split('.'); let t=obj;
  while(parts.length>1){ const p=parts.shift(); if(!(p in t)) t[p]={}; t=t[p]; }
  t[parts[0]]=val;
}
function updateTowingField(el){
  const path=el.dataset.path; if(!path) return;
  setByPath(towingReportData,path,el.value);
  if(path==='law.involved'){ renderDiscordCurrentStep(); applySignaturePreview(); scheduleDiscordPreview('soft'); return; }
  scheduleDiscordPreview('soft');
}


/* v4.35.25 DOT Truck Incident Report */
const SIGN_REPORT_STEPS=[
  {id:'datetime',label:'Date & Time'},
  {id:'employee',label:'Operator Details'},
  {id:'location',label:'Location'},
  {id:'incident',label:'Incident Type'},
  {id:'vehicle',label:'Vehicle / Actions'}
];
let signReportStep=0;
let signReportPreviewTimer=null;
let signReportBootTimer=null;
let currentSignReportRecordId=null;
const defaultTime=()=>new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false});
function createSignReportDefaults(){
  return {
    meta:{date:defaultToday(),time:defaultTime()},
    employee:{unit:String(me?.username||'DOT').trim(),name:getSavedOperatorProfileName()},
    location:{postal:'',street:''},
    incident:{disabled:'N',trafficControl:'N',roadHazard:'N',accidentAssistance:'N',roadClosure:'N',debrisRemoval:'N'},
    vehicle:{vehicle:'',plate:''},
    request:{agency:''},
    closure:{road:'',left:'N',right:'N',all:'N'},
    actions:''
  };
}
let signReportData=createSignReportDefaults();
function ensureSignReportPrefills(force=false){
  if(!signReportData)signReportData=createSignReportDefaults();
  if(force||!signReportData.meta.date)signReportData.meta.date=defaultToday();
  if(force||!signReportData.meta.time)signReportData.meta.time=defaultTime();
  if(force||!signReportData.employee.name)signReportData.employee.name=getSavedOperatorProfileName();
  if(force||!signReportData.employee.unit)signReportData.employee.unit=String(me?.username||'DOT').trim();
}
function signReadOnlyField(label,value){return `<label><span>${label}</span><input class="discord-system-prefill" type="text" value="${escapeValue(value)}" readonly></label>`}
function signTextField(path,label,value,placeholder=''){return `<label><span>${label}</span><input type="text" data-sign-path="${path}" value="${escapeValue(value)}" placeholder="${escapeValue(placeholder)}" oninput="updateSignReportField(this)"></label>`}
function signTextArea(path,label,value,placeholder=''){return `<label class="wide"><span>${label}</span><textarea data-sign-path="${path}" placeholder="${escapeValue(placeholder)}" oninput="updateSignReportField(this)">${escapeValue(value)}</textarea></label>`}
function signYesNo(path,label,value){return `<label class="discord-yn-field"><span>${label}</span><select data-sign-path="${path}" onchange="updateSignReportField(this)"><option value="Y" ${value==='Y'?'selected':''}>Yes</option><option value="N" ${value!=='Y'?'selected':''}>No</option></select></label>`}
function signAgencyField(value){
  const opts=['','LSCSO','LSPD','SAST','SAFR','BCSO'];
  return `<label class="wide"><span>Requested By</span><select data-sign-path="request.agency" onchange="updateSignReportField(this)">${opts.map(o=>`<option value="${o}" ${value===o?'selected':''}>${o||'Select requesting agency...'}</option>`).join('')}</select></label>`;
}
function getSignStepMarkup(id){
  const d=signReportData;
  if(id==='datetime')return `<div class="discord-step-panel"><div class="discord-step-title"><small>SECTION 1</small><h4>Date & Time</h4><p>The report date and current time are filled automatically when the report is opened.</p></div><div class="discord-step-grid">${signReadOnlyField('Date',d.meta.date)}${signReadOnlyField('Time',d.meta.time)}</div></div>`;
  if(id==='employee'){const savedName=getSavedOperatorProfileName();return `<div class="discord-step-panel"><div class="discord-step-title"><small>SECTION 2</small><h4>Operator Details</h4><p>Unit Number comes from the signed-in DOT account. Name comes only from Account → Operator Profile.</p></div><div class="discord-step-grid">${signReadOnlyField('Unit Number',d.employee.unit)}${signReadOnlyField('Name',savedName||'No profile name saved')}</div>${savedName?'':`<div class="discord-profile-name-warning">No operator name is saved for this account. Open <b>Account → Operator Profile</b> and save the character name once, then new incident reports will prefill it here.</div>`}</div>`;}
  if(id==='location')return `<div class="discord-step-panel"><div class="discord-step-title"><small>SECTION 3</small><h4>Location</h4><p>Record the nearest postal and the street or road where the incident took place.</p></div><div class="discord-step-grid">${signTextField('location.postal','Postal',d.location.postal,'3000')}${signTextField('location.street','Street',d.location.street,'Route 68 / Senora Fwy')}</div></div>`;
  if(id==='incident')return `<div class="discord-step-panel"><div class="discord-step-title"><small>SECTION 4</small><h4>Incident Type</h4><p>Mark every incident type that applies to the call.</p></div><div class="discord-step-grid yn-grid">${signYesNo('incident.disabled','Disabled Vehicle',d.incident.disabled)}${signYesNo('incident.trafficControl','Traffic Control',d.incident.trafficControl)}${signYesNo('incident.roadHazard','Road Hazard',d.incident.roadHazard)}${signYesNo('incident.accidentAssistance','Accident Assistance',d.incident.accidentAssistance)}${signYesNo('incident.roadClosure','Road Closure',d.incident.roadClosure)}${signYesNo('incident.debrisRemoval','Debris Removal',d.incident.debrisRemoval)}</div></div>`;
  return `<div class="discord-step-panel"><div class="discord-step-title"><small>SECTION 5</small><h4>Vehicle Information & Actions Taken</h4><p>Finish the incident record with the vehicle, requesting agency, lane closure and action taken.</p></div><div class="discord-step-grid">${signTextField('vehicle.vehicle','Vehicle',d.vehicle.vehicle,'Bravado Buffalo / Vehicle description')}${signTextField('vehicle.plate','Plate',d.vehicle.plate,'ABC123')}${signAgencyField(d.request.agency)}${signTextField('closure.road','What lane / road was shut down?',d.closure.road,'e.g. Northbound Senora Fwy')}${signYesNo('closure.left','Left',d.closure.left)}${signYesNo('closure.right','Right',d.closure.right)}${signYesNo('closure.all','ALL',d.closure.all)}${signTextArea('actions','Actions Taken',d.actions,'Describe traffic control, signs placed, debris removed, assistance provided, reopening of road, etc.')}</div></div>`;
}
function updateSignReportField(el){
  const path=el.dataset.signPath;if(!path)return;
  setByPath(signReportData,path,el.value);
  scheduleSignPreview();
}
function signIncidentLabels(){
  const d=signReportData.incident,rows=[];
  if(d.disabled==='Y')rows.push('Disabled Vehicle');if(d.trafficControl==='Y')rows.push('Traffic Control');if(d.roadHazard==='Y')rows.push('Road Hazard');if(d.accidentAssistance==='Y')rows.push('Accident Assistance');if(d.roadClosure==='Y')rows.push('Road Closure');if(d.debrisRemoval==='Y')rows.push('Debris Removal');
  return rows;
}
function signLaneLabels(){const c=signReportData.closure,r=[];if(c.left==='Y')r.push('Left');if(c.right==='Y')r.push('Right');if(c.all==='Y')r.push('ALL');return r}
function getSignPreviewText(){
  ensureSignReportPrefills(false);const d=signReportData,yn=v=>v==='Y'?'Yes':'No';
  return [
    'SA DOT TRUCK INCIDENT REPORT','',
    '[Date / Time]',`Date: ${d.meta.date}`,`Time: ${d.meta.time}`,'',
    '[Operator Details]',`Unit Number: ${d.employee.unit}`,`Name: ${d.employee.name||'—'}`,'',
    '[Location]',`Postal: ${d.location.postal||'—'}`,`Street: ${d.location.street||'—'}`,'',
    '[Incident Type]',`Disabled Vehicle: ${yn(d.incident.disabled)}`,`Traffic Control: ${yn(d.incident.trafficControl)}`,`Road Hazard: ${yn(d.incident.roadHazard)}`,`Accident Assistance: ${yn(d.incident.accidentAssistance)}`,`Road Closure: ${yn(d.incident.roadClosure)}`,`Debris Removal: ${yn(d.incident.debrisRemoval)}`,'',
    '[Vehicle Information]',`Vehicle: ${d.vehicle.vehicle||'—'}`,`Plate: ${d.vehicle.plate||'—'}`,`Requested By: ${d.request.agency||'—'}`,'',
    '[Lane / Road Closure]',`What lane / road was shut down?: ${d.closure.road||'—'}`,`Left: ${yn(d.closure.left)}`,`Right: ${yn(d.closure.right)}`,`ALL: ${yn(d.closure.all)}`,'',
    '[Actions Taken]',d.actions||'—'
  ].join('\n');
}
function setSignPreviewStatus(text){const el=$('signPreviewStatus');if(el)el.textContent=text}
function renderSignPreview(mode='soft'){
  const box=$('signTypePreview');if(!box)return;const text=getSignPreviewText();
  if(signReportPreviewTimer){clearInterval(signReportPreviewTimer);signReportPreviewTimer=null}
  if(mode!=='type'){box.textContent=text;box.scrollTop=0;return}
  box.textContent='';let i=0;signReportPreviewTimer=setInterval(()=>{box.textContent=text.slice(0,i);i+=5;if(i>text.length){clearInterval(signReportPreviewTimer);signReportPreviewTimer=null;box.textContent=text}},8);
}
let signPreviewDebounce=null;
function scheduleSignPreview(){if(signPreviewDebounce)clearTimeout(signPreviewDebounce);setSignPreviewStatus('SYNCING REPORT FEED...');signPreviewDebounce=setTimeout(()=>{renderSignPreview('soft');setSignPreviewStatus('REPORT FEED UPDATED');setTimeout(()=>setSignPreviewStatus('REPORT FEED READY'),750)},550)}
async function copySignPreviewAll(){
  const text=getSignPreviewText(),btn=$('signPreviewCopyBtn'),original=btn?.textContent||'Copy All';let copied=false;
  try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);copied=true}}catch(_){}
  if(!copied){const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();try{copied=document.execCommand('copy')}catch(_){}area.remove()}
  if(btn){btn.textContent=copied?'Copied ✓':'Copy Failed';btn.classList.toggle('copied',copied);setTimeout(()=>{btn.textContent=original;btn.classList.remove('copied')},1300)}
  setSignPreviewStatus(copied?'FULL REPORT COPIED':'COPY FAILED');setTimeout(()=>setSignPreviewStatus('REPORT FEED READY'),1300);
}
function renderSignTabs(){const host=$('signStepTabs');if(!host)return;host.innerHTML=SIGN_REPORT_STEPS.map((s,i)=>`<button type="button" class="discord-step-chip ${i===signReportStep?'active':''}" onclick="goToSignReportStep(${i})">${i+1}. ${s.label}</button>`).join('')}
function renderSignReportStep(){
  if(currentDiscordReportType!=='sign')return;ensureSignReportPrefills(false);
  const step=SIGN_REPORT_STEPS[signReportStep],count=SIGN_REPORT_STEPS.length,pct=Math.round(((signReportStep+1)/count)*100);
  if($('signStepCounter'))$('signStepCounter').textContent=`STEP ${signReportStep+1} / ${count}`;
  if($('signProgressFill'))$('signProgressFill').style.width=`${pct}%`;
  if($('signStepPercent'))$('signStepPercent').textContent=`${pct}%`;if($('signSectionIndex'))$('signSectionIndex').textContent=`${signReportStep+1} / ${count}`;
  if($('signSectionLabel'))$('signSectionLabel').textContent=step.label;
  if($('signSectionHint'))$('signSectionHint').textContent=signReportStep===count-1?'Complete the vehicle, agency, closure and actions taken, then export the report.':'Complete this screen, then press Continue to load the next section.';
  const host=$('signStepContent');if(host)host.innerHTML=`<div class="discord-step-tablet-shell discord-step-enter booting" id="signStepShell"><div class="discord-step-tablet-camera"></div><div class="discord-step-boot-overlay" id="signStepBootOverlay"><div class="discord-step-boot-card"><small>SA DOT INCIDENT TABLET</small><b>Loading ${step.label}</b><span>Opening section ${signReportStep+1} of ${count}</span><div class="discord-step-boot-progress"><i></i></div></div></div><div class="discord-step-tablet-screen"><div class="discord-step-stage-header"><div><small>SECTION ${signReportStep+1}</small><b>${step.label}</b></div><div class="discord-step-stage-chip">TASK READY</div></div><div class="discord-step-stage-copy">Complete the questions on this screen, then continue.</div><div class="discord-step-tablet-screen-inner">${getSignStepMarkup(step.id)}</div></div></div>`;
  if(signReportBootTimer)clearTimeout(signReportBootTimer);signReportBootTimer=setTimeout(()=>{const shell=$('signStepShell'),overlay=$('signStepBootOverlay');shell?.classList.remove('booting');shell?.classList.add('ready');overlay?.classList.add('hide')},700);
  if($('signPrevBtn'))$('signPrevBtn').disabled=signReportStep===0;if($('signNextBtn'))$('signNextBtn').textContent=signReportStep===count-1?'Review & Finish →':'Continue →';
  renderSignTabs();renderSignPreview('type');setSignPreviewStatus('REPORT FEED READY');
}
function initSignTruckReportBuilder(){currentDiscordReportType='sign';if(!signReportData)signReportData=createSignReportDefaults();ensureSignReportPrefills(!currentSignReportRecordId);renderSignReportStep()}
function goToSignReportStep(i){signReportStep=Math.max(0,Math.min(SIGN_REPORT_STEPS.length-1,i));renderSignReportStep()}
function nextSignReportStep(){if(signReportStep<SIGN_REPORT_STEPS.length-1){signReportStep++;renderSignReportStep()}else{renderSignPreview('soft');setSignPreviewStatus('REPORT READY FOR EXPORT');document.querySelector('.sign-export-card')?.scrollIntoView({behavior:'smooth',block:'nearest'})}}
function prevSignReportStep(){if(signReportStep>0){signReportStep--;renderSignReportStep()}}
function saveSignReportToHistory(){
  reportHistory=readReportHistory();const id=currentSignReportRecordId||('TRK-'+Date.now());currentSignReportRecordId=id;
  const d=signReportData,r={id,report_kind:'truck_incident',type:'DOT Truck Incident Report',created_at:new Date().toISOString(),data:JSON.parse(JSON.stringify(d)),vehicle_label:[d.vehicle.vehicle,d.vehicle.plate].filter(Boolean).join(' · ')||'Vehicle not entered',location_label:[d.location.street,d.location.postal&&('Postal '+d.location.postal)].filter(Boolean).join(' · ')||'Location not entered'};
  const i=reportHistory.findIndex(x=>x.id===id);if(i>=0)reportHistory[i]=r;else reportHistory.unshift(r);writeReportHistory();renderAccountPanel();
}
async function generateTruckIncidentReportImage(){
  const meta=$('signExportMeta');
  try{
    ensureSignReportPrefills(false);const d=signReportData,p=reportPalette(),yes=v=>v==='Y'?'Yes':'No';
    const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=1620;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas is unavailable in this browser');
    ctx.fillStyle=p.bg;ctx.fillRect(0,0,canvas.width,canvas.height);
    const grad=ctx.createLinearGradient(0,0,1400,0);grad.addColorStop(0,p.panel2);grad.addColorStop(1,p.bg);ctx.fillStyle=grad;ctx.fillRect(0,0,1400,188);ctx.fillStyle=p.accent;ctx.fillRect(0,0,18,188);
    fillStroke(ctx,58,40,150,62,p.accent,null,7);reportText(ctx,'SA DOT',88,82,31,900,'#111');reportText(ctx,'DOT TRUCK INCIDENT REPORT',245,76,37,900,p.text);reportText(ctx,'SAN ANDREAS DEPARTMENT OF TRANSPORTATION · FIELD OPERATIONS',247,111,15,700,p.muted);
    fillStroke(ctx,1090,38,245,94,p.panel,p.line,16);reportText(ctx,'UNIT',1113,66,12,800,p.muted);reportText(ctx,d.employee.unit.toUpperCase(),1113,102,27,900,p.text);reportText(ctx,`${d.meta.date} · ${d.meta.time}`,1113,126,13,700,p.subtle);

    fillStroke(ctx,58,218,1277,172,p.panel,p.line,20);reportText(ctx,'INCIDENT SUMMARY',82,252,13,900,p.accent);const types=signIncidentLabels();reportText(ctx,types[0]||'Incident type pending',82,301,30,900,p.text);reportText(ctx,types.length>1?types.slice(1).join(' · '):'SA DOT field response',82,334,15,700,p.muted);
    ctx.fillStyle=p.line;ctx.fillRect(520,246,2,116);reportText(ctx,'LOCATION',554,264,12,800,p.subtle);reportText(ctx,d.location.street||'Street not recorded',554,301,23,800,p.text);reportText(ctx,d.location.postal?`Postal ${d.location.postal}`:'Postal not recorded',554,332,15,700,p.muted);
    ctx.fillStyle=p.line;ctx.fillRect(1000,246,2,116);reportText(ctx,'OPERATOR DETAILS',1030,264,12,800,p.subtle);reportText(ctx,d.employee.name||getSavedOperatorName(),1030,301,21,800,p.text);reportText(ctx,d.employee.unit,1030,332,14,700,p.muted);

    const left=58,right=712,w=623;
    drawChoiceCard(ctx,'Incident Type',[[ 'Disabled Vehicle',yes(d.incident.disabled)],[ 'Traffic Control',yes(d.incident.trafficControl)],[ 'Road Hazard',yes(d.incident.roadHazard)],[ 'Accident Assistance',yes(d.incident.accidentAssistance)],[ 'Road Closure',yes(d.incident.roadClosure)],[ 'Debris Removal',yes(d.incident.debrisRemoval)]],undefined,left,420,w,240,p);
    drawKVCard(ctx,'Vehicle / Request',[[ 'Vehicle',d.vehicle.vehicle||'—'],['Plate',d.vehicle.plate||'—'],['Requested By',d.request.agency||'—']],right,420,w,240,p);

    drawChoiceCard(ctx,'Lane / Road Closure',[[ 'Left',yes(d.closure.left)],[ 'Right',yes(d.closure.right)],[ 'ALL',yes(d.closure.all)]],d.closure.road||'No lane / road entered',left,684,w,244,p);
    fillStroke(ctx,right,684,w,244,p.panel,p.line,18);reportCardTitle(ctx,'Actions Taken',right,684,w,p);ctx.fillStyle=p.text;ctx.font='500 17px Arial';reportWrap(ctx,d.actions||'No actions entered',right+22,759,w-44,27,6);

    fillStroke(ctx,58,952,1277,180,p.panel,p.line,18);reportCardTitle(ctx,'Operational Record',58,952,1277,p);
    const chips=[['DATE',d.meta.date],['TIME',d.meta.time],['UNIT',d.employee.unit],['AGENCY',d.request.agency||'—']];const cw=290,g=18;chips.forEach((x,i)=>drawSummaryChip(ctx,x[0],x[1],82+i*(cw+g),1018,cw,p));

    ctx.fillStyle=p.line;ctx.fillRect(58,1180,1277,2);reportText(ctx,'SA DOT · TRUCK / TRAFFIC CONTROL INCIDENT RECORD',58,1220,13,800,p.subtle);reportText(ctx,'Generated from the DOT Operator Tablet',1014,1220,13,700,p.subtle);reportText(ctx,`Report Ref: ${currentSignReportRecordId||'TRK-'+String(Date.now()).slice(-6)}`,58,1252,12,700,p.subtle);
    reportText(ctx,'Operator',58,1305,11,800,p.subtle);reportText(ctx,d.employee.name||getSavedOperatorName(),58,1336,20,800,p.text);reportText(ctx,'Unit Number',460,1305,11,800,p.subtle);reportText(ctx,d.employee.unit,460,1336,20,800,p.text);reportText(ctx,'Location',780,1305,11,800,p.subtle);reportText(ctx,[d.location.street,d.location.postal&&('Postal '+d.location.postal)].filter(Boolean).join(' · ')||'—',780,1336,18,800,p.text);

    const finalHeight=1405,out=document.createElement('canvas');out.width=1400;out.height=finalHeight;const oc=out.getContext('2d');if(!oc)throw new Error('Could not create export canvas');oc.drawImage(canvas,0,0,1400,finalHeight,0,0,1400,finalHeight);const dataUrl=out.toDataURL('image/png');if(!dataUrl||dataUrl==='data:,')throw new Error('Browser returned an empty image');
    const link=$('signDownloadLink'),img=$('signExportPreview');if(link){link.href=dataUrl;link.classList.remove('hidden')}if(img){img.src=dataUrl;img.classList.remove('hidden')}if(meta){meta.textContent='DOT Truck Incident Report generated successfully.';meta.classList.remove('hidden','error')}saveSignReportToHistory();
  }catch(err){console.error('Truck incident report generation failed:',err);if(meta){meta.textContent='Report could not be generated: '+(err?.message||'Unknown browser error');meta.classList.remove('hidden');meta.classList.add('error')}}
}


const SIGNATURE_ASSET_POOL = Array.from({length:30},(_,i)=>`assets/signatures/signature-${String(i+1).padStart(2,'0')}.png`);
let currentSignatureSet = null;
let discordStepBootTimer = null;
function pickRandomSignature(exclude=[]){
  const pool=SIGNATURE_ASSET_POOL.filter(p=>!exclude.includes(p));
  return pool[Math.floor(Math.random()*pool.length)]||SIGNATURE_ASSET_POOL[0];
}
function normaliseSignatureSet(set){
  const owner=(set&&typeof set.owner==='string'&&set.owner.includes('assets/signatures/'))?set.owner:pickRandomSignature([]);
  const officer=(set&&typeof set.officer==='string'&&set.officer.includes('assets/signatures/')&&set.officer!==owner)?set.officer:pickRandomSignature([owner]);
  return {operatorName:getSavedOperatorName(),owner,officer};
}
function shuffleSignatureSet(){
  const owner=pickRandomSignature([]);
  const officer=pickRandomSignature([owner]);
  currentSignatureSet={operatorName:getSavedOperatorName(),owner,officer};
  applySignaturePreview();
}
function applySignaturePreview(){
  currentSignatureSet=normaliseSignatureSet(currentSignatureSet);
  const nameEl=$('sigPreviewOperatorName'),owner=$('sigPreviewOwner'),officer=$('sigPreviewOfficer');
  if(nameEl)nameEl.textContent=getSavedOperatorName();
  if(owner)owner.src=currentSignatureSet.owner;
  if(officer){
    if(towingReportData.law.involved==='Y'){officer.src=currentSignatureSet.officer;officer.classList.remove('disabled')}
    else{officer.removeAttribute('src');officer.classList.add('disabled')}
  }
}
async function loadImageAsset(src){
  if(!src)return null;
  return await new Promise(resolve=>{
    const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=src;
  });
}
function drawProfileSignature(ctx,name,x,y,maxWidth){
  const text=String(name||getSavedOperatorName()||'DOT Operator').trim();
  ctx.save();ctx.translate(x,y);ctx.rotate(-0.035);
  let size=42;const family='"Segoe Script","Brush Script MT","Lucida Handwriting",Georgia,serif';
  ctx.font=`italic ${size}px ${family}`;
  while(size>24&&ctx.measureText(text).width>maxWidth){size-=2;ctx.font=`italic ${size}px ${family}`}
  ctx.fillStyle='#e9eef1';ctx.globalAlpha=.97;ctx.fillText(text,0,0);
  const width=Math.min(maxWidth,ctx.measureText(text).width+24);
  ctx.strokeStyle='rgba(233,238,241,.72)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(4,8);ctx.bezierCurveTo(width*.28,18,width*.68,-1,width,10);ctx.stroke();ctx.restore();
}

function signatureSeedFromAsset(asset){
  const match=String(asset||'').match(/signature-(\d+)/i);
  return match ? Number(match[1]) : 1;
}
function seededSignatureRand(seed){
  let s=(seed*9301+49297)%233280;
  return ()=>{s=(s*9301+49297)%233280;return s/233280};
}
function drawProceduralSignature(ctx,asset,x,y,maxWidth,label='Signature'){
  const seed=signatureSeedFromAsset(asset);
  const rand=seededSignatureRand(seed);
  const width=Math.max(190,Math.min(maxWidth,230+rand()*45));
  const height=54;
  const slant=(rand()-.5)*.18;
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(slant);
  ctx.strokeStyle='rgba(233,238,241,.94)';
  ctx.fillStyle='rgba(233,238,241,.96)';
  ctx.lineCap='round';
  ctx.lineJoin='round';
  ctx.lineWidth=2.2+rand()*1.4;
  ctx.beginPath();
  let px=4,py=26+rand()*8;
  ctx.moveTo(px,py);
  const count=7+Math.floor(rand()*5);
  for(let i=0;i<count;i++){
    const seg=width/count;
    const nx=Math.min(width-10,px+seg*(.72+rand()*.55));
    const ny=12+rand()*34;
    const c1x=px+seg*(.18+rand()*.25);
    const c1y=8+rand()*44;
    const c2x=nx-seg*(.15+rand()*.28);
    const c2y=8+rand()*44;
    ctx.bezierCurveTo(c1x,c1y,c2x,c2y,nx,ny);
    px=nx;py=ny;
  }
  ctx.stroke();
  if(rand()>.3){
    ctx.lineWidth=1.6+rand();
    ctx.beginPath();
    ctx.moveTo(5,45+rand()*4);
    ctx.bezierCurveTo(width*.28,52+rand()*5,width*.68,36+rand()*8,width-4,47+rand()*4);
    ctx.stroke();
  }
  if(rand()>.52){
    ctx.font=`italic ${20+Math.floor(rand()*7)}px Georgia, serif`;
    ctx.globalAlpha=.82;
    const initial=String(label||'S').trim().charAt(0).toUpperCase()||'S';
    ctx.fillText(initial,8,33);
  }
  ctx.restore();
}

function wrapText(ctx,text,x,y,maxWidth,lineHeight){
  const paragraphs=String(text||'').split('\n');
  let cy=y;
  paragraphs.forEach((para,pIdx)=>{
    const words=para.split(' ');
    let line='';
    words.forEach(word=>{
      const test=line?line+' '+word:word;
      if(ctx.measureText(test).width>maxWidth && line){ ctx.fillText(line,x,cy); cy+=lineHeight; line=word; }
      else line=test;
    });
    ctx.fillText(line||'',x,cy); cy+=lineHeight;
    if(pIdx<paragraphs.length-1) cy+=4;
  });
  return cy;
}
function drawReportRow(ctx,label,value,x,y,w){
  const highway=reportStyle==='highway';
  ctx.fillStyle=highway?'#9ec4aa':'#9fb3bf'; ctx.font='600 20px Arial'; ctx.fillText(label,x,y);
  ctx.fillStyle=highway?'#f1f7f2':'#f2f6f8'; ctx.font='500 20px Arial';
  return wrapText(ctx,value||'—',x+280,y,w-280,28);
}
function drawSection(ctx,title,rows,box){
  const {x,y,w}=box;const highway=reportStyle==='highway';
  ctx.fillStyle=highway?'#14231a':'#121a20';ctx.strokeStyle=highway?'#2d513a':'#28353d';ctx.lineWidth=2;ctx.beginPath();
  const hEstimate=70+rows.length*38;ctx.roundRect(x,y,w,hEstimate,18);ctx.fill();ctx.stroke();
  ctx.fillStyle=highway?'#ffbd4a':'#f0b34d';ctx.font='700 24px Arial';ctx.fillText(title,x+22,y+36);
  if(highway){ctx.fillStyle='#2d6d48';ctx.fillRect(x+22,y+50,85,4)}
  let cy=y+72;rows.forEach(([label,value])=>{cy=drawReportRow(ctx,label,value,x+22,cy,w-44)+6});return cy+18;
}

function reportPalette(){
  const highway=reportStyle==='highway';
  return highway?{
    bg:'#0b1510', panel:'#132219', panel2:'#172a1f', line:'#2f523b', accent:'#f4aa2d', accent2:'#6eb486',
    text:'#f4f8f5', muted:'#9fbaaa', subtle:'#6f8e7b', chip:'#1d3828', good:'#63ca84', bad:'#e07062'
  }:{
    bg:'#081015', panel:'#111a20', panel2:'#172229', line:'#2b3b44', accent:'#f2a900', accent2:'#5aa1c7',
    text:'#f3f7f9', muted:'#a5b6bf', subtle:'#6f848f', chip:'#16232a', good:'#5ccf82', bad:'#e06a5f'
  };
}
function rr(ctx,x,y,w,h,r=18){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function fillStroke(ctx,x,y,w,h,fill,stroke,r=18){ctx.fillStyle=fill;rr(ctx,x,y,w,h,r);ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}}
function reportText(ctx,text,x,y,size=20,weight=500,color='#fff',font='Arial'){ctx.fillStyle=color;ctx.font=`${weight} ${size}px ${font}`;ctx.fillText(String(text??'—'),x,y)}
function reportWrap(ctx,text,x,y,maxWidth,lineHeight=27,maxLines=3){
  const words=String(text||'—').split(/\s+/);let line='',cy=y,lines=0;
  for(const word of words){
    const test=line?line+' '+word:word;
    if(ctx.measureText(test).width>maxWidth&&line){ctx.fillText(line,x,cy);cy+=lineHeight;lines++;line=word;if(lines>=maxLines-1)break}else line=test;
  }
  if(line){ctx.fillText(line,x,cy);cy+=lineHeight}
  return cy;
}
function reportCardTitle(ctx,title,x,y,w,p){
  reportText(ctx,title.toUpperCase(),x+22,y+31,15,800,p.accent);
  ctx.fillStyle=p.accent;ctx.fillRect(x+22,y+43,54,3);
}
function drawKVCard(ctx,title,rows,x,y,w,h,p){
  fillStroke(ctx,x,y,w,h,p.panel,p.line,18);reportCardTitle(ctx,title,x,y,w,p);
  let cy=y+82;
  for(const [label,value] of rows){
    reportText(ctx,label,x+22,cy,15,700,p.muted);
    reportText(ctx,value||'—',x+w*0.46,cy,17,600,p.text);
    cy+=34;
  }
}
function drawYesNoPill(ctx,label,value,x,y,w,p){
  const yes=String(value).toLowerCase()==='yes'||value==='Y';
  fillStroke(ctx,x,y,w,38,p.chip,p.line,12);
  reportText(ctx,label,x+13,y+25,14,700,p.muted);
  const pw=64,px=x+w-pw-8;fillStroke(ctx,px,y+7,pw,24,yes?(p.good+'33'):(p.bad+'28'),yes?p.good:p.bad,12);
  reportText(ctx,yes?'YES':'NO',px+18,y+24,12,800,yes?p.good:p.bad);
}
function drawChoiceCard(ctx,title,items,note,x,y,w,h,p){
  fillStroke(ctx,x,y,w,h,p.panel,p.line,18);reportCardTitle(ctx,title,x,y,w,p);
  const cols=2,gap=10,itemW=(w-44-gap)/2;let cy=y+70;
  items.forEach((it,i)=>{const col=i%2,row=Math.floor(i/2);drawYesNoPill(ctx,it[0],it[1],x+22+col*(itemW+gap),cy+row*48,itemW,p)});
  if(note!==undefined){
    const rows=Math.ceil(items.length/2);const ny=cy+rows*48+6;
    reportText(ctx,'NOTES',x+22,ny+17,12,800,p.subtle);
    ctx.fillStyle=p.text;ctx.font='500 15px Arial';reportWrap(ctx,note||'—',x+22,ny+43,w-44,23,2);
  }
}
function drawSummaryChip(ctx,label,value,x,y,w,p){
  fillStroke(ctx,x,y,w,68,p.panel2,p.line,14);
  reportText(ctx,label.toUpperCase(),x+14,y+22,11,800,p.subtle);
  reportText(ctx,value||'—',x+14,y+50,19,800,p.text);
}
function drawCompactSignaturePanel(ctx,d,x,y,w,p){
  fillStroke(ctx,x,y,w,205,p.panel,p.line,18);reportCardTitle(ctx,'Authorisation',x,y,w,p);
  const colW=(w-88)/3;const xs=[x+22,x+44+colW,x+66+colW*2];
  const labels=['DOT Operator','Vehicle Owner','Officer on Scene'];
  xs.forEach((sx,i)=>{ctx.strokeStyle=p.line;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx,y+146);ctx.lineTo(sx+colW,y+146);ctx.stroke();reportText(ctx,labels[i],sx,y+174,12,700,p.muted)});
  drawProfileSignature(ctx,getSavedOperatorName(),xs[0]+4,y+132,colW-10);
  drawProceduralSignature(ctx,currentSignatureSet.owner,xs[1]+4,y+84,colW-10,'Vehicle Owner');
  if(d.law.involved==='Y')drawProceduralSignature(ctx,currentSignatureSet.officer,xs[2]+4,y+84,colW-10,'Officer');
  else reportText(ctx,'Not required',xs[2]+10,y+126,16,600,p.subtle);
}
async function generateTowingReportImage(){
  const meta=$('discordExportMeta');
  try{
    syncHeaderIntoReportData();
    if(!currentReportRecordId){
      towingReportData.driver.operatorName=getSavedOperatorName();
      if($('reportOperatorName'))$('reportOperatorName').value=towingReportData.driver.operatorName;
    }
    const d=towingReportData,yes=v=>v==='Y'?'Yes':'No',p=reportPalette();
    currentSignatureSet=normaliseSignatureSet(currentSignatureSet);

    const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=2100;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas is unavailable in this browser');
    ctx.fillStyle=p.bg;ctx.fillRect(0,0,canvas.width,canvas.height);

    // Header / brand strip
    const headGrad=ctx.createLinearGradient(0,0,1400,0);headGrad.addColorStop(0,p.panel2);headGrad.addColorStop(1,p.bg);
    ctx.fillStyle=headGrad;ctx.fillRect(0,0,1400,190);
    ctx.fillStyle=p.accent;ctx.fillRect(0,0,18,190);
    fillStroke(ctx,58,42,150,62,p.accent,null,7);reportText(ctx,'SA DOT',88,84,31,900,'#111');
    reportText(ctx,reportStyle==='highway'?'HIGHWAY TOW INCIDENT':'TOW INCIDENT REPORT',245,77,39,900,p.text);
    reportText(ctx,'SAN ANDREAS DEPARTMENT OF TRANSPORTATION · OPERATIONS RECORD',247,112,15,700,p.muted);
    fillStroke(ctx,1090,40,245,86,p.panel,p.line,16);
    reportText(ctx,'SIGNED IN UNIT',1112,68,12,800,p.muted);
    reportText(ctx,(me?.username||'operator').toUpperCase(),1112,104,27,900,p.text);
    reportText(ctx,d.driver.date||defaultToday(),1112,126,13,700,p.subtle);

    // Incident summary hero
    fillStroke(ctx,58,220,1277,170,p.panel,p.line,20);
    reportText(ctx,'INCIDENT SUMMARY',82,254,13,900,p.accent);
    reportText(ctx,[d.vehicle.color,d.vehicle.make,d.vehicle.model].filter(Boolean).join(' ')||'Vehicle details pending',82,302,31,900,p.text);
    reportText(ctx,d.vehicle.plate?`Plate ${d.vehicle.plate}`:'Plate not recorded',82,336,16,700,p.muted);
    ctx.fillStyle=p.line;ctx.fillRect(520,246,2,116);
    reportText(ctx,'LOCATION',554,263,12,800,p.subtle);
    reportText(ctx,d.location.street||'Location not recorded',554,301,24,800,p.text);
    reportText(ctx,d.location.postal?`Nearest Postal ${d.location.postal}`:'Postal not recorded',554,332,15,700,p.muted);
    ctx.fillStyle=p.line;ctx.fillRect(1000,246,2,116);
    reportText(ctx,'OPERATOR',1030,263,12,800,p.subtle);
    reportText(ctx,d.driver.operatorName||getSavedOperatorName(),1030,301,22,800,p.text);
    reportText(ctx,'Account '+(me?.username||'operator'),1030,332,14,700,p.muted);

    // Quick status chips
    const chipY=414,chipGap=14,chipW=(1277-chipGap*3)/4;
    const towReason = d.reason.police==='Y'?'Police Impound':d.reason.illegal==='Y'?'Illegal Parking':d.reason.collision==='Y'?'Traffic Collision':d.reason.disabled==='Y'?'Disabled Vehicle':d.reason.mechanical==='Y'?'Mechanical Failure':d.reason.roadside==='Y'?'Roadside Assistance':d.reason.abandoned==='Y'?'Abandoned Vehicle':(d.reason.other||'Tow Request');
    drawSummaryChip(ctx,'Primary Tow Reason',towReason,58,chipY,chipW,p);
    drawSummaryChip(ctx,'Pickup',d.details.pickup||'—',58+chipW+chipGap,chipY,chipW,p);
    drawSummaryChip(ctx,'Drop-Off',d.details.dropoff||'—',58+(chipW+chipGap)*2,chipY,chipW,p);
    drawSummaryChip(ctx,'Law Enforcement',d.law.involved==='Y'?(d.law.agency||'Yes'):'No',58+(chipW+chipGap)*3,chipY,chipW,p);

    // Two-column cards
    const left=58,right=712,colW=623;
    drawKVCard(ctx,'Vehicle Owner',[
      ['Owner Name',d.owner.ownerName||'—'],['Phone Number',d.owner.phone||'—'],['Driver License',d.owner.license||'—']
    ],left,508,colW,205,p);
    drawKVCard(ctx,'Vehicle Details',[
      ['Make',d.vehicle.make||'—'],['Model',d.vehicle.model||'—'],['Colour',d.vehicle.color||'—'],['Plate',d.vehicle.plate||'—']
    ],right,508,colW,205,p);

    drawChoiceCard(ctx,'Reason for Tow',[
      ['Disabled Vehicle',yes(d.reason.disabled)],['Traffic Collision',yes(d.reason.collision)],['Illegal Parking',yes(d.reason.illegal)],['Abandoned Vehicle',yes(d.reason.abandoned)],['Police Impound',yes(d.reason.police)],['Mechanical Failure',yes(d.reason.mechanical)],['Roadside Assistance',yes(d.reason.roadside)]
    ],d.reason.other,left,733,colW,315,p);
    drawChoiceCard(ctx,'Vehicle Condition',[
      ['No Visible Damage',yes(d.condition.none)],['Minor Damage',yes(d.condition.minor)],['Moderate Damage',yes(d.condition.moderate)],['Severe Damage',yes(d.condition.severe)]
    ],d.condition.damageNotes,right,733,colW,315,p);

    drawChoiceCard(ctx,'Tow Details',[
      ['Impound Lot',yes(d.details.impoundLot)],['Mechanic Shop',yes(d.details.mechanicShop)],['Owner Requested',yes(d.details.ownerRequested)],['Police Hold',yes(d.details.policeHold)]
    ],`Pickup: ${d.details.pickup||'—'}   ·   Drop-Off: ${d.details.dropoff||'—'}`,left,1068,colW,270,p);
    if(d.law.involved==='Y'){
      drawKVCard(ctx,'Law Enforcement',[
        ['Agency',d.law.agency||'—'],['Officer',d.law.officerName||'—'],['Badge Number',d.law.badgeNumber||'—'],['Notes',d.law.additionalNotes||'—']
      ],right,1068,colW,270,p);
    }else{
      fillStroke(ctx,right,1068,colW,270,p.panel,p.line,18);reportCardTitle(ctx,'Law Enforcement',right,1068,colW,p);
      fillStroke(ctx,right+22,1143,colW-44,90,p.chip,p.line,14);
      reportText(ctx,'NO LAW ENFORCEMENT INVOLVEMENT',right+48,1197,20,800,p.muted);
    }

    // Status bar
    fillStroke(ctx,58,1358,1277,135,p.panel,p.line,18);reportCardTitle(ctx,'Report Status',58,1358,1277,p);
    const statusY=1420,statusW=350;
    drawYesNoPill(ctx,'Completed',yes(d.signatures.completed),82,statusY,statusW,p);
    drawYesNoPill(ctx,'Cancelled',yes(d.signatures.cancelled),472,statusY,statusW,p);
    drawYesNoPill(ctx,'Pending Investigation',yes(d.signatures.pendingInvestigation),862,statusY,statusW,p);

    drawCompactSignaturePanel(ctx,d,58,1514,1277,p);

    // Footer
    ctx.fillStyle=p.line;ctx.fillRect(58,1750,1277,2);
    reportText(ctx,'SA DOT · OPERATIONAL TOW RECORD',58,1788,13,800,p.subtle);
    reportText(ctx,'Generated from the DOT Operator Tablet',1050,1788,13,700,p.subtle);
    reportText(ctx,`Report Ref: ${currentReportRecordId||'NEW-'+String(Date.now()).slice(-6)}`,58,1820,12,700,p.subtle);

    const finalHeight=1870;const out=document.createElement('canvas');out.width=canvas.width;out.height=finalHeight;
    const outCtx=out.getContext('2d');if(!outCtx)throw new Error('Could not create export canvas');outCtx.drawImage(canvas,0,0,canvas.width,finalHeight,0,0,canvas.width,finalHeight);
    const dataUrl=out.toDataURL('image/png');if(!dataUrl||dataUrl==='data:,')throw new Error('Browser returned an empty image');
    const link=$('discordDownloadLink'),img=$('discordExportPreview');
    if(link){link.href=dataUrl;link.classList.remove('hidden')}
    if(img){img.src=dataUrl;img.classList.remove('hidden')}
    if(meta){meta.textContent=`Compact SA DOT report generated successfully. Operator signature uses ${getSavedOperatorName()} from Account → Operator Profile.`;meta.classList.remove('hidden');meta.classList.remove('error')}
    saveCurrentReportToHistory();
  }catch(err){
    console.error('Report generation failed:',err);
    if(meta){meta.textContent='Report could not be generated: '+(err?.message||'Unknown browser error')+'. Please try again.';meta.classList.remove('hidden');meta.classList.add('error')}
  }
}

const MINI_TRUCK_VARIANTS={
  'DOT Pickup':'STANDARD PICKUP',
  'DOT Heavy Pickup':'HEAVY PICKUP',
  'DOT Flatbed':'FLATBED',
  'DOT Heavy Flatbed':'HEAVY FLATBED',
  'DOT Commercial Flatbed':'COMMERCIAL',
  'DOT Large Flatbed':'LARGE FLATBED'
};

function checklistVehicleFrame(){return $('checklistVehicle3D')}
function sendChecklistVehicleState(extra={}){
  const frame=checklistVehicleFrame();
  if(!frame?.contentWindow)return;
  const vehicle=$('checkVehicle')?.value?.trim()||'DOT Pickup';
  const item=typeof guidedItem==='function'?guidedItem():null;
  const key=extra.system||item?.[0]||'';
  const title=extra.title||item?.[2]||'AWAITING TEST';
  const state=extra.state!==undefined?extra.state:(key?(checklistState?.[key]||''):'');
  const tested=extra.tested!==undefined?extra.tested:(key?!!checklistTested?.[key]:false);
  frame.contentWindow.postMessage({type:'sadotChecklistVehicle',vehicle,system:key,title,state,tested,testing:!!extra.testing},'*');
}
function applyMiniTruckVariant(){
  const vehicle=$('checkVehicle')?.value?.trim()||'DOT Pickup';
  const badgeEl=$('miniTruckVariantBadge');
  if(badgeEl)badgeEl.textContent=MINI_TRUCK_VARIANTS[vehicle]||'STANDARD PICKUP';
  sendChecklistVehicleState();
}
function initChecklistVehicle3D(){
  const frame=checklistVehicleFrame();if(!frame||frame.dataset.bound==='1')return;
  frame.dataset.bound='1';
  frame.addEventListener('load',()=>setTimeout(()=>sendChecklistVehicleState(),120));
}
function openModal(){$('modal').classList.remove('hidden');$('plateA').focus()}function closeModal(){$('modal').classList.add('hidden')}
function openMemberModal(){if(!isAdmin())return;$('memberModal').classList.remove('hidden');$('userA').focus()}function closeMemberModal(){$('memberModal').classList.add('hidden')}
async function addImpound(){let p=$('plateA').value.trim().toUpperCase();if(!p)return;const row={registration:p,vehicle:$('vehicleA').value.trim()||'Vehicle on file',colour:$('colourA').value.trim()||'Not recorded',reason:$('reasonA').value,impound_lot:$('lotA').value,impounded_by:$('officerA').value.trim()||me.username,fee:Number($('feeA').value)||495,status:'UNPAID'};const {error}=await sb.from('impounds').insert(row);if(error){alert('Could not create impound: '+error.message);return}['plateA','vehicleA','colourA'].forEach(x=>$(x).value='');closeModal();await refresh()}
function releaseVehicle(id){const r=records.find(x=>x.id===id);if(!r||r.status!=='PAID')return;pendingReleaseId=id;$('releasedTo').value='';$('releaseNotes').value='';$('releaseError').textContent='';$('releaseModalVehicle').innerHTML=`<img src="${impoundImage(r)}"><div><b>${esc(r.registration)} · ${esc(r.vehicle||'Vehicle')}</b><span>${esc(r.colour||'—')} · ${esc(r.impound_lot||'—')} · $${Number(r.fee).toFixed(2)}</span></div>`;$('releaseModal').classList.remove('hidden')}
function closeReleaseModal(){$('releaseModal').classList.add('hidden');pendingReleaseId=null}
async function confirmVehicleRelease(){const r=records.find(x=>x.id===pendingReleaseId);if(!r)return;const name=$('releasedTo').value.trim();if(!name){$('releaseError').textContent='Enter the character name collecting the vehicle.';return}const now=new Date().toISOString();if(location.protocol==='file:'){r.status='RELEASED';r.released_at=now;r.released_to=name;r.release_notes=$('releaseNotes').value.trim();r.released_by=me.username;closeReleaseModal();selectedRelease=null;render();return}const {error}=await sb.from('impounds').update({status:'RELEASED',released_at:now}).eq('id',r.id);if(error){$('releaseError').textContent=error.message;return}closeReleaseModal();selectedRelease=null;await refresh()}
function openVehicleLightbox(id){const r=records.find(x=>x.id===id);if(!r)return;$('lightboxImage').src=impoundImage(r);$('lightboxTitle').textContent=(r.vehicle||'Vehicle')+' · '+r.registration;$('lightboxMeta').textContent=(r.colour||'—')+' · '+(r.impound_lot||'SA DOT Impound');$('imageLightbox').classList.remove('hidden')}
function closeVehicleLightbox(){$('imageLightbox').classList.add('hidden')}
function lightboxBackdrop(e){if(e.target===$('imageLightbox'))closeVehicleLightbox()}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeVehicleLightbox();closeReleaseModal()}})
async function removeVehicle(id){if(!isAdmin())return alert('Only DOT admins can delete impound records.');if(!confirm('Delete this impound record?'))return;const {error}=await sb.from('impounds').delete().eq('id',id);if(error)return alert('Delete failed: '+error.message);await refresh()}
async function addMember(){if(!isAdmin())return;const username=$('userA').value.trim().toLowerCase(),password=$('passA').value,role=$('adminA').checked?'admin':'operator';if(!username||!password){$('memberError').textContent='Username and password are required.';return}const {data:{session}}=await sb.auth.getSession();const res=await fetch('/.netlify/functions/manage-staff',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({action:'create',username,password,role})});const out=await res.json();if(!res.ok){$('memberError').textContent=out.error||'Could not create account.';return}$('userA').value='';$('passA').value='';$('adminA').checked=false;$('memberError').textContent='';closeMemberModal();await refresh()}
async function toggleMember(id){if(!isAdmin()||id===me.id)return;const u=members.find(x=>x.id===id);const {error}=await sb.from('dot_staff').update({enabled:!u.enabled}).eq('id',id);if(error)return alert(error.message);await refresh()}
async function deleteMember(id){if(!isAdmin()||id===me.id)return;const u=members.find(x=>x.id===id);if(!confirm('Delete DOT account '+u.username+'?'))return;const {data:{session}}=await sb.auth.getSession();const res=await fetch('/.netlify/functions/manage-staff',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify({action:'delete',user_id:id})});const out=await res.json();if(!res.ok)return alert(out.error||'Delete failed.');await refresh()}
async function towStatus(id,status){const row=tows.find(x=>x.id===id);if(!row)return;if(location.protocol==='file:'){row.status=status;if(status==='CLAIMED'&&!row.claimed_by)row.claimed_by=me.username;if(['COMPLETE','IMPOUNDED'].includes(status))row.completed_at=new Date().toISOString();render();return}const patch={status};if(status==='CLAIMED'&&!row.claimed_by)patch.claimed_by=me.username;if(status==='COMPLETE')patch.completed_at=new Date().toISOString();const {error}=await sb.from('tow_requests').update(patch).eq('id',id);if(error)return alert(error.message);await refresh()}
async function impoundTow(id){const t=tows.find(x=>x.id===id);if(!t)return;if(location.protocol==='file:'){t.status='IMPOUNDED';t.claimed_by=t.claimed_by||me.username;t.completed_at=new Date().toISOString();records.unshift({id:9000+id,registration:t.registration,vehicle:t.vehicle,colour:t.colour,reason:t.reason,impound_lot:t.destination,impounded_by:me.username,fee:495,status:'UNPAID',created_at:new Date().toISOString()});render();return}if(!confirm('Complete this tow and create an active impound for '+t.registration+'?'))return;const imp={registration:t.registration,vehicle:t.vehicle||'Vehicle on file',colour:t.colour||'Not recorded',reason:t.reason||'Police Impound',impound_lot:t.destination==='Nearest DOT Impound'?'Sandy Shores Impound':t.destination,impounded_by:me.username,fee:495,status:'UNPAID'};const {error}=await sb.from('impounds').insert(imp);if(error)return alert('Could not create impound: '+error.message);await sb.from('tow_requests').update({status:'IMPOUNDED',claimed_by:t.claimed_by||me.username,completed_at:new Date().toISOString()}).eq('id',id);await refresh()}
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

function impoundImage(r){return smartVehicleImage(r)}
function impoundStatus(r){if(r.status==='RELEASED')return['RELEASED','released'];if(r.status==='PAID')return['READY FOR RELEASE','ready'];return['AWAITING PAYMENT','awaiting']}
function toggleImpound(id){expandedImpound=expandedImpound===id?null:id;render()}
function renderImpounds(){const host=$('vehicleRows');if(!host)return;let q=($('impoundSearch')?.value||$('search')?.value||'').trim().toUpperCase(),st=$('impoundStatus')?.value||'ALL',lot=$('impoundLot')?.value||'ALL',sort=$('impoundSort')?.value||'NEW';let rows=records.filter(r=>(!q||r.registration.includes(q)||(r.vehicle||'').toUpperCase().includes(q)||('IMP-'+String(r.id)).includes(q))&&(st==='ALL'||r.status===st)&&(lot==='ALL'||r.impound_lot===lot));rows.sort((a,b)=>sort==='OLD'?new Date(a.created_at)-new Date(b.created_at):sort==='FEE'?Number(b.fee)-Number(a.fee):new Date(b.created_at)-new Date(a.created_at));let active=records.filter(r=>r.status!=='RELEASED').length,unpaid=records.filter(r=>r.status==='UNPAID').length,ready=records.filter(r=>r.status==='PAID').length,released=records.filter(r=>r.status==='RELEASED').length;$('impoundSummary').innerHTML=`<div><b>${active}</b><span>TOTAL IMPOUNDED</span></div><div class="sum-red"><b>${unpaid}</b><span>AWAITING PAYMENT</span></div><div class="sum-amber"><b>${ready}</b><span>READY FOR RELEASE</span></div><div class="sum-grey"><b>${released}</b><span>RELEASED</span></div>`;host.innerHTML=rows.map(r=>{let [label,cls]=impoundStatus(r),open=expandedImpound===r.id,img=impoundImage(r),date=new Date(r.created_at).toLocaleString('en-GB');return `<article class="impound-record ${open?'expanded':''}"><div class="impound-row"><button class="impound-chevron" onclick="toggleImpound(${r.id})">${open?'⌃':'⌄'}</button><button class="impound-thumb clickable-vehicle" onclick="event.stopPropagation();openVehicleLightbox(${r.id})" title="Enlarge vehicle image"><img src="${img}" alt="Vehicle reference"></button><b>${r.registration}</b><div><strong>${r.vehicle||'Vehicle on file'}</strong></div><div class="colour-cell"><i style="background:${String(r.colour||'grey').toLowerCase()}"></i>${r.colour||'—'}</div><span class="impound-state ${cls}">${label}</span><span>${r.impound_lot||'—'}</span><span>${date}</span><b>$${Number(r.fee).toFixed(0)}</b><button class="impound-view" onclick="toggleImpound(${r.id})">${open?'HIDE':'VIEW'}</button></div>${open?`<div class="impound-detail"><section><h4>VEHICLE INFORMATION</h4><button class="expanded-vehicle-image" onclick="openVehicleLightbox(${r.id})"><img src="${img}" alt="Vehicle reference"><span>⌕ ENLARGE IMAGE</span></button><dl><dt>Impound ID</dt><dd>IMP-${String(r.id).padStart(4,'0')}</dd><dt>Plate</dt><dd>${r.registration}</dd><dt>Make / Model</dt><dd>${r.vehicle||'—'}</dd><dt>Colour</dt><dd>${r.colour||'—'}</dd></dl></section><section><h4>IMPOUND DETAILS</h4><dl><dt>Impounded By</dt><dd>${r.impounded_by||'DOT'}</dd><dt>Reason</dt><dd>${r.reason||'—'}</dd><dt>Location</dt><dd>${r.impound_lot||'—'}</dd><dt>Date & Time</dt><dd>${date}</dd></dl></section><section><h4>PAYMENT & RELEASE</h4><dl><dt>Status</dt><dd><span class="impound-state ${cls}">${label}</span></dd><dt>Fee</dt><dd>$${Number(r.fee).toFixed(2)}</dd><dt>Paid Date</dt><dd>${r.paid_at?new Date(r.paid_at).toLocaleString('en-GB'):'—'}</dd><dt>Released Date</dt><dd>${r.released_at?new Date(r.released_at).toLocaleString('en-GB'):'—'}</dd></dl></section><section class="impound-actions"><h4>ACTIONS</h4>${r.status==='PAID'?`<button class="release-primary" onclick="releaseVehicle(${r.id})">🔑 RELEASE VEHICLE</button>`:''}${r.status==='UNPAID'?`<button class="action-disabled" disabled>AWAITING PAYMENT</button>`:''}${r.status==='RELEASED'?`<button class="action-disabled" disabled>VEHICLE RELEASED</button>`:''}${isAdmin()?`<button class="remove-danger" onclick="removeVehicle(${r.id})">REMOVE IMPOUND</button>`:''}</section></div>`:''}</article>`}).join('')||'<div class="empty">No impound records match these filters.</div>'}
function render(){if(!me)return;applySignedInChecklistUnit();renderDashboard();$('who').textContent=me.username;$('whoRole').textContent=me.role.toUpperCase();if($('profileName'))$('profileName').textContent=me.username;const av=document.querySelector('.operator-avatar');if(av)av.textContent=String(me.username||'DOT').split(/[^a-z0-9]+/i).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'DT';$('whoRole').className='rolepill '+me.role;$('membersTab').classList.toggle('hidden',!isAdmin());$('activeCount').textContent=records.filter(x=>x.status!=='RELEASED').length;$('paidCount').textContent=payments.length;$('collected').textContent='$'+payments.reduce((s,x)=>s+Number(x.amount),0).toFixed(2);let q=($('search')?.value||'').toUpperCase();renderImpounds();$('closureBadge').textContent=closures.filter(x=>!['COMPLETE','CANCELLED'].includes(x.status)).length;$('towBadge').textContent=tows.filter(x=>!['COMPLETE','IMPOUNDED','CANCELLED'].includes(x.status)).length;if($('roadsideBadge'))$('roadsideBadge').textContent=getRoadsideCalls().length;$('closureBadge').textContent=closures.filter(x=>!['COMPLETE','CANCELLED'].includes(x.status)).length;renderClosures();renderRoadsidePanel();
const vehicleImage=t=>impoundImage(t);
$('towRows').innerHTML=tows.filter(x=>!q||x.registration.includes(q)||(x.vehicle||'').toUpperCase().includes(q)||(x.location||'').toUpperCase().includes(q)).map(t=>{const img=vehicleImage(t),ref=t.reference||('TR-'+String(t.id).padStart(4,'0')),priority=String(t.priority||'ROUTINE'),status=String(t.status||'PENDING');return `<article class="tow-job ${priority.toLowerCase()}" data-request-id="tow-${t.id}"><div class="tow-job-head"><div><div class="tow-ref">${esc(ref)} · ${esc(new Date(t.created_at).toLocaleString('en-GB'))}</div><h3>${esc(t.registration)}</h3></div><div><span class="priority ${priority.toLowerCase()}">${esc(priority)}</span> <span class="badge tow-${status.toLowerCase()}">${esc(status)}</span></div></div><div class="tow-visual">${img?`<img src="${img}" alt="Generic vehicle reference for ${esc(t.vehicle)}">`:`<div class="vehicle-fallback">◆<b>VEHICLE IMAGE UNAVAILABLE</b><span>${esc(t.vehicle||'UNRECOGNISED VEHICLE')}</span></div>`}</div><div class="tow-fields"><div class="tow-field"><small>REGISTRATION</small><b>${esc(t.registration)}</b></div><div class="tow-field"><small>VEHICLE</small><b>${esc(t.vehicle)}</b></div><div class="tow-field"><small>COLOUR</small><span>${esc(t.colour)}</span></div><div class="tow-field"><small>TOW REASON</small><span>${esc(t.reason)}</span></div><div class="tow-field"><small>PRIORITY</small><span>${esc(priority)}</span></div><div class="tow-field"><small>LOCATION</small><span>${esc(t.location)}</span></div><div class="tow-field"><small>REQUESTING AGENCY</small><span>${esc(t.agency)}</span></div><div class="tow-field"><small>OFFICER / CALLSIGN</small><span>${esc(t.requesting_officer)}</span></div><div class="tow-field"><small>DESTINATION</small><span>${esc(t.destination)}</span></div><div class="tow-field"><small>DOT UNIT</small><span>${esc(t.claimed_by||'Awaiting DOT unit')}</span></div><div class="tow-field wide tow-note"><small>ADDITIONAL NOTES</small><span>${esc(t.notes)}</span></div></div><div class="tow-progress">${['PENDING','CLAIMED','EN ROUTE','ON SCENE','COMPLETE'].map((step,i)=>{const order={'PENDING':0,'CLAIMED':1,'EN ROUTE':2,'ON SCENE':3,'COMPLETE':4,'IMPOUNDED':4,'CANCELLED':4};return `<span class="${i<=order[status]?'done':''}"><i></i>${step}</span>`}).join('')}</div><div class="tow-job-actions">${status==='PENDING'?`<button class="mini action-claim" onclick="towStatus(${t.id},'CLAIMED')">CLAIM REQUEST</button>`:''}${status==='CLAIMED'?`<button class="mini action-enroute" onclick="towStatus(${t.id},'EN ROUTE')">MARK EN ROUTE</button>`:''}${status==='EN ROUTE'?`<button class="mini action-onscene" onclick="towStatus(${t.id},'ON SCENE')">MARK ON SCENE</button>`:''}${status==='ON SCENE'?`${isRoadsideTow(t)?`<button class="mini action-roadside" onclick="startRoadsideFromTow(${t.id})">⚒ ROADSIDE ASSIST</button>`:''}<button class="mini action-impound" onclick="impoundTow(${t.id})">IMPOUND VEHICLE ($495)</button><button class="mini action-noimpound" onclick="towStatus(${t.id},'COMPLETE')">NO IMPOUND</button>`:''}${['COMPLETE','IMPOUNDED','CANCELLED'].includes(status)?`<span class="closed-action">REQUEST CLOSED · ${esc(status)}</span>`:''}</div></article>`}).join('')||'<div class="empty">No police tow requests.</div>';
$('closureRows').innerHTML=closures.map(c=>{const st=String(c.status||'PENDING');return `<article class="closure-card"><div class="closure-top"><div><small>${esc(c.reference||('RC-'+c.id))}</small><h3>⛔ ${esc(c.location)}</h3></div><span class="closure-status ${st.toLowerCase().replace(' ','-')}">${esc(st)}</span></div><div class="closure-fields"><div><small>REASON</small><b>${esc(c.reason)}</b></div><div><small>CLOSURE TYPE</small><b>${esc(c.closure_type||'Road Closure')}</b></div><div><small>AGENCY / OFFICER</small><b>${esc(c.agency)} · ${esc(c.requesting_officer)}</b></div><div><small>PRIORITY</small><b>${esc(c.priority)}</b></div><div class="wide"><small>NOTES</small><span>${esc(c.notes||'—')}</span></div></div><div class="closure-actions">${st==='PENDING'?`<button onclick="closureStatus(${c.id},'EN ROUTE')">ACCEPT & MARK EN ROUTE</button>`:''}${st==='EN ROUTE'?`<button class="amber-btn" onclick="closureStatus(${c.id},'ON SCENE')">MARK ON SCENE</button>`:''}${st==='ON SCENE'?`<button class="green-btn" onclick="closureStatus(${c.id},'COMPLETE')">CLOSURE COMPLETE</button>`:''}</div></article>`}).join('')||'<div class="empty">No road closure requests.</div>';renderReleases();if(isAdmin())$('memberRows').innerHTML=members.map(u=>`<tr><td><b>${u.username}</b></td><td><span class="rolepill ${u.role}">${u.role.toUpperCase()}</span></td><td>${u.enabled?'ACTIVE':'DISABLED'}</td><td>${new Date(u.created_at).toLocaleString('en-GB')}</td><td>${u.id===me.id?'<span class="micro">CURRENT USER</span>':`<button class="mini" onclick="toggleMember('${u.id}')">${u.enabled?'DISABLE':'ENABLE'}</button><button class="mini ghost" onclick="deleteMember('${u.id}')">×</button>`}</td></tr>`).join('')}

function dashboardSearch(v){const q=String(v||'').trim().toUpperCase();if(!q)return;const tow=tows.find(x=>[x.registration,x.vehicle,x.reference,x.location].some(y=>String(y||'').toUpperCase().includes(q)));if(tow){switchTab('tows');return}const rec=records.find(x=>[x.registration,x.vehicle,'IMP-'+x.id].some(y=>String(y||'').toUpperCase().includes(q)));if(rec){expandedImpound=rec.id;switchTab('vehicles')}}
function mapPosition(location){let l=String(location||'').toLowerCase();if(/paleto/.test(l))return[27,19];if(/grape/.test(l))return[62,29];if(/sandy|senora|harmony|route 68/.test(l))return[46,47];if(/del perro|vespucci/.test(l))return[55,78];if(/pillbox|mission row|davis|los santos/.test(l))return[69,78];if(/great ocean/.test(l))return[21,55];return[50,58]}
function dashStatus(t){if(t.status==='PENDING')return['AWAITING DOT','red'];if(t.status==='CLAIMED')return['ASSIGNED','blue'];if(t.status==='EN ROUTE')return['EN ROUTE','amber'];if(t.status==='ON SCENE')return['ON SCENE','green'];return[t.status,'grey']}
function renderDashboard(){if(!$('dashboardPanel')||!me)return;const active=tows.filter(x=>!['COMPLETE','IMPOUNDED','CANCELLED'].includes(x.status));const waiting=active.filter(x=>x.status==='PENDING');const unpaid=records.filter(x=>x.status==='UNPAID');const ready=records.filter(x=>x.status==='PAID');const oldest=waiting.length?Math.max(...waiting.map(x=>Math.round((Date.now()-new Date(x.created_at))/60000))):0;$('dashName').textContent=me.username||'Operator';$('dashStats').innerHTML=`<div class="ds blue"><i>▣</i><b>${active.length}</b><span>ACTIVE TOW REQUESTS<small>${waiting.length} awaiting DOT</small></span></div><div class="ds red"><i>!</i><b>${oldest}</b><span>OLDEST WAITING<small>${oldest?'minutes':'no queue'}</small></span></div><div class="ds amber"><i>▰</i><b>${unpaid.length}</b><span>AWAITING PAYMENT<small>vehicles in yard</small></span></div><div class="ds green"><i>✓</i><b>${ready.length}</b><span>READY FOR RELEASE<small>paid vehicles</small></span></div>`;
const vi=t=>impoundImage(t);$('dashTowList').innerHTML=active.slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).slice(0,5).map(t=>{const [label,c]=dashStatus(t),mins=Math.max(1,Math.round((Date.now()-new Date(t.created_at))/60000));return `<button class="dash-tow-row" onclick="switchTab('tows')"><img src="${vi(t)}"><span class="dash-veh"><b>${t.registration}</b><small>${t.vehicle} · ${t.location}</small></span><span class="dash-age ${mins>=20?'late':''}">${mins} min</span><em class="dash-pill ${c}">${label}</em><strong>›</strong></button>`}).join('')||'<div class="dash-empty">No active tow requests.</div>';
const activeClosures=closures.filter(x=>!['COMPLETE','CANCELLED'].includes(x.status));renderPostalPrototypePins(active,activeClosures);
$('dashYardList').innerHTML=[...unpaid.slice(0,2),...ready.slice(0,2)].slice(0,4).map(r=>{let [label,c]=impoundStatus(r);return `<button class="yard-row" onclick="expandedImpound=${r.id};switchTab('vehicles')"><img src="${impoundImage(r)}"><span><b>${r.registration}</b><small>${r.vehicle} · ${r.impound_lot}</small></span><em class="dash-pill ${r.status==='UNPAID'?'red':'amber'}">${label}</em><strong>$${Number(r.fee).toFixed(0)}</strong></button>`}).join('')||'<div class="dash-empty">Nothing currently needs attention.</div>';
let activity=[];active.slice(0,3).forEach(t=>activity.push({time:t.created_at,icon:'▣',text:`${t.reference} · ${t.vehicle}`,sub:t.status==='PENDING'?`Submitted by ${t.agency}`:`${t.status} · ${t.claimed_by||'DOT'}`}));records.slice(0,3).forEach(r=>activity.push({time:r.paid_at||r.created_at,icon:'▰',text:`${r.registration} · ${r.vehicle}`,sub:r.status==='PAID'?'Payment received':r.status==='RELEASED'?'Vehicle released':'Vehicle impounded'}));activity.sort((a,b)=>new Date(b.time)-new Date(a.time));$('dashActivity').innerHTML=activity.slice(0,5).map(a=>`<div class="activity-row"><i>${a.icon}</i><span><b>${a.text}</b><small>${a.sub}</small></span><time>${new Date(a.time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</time></div>`).join('');}
function updateDashClock(){if(!$('dashTime'))return;const d=new Date();$('dashTime').textContent=d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});$('dashDate').textContent=d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}setInterval(updateDashClock,30000);setTimeout(updateDashClock,0);

// v4.34 full high-resolution postal map pan/zoom prototype.
const POSTAL_EXACT={"1000":{"x":59.063,"y":15.529},"10003":{"x":40.107,"y":85.616},"10005":{"x":41.314,"y":85.837},"1002":{"x":58.541,"y":14.409},"10031":{"x":36.706,"y":84.439},"10032":{"x":36.732,"y":83.635},"10037":{"x":38.143,"y":85.835},"1004":{"x":50.095,"y":14.418},"1005":{"x":51.202,"y":15.357},"1006":{"x":48.682,"y":14.144},"1007":{"x":50.122,"y":15.28},"1010":{"x":47.985,"y":14.274},"1012":{"x":47.131,"y":14.263},"1013":{"x":47.111,"y":15.378},"1015":{"x":46.821,"y":15.717},"1019":{"x":46.245,"y":16.275},"1021":{"x":45.885,"y":16.627},"1023":{"x":45.525,"y":17.011},"1025":{"x":45.172,"y":17.348},"1027":{"x":44.773,"y":17.731},"1029":{"x":44.436,"y":18.084},"1034":{"x":42.121,"y":19.103},"1039":{"x":42.076,"y":18.368},"1041":{"x":45.916,"y":14.365},"1043":{"x":42.842,"y":17.485},"1047":{"x":43.632,"y":16.58},"1048":{"x":44.148,"y":16.995},"1049":{"x":44.223,"y":15.062},"1053":{"x":44.525,"y":15.722},"1057":{"x":45.237,"y":14.989},"1059":{"x":45.544,"y":14.683},"1060":{"x":46.123,"y":15.002},"1061":{"x":45.918,"y":14.367},"1062":{"x":46.439,"y":14.683},"1063":{"x":46.529,"y":13.913},"1064":{"x":45.947,"y":13.744},"1065":{"x":45.373,"y":13.974},"1072":{"x":43.211,"y":16.028},"1075":{"x":42.214,"y":17.009},"1076":{"x":56.767,"y":38.409},"1077":{"x":40.807,"y":18.144},"1079":{"x":40.502,"y":20.882},"1081":{"x":41.405,"y":22.855},"1082":{"x":41.657,"y":24.79},"1083":{"x":38.889,"y":25.004},"1085":{"x":44.894,"y":15.36},"1087":{"x":49.554,"y":22.268},"1096":{"x":42.979,"y":18.827},"1900":{"x":59.493,"y":38.476},"1949":{"x":42.689,"y":18.436},"2000":{"x":64.547,"y":26.019},"2001":{"x":63.134,"y":25.884},"2003":{"x":61.396,"y":26.4},"2004":{"x":60.903,"y":26.726},"2007":{"x":58.918,"y":28.711},"2009":{"x":59.658,"y":28.263},"2010":{"x":59.681,"y":28.689},"2012":{"x":59.804,"y":29.149},"2013":{"x":59.064,"y":29.564},"2014":{"x":59.883,"y":29.565},"2015":{"x":59.087,"y":30.013},"2016":{"x":59.917,"y":30.002},"2017":{"x":60.271,"y":30.373},"2020":{"x":61.969,"y":29.767},"2021":{"x":61.464,"y":28.802},"2023":{"x":60.701,"y":27.859},"2024":{"x":63.504,"y":26.894},"2026":{"x":63.509,"y":26.885},"2027":{"x":65.119,"y":27.287},"2028":{"x":64.038,"y":27.909},"2029":{"x":63.056,"y":28.488},"2030":{"x":62.507,"y":29.127},"2031":{"x":63.841,"y":29.004},"2034":{"x":65.299,"y":28.914},"2036":{"x":65.815,"y":29.341},"2038":{"x":66.835,"y":28.174},"2040":{"x":66.533,"y":29.981},"2042":{"x":66.365,"y":31.002},"2043":{"x":67.105,"y":30.396},"2044":{"x":67.228,"y":31.316},"2045":{"x":66.717,"y":31.864},"2046":{"x":66.164,"y":32.359},"2047":{"x":65.995,"y":30.474},"2048":{"x":65.408,"y":34.184},"2052":{"x":68.932,"y":30.217},"2054":{"x":68.135,"y":28.309},"2055":{"x":67.783,"y":26.994},"2056":{"x":70.388,"y":27.12},"2057":{"x":72.506,"y":25.673},"2059":{"x":75.983,"y":31.317},"2622":{"x":61.139,"y":28.33},"2900":{"x":64.522,"y":25.97},"3001":{"x":59.314,"y":37.96},"3005":{"x":60.345,"y":37.358},"3014":{"x":46.692,"y":37.511},"3020":{"x":58.968,"y":37.47},"3021":{"x":58.636,"y":37.241},"3023":{"x":58.151,"y":37.65},"3028":{"x":53.884,"y":38.566},"3031":{"x":49.536,"y":38.836},"3032":{"x":48.746,"y":38.717},"3033":{"x":61.692,"y":41.372},"3034":{"x":58.832,"y":38.79},"3036":{"x":61.075,"y":41.08},"3037":{"x":60.584,"y":41.107},"3038":{"x":61.078,"y":41.107},"3050":{"x":66.559,"y":41.898},"3054":{"x":69.105,"y":44.3},"3084":{"x":66.908,"y":45.288},"3926":{"x":56.909,"y":38.404},"4000":{"x":59.451,"y":46.659},"4005":{"x":54.874,"y":47.233},"4012":{"x":45.604,"y":44.226},"4017":{"x":49.681,"y":46.072},"4021":{"x":53.263,"y":46.066},"4022":{"x":53.662,"y":45.571},"4023":{"x":54.144,"y":46.065},"4025":{"x":54.952,"y":46.11},"4041":{"x":62.342,"y":39.8},"4045":{"x":61.872,"y":42.988},"4070":{"x":47.793,"y":46.651},"4071":{"x":53.28,"y":46.021},"5000":{"x":42.383,"y":44.496},"5028":{"x":53.009,"y":37.926},"7001":{"x":41.372,"y":81.819},"7002":{"x":41.724,"y":81.355},"7008":{"x":44.985,"y":84.516},"7010":{"x":41.191,"y":84.692},"7015":{"x":31.127,"y":70.363},"7017":{"x":30.627,"y":70.772},"7019":{"x":31.406,"y":70.789},"7021":{"x":31.145,"y":71.215},"7023":{"x":32.045,"y":71.151},"7024":{"x":32.571,"y":71.528},"7025":{"x":33.232,"y":70.623},"7027":{"x":32.561,"y":70.613},"7030":{"x":33.704,"y":70.038},"7032":{"x":33.838,"y":68.906},"7040":{"x":44.037,"y":78.589},"7043":{"x":45.365,"y":77.804},"7044":{"x":45.408,"y":78.167},"7045":{"x":48.501,"y":78.766},"7059":{"x":49.856,"y":78.285},"7064":{"x":49.683,"y":79.517},"7066":{"x":48.78,"y":79.079},"7071":{"x":44.778,"y":80.909},"7073":{"x":46.296,"y":79.095},"7081":{"x":43.965,"y":79.517},"7083":{"x":32.055,"y":71.206},"7092":{"x":45.704,"y":80.816},"7097":{"x":45.693,"y":82.553},"7105":{"x":46.992,"y":83.219},"7109":{"x":46.55,"y":82.039},"7118":{"x":48.099,"y":68.963},"7136":{"x":45.613,"y":68.107},"7145":{"x":35.553,"y":69.65},"7158":{"x":35.952,"y":68.516},"7167":{"x":35.309,"y":69.313},"7169":{"x":34.097,"y":70.41},"7170":{"x":33.517,"y":70.88},"7181":{"x":49.567,"y":82.589},"7186":{"x":44.105,"y":68.334},"7199":{"x":46.542,"y":69.495},"7200":{"x":45.848,"y":69.226},"7201":{"x":45.377,"y":69.075},"7203":{"x":43.99,"y":68.633},"7204":{"x":43.002,"y":68.278},"7205":{"x":41.997,"y":67.906},"7207":{"x":38.806,"y":69.252},"7208":{"x":39.369,"y":68.719},"7215":{"x":34.76,"y":71.35},"7218":{"x":34.015,"y":72.716},"7219":{"x":34.583,"y":72.331},"7223":{"x":36.833,"y":70.868},"7226":{"x":38.869,"y":70.073},"7227":{"x":39.573,"y":69.142},"7230":{"x":42.311,"y":68.414},"7233":{"x":44.52,"y":69.211},"7235":{"x":45.599,"y":69.847},"7237":{"x":46.845,"y":70.273},"7238":{"x":47.573,"y":70.512},"7239":{"x":48.011,"y":70.848},"7240":{"x":47.439,"y":70.985},"7241":{"x":46.708,"y":70.699},"7242":{"x":46.124,"y":70.578},"7249":{"x":41.564,"y":69.345},"7250":{"x":53.116,"y":78.142},"7253":{"x":39.604,"y":70.394},"7258":{"x":35.398,"y":72.263},"7259":{"x":34.7,"y":72.716},"7261":{"x":38.628,"y":70.851},"7262":{"x":35.778,"y":72.723},"7265":{"x":37.274,"y":71.595},"7270":{"x":41.163,"y":70.165},"7271":{"x":35.857,"y":71.384},"7272":{"x":42.047,"y":70.801},"7274":{"x":42.207,"y":69.793},"7279":{"x":45.228,"y":70.96},"7280":{"x":46.242,"y":70.96},"7281":{"x":48.875,"y":70.933},"7282":{"x":50.421,"y":69.227},"7283":{"x":50.43,"y":68.502},"7284":{"x":51.332,"y":67.869},"7296":{"x":51.729,"y":69.8},"7297":{"x":52.716,"y":69.648},"7301":{"x":53.713,"y":84.526},"7302":{"x":55.137,"y":69.851},"7303":{"x":54.716,"y":70.088},"7305":{"x":54.049,"y":70.624},"7306":{"x":54.128,"y":71.255},"7307":{"x":53.731,"y":70.773},"7320":{"x":53.947,"y":80.159},"7321":{"x":54.073,"y":72.862},"7323":{"x":54.343,"y":73.133},"7326":{"x":55.058,"y":73.76},"7327":{"x":55.063,"y":78.505},"7329":{"x":56.3,"y":73.471},"7330":{"x":56.899,"y":73.623},"7340":{"x":56.947,"y":72.355},"7344":{"x":55.737,"y":82.335},"7345":{"x":55.848,"y":70.934},"7347":{"x":55.999,"y":70.274},"7349":{"x":56.873,"y":68.547},"7350":{"x":56.774,"y":83.026},"7354":{"x":55.019,"y":85.132},"7355":{"x":54.683,"y":85.402},"7383":{"x":59.508,"y":81.037},"8007":{"x":35.038,"y":73.73},"8008":{"x":35.622,"y":73.73},"8015":{"x":37.535,"y":72.79},"8017":{"x":38.419,"y":72.368},"8026":{"x":45.48,"y":72.557},"8027":{"x":45.672,"y":72.051},"8029":{"x":46.02,"y":72.626},"8037":{"x":47.812,"y":73.911},"8041":{"x":49.544,"y":72.482},"8048":{"x":48.737,"y":75.518},"8051":{"x":48.187,"y":75.281},"8053":{"x":47.24,"y":75.349},"8054":{"x":47.621,"y":74.5},"8055":{"x":46.413,"y":74.0},"8056":{"x":46.388,"y":74.534},"8067":{"x":43.381,"y":72.956},"8070":{"x":42.108,"y":73.97},"8074":{"x":41.152,"y":73.507},"8075":{"x":41.393,"y":73.912},"8076":{"x":40.243,"y":73.913},"8081":{"x":39.556,"y":73.909},"8083":{"x":39.187,"y":73.201},"8084":{"x":38.57,"y":72.963},"8085":{"x":38.58,"y":73.473},"8087":{"x":38.079,"y":73.855},"8088":{"x":38.056,"y":73.206},"8089":{"x":37.596,"y":73.541},"8093":{"x":35.918,"y":75.009},"8094":{"x":35.127,"y":75.139},"8095":{"x":34.96,"y":74.771},"8099":{"x":34.429,"y":77.01},"8107":{"x":35.991,"y":75.538},"8108":{"x":36.223,"y":76.041},"8109":{"x":36.377,"y":76.467},"8115":{"x":37.273,"y":76.494},"8121":{"x":37.71,"y":75.649},"8122":{"x":37.97,"y":76.124},"8130":{"x":38.262,"y":74.838},"8134":{"x":39.371,"y":74.754},"8135":{"x":39.359,"y":75.197},"8138":{"x":40.238,"y":75.69},"8139":{"x":40.128,"y":75.332},"8140":{"x":40.2,"y":74.862},"8147":{"x":41.95,"y":74.994},"8149":{"x":43.209,"y":74.487},"8150":{"x":43.14,"y":74.984},"8151":{"x":43.108,"y":75.467},"8153":{"x":43.297,"y":76.376},"8160":{"x":44.028,"y":76.399},"8164":{"x":45.092,"y":75.17},"8182":{"x":51.828,"y":75.298},"8185":{"x":51.781,"y":74.017},"8195":{"x":52.525,"y":76.295},"8197":{"x":53.195,"y":75.839},"8200":{"x":34.563,"y":77.577},"8202":{"x":34.694,"y":78.799},"8203":{"x":34.85,"y":79.622},"8205":{"x":35.77,"y":81.049},"8216":{"x":35.76,"y":77.088},"8219":{"x":36.159,"y":78.107},"8220":{"x":36.923,"y":78.536},"8226":{"x":38.507,"y":79.619},"8230":{"x":37.468,"y":78.58},"8232":{"x":37.936,"y":77.728},"8240":{"x":40.295,"y":78.725},"8241":{"x":39.758,"y":79.177},"8245":{"x":40.71,"y":77.351},"8247":{"x":40.239,"y":76.663},"8251":{"x":40.935,"y":75.947},"8253":{"x":40.892,"y":76.696},"8254":{"x":41.596,"y":77.304},"8255":{"x":41.376,"y":77.794},"8265":{"x":41.372,"y":77.787},"8753":{"x":40.896,"y":76.69},"9003":{"x":42.196,"y":81.473},"9004":{"x":42.316,"y":81.225},"9005":{"x":42.446,"y":80.976},"9007":{"x":45.197,"y":83.589},"9008":{"x":44.978,"y":84.522},"9010":{"x":41.2,"y":84.697},"9012":{"x":42.379,"y":85.007},"9013":{"x":43.01,"y":84.979},"9018":{"x":45.192,"y":84.991},"9019":{"x":45.75,"y":84.839},"9023":{"x":46.957,"y":85.181},"9025":{"x":47.637,"y":85.23},"9026":{"x":48.272,"y":85.143},"9028":{"x":42.898,"y":80.251},"9029":{"x":43.032,"y":79.991},"9030":{"x":43.199,"y":79.778},"9033":{"x":43.325,"y":79.161},"9035":{"x":43.277,"y":78.234},"9036":{"x":43.323,"y":77.797},"9037":{"x":44.057,"y":77.676},"9038":{"x":44.052,"y":78.152},"9039":{"x":44.036,"y":78.386},"9040":{"x":44.03,"y":78.587},"9041":{"x":44.684,"y":77.676},"9042":{"x":44.699,"y":78.152},"9043":{"x":45.368,"y":77.764},"9046":{"x":46.04,"y":78.167},"9047":{"x":47.201,"y":77.939},"9048":{"x":46.973,"y":78.186},"9049":{"x":47.205,"y":77.946},"9050":{"x":47.302,"y":77.669},"9051":{"x":48.017,"y":77.542},"9053":{"x":48.92,"y":78.014},"9058":{"x":49.835,"y":78.689},"9061":{"x":50.352,"y":80.285},"9063":{"x":49.499,"y":80.04},"9067":{"x":49.041,"y":78.884},"9069":{"x":48.672,"y":78.527},"9070":{"x":47.964,"y":78.186},"9071":{"x":43.291,"y":79.576},"9074":{"x":46.004,"y":78.658},"9076":{"x":45.494,"y":78.648},"9077":{"x":46.581,"y":78.707},"9080":{"x":44.577,"y":78.965},"9083":{"x":44.231,"y":80.058},"9084":{"x":44.104,"y":80.362},"9085":{"x":44.113,"y":80.868},"9086":{"x":44.36,"y":81.303},"9087":{"x":45.197,"y":80.369},"9088":{"x":44.67,"y":80.362},"9089":{"x":45.246,"y":80.362},"9091":{"x":44.793,"y":80.868},"9093":{"x":44.979,"y":81.914},"9095":{"x":45.519,"y":82.379},"9106":{"x":47.111,"y":82.996},"9109":{"x":46.575,"y":82.035},"9114":{"x":49.63,"y":81.381},"9121":{"x":47.263,"y":81.288},"9143":{"x":47.289,"y":79.011},"9145":{"x":47.931,"y":79.499},"9153":{"x":49.134,"y":80.676},"9163":{"x":47.59,"y":83.407},"9166":{"x":47.884,"y":83.6},"9169":{"x":48.387,"y":82.956},"9172":{"x":49.233,"y":82.14},"9178":{"x":50.212,"y":81.83},"9191":{"x":50.66,"y":82.943},"9193":{"x":45.583,"y":79.897},"9200":{"x":49.786,"y":85.763},"9204":{"x":50.286,"y":85.46},"9205":{"x":50.316,"y":85.214},"9206":{"x":50.349,"y":84.982},"9207":{"x":50.363,"y":84.744},"9208":{"x":50.371,"y":84.51},"9215":{"x":51.445,"y":85.844},"9216":{"x":51.465,"y":85.615},"9217":{"x":51.461,"y":85.379},"9218":{"x":51.507,"y":85.144},"9219":{"x":51.51,"y":84.911},"9222":{"x":51.569,"y":84.224},"9224":{"x":51.678,"y":83.516},"9225":{"x":51.694,"y":83.277},"9226":{"x":51.822,"y":82.57},"9227":{"x":51.764,"y":82.806},"9230":{"x":52.008,"y":79.568},"9234":{"x":52.183,"y":80.926},"9237":{"x":52.269,"y":80.211},"9238":{"x":52.004,"y":79.57},"9239":{"x":40.227,"y":77.878},"9240":{"x":51.897,"y":79.18},"9241":{"x":53.057,"y":77.511},"9243":{"x":40.069,"y":76.411},"9253":{"x":53.318,"y":79.32},"9256":{"x":53.067,"y":80.171},"9257":{"x":53.223,"y":80.521},"9258":{"x":53.504,"y":80.926},"9260":{"x":53.201,"y":81.829},"9263":{"x":52.849,"y":82.377},"9264":{"x":53.103,"y":79.661},"9267":{"x":52.687,"y":83.074},"9269":{"x":52.62,"y":83.347},"9270":{"x":53.459,"y":83.523},"9272":{"x":53.42,"y":83.843},"9274":{"x":52.517,"y":84.332},"9280":{"x":52.93,"y":85.747},"9297":{"x":53.605,"y":85.427},"9303":{"x":53.773,"y":83.843},"9304":{"x":54.366,"y":83.867},"9305":{"x":54.959,"y":83.833},"9306":{"x":54.678,"y":83.479},"9308":{"x":53.9,"y":83.28},"9309":{"x":54.551,"y":83.194},"9310":{"x":53.896,"y":82.957},"9322":{"x":53.982,"y":79.32},"9324":{"x":55.508,"y":77.48},"9326":{"x":55.519,"y":77.916},"9327":{"x":55.062,"y":78.091},"9330":{"x":55.456,"y":78.689},"9331":{"x":54.969,"y":79.32},"9338":{"x":56.011,"y":80.53},"9344":{"x":56.347,"y":84.096},"9347":{"x":57.003,"y":82.37},"9348":{"x":56.431,"y":82.38},"9350":{"x":56.779,"y":83.028},"9351":{"x":56.236,"y":83.464},"9352":{"x":54.933,"y":84.509},"9360":{"x":59.19,"y":82.605},"9365":{"x":55.338,"y":84.888},"9378":{"x":58.703,"y":83.756},"9381":{"x":57.774,"y":81.694},"9382":{"x":58.649,"y":81.222},"9388":{"x":58.565,"y":79.719},"9404":{"x":54.368,"y":83.86},"9414":{"x":53.841,"y":81.871},"9419":{"x":53.911,"y":80.926},"9425":{"x":55.078,"y":77.745},"9468":{"x":56.93,"y":85.537},"9748":{"x":53.57,"y":77.593},"9770":{"x":53.087,"y":83.472},"9799":{"x":53.714,"y":84.913},"9907":{"x":53.828,"y":83.582},"9926":{"x":32.974,"y":70.951},"9944":{"x":45.413,"y":78.152},"9949":{"x":53.208,"y":77.863},"9955":{"x":49.564,"y":78.014},"9972":{"x":46.581,"y":78.709},"9981":{"x":56.254,"y":83.419},"9995":{"x":53.572,"y":85.747}};
let postalView={scale:1,x:0,y:0,drag:false,sx:0,sy:0,ox:0,oy:0};
function postalStage(){return $('postalMapStage')}
function postalMap(){return $('requestMap')}
function applyPostalView(){
 const st=postalStage(); if(!st)return;
 const map=postalMap(), w=map?.clientWidth||1,h=map?.clientHeight||1;
 const sc=postalView.scale;
 const minX=w-w*sc,minY=h-h*sc;
 postalView.x=Math.min(0,Math.max(minX,postalView.x));
 postalView.y=Math.min(0,Math.max(minY,postalView.y));
 st.style.transform=`translate(${postalView.x}px,${postalView.y}px) scale(${sc})`;
}
function resetPostalView(){postalView.scale=1;postalView.x=0;postalView.y=0;applyPostalView()}
function zoomPostal(delta,cx,cy){
 const map=postalMap();if(!map)return;
 const r=map.getBoundingClientRect(), px=(cx??(r.left+r.width/2))-r.left,py=(cy??(r.top+r.height/2))-r.top;
 const old=postalView.scale,next=Math.max(1,Math.min(4,old*delta));
 const wx=(px-postalView.x)/old,wy=(py-postalView.y)/old;
 postalView.scale=next;postalView.x=px-wx*next;postalView.y=py-wy*next;applyPostalView();
}
function exactPostalPoint(postal){return POSTAL_EXACT[String(postal||'').trim()]||null}
function focusPostal(postal,locationLabel='Dispatch location',ref='POSTAL '+postal,type='tow',colour='red'){
 postal=String(postal||'').trim();if(!postal)return;
 const point=exactPostalPoint(postal);
 if(!point){
  if($('postalFocusTitle'))$('postalFocusTitle').textContent=`POSTAL ${postal} · NOT MAPPED`;
  if($('postalFocusSub'))$('postalFocusSub').textContent='No verified coordinate was extracted for this postal. No approximate marker has been shown.';
  return;
 }
 const host=$('mapPins');
 if(host)host.innerHTML=`<button class="map-pin ${colour} ${type==='closure'?'closure-pin':''}" style="left:${point.x}%;top:${point.y}%"><span>${type==='closure'?'⛔':'●'}</span><b>${ref} · ${postal}</b><small>${locationLabel}</small></button>`;
 if($('postalSector'))$('postalSector').textContent='FULL SAN ANDREAS · VERIFIED POSTAL LOOKUP';
 if($('postalFocusTitle'))$('postalFocusTitle').textContent=`POSTAL ${postal} · ${ref}`;
 if($('postalFocusSub'))$('postalFocusSub').textContent=`${locationLabel} · verified from supplied postal map`;
 const map=postalMap();if(!map)return;
 const w=map.clientWidth,h=map.clientHeight,targetScale=2.7;
 postalView.scale=targetScale;
 postalView.x=w/2-(point.x/100*w)*targetScale;
 postalView.y=h/2-(point.y/100*h)*targetScale;
 applyPostalView();
}
function previewPostal(){
 const p=($('postalPreviewInput')?.value||'').replace(/\D/g,'').slice(0,5);if(!p)return;
 focusPostal(p,'Postal dispatch location','PREVIEW','tow','red');
}
let lastMapActiveTows=[];
let lastMapActiveClosures=[];
function extractPostalFromRequest(r){
 const candidates=[r?.postal,r?.nearest_postal,r?.location,r?.notes,r?.destination,r?.reason];
 for(const value of candidates){
   const m=String(value||'').match(/(?:postal\s*)?(\d{4,5})/i);
   if(m)return m[1];
 }
 return null;
}
function renderPostalPrototypePins(activeTows=lastMapActiveTows,activeClosures=lastMapActiveClosures){
 const host=$('mapPins');if(!host)return;
 lastMapActiveTows=Array.isArray(activeTows)?activeTows:[];
 lastMapActiveClosures=Array.isArray(activeClosures)?activeClosures:[];
 resetPostalView();

 const all=[];
 (lastMapActiveTows||[]).forEach(t=>{
   const postal=extractPostalFromRequest(t);
   const st=String(t.status||'PENDING');
   const c=st==='ON SCENE'?'green':(st==='EN ROUTE'||st==='CLAIMED')?'amber':'red';
   all.push({postal,ref:t.reference||('TR-'+t.id),location:t.location||'Tow Request',type:'tow',c});
 });
 (lastMapActiveClosures||[]).forEach(r=>{
   const postal=extractPostalFromRequest(r);
   const st=String(r.status||'PENDING');
   const c=st==='ON SCENE'?'green':(st==='EN ROUTE'||st==='CLAIMED')?'amber':'red';
   all.push({postal,ref:r.reference||('RC-'+r.id),location:r.location||'Road Closure',type:'closure',c});
 });

 const mapped=all.filter(d=>d.postal&&POSTAL_EXACT[d.postal]);
 const missingPostal=all.filter(d=>!d.postal).length;
 const unmappedPostal=all.filter(d=>d.postal&&!POSTAL_EXACT[d.postal]).length;

 host.innerHTML=mapped.map(d=>{
   const p=POSTAL_EXACT[d.postal];
   const loc=String(d.location).replace(/'/g,"\\'");
   const ref=String(d.ref).replace(/'/g,"\\'");
   return `<button class="map-pin ${d.c} ${d.type==='closure'?'closure-pin':''}" style="left:${p.x}%;top:${p.y}%" onclick="focusPostal('${d.postal}','${loc}','${ref}','${d.type}','${d.c}')"><span>${d.type==='closure'?'⛔':'●'}</span><b>${d.ref} · ${d.postal}</b><small>${d.location}</small></button>`;
 }).join('');

 if($('postalFocusTitle')){
   $('postalFocusTitle').textContent=all.length?'LIVE DISPATCH JOBS':'NO ACTIVE DISPATCH JOBS';
 }
 if($('postalFocusSub')){
   if(!all.length){
     $('postalFocusSub').textContent='No active tow or road-closure requests are currently open.';
   }else if(mapped.length===all.length){
     $('postalFocusSub').textContent=`${mapped.length} active job${mapped.length===1?'':'s'} shown on the map.`;
   }else{
     const notes=[];
     if(mapped.length)notes.push(`${mapped.length} mapped`);
     if(unmappedPostal)notes.push(`${unmappedPostal} postal${unmappedPostal===1?'':'s'} not in the coordinate map`);
     if(missingPostal)notes.push(`${missingPostal} job${missingPostal===1?'':'s'} without a postal`);
     $('postalFocusSub').textContent=`${all.length} active job${all.length===1?'':'s'} · ${notes.join(' · ')}.`;
   }
 }
}
function initPostalPanZoom(){
 const map=postalMap();if(!map||map.dataset.panReady)return;map.dataset.panReady='1';
 $('postalZoomIn')?.addEventListener('click',e=>{e.stopPropagation();zoomPostal(1.35)});
 $('postalZoomOut')?.addEventListener('click',e=>{e.stopPropagation();zoomPostal(1/1.35)});
 $('postalReset')?.addEventListener('click',e=>{e.stopPropagation();renderPostalPrototypePins(lastMapActiveTows,lastMapActiveClosures)});
 map.addEventListener('wheel',e=>{e.preventDefault();zoomPostal(e.deltaY<0?1.18:1/1.18,e.clientX,e.clientY)},{passive:false});
 map.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;postalView.drag=true;postalView.sx=e.clientX;postalView.sy=e.clientY;postalView.ox=postalView.x;postalView.oy=postalView.y;map.setPointerCapture(e.pointerId);map.classList.add('dragging')});
 map.addEventListener('pointermove',e=>{if(!postalView.drag)return;postalView.x=postalView.ox+(e.clientX-postalView.sx);postalView.y=postalView.oy+(e.clientY-postalView.sy);applyPostalView()});
 const stop=e=>{postalView.drag=false;map.classList.remove('dragging');try{map.releasePointerCapture(e.pointerId)}catch(_){}};
 map.addEventListener('pointerup',stop);map.addEventListener('pointercancel',stop);
 window.addEventListener('resize',applyPostalView);
}
setTimeout(initPostalPanZoom,50);

init();

function selectRelease(id){selectedRelease=id;renderReleases()}
function renderReleases(){
 const host=$('releaseRows'),detail=$('releaseDetail');if(!host||!detail)return;
 const readyAll=records.filter(r=>r.status==='PAID'),released=records.filter(r=>r.status==='RELEASED');
 $('releaseStats').innerHTML=`<div class="rs ready"><i>🔑</i><b>${readyAll.length}</b><span>READY FOR RELEASE<small>Paid vehicles awaiting collection</small></span></div><div class="rs today"><i>✓</i><b>${released.filter(r=>r.released_at&&Date.now()-new Date(r.released_at)<86400000).length}</b><span>RELEASED TODAY<small>Collections completed today</small></span></div><div class="rs total"><i>▰</i><b>${released.length}</b><span>TOTAL RELEASED<small>Recorded vehicle releases</small></span></div>`;
 const q=($('releaseSearch')?.value||'').trim().toLowerCase(),lot=$('releaseLot')?.value||'ALL';
 const rows=readyAll.filter(r=>(!q||(`${r.registration} ${r.vehicle} IMP-${r.id}`).toLowerCase().includes(q))&&(lot==='ALL'||r.impound_lot===lot));
 if(selectedRelease&&!rows.some(r=>r.id===selectedRelease))selectedRelease=null;if(!selectedRelease&&rows[0])selectedRelease=rows[0].id;
 host.innerHTML=rows.map(r=>`<button class="release-row ${selectedRelease===r.id?'selected':''}" onclick="selectRelease(${r.id})"><img src="${impoundImage(r)}"><b>${esc(r.registration)}</b><span>${esc(r.vehicle||'Vehicle')}</span><span><i class="colour-dot" style="background:${esc(String(r.colour||'grey').toLowerCase())}"></i>${esc(r.colour||'—')}</span><small>${r.paid_at?new Date(r.paid_at).toLocaleString('en-GB'):'PAID'}</small><strong>$${Number(r.fee).toFixed(0)}</strong><em>›</em></button>`).join('')||'<div class="release-empty">No vehicles are currently ready for release.</div>';
 const r=records.find(x=>x.id===selectedRelease);if(!r){detail.innerHTML='<div class="release-empty">Select a vehicle ready for collection.</div>';return}
 detail.innerHTML=`<div class="release-ready">● READY FOR RELEASE <small>IMP-${String(r.id).padStart(4,'0')}</small></div><button class="release-photo" onclick="openVehicleLightbox(${r.id})"><img src="${impoundImage(r)}"><span>⌕ CLICK TO ENLARGE</span></button><h2>${esc(r.vehicle||'Vehicle')}</h2><div class="release-meta"><b>${esc(r.registration)}</b><span>${esc(r.colour||'—')}</span><span>${esc(r.impound_lot||'—')}</span></div><div class="release-info"><h4>IMPOUND DETAILS</h4><dl><dt>Impounded</dt><dd>${new Date(r.created_at).toLocaleString('en-GB')}</dd><dt>Reason</dt><dd>${esc(r.reason||'—')}</dd><dt>Impounded By</dt><dd>${esc(r.impounded_by||'DOT')}</dd></dl></div><div class="release-info paid-box"><h4>PAYMENT VERIFIED ✓</h4><dl><dt>Fee</dt><dd>$${Number(r.fee).toFixed(2)}</dd><dt>Reference</dt><dd>${esc(r.payment_reference||'PAYMENT ON FILE')}</dd><dt>Paid Date</dt><dd>${r.paid_at?new Date(r.paid_at).toLocaleString('en-GB'):'Recorded'}</dd></dl></div><button class="release-primary big" onclick="releaseVehicle(${r.id})">🔑 &nbsp; RELEASE VEHICLE</button><button class="release-secondary" onclick="switchTab('vehicles');expandedImpound=${r.id};render()">VIEW IMPOUND RECORD</button>`;
}

function openMapRequest(type,id){switchTab(type==='closure'?'closures':'tows');setTimeout(()=>{const el=document.querySelector(`[data-request-id="${type}-${id}"]`);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('request-focus');setTimeout(()=>el.classList.remove('request-focus'),2200)}},80)}
async function closureStatus(id,status){const r=closures.find(x=>x.id===id);if(!r)return;if(location.protocol==='file:'){r.status=status;if(status==='CLAIMED'&&!r.claimed_by)r.claimed_by=me.username;render();return}const patch={status};if(status==='CLAIMED')patch.claimed_by=me.username;if(status==='COMPLETE')patch.completed_at=new Date().toISOString();const {error}=await sb.from('road_closure_requests').update(patch).eq('id',id);if(error)return alert(error.message);await refresh()}
function renderClosures(){if(!$('closureRows'))return;const list=closures.filter(x=>!['CANCELLED'].includes(x.status));$('closureRows').innerHTML=list.map(r=>{const st=r.status||'PENDING',ref=r.reference||('RC-'+String(r.id).padStart(4,'0'));return `<article class="closure-card" data-request-id="closure-${r.id}"><div class="closure-top"><div><small>ROAD CLOSURE REQUEST</small><h2>${esc(ref)}</h2></div><span class="badge tow-${st.toLowerCase().replace(' ','-')}">${esc(st)}</span></div><div class="closure-location">⛔ <div><small>LOCATION</small><b>${esc(r.location)}</b></div></div><div class="closure-fields"><div><small>CLOSURE TYPE</small><b>${esc(r.closure_type||'Road Closure')}</b></div><div><small>PRIORITY</small><b>${esc(r.priority||'ROUTINE')}</b></div><div><small>AGENCY</small><b>${esc(r.agency||'')}</b></div><div><small>OFFICER</small><b>${esc(r.requesting_officer||'')}</b></div><div><small>DURATION</small><b>${esc(r.duration||'Unknown')}</b></div><div><small>DOT UNIT</small><b>${esc(r.claimed_by||'Awaiting DOT')}</b></div><div class="wide"><small>REASON / INCIDENT</small><span>${esc(r.reason||'')}</span></div><div class="wide"><small>NOTES</small><span>${esc(r.notes||'None')}</span></div></div><div class="closure-actions">${st==='PENDING'?`<button class="action-claim" onclick="closureStatus(${r.id},'CLAIMED')">CLAIM REQUEST</button>`:''}${st==='CLAIMED'?`<button class="action-enroute" onclick="closureStatus(${r.id},'EN ROUTE')">MARK EN ROUTE</button>`:''}${st==='EN ROUTE'?`<button class="action-onscene" onclick="closureStatus(${r.id},'ON SCENE')">MARK ON SCENE</button>`:''}${st==='ON SCENE'?`<button class="action-impound" onclick="closureStatus(${r.id},'COMPLETE')">REOPEN ROAD / COMPLETE</button>`:''}${st==='COMPLETE'?'<span class="closed-action">ROAD REOPENED · REQUEST COMPLETE</span>':''}</div></article>`}).join('')||'<div class="empty">No road closure requests.</div>'}


// v4.35.1 Interactive Vehicle Checklist + operator profile
const CHECK_ITEMS=[
  ['tyres','◉','TYRES & WHEELS','Condition, pressure and wheel security','WALKAROUND','Visual tyre / wheel-security check','Walk around the unit. Check tyre condition, obvious pressure issues and that the wheels look secure.'],
  ['lights','✦','LIGHTS & BEACONS','Headlights, brake lights and amber beacons','LIGHT CYCLE','Cycling road lamps and warning beacons','Cycle the road lights and warning equipment. Make sure everything that should illuminate actually does.'],
  ['brakes','⬡','BRAKES','Service brake, parking brake and pedal feel','PEDAL TEST','Brake response and parking-brake check','Check the service brake, parking brake and pedal response before the unit moves off.'],
  ['fluids','◒','FLUID LEVELS','Oil, coolant, washer fluid and visible leaks','BAY CHECK','Fluid-bay and visible-leak inspection','Check the main fluid levels and look underneath or around the engine bay for anything obviously leaking.'],
  ['body','▰','BODY & GLASS','Mirrors, windscreen and exterior damage','BODY SCAN','Exterior, mirror and glass walkaround','Walk around the body. Check mirrors, windscreen, glass and any fresh exterior damage.'],
  ['tow','⌁','TOW EQUIPMENT','Winch, hook, straps, chains and wheel lift','GEAR CHECK','Recovery equipment and securing-gear check','Check recovery gear is present, secure and ready: winch, hook, straps, chains and wheel-lift equipment.'],
  ['safety','+','SAFETY EQUIPMENT','Cones, extinguisher, first aid and hi-vis','KIT CHECK','Safety equipment inventory verification','Confirm the safety kit is onboard and usable: cones, extinguisher, first aid and high-visibility equipment.'],
  ['radio','⌁','RADIO / MDT','Radio, MDT and dispatch connection','COMMS TEST','Radio and MDT connection check','Make sure radio and MDT are powered, connected and ready for dispatch traffic.'],
  ['cab','▣','CAB CONTROLS','Horn, wipers, gauges and seat belts','CONTROL SWEEP','Cab controls and driver-safety check','From the driver seat, check horn, wipers, gauges, warning lamps and seat belt.'],
  ['fuel','▥','FUEL / CHARGE','Sufficient level for operational shift','LEVEL CHECK','Operational fuel / charge level check','Confirm the unit has enough fuel or charge to complete an operational shift without an immediate stop.']
];

let checklistState={},checklistTested={},checklistHistory=[],loadedChecklistId=null;
let activeChecklistTest=null,walkaroundTimer=null,testFinishTimer=null,walkaroundRunning=false,walkaroundIndex=0;
let checklistMode='guided',guidedIndex=0,guidedAdvanceTimer=null;

function checklistStorageKey(){return 'sadot_checklists_'+(me?.id||me?.username||'operator')}

function signedInUnitName(){return String(me?.username||'').trim()}
function applySignedInChecklistUnit(force=false){
  const input=$('checkUnit');
  if(!input||!me)return;
  const unit=signedInUnitName();
  input.readOnly=true;
  if(force || !input.value.trim() || input.dataset.autoUnit==='1'){
    input.value=unit;
    input.dataset.autoUnit='1';
  }
}

function readLocalChecklistHistory(){try{return JSON.parse(localStorage.getItem(checklistStorageKey())||'[]')}catch{return []}}
function writeLocalChecklistHistory(){localStorage.setItem(checklistStorageKey(),JSON.stringify(checklistHistory.slice(0,40)))}

async function loadChecklistHistory(){
  if(!me)return;
  if(location.protocol==='file:'){checklistHistory=readLocalChecklistHistory();renderProfileHistory();return}
  const {data,error}=await sb.from('vehicle_checklists').select('*').eq('operator_id',me.id).order('completed_at',{ascending:false}).limit(40);
  if(error){console.warn('Checklist history unavailable; using browser storage.',error.message);checklistHistory=readLocalChecklistHistory()}else checklistHistory=data||[];
  renderProfileHistory();
}

function toggleProfileMenu(e){e?.stopPropagation();$('profileMenu')?.classList.toggle('hidden');renderProfileHistory()}
function closeProfileMenu(){$('profileMenu')?.classList.add('hidden')}
document.addEventListener('click',e=>{if(!e.target.closest('.operator-wrap'))closeProfileMenu()});

function renderProfileHistory(){
  if($('profileName'))$('profileName').textContent=me?.username||'DOT';
  if($('profileDisplayName'))$('profileDisplayName').textContent=getOperatorProfile().name||'SA DOT OPERATOR';
  const host=$('profileChecklistHistory');if(!host)return;
  host.innerHTML=checklistHistory.length?checklistHistory.map((x,i)=>`<button onclick="loadSavedChecklist(${i})"><b>${esc(x.unit_number||'UNIT NOT RECORDED')} · ${esc(x.vehicle||'Vehicle')}</b><span>${new Date(x.completed_at).toLocaleString('en-GB')} · ${Object.values(x.checks||{}).filter(v=>v==='issue').length?'<strong>ISSUES RECORDED</strong>':'ALL SYSTEMS PASS'}</span></button>`).join(''):'<div class="profile-empty">No completed inspections yet.</div>';
}

function inspectionDiagnosticMarkup(key){
  const bars=key==='radio'?'<i></i><i></i><i></i><i></i>':'<i></i><i></i><i></i>';
  return `<div class="diagnostic-visual diagnostic-${key}" aria-hidden="true"><span></span>${bars}</div>`;
}

function renderChecklist(){
  const host=$('inspectionGrid');if(!host||!me)return;
  applySignedInChecklistUnit();
  $('inspectionOperator').textContent='Operator: '+me.username;
  host.innerHTML=CHECK_ITEMS.map(([key,icon,title,desc,testLabel,testDesc],i)=>{
    const state=checklistState[key]||'';
    const tested=!!checklistTested[key];
    const testing=activeChecklistTest===key;
    return `<article class="inspection-item ${state} ${tested?'tested':''} ${testing?'testing':''}" data-check="${key}">
      <div class="inspection-icon">${icon}</div>
      <div class="inspection-copy">
        <div class="inspection-line"><b>${String(i+1).padStart(2,'0')} · ${title}</b>${tested?'<em>TESTED ✓</em>':''}</div>
        <small>${desc}</small>
        <div class="diagnostic-status">${testing?`<strong>RUNNING ${testLabel}…</strong><span>${testDesc}</span>`:tested?`<strong>DIAGNOSTIC COMPLETE</strong><span>${testDesc}</span>`:'<strong>READY</strong><span>Optional diagnostic available</span>'}</div>
      </div>
      ${inspectionDiagnosticMarkup(key)}
      <div class="inspection-actions">
        <button class="test-btn ${tested?'tested-btn':''}" onclick="runInspectionTest('${key}')" ${testing?'disabled':''}>${testing?'TESTING…':tested?'↻ RETEST':'▶ TEST'}</button>
        <button class="pass-btn" onclick="setInspection('${key}','pass')">✓ PASS</button>
        <button class="issue-btn" onclick="setInspection('${key}','issue')">! ISSUE</button>
      </div>
    </article>`;
  }).join('');
  updateChecklistProgress();
  updateInspectionSession();
  renderGuidedInspection();
  applyChecklistMode();
}

function runInspectionTest(key){
  if(activeChecklistTest || walkaroundRunning)return;
  if(!CHECK_ITEMS.some(x=>x[0]===key))return;

  clearTimeout(testFinishTimer);
  activeChecklistTest=key;
  renderChecklist();

  // Keep the page still. The diagnostic itself is the feedback.
  testFinishTimer=setTimeout(()=>{
    checklistTested[key]=true;
    activeChecklistTest=null;
    saveChecklistDraft();
    renderChecklist();
    pulseInspectionCard(key,'tested-pop');
    pulseGuidedCard('guided-tested-pop');
  },1900);
}

function pulseInspectionCard(key,cls){
  const card=document.querySelector(`.inspection-item[data-check="${key}"]`);
  if(!card)return;
  card.classList.remove(cls);void card.offsetWidth;card.classList.add(cls);
  setTimeout(()=>card.classList.remove(cls),700);
}

function setInspection(key,state){
  checklistState[key]=state;
  loadedChecklistId=null;
  renderChecklist();
  saveChecklistDraft();
  pulseInspectionCard(key,state==='pass'?'pass-pop':'issue-pop');
  pulseGuidedCard(state==='pass'?'guided-pass-pop':'guided-issue-pop');
}


function readChecklistMode(){
  try{return localStorage.getItem('sadot_checklist_mode')||'guided'}catch{return 'guided'}
}
function setChecklistMode(mode){
  checklistMode=mode==='overview'?'overview':'guided';
  try{localStorage.setItem('sadot_checklist_mode',checklistMode)}catch{}
  applyChecklistMode();
  renderGuidedInspection();
}
function applyChecklistMode(){
  $('guidedInspection')?.classList.toggle('hidden',checklistMode!=='guided');
  $('inspectionOverview')?.classList.toggle('hidden',checklistMode!=='overview');
  $('guidedModeBtn')?.classList.toggle('active',checklistMode==='guided');
  $('overviewModeBtn')?.classList.toggle('active',checklistMode==='overview');
  if($('modeHelper'))$('modeHelper').textContent=checklistMode==='guided'
    ?'One check at a time. Less clutter, same inspection.'
    :'See every check together and jump around freely.';
}
function guidedItem(){return CHECK_ITEMS[Math.max(0,Math.min(CHECK_ITEMS.length-1,guidedIndex))]}
function guidedDetailsReady(){return !!$('checkUnit')?.value.trim() && !!$('checkVehicle')?.value.trim()}

function renderGuidedInspection(){
  if(!$('guidedCard'))return;
  guidedIndex=Math.max(0,Math.min(CHECK_ITEMS.length-1,guidedIndex));
  const item=guidedItem();if(!item)return;
  const [key,icon,title,desc,testLabel,testDesc,tip]=item;
  const state=checklistState[key]||'';
  const tested=!!checklistTested[key];
  const testing=activeChecklistTest===key;
  const ready=guidedDetailsReady();

  if($('guidedStepNo'))$('guidedStepNo').textContent=String(guidedIndex+1).padStart(2,'0');
  if($('guidedIcon'))$('guidedIcon').textContent=icon;
  if($('guidedStepCount'))$('guidedStepCount').textContent=`STEP ${guidedIndex+1} OF ${CHECK_ITEMS.length}`;
  if($('guidedKicker'))$('guidedKicker').textContent=state==='pass'?'PASSED ✓':state==='issue'?'ISSUE RECORDED':tested?'TEST COMPLETE':'CURRENT CHECK';
  if($('guidedTitle'))$('guidedTitle').textContent=title;
  if($('guidedDesc'))$('guidedDesc').textContent=desc;
  if($('guidedTip'))$('guidedTip').textContent=tip;

  const diag=$('guidedDiagnosticHost');
  if(diag)diag.innerHTML=`<div class="guided-diagnostic ${testing?'testing':''} ${tested?'tested':''}">${inspectionDiagnosticMarkup(key)}<div><b>${testing?'RUNNING '+testLabel+'…':tested?'DIAGNOSTIC COMPLETE':ready?'OPTIONAL TEST READY':'ADD UNIT DETAILS TO BEGIN'}</b><span>${testing?testDesc:tested?'You can retest it, or mark the result below.':ready?'Run the RP diagnostic, or simply PASS / ISSUE if you have checked it manually.':'Enter the unit number and choose the vehicle above.'}</span></div></div>`;

  const testBtn=$('guidedTestBtn'),passBtn=$('guidedPassBtn'),issueBtn=$('guidedIssueBtn');
  if(testBtn){
    testBtn.disabled=!ready||walkaroundRunning|| (!!activeChecklistTest && activeChecklistTest!==key);
    testBtn.textContent=testing?'TESTING…':tested?'↻ RETEST':'▶ RUN TEST';
  }
  if(passBtn){passBtn.disabled=!ready;passBtn.classList.toggle('selected',state==='pass')}
  if(issueBtn){issueBtn.disabled=!ready;issueBtn.classList.toggle('selected',state==='issue')}
  if($('guidedPrevBtn'))$('guidedPrevBtn').disabled=guidedIndex===0;
  if($('guidedNextBtn'))$('guidedNextBtn').disabled=guidedIndex===CHECK_ITEMS.length-1;

  const route=$('guidedRoute');
  if(route)route.innerHTML=CHECK_ITEMS.map((x,i)=>{
    const s=checklistState[x[0]]||'',t=!!checklistTested[x[0]];
    return `<button type="button" class="${i===guidedIndex?'current ':''}${s||''} ${t?'tested':''}" onclick="goGuidedStep(${i})" title="${x[2]}"><span>${i+1}</span><em>${x[2]}</em></button>`;
  }).join('');

  const done=CHECK_ITEMS.filter(x=>checklistState[x[0]]).length;
  let head='TEN QUICK CHECKS',sub='Take them one at a time.';
  if(done>=1&&done<=3){head='GOOD START';sub=`${done} down. Keep the rhythm going.`}
  else if(done>=4&&done<=6){head='YOU’RE FLYING THROUGH IT';sub=`${CHECK_ITEMS.length-done} checks left.`}
  else if(done>=7&&done<10){head='NEARLY THERE';sub=`Only ${CHECK_ITEMS.length-done} to go.`}
  else if(done===10){head='WALKAROUND COMPLETE';sub='Review the result, then lock and file it.'}
  if($('guidedMomentum'))$('guidedMomentum').textContent=head;
  if($('guidedMomentumSub'))$('guidedMomentumSub').textContent=sub;

  const card=$('guidedCard');
  card.classList.toggle('guided-state-pass',state==='pass');
  card.classList.toggle('guided-state-issue',state==='issue');
  card.classList.toggle('guided-testing',testing);
  card.classList.toggle('guided-locked',!ready);

  // Compact vehicle visual to the right of the guided checklist.
  [...card.classList].filter(c=>c.startsWith('mini-truck-test-')).forEach(c=>card.classList.remove(c));
  if(testing)card.classList.add('mini-truck-test-'+key);

  const truckTitle=$('miniTruckTitle'),truckState=$('miniTruckState'),truckSystem=$('miniTruckSystem');
  if(truckTitle)truckTitle.textContent=($('checkVehicle')?.value||'DOT UNIT').toUpperCase();
  if(truckState)truckState.textContent=testing?'TESTING':state==='pass'?'PASS':state==='issue'?'ISSUE':tested?'TESTED':'READY';
  if(truckSystem)truckSystem.textContent=testing?title+' · ACTIVE':state==='pass'?title+' · PASS':state==='issue'?title+' · ISSUE':tested?title+' · TESTED':title;
  applyMiniTruckVariant();
  initChecklistVehicle3D();
  sendChecklistVehicleState({system:key,title,state,tested,testing});
}
function goGuidedStep(index){
  guidedIndex=Math.max(0,Math.min(CHECK_ITEMS.length-1,Number(index)||0));
  renderGuidedInspection();
}
function moveGuidedStep(delta){
  goGuidedStep(guidedIndex+delta);
}
function runCurrentGuidedTest(){
  const item=guidedItem();if(!item||!guidedDetailsReady())return;
  runInspectionTest(item[0]);
}
function setGuidedInspection(state){
  const item=guidedItem();if(!item||!guidedDetailsReady())return;
  const currentIndex=guidedIndex;
  setInspection(item[0],state);
  clearTimeout(guidedAdvanceTimer);
  if(currentIndex<CHECK_ITEMS.length-1){
    guidedAdvanceTimer=setTimeout(()=>{
      guidedIndex=currentIndex+1;
      renderGuidedInspection();
      pulseGuidedCard('guided-next-pop');
    },380);
  }
}
function pulseGuidedCard(cls){
  const card=$('guidedCard');if(!card||checklistMode!=='guided')return;
  card.classList.remove(cls);void card.offsetWidth;card.classList.add(cls);
  setTimeout(()=>card.classList.remove(cls),650);
}
function updateChecklistProgress(){
  const done=CHECK_ITEMS.filter(x=>checklistState[x[0]]).length;
  const tested=CHECK_ITEMS.filter(x=>checklistTested[x[0]]).length;
  const passes=Object.values(checklistState).filter(x=>x==='pass').length;
  const issues=Object.values(checklistState).filter(x=>x==='issue').length;
  const p=Math.round(done/CHECK_ITEMS.length*100);

  $('progressRing')?.style.setProperty('--p',p);
  if($('progressNumber'))$('progressNumber').textContent=p+'%';
  if($('progressText'))$('progressText').textContent=`${done} / ${CHECK_ITEMS.length} inspected`;
  if($('testedCount'))$('testedCount').textContent=tested;
  if($('passCount'))$('passCount').textContent=passes;
  if($('issueCount'))$('issueCount').textContent=issues;

  const ready=done===CHECK_ITEMS.length&&$('checkUnit')?.value.trim()&&$('checkVehicle')?.value.trim();
  if($('completeChecklist'))$('completeChecklist').disabled=!ready;

  if($('checklistMessage')){
    $('checklistMessage').innerHTML=done<CHECK_ITEMS.length
      ?`<b>INSPECTION ACTIVE</b><span>${CHECK_ITEMS.length-done} system${CHECK_ITEMS.length-done===1?'':'s'} still need a PASS or ISSUE.</span>`
      :issues
        ?`<b>${issues} ISSUE${issues===1?'':'S'} RECORDED</b><span>Inspection can be filed with defects noted.</span>`
        :'<b>UNIT READY</b><span>All systems inspected. Lock and file when ready.</span>';
  }

  const banner=$('inspectionCompleteBanner');
  if(banner){
    banner.classList.toggle('hidden',done!==CHECK_ITEMS.length);
    if(done===CHECK_ITEMS.length){
      $('inspectionCompleteSub').textContent=issues
        ?`${issues} defect${issues===1?'':'s'} recorded · inspection ready to file.`
        :'All ten systems passed · unit ready for operational service.';
    }
  }
}

function updateInspectionSession(){
  applyMiniTruckVariant();
  const el=$('inspectionSessionState');if(!el)return;
  const hasUnit=!!$('checkUnit')?.value.trim(),hasVehicle=!!$('checkVehicle')?.value.trim();
  const done=CHECK_ITEMS.filter(x=>checklistState[x[0]]).length;
  if(loadedChecklistId){el.textContent='FILED RECORD';el.className='tablet-session filed';return}
  if(!hasUnit&&!hasVehicle&&done===0){el.textContent='STANDBY';el.className='tablet-session';return}
  if(hasUnit&&hasVehicle){el.textContent=done===CHECK_ITEMS.length?'READY TO FILE':'INSPECTION ACTIVE';el.className='tablet-session active';return}
  el.textContent='UNIT DETAILS REQUIRED';el.className='tablet-session warning';
}

function focusNextInspection(){
  const index=CHECK_ITEMS.findIndex(x=>!checklistState[x[0]]);
  if(index<0){$('completeChecklist')?.focus();return}
  if(checklistMode==='guided'){
    guidedIndex=index;
    renderGuidedInspection();
    $('guidedCard')?.scrollIntoView({behavior:'smooth',block:'center'});
    pulseGuidedCard('guided-next-pop');
    return;
  }
  const key=CHECK_ITEMS[index][0];
  const card=document.querySelector(`.inspection-item[data-check="${key}"]`);
  if(card){
    card.scrollIntoView({behavior:'smooth',block:'center'});
    card.classList.remove('next-focus');void card.offsetWidth;card.classList.add('next-focus');
    setTimeout(()=>card.classList.remove('next-focus'),1000);
  }
}

function stopWalkaroundSequence(){
  walkaroundRunning=false;
  clearTimeout(walkaroundTimer);
  walkaroundTimer=null;
  activeChecklistTest=null;

  const btn=$('walkaroundBtn');
  if(btn){
    btn.textContent='AUTO WALKAROUND';
    btn.classList.remove('walkaround-running');
  }

  const helper=$('inspectionInstructions')?.querySelector('span');
  if(helper)helper.textContent='Run checks manually, or use AUTO WALKAROUND to test each system, mark PASS and move to the next step automatically.';

  renderChecklist();
}

function runWalkaroundSequence(){
  if(walkaroundRunning){
    stopWalkaroundSequence();
    return;
  }

  if(activeChecklistTest)return;

  walkaroundRunning=true;
  walkaroundIndex=0;

  // Start at the first incomplete check where possible.
  const firstIncomplete=CHECK_ITEMS.findIndex(x=>!checklistState[x[0]]);
  if(firstIncomplete>=0)walkaroundIndex=firstIncomplete;

  const btn=$('walkaroundBtn');
  if(btn){
    btn.textContent='■ STOP AUTO WALKAROUND';
    btn.classList.add('walkaround-running');
  }

  const helper=$('inspectionInstructions')?.querySelector('span');

  const advance=()=>{
    if(!walkaroundRunning)return;

    if(walkaroundIndex>=CHECK_ITEMS.length){
      walkaroundRunning=false;
      walkaroundTimer=null;
      activeChecklistTest=null;

      if(btn){
        btn.textContent='RUN AUTO WALKAROUND AGAIN';
        btn.classList.remove('walkaround-running');
      }
      if(helper)helper.textContent='Auto walkaround complete. All ten checks have been tested and marked PASS. You can change any result manually if required.';

      renderChecklist();
      return;
    }

    const item=CHECK_ITEMS[walkaroundIndex];
    const key=item[0];

    activeChecklistTest=key;
    guidedIndex=walkaroundIndex;

    if(helper){
      helper.textContent=`Auto walkaround ${walkaroundIndex+1} of ${CHECK_ITEMS.length}: testing ${item[2]}. This check will PASS automatically when the diagnostic finishes.`;
    }

    renderChecklist();

    // Show each diagnostic clearly.
    walkaroundTimer=setTimeout(()=>{
      if(!walkaroundRunning)return;

      checklistTested[key]=true;
      checklistState[key]='pass';
      activeChecklistTest=null;

      saveChecklistDraft();
      renderChecklist();
      pulseInspectionCard(key,'pass-pop');
      pulseGuidedCard('guided-pass-pop');

      // Keep the PASS state visible before moving on.
      walkaroundTimer=setTimeout(()=>{
        if(!walkaroundRunning)return;
        walkaroundIndex+=1;

        if(walkaroundIndex<CHECK_ITEMS.length){
          guidedIndex=walkaroundIndex;
          renderChecklist();
        }

        walkaroundTimer=setTimeout(advance,300);
      },700);
    },1850);
  };

  advance();
}

function saveChecklistDraft(){
  applySignedInChecklistUnit();
  updateChecklistProgress();updateInspectionSession();renderGuidedInspection();
  if(!me)return;
  localStorage.setItem(checklistStorageKey()+'_draft',JSON.stringify({
    unit:$('checkUnit')?.value||'',
    vehicle:$('checkVehicle')?.value||'',
    checks:checklistState,
    tested:checklistTested
  }));
}

function setChecklistVehicleValue(value){
  const select=$('checkVehicle');if(!select)return;
  const v=value||'';
  const known=[...select.options].some(o=>o.value===v);
  if(v && !known){
    const legacy=document.createElement('option');
    legacy.value=v;legacy.textContent=v+' (SAVED RECORD)';legacy.dataset.legacy='1';
    select.appendChild(legacy);
  }
  select.value=v;
}

function restoreChecklistDraft(){
  try{
    const d=JSON.parse(localStorage.getItem(checklistStorageKey()+'_draft')||'null');
    if(!d){ applySignedInChecklistUnit(true); renderChecklist(); return; }
    $('checkUnit').value=d.unit||'';
    setChecklistVehicleValue(d.vehicle||'');
    checklistState=d.checks||{};
    checklistTested=d.tested||{};
  }catch{}
  applySignedInChecklistUnit(!($('checkUnit')?.value||'').trim());
  renderChecklist();
}


async function completeVehicleChecklist(){
  if($('completeChecklist')?.disabled)return;
  const row={
    operator_id:me.id,
    operator_username:me.username,
    unit_number:$('checkUnit').value.trim(),
    vehicle:$('checkVehicle').value.trim(),
    checks:{...checklistState},
    completed_at:new Date().toISOString()
  };
  if(location.protocol==='file:'){
    row.id='local-'+Date.now();checklistHistory.unshift(row);writeLocalChecklistHistory();
  }else{
    const {data,error}=await sb.from('vehicle_checklists').insert(row).select().single();
    if(error){alert('Checklist could not be filed: '+error.message+'\n\nRun the included v4.28 checklist SQL in Supabase first.');return}
    checklistHistory.unshift(data);
  }
  localStorage.removeItem(checklistStorageKey()+'_draft');
  loadedChecklistId=row.id;
  renderProfileHistory();
  $('checklistMessage').innerHTML='<b>INSPECTION FILED ✓</b><span>Saved to your operator profile with date and time.</span>';
  $('completeChecklist').disabled=true;
  $('completeChecklist').textContent='INSPECTION FILED ✓';
  updateInspectionSession();
  const banner=$('inspectionCompleteBanner');
  if(banner){
    banner.classList.remove('hidden');
    $('inspectionCompleteSub').textContent='Inspection locked to operator profile.';
    banner.classList.remove('filed-pop');void banner.offsetWidth;banner.classList.add('filed-pop');
  }
}

function loadSavedChecklist(index){
  const x=checklistHistory[index];if(!x)return;
  closeProfileMenu();switchTab('checklist');loadedChecklistId=x.id;
  $('checkUnit').value=x.unit_number||signedInUnitName()||'';
  $('checkUnit').dataset.autoUnit = (String($('checkUnit').value).trim()===signedInUnitName()) ? '1' : '0';
  setChecklistVehicleValue(x.vehicle||'');
  checklistState={...(x.checks||{})};
  checklistTested={};
  renderChecklist();
  $('inspectionTitle').textContent='FILED INSPECTION';
  $('checklistMessage').innerHTML=`<b class="loaded-banner">SAVED INSPECTION</b><span>${new Date(x.completed_at).toLocaleString('en-GB')} · ${esc(x.operator_username||me.username)}</span>`;
  $('completeChecklist').disabled=true;
  $('completeChecklist').textContent='SAVED RECORD';
  updateInspectionSession();
}

function newVehicleChecklist(){
  if(walkaroundTimer){clearTimeout(walkaroundTimer);walkaroundTimer=null}
  walkaroundRunning=false;activeChecklistTest=null;clearTimeout(testFinishTimer);testFinishTimer=null;
  activeChecklistTest=null;loadedChecklistId=null;checklistState={};checklistTested={};guidedIndex=0;
  $('checkUnit').value='';
  applySignedInChecklistUnit(true);
  setChecklistVehicleValue('');
  $('inspectionTitle').textContent='UNIT SAFETY CHECK';
  $('completeChecklist').textContent='LOCK & FILE INSPECTION →';
  renderChecklist();saveChecklistDraft();
}

checklistMode=readChecklistMode();
setInterval(()=>{if($('checklistClock'))$('checklistClock').textContent=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})},1000);
