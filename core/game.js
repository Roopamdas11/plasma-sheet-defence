'use strict';
// ═══════════════════════════════════════════════════════════════════════
// PLASMA SHEET DEFENSE — core/game.js
// Brand system: T() delegates to BrandEngine.getLegacyTheme().
// To add a brand: drop /brands/<id>.brand.js, regenerate manifest. Done.
// ═══════════════════════════════════════════════════════════════════════

// ── CANVAS / RESIZE ───────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W=1,H=1,DPR=1,CX,CY,towerX,towerY;
let _resizePending=false;
function applyResize(){
  _resizePending=false;
  if(typeof _invalidateBgCache==='function')_invalidateBgCache();
  const vp=window.visualViewport;
  W=vp?vp.width:window.innerWidth;
  H=vp?vp.height:window.innerHeight;
  DPR=ultraMode?1:Math.min(window.devicePixelRatio||1,3);
  canvas.width=Math.round(W*DPR); canvas.height=Math.round(H*DPR);
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  CX=W/2; CY=H/2; towerX=W/2; towerY=H*0.65;
  if(typeof layoutControls==='function') layoutControls();
}
function scheduleResize(){if(!_resizePending){_resizePending=true;requestAnimationFrame(applyResize);}}
window.addEventListener('resize',scheduleResize);
window.addEventListener('orientationchange',scheduleResize);
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',scheduleResize);
  window.visualViewport.addEventListener('scroll',scheduleResize);
}

// ── BRAND ADAPTER ─────────────────────────────────────────────────────
// T() returns the cached theme — refreshed once per render frame via _refreshTheme().
// Do NOT call T() inside inner loops; use the local `th` variable instead.
let _cachedTheme = null;
function T(){ return _cachedTheme || (_cachedTheme = window.BrandEngine.getLegacyTheme()); }
function _refreshTheme(){ _cachedTheme = window.BrandEngine.getLegacyTheme(); }
window.addEventListener('brandChanged', ()=>{ _cachedTheme = null; });

// ── GLYPH SPRITE CACHE ────────────────────────────────────────────────
// Pre-renders every enemy-skin glyph to an offscreen canvas once.
// drawImage is GPU-blit (~10× faster than fillText per frame).
//
// Cache key: `${glyph}:${size}` where size is the offscreen canvas px.
// We use a fixed set of sizes (one per distinct enemy radius) to keep
// the cache small. On brand change the cache is cleared and rebuilt
// lazily on the next frame each enemy type is encountered.
// ─────────────────────────────────────────────────────────────────────
const _glyphCache = new Map();   // key → HTMLCanvasElement

// Call this whenever the brand changes so old glyphs are re-rendered
// with the new emoji set (in case a brand changes the skin map).
function clearGlyphCache(){ _glyphCache.clear(); }
window.addEventListener('brandChanged', clearGlyphCache);

// Returns a pre-rendered canvas for a glyph at a given display size.
// `displaySize` = the enemy's radius * 2 in CSS pixels (we add padding).
function getGlyphSprite(glyph, displayRadius) {
  // Round to nearest 4px bucket — avoids cache explosion while keeping quality
  const bucket = Math.max(Math.ceil(displayRadius / 4) * 4, 12);
  const key = glyph + ':' + bucket;
  if (_glyphCache.has(key)) return _glyphCache.get(key);

  // Offscreen canvas — render at 2× for crispness on high-DPI
  const scale = 2;
  const canvasSize = (bucket * 2 + 8) * scale;  // diameter + padding, then ×2
  const oc = document.createElement('canvas');
  oc.width = canvasSize; oc.height = canvasSize;
  const c = oc.getContext('2d');

  // Font size fills ~90% of the canvas diameter
  const fs = Math.round(bucket * 1.7 * scale);
  c.font = `${fs}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif`;
  c.textAlign    = 'center';
  c.textBaseline = 'middle';

  // Shadow for depth
  c.shadowColor = 'rgba(0,0,0,0.85)';
  c.shadowBlur  = 5 * scale;

  c.fillStyle = '#ffffff';
  c.fillText(glyph, canvasSize / 2, canvasSize / 2);

  _glyphCache.set(key, oc);
  return oc;
}

// ── AUDIO ─────────────────────────────────────────────────────────────
let audioCtx=null,masterGain=null,musicBus=null,sfxBus=null;
let sfxMuted=false,musicMuted=false;
function initAudio(){
  if(audioCtx){if(audioCtx.state==='suspended')audioCtx.resume();return;}
  try{
    audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    masterGain=audioCtx.createGain();masterGain.gain.value=1;masterGain.connect(audioCtx.destination);
    musicBus=audioCtx.createGain();musicBus.gain.value=0.55;musicBus.connect(masterGain);
    sfxBus=audioCtx.createGain();sfxBus.gain.value=1;sfxBus.connect(masterGain);
  }catch(e){}
}
function duckMusic(to=0.12,spd=0.4){if(musicBus)musicBus.gain.setTargetAtTime(musicMuted?0:to,audioCtx.currentTime,spd);}
function unduckMusic(spd=0.4){if(musicBus)musicBus.gain.setTargetAtTime(musicMuted?0:0.55,audioCtx.currentTime,spd);}
function tone(freq,dur,type='sine',vol=0.12){
  if(sfxMuted||!audioCtx)return;
  try{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(sfxBus);o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(vol,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+dur);o.start();o.stop(audioCtx.currentTime+dur);}catch(e){}
}

// ── MATH ──────────────────────────────────────────────────────────────
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
function dist(ax,ay,bx,by){return Math.hypot(ax-bx,ay-by);}
function lerpAngle(a,b,t){let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return a+d*t;}
let _rngS=12345;
function rng(){_rngS^=_rngS<<13;_rngS^=_rngS>>17;_rngS^=_rngS<<5;return(_rngS>>>0)/0xFFFFFFFF;}

// ── GAME STATE ────────────────────────────────────────────────────────
const S={START:0,PLAY:1,UPGRADE:2,PAUSE:3,OVER:4};
let state=S.START;
let score=0,elapsed=0,waveStage=0;
let shake={x:0,y:0,t:0};
let bgPhase=0;
let combo=1,comboTimer=0,lastKillTime=0;
let upgradePendingCount=0;
let aimAssistOn=true;
let lastFinalScore=0,lastFinalTime=0;
let _lastThemeBgPhase=-1;  // track bgPhase at last theme switch — change theme on level-up
let ultraMode=false;  // Ultra performance mode — strips heavy gfx, caps DPR=1

// ── TUNING CACHE — rebuilt on startGame/difficultyChanged ─────────────────
// Avoids repeated Object.prototype lookups inside hot inner loops.
let _tc = {
  dartSpeedBase: 340, projectileDamageMult: 1, towerRegenInterval: 4,
  towerRegenAmount: 0.04, pulseBaseForce: 850, pulseRingThickness: 26,
  pulseRingSpeed: 380, pulseKillRechargeMin: 0.04, pulseKillRechargeMax: 0.12,
  enemyTowerDmgBase: 5, exploderTowerDmg: 8, pulseMaxCd: 14, pulseCooldownMult: 1,
  spawnIntervalMin: 0.28, spawnIntervalMax: 1.45, enemyCapMin: 18, enemyCapMax: 65,
  projectileDamageMult_val: 1,
};
function _rebuildTuningCache(){
  _tc.dartSpeedBase       = Tuning.get('dartSpeedBase');
  _tc.projectileDamageMult= Tuning.get('projectileDamageMult');
  _tc.towerRegenInterval  = Tuning.get('towerRegenInterval');
  _tc.towerRegenAmount    = Tuning.get('towerRegenAmount');
  _tc.pulseBaseForce      = Tuning.get('pulseBaseForce');
  _tc.pulseRingThickness  = Tuning.get('pulseRingThickness');
  _tc.pulseRingSpeed      = Tuning.get('pulseRingSpeed');
  _tc.pulseKillRechargeMin= Tuning.get('pulseKillRechargeMin');
  _tc.pulseKillRechargeMax= Tuning.get('pulseKillRechargeMax');
  _tc.enemyTowerDmgBase   = Tuning.get('enemyTowerDmgBase');
  _tc.exploderTowerDmg    = Tuning.get('exploderTowerDmg');
  _tc.pulseMaxCd          = Tuning.get('pulseMaxCd');
  _tc.pulseCooldownMult   = Tuning.get('pulseCooldownMult');
  _tc.spawnIntervalMin    = Tuning.get('spawnIntervalMin');
  _tc.spawnIntervalMax    = Tuning.get('spawnIntervalMax');
  _tc.enemyCapMin         = Tuning.get('enemyCapMin');
  _tc.enemyCapMax         = Tuning.get('enemyCapMax');
}
window.addEventListener('difficultyChanged', _rebuildTuningCache);

// ── TOWER ─────────────────────────────────────────────────────────────
let tower={hp:100,maxHp:100,radius:28,regenTimer:0,hitFlash:0,healGlow:0};
function towerHeal(amount,enemyMass){
  let heal=Math.min(Tuning.get('towerHealMax'),Tuning.get('towerHealBase')+enemyMass*0.25);
  if(tower.hp/tower.maxHp>Tuning.get('towerHealThreshold')) heal*=0.35;
  tower.hp=Math.min(tower.maxHp,tower.hp+heal);
  tower.healGlow=0.6;
  spawnHealFX(towerX,towerY);
}

// ── PLAYER ────────────────────────────────────────────────────────────
let shard={
  x:0,y:0,aimAngle:-Math.PI/2,
  _aimTarget:-Math.PI/2,   // smooth target — written in update(), not pointer events
  _joyDx:0,_joyDy:0,_joyMag:0,  // raw joystick delta from pointer events
  aimLocked:false,autoAimGrace:0,
  fireCooldown:0,fireRate:0.55,radius:36,isDragged:false,
  trailX:[],trailY:[],hasPlasmaTrail:false,trailDmgMult:1,
  overdriveMode:false,overdriveTimer:0,
};

// ── UPGRADES ─────────────────────────────────────────────────────────
let upg={
  fireRate:1,dartSpeed:1,knockbackMult:1,pulseCdMult:1,
  shotCount:1,pierce:false,slowAura:false,attractForce:false,
  ghostActive:false,ghostLife:0,ghostX:0,ghostY:0,
  ramDmg:Tuning.get('ramDamageBase'),projTier:1,
  homingLevel:0,  // 0=off, 1-3=strength
  splitOnKill:false, burstDarts:false,
  stackCounts:{},  // tracks stacks per upgrade id
};
const MAX_STACK=5;
const MILESTONES=[100,300,600,1000,1600,2500,3800,5500,7500,10000];
let milestonesHit=new Set();
let upgradeFlash={text:'',timer:0};

// Returns tier color interpolated by projTier
function getTierColors(){
  const t=T();const arr=t.projColors||['#00e5ff','#00ff99','#ffee00','#ff6622'];
  return arr;
}

const UPG_DEFS=[
  {id:'fireRate', icon:'🔥', name:'Fire Rate',       medal:'🔥', color:'#ff6622',
   desc:'Fires 15% faster',              max:5, apply:()=>{upg.fireRate*=0.85;}},
  {id:'dartSpd',  icon:'⚡', name:'Dart Speed',      medal:'⚡', color:'#ffee00',
   desc:'Projectiles +15% speed',        max:5, apply:()=>{upg.dartSpeed*=1.15;}},
  {id:'shotCount',icon:'◈', name:'Multi-Shot',       medal:'◈', color:'#00e5ff',
   desc:'+1 simultaneous dart (max 4)',  max:3, canAdd:()=>upg.shotCount<4, apply:()=>{upg.shotCount=Math.min(4,upg.shotCount+1);}},
  {id:'pierce',   icon:'◆', name:'Pierce',           medal:'◆', color:'#cc44ff',
   desc:'Darts pass through enemies',    max:1, canAdd:()=>!upg.pierce, apply:()=>{upg.pierce=true;}},
  {id:'homing',   icon:'🎯', name:'Homing Darts',    medal:'🎯', color:'#ff44aa',
   desc:'Darts curve toward enemies',    max:3, apply:()=>{upg.homingLevel=Math.min(3,(upg.homingLevel||0)+1);}},
  {id:'burst',    icon:'💥', name:'Burst Rounds',    medal:'💥', color:'#ffaa00',
   desc:'Killing a dart splits into 3', max:2, canAdd:()=>!upg.burstDarts, apply:()=>{upg.burstDarts=true;}},
  {id:'plasma',   icon:'🔮', name:'Plasma Amp',      medal:'🔮', color:'#aa44ff',
   desc:'Boosts projectile tier + neon', max:4, canAdd:()=>upg.projTier<4, apply:()=>{upg.projTier=Math.min(4,(upg.projTier||1)+1);}},
  {id:'trail',    icon:'🌊', name:'Plasma Trail',    medal:'🌊', color:'#00ffcc',
   desc:'Wake behind ship damages foes', max:3, apply:()=>{shard.hasPlasmaTrail=true;shard.trailDmgMult*=1.25;}},
  {id:'attract',  icon:'🧲', name:'Attract Force',   medal:'🧲', color:'#ff88cc',
   desc:'Pulls weak enemies toward ship',max:3, apply:()=>{upg.attractForce=true;upg.attractStrength=((upg.attractStrength||0)+40);}},
  {id:'slowAura', icon:'❄', name:'Cryo Aura',       medal:'❄', color:'#44ccff',
   desc:'Chills all nearby enemies',     max:3, apply:()=>{upg.slowAura=true;upg.slowAuraR=((upg.slowAuraR||0)+28);}},
  {id:'knockback',icon:'🌀', name:'Knockback',       medal:'🌀', color:'#88eeff',
   desc:'Heavier impact force +20%',     max:5, apply:()=>{upg.knockbackMult*=1.2;}},
  {id:'pulseCd',  icon:'◎', name:'Pulse Charge',    medal:'◎', color:'#00e5ff',
   desc:'Shockwave recharges 10% faster',max:5, apply:()=>{upg.pulseCdMult*=0.90;}},
  {id:'ghost',    icon:'👻', name:'Ghost Ship',      medal:'👻', color:'#aaffee',
   desc:'A twin fires alongside you',    max:1, canAdd:()=>!upg.ghostActive, apply:()=>{spawnGhost();}},
  {id:'overdrive',icon:'☄', name:'Overdrive',       medal:'☄', color:'#ff4400',
   desc:'8s turbo burst fire',           max:5, apply:()=>{shard.overdriveMode=true;shard.overdriveTimer=8;}},
];

// ── PULSE ─────────────────────────────────────────────────────────────
let pulse={cd:0,maxCd:14,rings:[]};
const PULSE_BASE_FORCE    = () => _tc.pulseBaseForce;
const PULSE_RING_THICKNESS= () => _tc.pulseRingThickness;
const PULSE_RING_SPEED    = () => _tc.pulseRingSpeed;

function triggerPulse(){
  if(state!==S.PLAY||pulse.cd>0)return;
  pulse.cd=_tc.pulseMaxCd*_tc.pulseCooldownMult*upg.pulseCdMult;
  pulse.rings.push({r:tower.radius,speed:PULSE_RING_SPEED(),maxR:Math.max(W,H)*0.58,hitSet:new Set()});
  tone(180,0.28,'sine',0.18);
  // Brand-driven extra SFX — zero hardcoded brand checks
  const ap=T().audioProfile||{};
  (ap.pulseExtraFreqs||[]).forEach(f=>tone(f.freq,f.dur||0.12,f.type||'sine',f.vol||0.10));
}

function pulseFillOnKill(enemyMass){
  const gain=clamp(_tc.pulseKillRechargeMin+enemyMass*0.008,
                   _tc.pulseKillRechargeMin,
                   _tc.pulseKillRechargeMax);
  pulse.cd=Math.max(0,pulse.cd-gain);
}

// ── BOSSES ────────────────────────────────────────────────────────────
const BOSS_THRESHOLDS=()=>Tuning.get('bossThresholds');
let bossEventsTriggered=new Set();
let bossActive=false,bossTimer=0,bossSpawnTimer=0;
let bossBannerTimer=0;
let bossId=9000;

function startBossEvent(idx){
  bossEventsTriggered.add(idx);
  bossActive=true;bossTimer=Tuning.get('bossTimer');bossBannerTimer=3.5;bossSpawnTimer=2.0;
  document.getElementById('boss-banner').classList.remove('hidden');
  tone(120,1.2,'sawtooth',0.2);
  musicIntensityBoost=2.5;
}
function spawnBoss(idx){
  const a=rng()*Math.PI*2;
  const sr=clamp(Math.min(W,H)*0.42,120,Math.min(W,H)*0.48);
  const ex=clamp(towerX+Math.cos(a)*sr,60,W-60);
  const ey=clamp(towerY+Math.sin(a)*sr,60,H-60);
  const type=idx%2===1?'phaseDodger':'sentinelBrute';
  const def=EDEFS[type];
  enemies.push({
    id:bossId++,type,isBoss:true,x:ex,y:ey,vx:0,vy:0,
    hp:def.hp,maxHp:def.hp,hitTimer:0,stunTimer:0,flashTimer:0,wobble:rng()*Math.PI*2,
    color:def.color,radius:def.radius,speed:def.speed,reward:def.reward,
    shape:def.shape,sides:def.sides||8,extraDmg:def.extraDmg,mass:def.mass,_rm:false,
    dodgeCd:0,zigTimer:0,zigDir:1,teleportCd:idx%2===1?4:0,teleportGlow:0,
    shieldHp:0,shieldMax:0,shieldTimer:0,healAura:false,explodeOnDeath:false,bodyHitCd:0,
    anchored:type==='sentinelBrute',healPulse:null,spiralDir:1,
  });
}

// ── DIRECTOR ─────────────────────────────────────────────────────────
const GAUSS_DEFS={
  runner:      {peak:250,  sigma:550, bw:1.10,fw:0.12,unlock:0},
  splitter:    {peak:900,  sigma:840, bw:0.75,fw:0.06,unlock:0},
  leech:       {peak:1400, sigma:900, bw:0.55,fw:0.04,unlock:0},
  tank:        {peak:2100, sigma:1100,bw:0.60,fw:0.03,unlock:0},
  skitter:     {peak:2600, sigma:920, bw:0.65,fw:0.02,unlock:450},
  dodger:      {peak:3200, sigma:1080,bw:0.50,fw:0.015,unlock:900},
  bruteNgon:   {peak:4200, sigma:1280,bw:0.45,fw:0.008,unlock:1200},
  anchored:    {peak:2800, sigma:1050,bw:0.42,fw:0.006,unlock:800},
  shielded:    {peak:1800, sigma:950, bw:0.50,fw:0.015,unlock:500},
  exploder:    {peak:2200, sigma:980, bw:0.48,fw:0.012,unlock:600},
  healer:      {peak:3000, sigma:1100,bw:0.38,fw:0.008,unlock:1000},
  spiralHunter:{peak:3800, sigma:1200,bw:0.42,fw:0.005,unlock:1500},
};
function gaussW(s,g){
  const sig=g.sigma*(1+0.12*Math.min(1,s/5000));
  return g.fw+g.bw*Math.exp(-Math.pow(s-g.peak,2)/(2*sig*sig));
}
// Threat = combined function of time + score
// getThreat2() drives all scaling; it grows unbounded so game gets harder forever
function getThreat(){return elapsed*0.022+score*0.00055;}
function getThreat2(){return Math.pow(getThreat(),1.45);}

// Radius scale: enemies grow visually over time — capped at 3× base radius
function getRadiusMult(){return Math.min(1+getThreat2()*0.012, 3.0);}

let spawnTimer=2.0;
let recentKills=[];
let recentKillsScore=0;
let recentScoreTime=0;
let dangerNearTowerCount=0;
let pacingBoost=false,pacingBoostTimer=0;
let safetyValveTimer=0;

function getSpawnInterval(){
  const t2=getThreat2();
  const mn=_tc.spawnIntervalMin, mx=_tc.spawnIntervalMax;
  // Spawn interval shrinks linearly then stays near minimum
  let iv=clamp((mx-0.10*t2)*Tuning.get('spawnIntervalMult'),mn,mx);
  if(bossActive)iv*=2.1;
  if(pacingBoost)iv*=0.84;
  if(safetyValveTimer>0)iv*=1.35;
  return iv;
}
// Enemy cap rises without a hard ceiling after t2 > 20
function getEnemyCap(){
  const t2=getThreat2();
  const raw=(_tc.enemyCapMin+3.5*t2)*Tuning.get('enemyCapMult');
  // No hard cap — allow up to 120 at extreme threat
  return Math.floor(clamp(raw,_tc.enemyCapMin,120));
}
// HP grows without a hard ceiling — large enemies become bullet sponges
function getHpMult(){
  const t2=getThreat2();
  // Linear growth: +4% per t2 unit, no cap
  return Math.max(1, 1+0.04*t2);
}
// Speed grows without hard ceiling — late game enemies are alarmingly fast
function getSpdMult(){
  const t2=getThreat2();
  // Starts gentle, accelerates — by score 5000 enemies are ~3× speed
  return Math.max(1, 1+0.022*t2);
}

function pickEnemyType(){
  const types=Object.keys(GAUSS_DEFS).filter(k=>score>=GAUSS_DEFS[k].unlock&&EDEFS[k]);
  let total=0;
  const ws=types.map(k=>{const w=gaussW(score,GAUSS_DEFS[k]);total+=w;return w;});
  let r=rng()*total;
  for(let i=0;i<types.length;i++){r-=ws[i];if(r<=0)return types[i];}
  return 'runner';
}

// ── ENEMY DEFS ────────────────────────────────────────────────────────
const EDEFS={
  // Small / fast units — hp unchanged, speed boosted slightly
  runner:       {color:'#ff4488',radius:12, hp:2,   speed:70,  reward:5,  shape:'tri',     sides:3, extraDmg:0, mass:1},
  splitter:     {color:'#cc44ff',radius:15, hp:5,   speed:52,  reward:10, shape:'circ',    sides:0, extraDmg:0, mass:1.5},
  leech:        {color:'#ff6633',radius:14, hp:3,   speed:60,  reward:8,  shape:'diamond', sides:4, extraDmg:2, mass:2},
  skitter:      {color:'#ffee00',radius:9,  hp:2,   speed:110, reward:6,  shape:'tri',     sides:3, extraDmg:0, mass:0.6},
  dodger:       {color:'#00ffaa',radius:15, hp:4,   speed:58,  reward:12, shape:'tri',     sides:3, extraDmg:0, mass:1.2},
  shielded:     {color:'#44ddff',radius:18, hp:8,   speed:40,  reward:18, shape:'hex',     sides:6, extraDmg:0, mass:3},
  exploder:     {color:'#ff4400',radius:17, hp:5,   speed:48,  reward:14, shape:'circ',    sides:0, extraDmg:0, mass:2},
  healer:       {color:'#44ff88',radius:15, hp:6,   speed:34,  reward:20, shape:'diamond', sides:4, extraDmg:0, mass:1.5},
  spiralHunter: {color:'#ff55ff',radius:17, hp:10,  speed:82,  reward:28, shape:'ngon',    sides:5, extraDmg:0, mass:2.5},
  // LARGE enemies — 3× hp from original values
  tank:         {color:'#ff8c00',radius:22, hp:30,  speed:28,  reward:22, shape:'hex',     sides:6, extraDmg:1, mass:5},
  bruteNgon:    {color:'#ff3300',radius:29, hp:60,  speed:22,  reward:35, shape:'ngon',    sides:9, extraDmg:1, mass:8},
  anchored:     {color:'#aaaaff',radius:26, hp:84,  speed:16,  reward:42, shape:'ngon',    sides:8, extraDmg:2, mass:25},
  sentinelBrute:{color:'#ff2200',radius:44, hp:285, speed:15,  reward:100,shape:'ngon',    sides:12,extraDmg:3, mass:20},
  phaseDodger:  {color:'#aa00ff',radius:24, hp:165, speed:44,  reward:85, shape:'tri',     sides:3, extraDmg:1, mass:4},
};

let enemies=[],enemyId=0;

function makeEnemy(type,ex,ey){
  if(!EDEFS[type]) type='runner';
  const d=EDEFS[type];
  const hm=getHpMult()*Tuning.get("enemyHpMult"),sm=getSpdMult()*Tuning.get("enemySpeedMult"),t2=getThreat2();
  const sides=type==='bruteNgon'?clamp(7+Math.floor(t2*0.5),7,14):(d.sides||3);
  const shieldHP=(type==='shielded'||type==='sentinelBrute')?3+Math.floor(t2*0.3):0;
  // Apply brand color overrides
  const co=T().enemyColorOverrides||{};
  const color=co[type]||d.color;
  const en={
    id:enemyId++,type,isBoss:false,
    x:ex,y:ey,vx:0,vy:0,
    hp:d.hp*hm,maxHp:d.hp*hm,
    hitTimer:0,stunTimer:0,flashTimer:0,wobble:rng()*Math.PI*2,
    color,radius:Math.round(d.radius*getRadiusMult()+(type==='bruteNgon'?t2*0.35:0)),
    speed:d.speed*sm,reward:d.reward,shape:d.shape,sides,
    extraDmg:d.extraDmg,mass:d.mass+(type==='bruteNgon'?t2*0.18:0),
    _rm:false,dodgeCd:0,zigTimer:rng()*0.8,zigDir:rng()>.5?1:-1,
    teleportCd:0,teleportGlow:0,
    shieldHp:shieldHP,shieldMax:shieldHP,shieldTimer:0,
    healAura:type==='healer',explodeOnDeath:type==='exploder',
    bodyHitCd:0,
    anchored:type==='anchored'||type==='sentinelBrute',
    healPulse:type==='healer'?0:null,
    spiralDir:rng()>.5?1:-1,
    // ── Player-aware AI ──────────────────────────────────────
    strafeDir: rng()>.5?1:-1,   // lateral strafe direction
    strafeTimer: 1.2+rng()*2.5, // s until strafe flip
    flockPhase: rng()*Math.PI*2,// unique offset so pack spreads naturally
    iqMode: 'direct',           // 'direct'|'arc'|'flank'|'hold'
    iqTimer: rng()*1.5,         // time left in this AI mode
  };
  // Super-fast 'blitz' variant — appears ~15% of the time at threat2 > 2
  // Small enemies only (runners, skitters, dodgers, spiralHunters)
  const _blitzTypes=['runner','skitter','dodger','spiralHunter','leech'];
  if(t2>2 && _blitzTypes.includes(type) && rng()<clamp(0.08+t2*0.012,0,0.35)){
    const blitzMult=1.8+rng()*0.7;  // 1.8–2.5× speed
    en.speed*=blitzMult;
    en.radius=Math.max(6,Math.round(en.radius*0.75));  // smaller = harder to hit
    en.color='#ffffff';  // white flash = visual warning
    en.blitz=true;
    en.hp*=0.6;  // brittle — one or two darts kills it
  }
  return en;
}
function spawnEnemy(){
  if(enemies.filter(e=>!e._rm).length>=getEnemyCap())return;
  const a=rng()*Math.PI*2;
  // Spawn just outside the visible screen edge rather than deep off-screen.
  // This keeps enemies arriving at a steady trickle instead of all piling up
  // far away and walking in as one synchronized wave.
  const halfW=W/2+24, halfH=H/2+24;
  const t=rng(), onSide=rng()<0.5;
  let ex,ey;
  if(onSide){ex=towerX+(rng()<0.5?-1:1)*(halfW+rng()*40);ey=towerY+(rng()*2-1)*halfH;}
  else      {ex=towerX+(rng()*2-1)*halfW;ey=towerY+(rng()<0.5?-1:1)*(halfH+rng()*40);}
  ex=Math.round(ex); ey=Math.round(ey);
  const type=tower.hp<tower.maxHp*0.25?'runner':pickEnemyType();
  enemies.push(makeEnemy(type,ex,ey));
}
function spawnFodderPack(){
  const n=3+Math.floor(rng()*3);
  for(let i=0;i<n;i++){
    const halfW=W/2+20,halfH=H/2+20;
    let ex,ey;
    if(rng()<0.5){ex=towerX+(rng()<0.5?-1:1)*(halfW+rng()*30);ey=towerY+(rng()*2-1)*halfH;}
    else         {ex=towerX+(rng()*2-1)*halfW;ey=towerY+(rng()<0.5?-1:1)*(halfH+rng()*30);}
    enemies.push(makeEnemy('runner',ex,ey));
  }
}
function spawnEscortPack(){
  const halfW=W/2+20,halfH=H/2+20;
  let bx,by;
  if(rng()<0.5){bx=towerX+(rng()<0.5?-1:1)*(halfW+20);by=towerY+(rng()*2-1)*halfH;}
  else         {bx=towerX+(rng()*2-1)*halfW;by=towerY+(rng()<0.5?-1:1)*(halfH+20);}
  if(score>=GAUSS_DEFS.anchored.unlock) enemies.push(makeEnemy('anchored',bx,by));
  for(let i=0;i<3;i++){const off=(rng()-.5)*80;enemies.push(makeEnemy('skitter',bx+off,by+off));}
}

// ── ENEMY UPDATE ──────────────────────────────────────────────────────
function updateEnemy(en,dt){
  if(en.hitTimer>0)en.hitTimer-=dt;
  if(en.flashTimer>0)en.flashTimer=Math.max(0,en.flashTimer-dt*8);
  if(en.bodyHitCd>0)en.bodyHitCd-=dt;
  if(en.stunTimer>0){en.stunTimer-=dt;en.vx*=0.78;en.vy*=0.78;return;}

  const dx=towerX-en.x,dy=towerY-en.y,d=Math.hypot(dx,dy)||1;
  // During tutorial, enemies slow to 25% so the player can read bubbles
  let sm=(_tutActive && state===S.PLAY) ? 0.25 : 1;
  const auraR=upg.slowAuraR||82;
  if(upg.slowAura&&dist(en.x,en.y,shard.x,shard.y)<auraR+en.radius) sm=0.38;

  // Attract force — gravity well towards ship (stronger when closer)
  if(upg.attractForce&&en.mass<=3){
    const adx=shard.x-en.x,ady=shard.y-en.y,ad=Math.hypot(adx,ady)||1;
    const attractR=320;
    if(ad<attractR){
      // Gravity-like: acceleration scales inversely with distance
      // Strong pull close up, diminishing at range — feels like a gravity well
      const gravStr=Math.min((upg.attractStrength||40)*0.9/(ad*0.12+8),2.8);
      en.vx+=(adx/ad)*gravStr;
      en.vy+=(ady/ad)*gravStr;
    }
  }

  if(en.shieldHp<en.shieldMax&&en.shieldMax>0){
    en.shieldTimer+=dt;
    if(en.shieldTimer>8){en.shieldHp=Math.min(en.shieldMax,en.shieldHp+1);en.shieldTimer=0;}
  }
  if(en.healAura){
    en.healPulse=(en.healPulse||0)+dt;
    if(en.healPulse>2.5){
      en.healPulse=0;
      const _hn=_sgQuery(en.x,en.y,100);
      for(let _hi=0;_hi<_hn.length;_hi++){
        const other=_hn[_hi];if(other===en||other._rm)continue;
        const _hdx=other.x-en.x,_hdy=other.y-en.y;
        if(_hdx*_hdx+_hdy*_hdy<10000)other.hp=Math.min(other.maxHp,other.hp+other.maxHp*0.06);
      }
    }
  }
  if(en.type==='dodger'||en.type==='phaseDodger'){
    if(en.dodgeCd>0)en.dodgeCd-=dt;
    else{
      const t2=getThreat2();
      for(const p of projectiles){
        if(p.dead)continue;
        const pdx=en.x-p.x,pdy=en.y-p.y,pd=Math.hypot(pdx,pdy);
        if(pd>160)continue;
        const pvl=Math.hypot(p.vx,p.vy)||1;
        const dot=(p.vx*(en.x-p.x)+p.vy*(en.y-p.y))/(pvl*pd);
        if(dot>0.65){
          const str=50+t2*5,s=rng()>.5?1:-1;
          en.vx+=(-p.vy/pvl)*s*str;en.vy+=(p.vx/pvl)*s*str;
          en.dodgeCd=0.38;break;
        }
      }
    }
    if(en.type==='phaseDodger'){
      if(en.teleportCd>0)en.teleportCd-=dt;
      en.teleportGlow=Math.max(0,en.teleportGlow-dt*2);
      if(en.teleportCd<=0&&en.hp<en.maxHp*0.7){
        const a=rng()*Math.PI*2,r=55+rng()*75;
        en.x=clamp(en.x+Math.cos(a)*r,0,W);en.y=clamp(en.y+Math.sin(a)*r,0,H);
        en.teleportCd=5+rng()*4;en.teleportGlow=1;
      }
    }
  }
  if(en.type==='skitter'){
    en.zigTimer-=dt;
    if(en.zigTimer<=0){en.zigDir*=-1;en.zigTimer=0.28+rng()*0.5;}
    const t2=getThreat2();
    en.vx+=(-dy/d)*en.zigDir*(38+t2*4)*dt;
    en.vy+=(dx/d)*en.zigDir*(38+t2*4)*dt;
  }

  // SpiralHunter — brand behavior multiplier applied here
  if(en.type==='spiralHunter'){
    const spiralMult=((T().behavior||{}).spiralEmphasis)||1.0;
    if(en.dodgeCd>0)en.dodgeCd-=dt;
    else{
      for(const p of projectiles){
        if(p.dead)continue;
        const pdx=en.x-p.x,pdy=en.y-p.y,pd=Math.hypot(pdx,pdy);
        if(pd>140)continue;
        const pvl=Math.hypot(p.vx,p.vy)||1;
        const dot=(p.vx*(en.x-p.x)+p.vy*(en.y-p.y))/(pvl*(pd||1));
        if(dot>0.68){
          const str=65*spiralMult,s=en.spiralDir;
          en.vx+=(-p.vy/pvl)*s*str;en.vy+=(p.vx/pvl)*s*str;
          en.dodgeCd=0.55;break;
        }
      }
    }
  }

  let moveDx=dx/d,moveDy=dy/d;
  if(en.type==='spiralHunter'){
    const spiralMult=((T().behavior||{}).spiralEmphasis)||1.0;
    const maxR=Math.max(W,H)*0.58;
    const tFrac=clamp(d/maxR,0,1);
    const tanX=(-dy/d)*en.spiralDir,tanY=(dx/d)*en.spiralDir;
    const ppx=shard.x-en.x,ppy=shard.y-en.y,ppd=Math.hypot(ppx,ppy)||1;
    const bias=0.10;
    let mx=dx/d*(1-tFrac*0.45*spiralMult)+tanX*(tFrac*0.95*spiralMult)+(ppx/ppd)*bias;
    let my=dy/d*(1-tFrac*0.45*spiralMult)+tanY*(tFrac*0.95*spiralMult)+(ppy/ppd)*bias;
    const ml=Math.hypot(mx,my)||1;
    moveDx=mx/ml;moveDy=my/ml;
  }

  // ── Player-aware AI director ──────────────────────────────────────────
  // Anchored + sentinelBrute skip AI modes — they have their own behaviour
  if(!en.anchored && en.type!=='spiralHunter'){
    const t2=getThreat2();
    en.iqTimer-=dt;
    if(en.iqTimer<=0){
      // Pick next AI mode probabilistically — more variety at higher threat
      const r=rng();
      if(d < Math.min(W,H)*0.22){
        // Close to tower: prefer flanking to avoid bunching up
        en.iqMode = r<0.45?'flank':'direct';
        en.iqTimer = 1.2+rng()*1.6;
      } else if(t2 > 3){
        // High threat: more arc attacks and flanking
        en.iqMode = r<0.30?'direct':r<0.60?'arc':r<0.85?'flank':'hold';
        en.iqTimer = 1.4+rng()*2.0;
      } else {
        en.iqMode = r<0.55?'direct':r<0.80?'arc':'flank';
        en.iqTimer = 1.8+rng()*2.5;
      }
    }

    // Compute player offset: vector from shard toward this enemy
    const pdx=en.x-shard.x,pdy=en.y-shard.y;
    const pd=Math.hypot(pdx,pdy)||1;
    // Perpendicular to tower direction (strafe axis)
    const perpX=-dy/d,perpY=dx/d;

    // Strafe timer: periodically flip direction to avoid clustering
    en.strafeTimer-=dt;
    if(en.strafeTimer<=0){en.strafeDir*=-1;en.strafeTimer=1.0+rng()*2.5;}

    if(en.iqMode==='direct'){
      // Straight toward tower, slight player-avoidance weave
      const weave=Math.sin(elapsed*2.2+en.flockPhase)*0.18*(1+t2*0.04);
      moveDx=dx/d+perpX*weave;
      moveDy=dy/d+perpY*weave;
    } else if(en.iqMode==='arc'){
      // Arc around the tower from the side — approaches at an angle
      const arcStrength=0.55+t2*0.04;
      moveDx=dx/d*(1-arcStrength)+perpX*en.strafeDir*arcStrength;
      moveDy=dy/d*(1-arcStrength)+perpY*en.strafeDir*arcStrength;
    } else if(en.iqMode==='flank'){
      // Move toward player position first, then cut to tower
      // This breaks up straight-line predictability
      const toPlayerX=shard.x-en.x,toPlayerY=shard.y-en.y;
      const tpd=Math.hypot(toPlayerX,toPlayerY)||1;
      const flankW=clamp(0.35+t2*0.04,0.2,0.6);
      moveDx=dx/d*(1-flankW)+toPlayerX/tpd*flankW;
      moveDy=dy/d*(1-flankW)+toPlayerY/tpd*flankW;
    } else {
      // 'hold': slow drift sideways — pause-and-reposition behaviour
      moveDx=perpX*en.strafeDir*0.5+dx/d*0.25;
      moveDy=perpY*en.strafeDir*0.5+dy/d*0.25;
    }

    // Normalize composite direction
    const ml=Math.hypot(moveDx,moveDy)||1;
    moveDx/=ml;moveDy/=ml;

    // Lateral strafe component: enemies don't just charge straight
    // Runners weave hard, tanks barely at all, others in between
    const strafeAmt = en.type==='runner'?0.32:en.type==='tank'||en.type==='anchored'?0:
                      en.type==='leech'?0.22:en.type==='bruteNgon'?0.10:0.18;
    if(strafeAmt>0){
      const sw=Math.sin(elapsed*2.8+en.flockPhase)*strafeAmt;
      moveDx+=perpX*sw;moveDy+=perpY*sw;
      const ml2=Math.hypot(moveDx,moveDy)||1;
      moveDx/=ml2;moveDy/=ml2;
    }
  }

  const ms=en.speed*sm;
  en.vx+=(moveDx*ms-en.vx)*0.08;
  en.vy+=(moveDy*ms-en.vy)*0.08;
  en.vx*=0.92;en.vy*=0.92;
  en.x+=en.vx*dt;en.y+=en.vy*dt;
  en.wobble+=dt*2.5;

  if(dist(en.x,en.y,towerX,towerY)<tower.radius+en.radius){
    // Tower damage scales up with threat — late game each hit is devastating
    const _towerDmgMult=Math.max(1, 1+getThreat2()*0.04);
    tower.hp-=(_tc.enemyTowerDmgBase+en.extraDmg)*_towerDmgMult;tower.hitFlash=0.3;
    shake.x=(rng()-.5)*6;shake.y=(rng()-.5)*6;shake.t=0.12;
    tone(80,0.18,'sawtooth',0.2);
    if(en.type==='splitter')doSplit(en);
    if(en.type==='exploder')spawnExploderBurst(en.x,en.y);
    en._rm=true;
    if(tower.hp<=0)gameOver();
  }
}
function doSplit(en){
  for(let i=0;i<2;i++){const a=rng()*Math.PI*2;enemies.push(makeEnemy('runner',en.x+Math.cos(a)*12,en.y+Math.sin(a)*12));}
}
function spawnExploderBurst(x,y){
  tower.hp-=_tc.exploderTowerDmg;tower.hitFlash=0.5;
  spawnPlasmaExplosion(x,y,'#ff4400');
  const _en=_sgQuery(x,y,90);
  for(let i=0;i<_en.length;i++){
    const en=_en[i];if(en._rm)continue;
    const _edx=en.x-x,_edy=en.y-y,_ed2=_edx*_edx+_edy*_edy;
    if(_ed2<8100){const _ed=Math.sqrt(_ed2)||1;en.vx+=(_edx/_ed)*200;en.vy+=(_edy/_ed)*200;}
  }
}

// ── DAMAGE + COLLISION ────────────────────────────────────────────────
function shardBump(en,sx,sy){
  if(en.hitTimer>0)return;
  const _bx=en.x-sx,_by=en.y-sy,r=shard.radius+en.radius;
  const d2sq=_bx*_bx+_by*_by;
  if(d2sq>=r*r)return;
  const d=Math.sqrt(d2sq);
  const nx=(en.x-sx)/(d||1),ny=(en.y-sy)/(d||1);
  const sentinelMult=en.type==='sentinelBrute'?0.1:1;
  const anchorMult=en.anchored?0.08:1;
  const impulse=(380*upg.knockbackMult)/(en.mass||1)*anchorMult*sentinelMult;
  en.vx+=nx*impulse;en.vy+=ny*impulse;
  en.stunTimer=0.12;en.hitTimer=0.18;
  en.x+=nx*(r-d);en.y+=ny*(r-d);
  if(en.bodyHitCd<=0){
    const bodyDmgMult=en.anchored?0:en.shieldHp>0?0.2:1;
    if(bodyDmgMult>0){hitEnemy(en,upg.ramDmg*bodyDmgMult,false);en.bodyHitCd=0.35;}
  }
  tone(300,0.06,'triangle',0.10);
}
function hitEnemy(en,dmg,fromProjectile=true){
  if(en._rm)return;
  if(fromProjectile&&en.shieldHp>0){
    en.shieldHp--;spawnImpact(en.x,en.y,'#88eeff');tone(800,0.04,'square',0.08);return;
  }
  en.hp-=dmg*getTierDmg();
  en.flashTimer=1;  // 0→1 at hit, fades to 0 via updateEnemy
  // Sub-bass thud — distinct from the music bus, goes through sfxBus
  if(!sfxMuted&&audioCtx){
    try{
      const t=audioCtx.currentTime;
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.type='sine';
      o.frequency.setValueAtTime(95,t);
      o.frequency.exponentialRampToValueAtTime(38,t+0.10);
      g.gain.setValueAtTime(0.32,t);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.13);
      o.connect(g);g.connect(sfxBus);o.start(t);o.stop(t+0.14);
    }catch(_){}
  }
  spawnImpact(en.x,en.y,en.color);
  if(en.hp<=0)killEnemy(en);
}
function killEnemy(en){
  if(en._rm)return;en._rm=true;
  // Haptic feedback — short sharp jerk
  try{if(navigator.vibrate)navigator.vibrate(en.isBoss?[40,20,40]:18);}catch(_){}
  const now=elapsed;
  if(now-lastKillTime<2.0)combo=Math.min(1.7,combo+0.12);
  else combo=1;
  lastKillTime=now;
  const reward=Math.round(en.reward*combo*Tuning.get('scoreMult'));
  score+=reward;
  recentKills.push(elapsed);
  if(en.type==='splitter')doSplit(en);
  if(en.type==='exploder')spawnExploderBurst(en.x,en.y);
  spawnPlasmaExplosion(en.x,en.y,T().particleColor||en.color);
  tone(500,0.06,'triangle',0.09);
  pulseFillOnKill(en.mass);
  if(en.mass>=4)towerHeal(0,en.mass);
  if(en.isBoss){
    score+=50;tower.hp=Math.min(tower.maxHp,tower.hp+10);
    upgradePendingCount++;updateUpgradePin();tower.healGlow=0.8;
    bossActive=false;
  }
  MILESTONES.forEach((ms,i)=>{
    if(!milestonesHit.has(i)&&score>=ms){milestonesHit.add(i);bgPhase=milestonesHit.size;upgradePendingCount++;updateUpgradePin();if(typeof tutShowUpgradeHint==='function')tutShowUpgradeHint();}
  });
  BOSS_THRESHOLDS().forEach((th,idx)=>{
    if(!bossEventsTriggered.has(idx)&&score>=th&&!bossActive)startBossEvent(idx);
  });
}

// ── PROJECTILES ───────────────────────────────────────────────────────
let projectiles=[];
function getTierColor(){const t=T();return t.projColors[clamp(upg.projTier-1,0,3)];}
function getTierDmg(){return[1,1.4,2.0,3.0][clamp(upg.projTier-1,0,3)];}

function fireDart(x,y,angle){
  const spr=(rng()-.5)*0.11,spd=_tc.dartSpeedBase*upg.dartSpeed;
  const a=angle+spr;
  projectiles.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,
    life:1.6,dead:false,pierced:false,isBurst:false,homing:upg.homingLevel||0});
}
function doFireShot(x,y,angle){
  const c=upg.shotCount,spread=0.20;
  for(let i=0;i<c;i++)fireDart(x,y,angle+(i-(c-1)/2)*spread);
  if(shard.overdriveMode){fireDart(x,y,angle+0.55);fireDart(x,y,angle-0.55);}
}

// ── MUSIC ENGINE ──────────────────────────────────────────────────────
let musicScheduled=0,beatIdx=0,musicTimer=null,musicIntensityBoost=0;
const TAB_PAT16=[3,0,0,1,2,0,1,1,1,0,2,0,2,0,1,2];
const ARP_FREQS=[220,261.6,329.6,369.9,440,523.2,369.9,293.7];

function getMusicBPM(){
  const bpmBase=(T().audioProfile||{}).bpmBase||116;
  return bpmBase+Math.min(bgPhase*14,56)+Math.min(musicIntensityBoost*18,36);
}
function scheduleNote(type,t,freq,vol){
  if(!audioCtx||musicMuted)return;
  try{
    if(type==='tabla'){
      const o=audioCtx.createOscillator(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter();
      f.type='bandpass';f.frequency.value=freq*1.5;f.Q.value=4;
      o.connect(f);f.connect(g);g.connect(musicBus);
      o.frequency.setValueAtTime(freq*2.2,t);o.frequency.exponentialRampToValueAtTime(freq*0.55,t+0.14);
      g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.22);
      o.start(t);o.stop(t+0.24);
    }else if(type==='bass'){
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.type='sine';o.frequency.value=freq;o.connect(g);g.connect(musicBus);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+0.015);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.30);
      o.start(t);o.stop(t+0.32);
    }else if(type==='snare'){
      const o=audioCtx.createOscillator(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter();
      o.type='sawtooth';o.frequency.value=190;f.type='highpass';f.frequency.value=1800;
      o.connect(f);f.connect(g);g.connect(musicBus);
      g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.09);
      o.start(t);o.stop(t+0.11);
    }else if(type==='arp'){
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.type='triangle';o.frequency.value=freq;o.connect(g);g.connect(musicBus);
      g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.17);
      o.start(t);o.stop(t+0.19);
    }
  }catch(e){}
}
function runMusic(){
  if(!audioCtx||musicMuted){musicTimer=setTimeout(runMusic,80);return;}
  const bpm=getMusicBPM(),stepDur=60/bpm/4,AHEAD=0.22;
  const ph=bgPhase,ib=Math.min(musicIntensityBoost,1);
  while(musicScheduled<audioCtx.currentTime+AHEAD){
    const step=beatIdx%16,bar=Math.floor(beatIdx/16)%4;
    const tv=TAB_PAT16[step];
    if(tv>0)scheduleNote('tabla',musicScheduled,[200,170,150][Math.min(2,ph)],[0,0.05,0.08,0.115][tv]+ib*0.03);
    const bSteps=[[0,8],[0,6,8,12],[0,4,8,10,12],[0,4,8,10,12,14]][Math.min(3,ph)];
    if(bSteps.includes(step))scheduleNote('bass',musicScheduled,[55,55,82.4,65.4,41.2][step%5],0.10+ph*0.022+ib*0.03);
    if(step===4||step===12)scheduleNote('snare',musicScheduled,0,0.055+ph*0.01+ib*0.02);
    if(ph>=3&&(step===2||step===14))scheduleNote('snare',musicScheduled,0,0.032);
    if(ph>=1){
      const dens=ph>=3?1:2;
      if(step%dens===0){
        const idx=(Math.floor(step/dens)+bar*4)%ARP_FREQS.length;
        scheduleNote('arp',musicScheduled,ARP_FREQS[idx]*(ph>=2?2:1),0.025+ph*0.005+ib*0.01);
      }
    }
    beatIdx++;musicScheduled+=stepDur;
  }
  if(musicIntensityBoost>0)musicIntensityBoost=Math.max(0,musicIntensityBoost-0.016);
  musicTimer=setTimeout(runMusic,50);
}
function startMusic(){
  if(musicTimer)clearTimeout(musicTimer);
  beatIdx=0;initAudio();
  if(!audioCtx){musicTimer=setTimeout(runMusic,200);return;}
  musicScheduled=audioCtx.currentTime+0.1;
  musicTimer=setTimeout(runMusic,0);
}

// ── FX ────────────────────────────────────────────────────────────────
let particles=[];
function spawnImpact(x,y,color){
  for(let i=0;i<4;i++){
    const a=rng()*Math.PI*2,s=26+rng()*40;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.26+rng()*.14,color,size:2+rng()*3,type:'dot'});
  }
}
function spawnPlasmaExplosion(x,y,color){
  particles.push({x,y,vx:0,vy:0,life:.34,color:'#fff',size:28,type:'flash'});
  for(let i=0;i<16;i++){
    const a=rng()*Math.PI*2,s=65+rng()*110;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.48+rng()*.4,color,size:3+rng()*5,type:'glow'});
  }
  for(let i=0;i<7;i++){
    const a=rng()*Math.PI*2,s=40+rng()*60;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-26,life:.45+rng()*.3,color,size:4+rng()*6,type:'rect',rot:rng()*Math.PI*2});
  }
}
function spawnHealFX(x,y){
  for(let i=0;i<8;i++){
    const a=rng()*Math.PI*2,s=28+rng()*38;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-38,life:.55+rng()*.3,color:'#00ff99',size:3+rng()*4,type:'glow'});
  }
}

// ── CONTROLS / INPUT ─────────────────────────────────────────────────
const controls={
  aim:  {x:0,y:0,r:74,active:false,pid:null,dx:0,dy:0},  // larger joystick
  pulse:{x:0,y:0,r:44},   // bottom-RIGHT corner
  move: {active:false,pid:null,rawX:0,rawY:0},
};
function layoutControls(){
  controls.aim.x=26+controls.aim.r;
  controls.aim.y=H-26-controls.aim.r;
  // Pulse in bottom-right corner, symmetric to joystick
  controls.pulse.x=W-26-controls.pulse.r;
  controls.pulse.y=H-26-controls.pulse.r;
}
function inCircle(px,py,cx,cy,r){const dx=px-cx,dy=py-cy;return dx*dx+dy*dy<=r*r;}

const ptrs={};
canvas.addEventListener('pointerdown',onPD,{passive:false});
canvas.addEventListener('pointermove',onPM,{passive:false});
canvas.addEventListener('pointerup',onPU,{passive:false});
canvas.addEventListener('pointercancel',onPU,{passive:false});
// Long-press / contextmenu no longer fires pulse — dedicated canvas button does.
canvas.addEventListener('contextmenu',e=>e.preventDefault());

function onPD(e){
  e.preventDefault();initAudio();
  ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
  if(state!==S.PLAY)return;
  const x=e.clientX,y=e.clientY;
  // During tutorial: NEXT button (right 60px edge) advances step — all other game input works normally
  if(_tutActive && x >= W-60){ tutTap(); return; }

  // Pulse button (bottom-right — checked before move fallback)
  if(inCircle(x,y,controls.pulse.x,controls.pulse.y,controls.pulse.r*1.2)){
    triggerPulse();return;
  }

  // Aim joystick (bottom-left)
  if(!controls.aim.active&&inCircle(x,y,controls.aim.x,controls.aim.y,controls.aim.r*1.2)){
    controls.aim.active=true;controls.aim.pid=e.pointerId;controls.aim.dx=0;controls.aim.dy=0;
    shard.aimLocked=true;shard.autoAimGrace=0;manualFireImmediate();shard.fireCooldown=0;return;
  }

  // Pulse button (bottom-right) — ONLY way to fire shockwave on touch
  if(inCircle(x,y,controls.pulse.x,controls.pulse.y,controls.pulse.r*1.2)){
    triggerPulse();return;
  }

  // Anywhere else → move ship. Works even while joystick is already held
  // so a second finger can always claim ship movement.
  if(!controls.move.active){
    controls.move.active=true;controls.move.pid=e.pointerId;
    controls.move.rawX=x;controls.move.rawY=y;shard.isDragged=true;
    shard.x=clamp(x,shard.radius,W-shard.radius);
    shard.y=clamp(y,shard.radius,H-shard.radius);
  }
}
function onPM(e){
  e.preventDefault();
  const p=ptrs[e.pointerId];if(!p)return;
  p.x=e.clientX;p.y=e.clientY;
  if(state!==S.PLAY)return;
  const x=e.clientX,y=e.clientY;
  if(controls.aim.active&&e.pointerId===controls.aim.pid){
    let dx=x-controls.aim.x,dy=y-controls.aim.y;
    const len=Math.hypot(dx,dy)||1,max=controls.aim.r*0.9,k=Math.min(1,max/len);
    dx*=k;dy*=k;controls.aim.dx=dx;controls.aim.dy=dy;
    // Only store raw delta — update() smoothly integrates this each fixed step
    // NEVER write shard.aimAngle directly from pointer events (causes jitter)
    shard._joyDx=dx;shard._joyDy=dy;shard._joyMag=Math.hypot(dx,dy);
    return;
  }
  if(controls.move.active&&e.pointerId===controls.move.pid){
    controls.move.rawX=x;controls.move.rawY=y;
    shard.x=clamp(x,shard.radius+2,W-shard.radius-2);
    shard.y=clamp(y,shard.radius+2,H-shard.radius-2);
  }
}
function onPU(e){
  e.preventDefault();
  delete ptrs[e.pointerId];
  if(controls.aim.active&&e.pointerId===controls.aim.pid){
    controls.aim.active=false;controls.aim.pid=null;controls.aim.dx=0;controls.aim.dy=0;
    shard._joyDx=0;shard._joyDy=0;shard._joyMag=0;
    shard.aimLocked=false;shard.autoAimGrace=0.25;
  }
  if(controls.move.active&&e.pointerId===controls.move.pid){
    controls.move.active=false;controls.move.pid=null;shard.isDragged=false;
  }
}
const keys={};
window.addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='Space'){e.preventDefault();triggerPulse();}
  if(e.code==='KeyP')togglePause();
  if(e.code==='KeyQ'){shard.aimAngle-=0.15;shard.aimLocked=true;}
  if(e.code==='KeyE'){shard.aimAngle+=0.15;shard.aimLocked=true;}
});
window.addEventListener('keyup',e=>{keys[e.code]=false;});

// ── UI MENU ───────────────────────────────────────────────────────────

const pauseBtn=document.createElement('button');
pauseBtn.style.cssText='position:fixed;top:14px;right:14px;width:44px;height:44px;border-radius:6px;background:rgba(4,2,15,.7);border:1.5px solid rgba(0,229,255,.35);cursor:pointer;pointer-events:all;z-index:5;font-size:18px;color:#00e5ff;backdrop-filter:blur(4px);';
pauseBtn.textContent='⏸';
pauseBtn.addEventListener('pointerdown',e=>{e.stopPropagation();togglePause();});
document.body.appendChild(pauseBtn);

// Help button (below pause)
const helpBtn=document.createElement('button');
helpBtn.id='help-btn';helpBtn.textContent='?';
document.body.appendChild(helpBtn);

// Tutorial is now canvas-drawn — ? button replays the tutorial
helpBtn.addEventListener('pointerdown',e=>{
  e.stopPropagation();
  if(state===S.PLAY){_tutDone=false;tutStart();}
});

// Upgrade pill
const upgradePill=document.getElementById('upgrade-pill');
upgradePill.addEventListener('pointerdown',e=>{e.stopPropagation();if(state===S.PLAY&&upgradePendingCount>0)openUpgradeOverlay();});

document.getElementById('resume-btn').addEventListener('click',resumeGame);
document.getElementById('restart-btn').addEventListener('click',()=>{document.getElementById('pause-overlay').classList.add('hidden');startGame();});
document.getElementById('play-btn').addEventListener('click',startGame);
document.getElementById('share-btn').addEventListener('click',handleShare);
document.getElementById('hs-reset-btn').addEventListener('click',()=>{if(confirm('Reset all high scores?')){try{localStorage.removeItem('psd_scores');}catch(e){}alert('Cleared.');}});
document.getElementById('upg-done-btn').addEventListener('click',()=>{
  document.getElementById('upgrade-overlay').classList.add('hidden');
  unduckMusic();state=S.PLAY;updateUpgradePin();
});

const sfxBtn=document.getElementById('sfx-btn');
const musicBtn=document.getElementById('music-btn');
const assistBtn=document.getElementById('assist-btn');
sfxBtn.addEventListener('click',()=>{sfxMuted=!sfxMuted;sfxBtn.textContent=sfxMuted?'SFX ✕':'SFX';sfxBtn.classList.toggle('on',!sfxMuted);});
musicBtn.addEventListener('click',()=>{musicMuted=!musicMuted;musicBtn.textContent=musicMuted?'MUSIC ✕':'MUSIC';musicBtn.classList.toggle('on',!musicMuted);if(musicBus)musicBus.gain.setTargetAtTime(musicMuted?0:0.55,audioCtx.currentTime,0.3);});
assistBtn.addEventListener('click',()=>{aimAssistOn=!aimAssistOn;assistBtn.textContent=aimAssistOn?'AIM':'AIM ✕';assistBtn.classList.toggle('on',aimAssistOn);});
const ultraBtn=document.getElementById('ultra-btn');
if(ultraBtn)ultraBtn.addEventListener('click',()=>{
  ultraMode=!ultraMode;
  ultraBtn.textContent=ultraMode?'⚡ ULTRA ✓':'⚡ ULTRA';
  ultraBtn.classList.toggle('on',ultraMode);
  _invalidateBgCache();  // force re-render bg at new DPR
  scheduleResize();       // re-calc canvas size at new DPR
  showToast(ultraMode?'ULTRA MODE: max fps, reduced gfx':'ULTRA MODE OFF');
});

// When brand changes during game, refresh CSS
window.addEventListener('brandChanged',()=>{
  if(state===S.PLAY||state===S.PAUSE) applyBrandCSS();
});
function applyBrandCSS(){
  const b=T();
  document.documentElement.style.setProperty('--accent',b.accent);
  document.documentElement.style.setProperty('--accent-rgb',b.accentRgb);
  document.documentElement.style.setProperty('--accent-glow',b.accentGlow);
  document.documentElement.style.setProperty('--hud-font',b.hudFont);
}

// ── UPGRADE OVERLAY ───────────────────────────────────────────────────
function updateUpgradePin(){
  if(upgradePendingCount>0){
    document.getElementById('upgrade-pill-text').textContent=
      upgradePendingCount>1?`⚡ ${upgradePendingCount} UPGRADES AVAILABLE`:`⚡ UPGRADE AVAILABLE`;
    upgradePill.classList.remove('hidden');
  }else{
    upgradePill.classList.add('hidden');
  }
}
function openUpgradeOverlay(){
  state=S.UPGRADE;duckMusic();
  renderUpgradeCards();
  document.getElementById('upgrade-overlay').classList.remove('hidden');
}
function renderUpgradeCards(){
  const cont=document.getElementById('upg-cards');cont.innerHTML='';
  const tokensLeft=upgradePendingCount;
  const doneBtn=document.getElementById('upg-done-btn');
  if(doneBtn)doneBtn.textContent=tokensLeft>0?`${tokensLeft} PICK${tokensLeft>1?'S':''} LEFT — DONE`:'DONE';

  UPG_DEFS.forEach(u=>{
    const stacks=upg.stackCounts[u.id]||0;
    const maxed=stacks>=u.max;
    const unavail=u.canAdd&&!u.canAdd();
    const card=document.createElement('div');
    card.className='upg-card2'+(maxed||unavail?' upg-maxed':'');
    const pips=Array.from({length:u.max},(_,i)=>`<span class="upg-pip${i<stacks?' upg-pip-on':''}"></span>`).join('');
    card.innerHTML=`
      <div class="upg-c2-icon" style="color:${u.color};text-shadow:0 0 10px ${u.color}88">${u.icon}</div>
      <div class="upg-c2-body">
        <div class="upg-c2-name" style="color:${u.color}">${u.name}</div>
        <div class="upg-c2-desc">${u.desc}</div>
        <div class="upg-c2-pips">${pips}</div>
      </div>
      <div class="upg-c2-badge">${maxed?'MAX':(unavail?'—':stacks>0?'+'+stacks:'NEW')}</div>`;
    if(!maxed&&!unavail&&tokensLeft>0){
      card.addEventListener('click',()=>{
        u.apply();upgradeFlash.text=u.name;upgradeFlash.timer=2;
        upg.stackCounts[u.id]=(upg.stackCounts[u.id]||0)+1;
        upgradePendingCount--;
        renderUpgradeCards();
        if(upgradePendingCount<=0){
          document.getElementById('upgrade-overlay').classList.add('hidden');
          unduckMusic();state=S.PLAY;updateUpgradePin();
        }
      });
    }
    cont.appendChild(card);
  });
}

function manualFireImmediate(){if(state!==S.PLAY)return;doFireShot(shard.x,shard.y,shard.aimAngle);tone(720,.04,'square',.07);}
function spawnGhost(){upg.ghostActive=true;upg.ghostLife=8;upg.ghostX=shard.x+(rng()-.5)*120;upg.ghostY=shard.y+(rng()-.5)*120;}

// ── SPATIAL HASH — O(1) enemy lookup for collision & nearest-enemy ────────────
// Each cell is GRID_CELL×GRID_CELL px. Rebuilt once per update() tick.
// Key = (cx+100)*1000+(cy+100) avoids string allocation and handles neg coords.
const GRID_CELL = 80;
const _sg = new Map();   // spatial grid  key→Enemy[]
let _sgPool = [];        // reuse cell arrays to avoid GC pressure

function _sgClear() {
  _sg.forEach(cell => { cell.length = 0; _sgPool.push(cell); });
  _sg.clear();
}
function _sgBuild() {
  _sgClear();
  for (let i = 0; i < enemies.length; i++) {
    const en = enemies[i];
    if (en._rm) continue;
    const k = ((en.x / GRID_CELL)|0 + 100) * 1000 + ((en.y / GRID_CELL)|0 + 100);
    let cell = _sg.get(k);
    if (!cell) { cell = _sgPool.pop() || []; _sg.set(k, cell); }
    cell.push(en);
  }
}
// Query all enemies within a square of radius r around (x,y)
// Returns a reused shared array — do NOT store the reference.
const _sgOut = [];
function _sgQuery(x, y, r) {
  _sgOut.length = 0;
  const cx0 = ((x - r) / GRID_CELL)|0, cx1 = ((x + r) / GRID_CELL)|0;
  const cy0 = ((y - r) / GRID_CELL)|0, cy1 = ((y + r) / GRID_CELL)|0;
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cy = cy0; cy <= cy1; cy++) {
      const cell = _sg.get((cx + 100) * 1000 + (cy + 100));
      if (cell) for (let i = 0; i < cell.length; i++) _sgOut.push(cell[i]);
    }
  }
  return _sgOut;
}

function nearestEnemy(x,y){
  // Fast path: search expanding radii using spatial grid
  for (const sr of [120, 320, 700]) {
    let best=null, bd2=sr*sr;
    const near=_sgQuery(x,y,sr);
    for (let i=0;i<near.length;i++){
      const e=near[i]; if(e._rm)continue;
      const dx=e.x-x,dy=e.y-y,d2=dx*dx+dy*dy;
      if(d2<bd2){bd2=d2;best=e;}
    }
    if(best)return best;
  }
  // Fallback full scan (very rare — screen larger than 700px from any enemy)
  let best=null,bd2=Infinity;
  for(let i=0;i<enemies.length;i++){
    const e=enemies[i];if(e._rm)continue;
    const dx=e.x-x,dy=e.y-y,d2=dx*dx+dy*dy;
    if(d2<bd2){bd2=d2;best=e;}
  }
  return best;
}
function enemyInCone(x,y,angle,half,maxD){
  return enemies.some(en=>{
    if(en._rm)return false;
    const dx=en.x-x,dy=en.y-y,d=Math.hypot(dx,dy);
    if(d>maxD)return false;
    const a=Math.atan2(dy,dx);let da=Math.abs(a-angle);
    if(da>Math.PI)da=Math.PI*2-da;return da<half;
  });
}

// ── MAIN UPDATE ───────────────────────────────────────────────────────
const FIXED_DT=1/120;
let accumulator=0;

function update(dt){
  if(state!==S.PLAY)return;
  elapsed+=dt;waveStage=Math.floor(elapsed/30);
  // Auto-theme: switch when bgPhase increases (i.e. a milestone / level-up fires)
  // This means each new phase/level gets a fresh theme rather than a timed interrupt
  if(!window.Tuning.isThemeLocked()&&bgPhase>_lastThemeBgPhase){
    _lastThemeBgPhase=bgPhase;
    const _brands=window.BrandEngine.getBrands().filter(b=>!b.hidden);
    if(_brands.length>1){
      const _ci=_brands.findIndex(b=>b.id===window.BrandEngine.getCurrentId());
      window.BrandEngine.applyBrand(_brands[(_ci+1)%_brands.length].id);
    }
  }
  if(shake.t>0){shake.t-=dt;if(shake.t<=0){shake.x=0;shake.y=0;}}
  if(comboTimer>0)comboTimer-=dt;
  else if(elapsed-lastKillTime>2.0)combo=Math.max(1,combo-dt*0.5);
  if(tower.hp<tower.maxHp*0.20)safetyValveTimer=10;
  if(safetyValveTimer>0)safetyValveTimer-=dt;
  const km=220*dt;
  if(keys['KeyW']||keys['ArrowUp'])    shard.y=clamp(shard.y-km,shard.radius,H-shard.radius);
  if(keys['KeyS']||keys['ArrowDown'])  shard.y=clamp(shard.y+km,shard.radius,H-shard.radius);
  if(keys['KeyA']||keys['ArrowLeft'])  shard.x=clamp(shard.x-km,shard.radius,W-shard.radius);
  if(keys['KeyD']||keys['ArrowRight']) shard.x=clamp(shard.x+km,shard.radius,W-shard.radius);
  if(shard.overdriveMode){shard.overdriveTimer-=dt;if(shard.overdriveTimer<=0)shard.overdriveMode=false;}
  shard.trailX.unshift(shard.x);shard.trailY.unshift(shard.y);
  if(shard.trailX.length>20){shard.trailX.pop();shard.trailY.pop();}
  if(shard.hasPlasmaTrail){
    // Use spatial grid: only test enemies near the first few trail points
    const _trR=shard.radius*0.9,_trR2=_trR*_trR;
    const _trLen=Math.min(8,shard.trailX.length);
    for(let ti=0;ti<_trLen;ti++){
      const _tnear=_sgQuery(shard.trailX[ti],shard.trailY[ti],_trR+40);
      for(let ni=0;ni<_tnear.length;ni++){
        const en=_tnear[ni];if(en._rm||en.bodyHitCd>0)continue;
        const _tdx=en.x-shard.trailX[ti],_tdy=en.y-shard.trailY[ti];
        if(_tdx*_tdx+_tdy*_tdy<_trR2){
          hitEnemy(en,.25*shard.trailDmgMult,false);en.bodyHitCd=0.35;
        }
      }
    }
  }
  if(pulse.cd>0)pulse.cd=Math.max(0,pulse.cd-dt);
  for(let ri=0;ri<pulse.rings.length;ri++){
    const ring=pulse.rings[ri];
    ring.r+=ring.speed*dt;
    // Query a square band around the ring radius — avoids iterating all enemies
    const _prt=PULSE_RING_THICKNESS()+32;  // generous band for large enemies
    const _near=_sgQuery(towerX,towerY,ring.r+_prt);
    for(let ni=0;ni<_near.length;ni++){
      const en=_near[ni];
      if(en._rm||ring.hitSet.has(en.id))continue;
      if(en.x<-en.radius||en.x>W+en.radius||en.y<-en.radius||en.y>H+en.radius)continue;
      const _pdx=en.x-towerX,_pdy=en.y-towerY;
      const d=Math.sqrt(_pdx*_pdx+_pdy*_pdy)||1;
      if(Math.abs(d-ring.r)<=en.radius+PULSE_RING_THICKNESS()){
        ring.hitSet.add(en.id);
        const nx=_pdx/d,ny=_pdy/d;
        const anchorMult=en.anchored?0.08:1;
        const sentMult=en.type==='sentinelBrute'?0.1:1;
        const impulse=(PULSE_BASE_FORCE()/(en.mass||1))*anchorMult*sentMult;
        en.vx+=nx*impulse;en.vy+=ny*impulse;
        if(en.shieldHp>0){en.shieldHp=0;spawnImpact(en.x,en.y,'#88eeff');}
        else hitEnemy(en,2.0+en.mass*0.45,true);
        spawnPlasmaExplosion(en.x,en.y,en.color);
      }
    }
  }
  let _rlj=0;
  for(let i=0;i<pulse.rings.length;i++){if(pulse.rings[i].r<pulse.rings[i].maxR)pulse.rings[_rlj++]=pulse.rings[i];}
  pulse.rings.length=_rlj;
  if(shard.autoAimGrace>0)shard.autoAimGrace-=dt;

  // ── AIM UPDATE (all in fixed timestep — never touched by pointer events) ──────
  // Smooth factor: lerp speed ~14 rad/s gives crisp but glitch-free tracking
  const AIM_SMOOTH = 14;
  if(controls.aim.active){
    // JOYSTICK HELD: compute manual angle from stored raw delta
    const jMag = shard._joyMag;
    const DEAD = 12; // px dead zone — ignore resting thumb pressure
    if(jMag > DEAD){
      const manAngle = Math.atan2(shard._joyDy, shard._joyDx);
      let targetAngle = manAngle;
      if(aimAssistOn){
        const ne = nearestEnemy(shard.x, shard.y);
        if(ne){
          const autoAngle = Math.atan2(ne.y-shard.y, ne.x-shard.x);
          // Light assist only — never snaps to enemy, just nudges
          // Constant 12% blend: predictable, no magnitude jitter
          targetAngle = lerpAngle(manAngle, autoAngle, 0.12);
        }
      }
      shard._aimTarget = targetAngle;
    }
    // Smooth lerp toward target each fixed step
    shard.aimAngle = lerpAngle(shard.aimAngle, shard._aimTarget, clamp(AIM_SMOOTH*dt, 0, 1));
    shard.aimLocked = true;
  } else {
    // NO JOYSTICK: auto-aim toward nearest enemy (with grace period after release)
    // At high threat the auto-aim speed degrades so the player must engage manually
    shard.aimLocked = false;
    if(shard.autoAimGrace <= 0){
      const ne = nearestEnemy(shard.x, shard.y);
      if(ne){
        const autoAngle = Math.atan2(ne.y-shard.y, ne.x-shard.x);
        // Auto-aim sluggishness grows with threat: at t2=20 it's 40% as fast
        const autoSlug = clamp(1 - getThreat2()*0.03, 0.25, 1.0);
        shard.aimAngle = lerpAngle(shard.aimAngle, autoAngle, clamp(AIM_SMOOTH*autoSlug*dt, 0, 1));
      }
    }
  }
  shard.fireCooldown-=dt;
  const holdFire=controls.aim.active;
  if(shard.fireCooldown<=0){
    if(holdFire){
      doFireShot(shard.x,shard.y,shard.aimAngle);
      shard.fireCooldown=Math.max(.05,shard.fireRate*upg.fireRate*0.30);
      tone(700,.035,'square',.055);
    }else{
      const hasTarget=shard.aimLocked||enemyInCone(shard.x,shard.y,shard.aimAngle,Math.PI*65/180,370);
      if(hasTarget){doFireShot(shard.x,shard.y,shard.aimAngle);shard.fireCooldown=shard.fireRate*upg.fireRate;tone(680,.04,'square',.055);}
      else shard.fireCooldown=.08;
    }
  }
  if(upg.ghostActive){
    upg.ghostLife-=dt;
    if(upg.ghostLife<=0)upg.ghostActive=false;
    else{
      upg.ghostX=lerp(upg.ghostX,towerX+Math.cos(elapsed*.9)*Math.min(W,H)*.25,.05);
      upg.ghostY=lerp(upg.ghostY,towerY+Math.sin(elapsed*1.2)*Math.min(W,H)*.16,.05);
      const gt=nearestEnemy(upg.ghostX,upg.ghostY);
      if(gt&&shard.fireCooldown<.02)fireDart(upg.ghostX,upg.ghostY,Math.atan2(gt.y-upg.ghostY,gt.x-upg.ghostX));
    }
  }
  // Single pass: update + bump + danger count + in-place removal
  const _dangerR=Math.min(W,H)*0.28, _dangerR2=_dangerR*_dangerR;
  dangerNearTowerCount=0;
  let _ej=0;
  for(let i=0;i<enemies.length;i++){
    const en=enemies[i];
    if(!en._rm){updateEnemy(en,dt);}
    if(!en._rm){shardBump(en,shard.x,shard.y);}
    if(upg.ghostActive&&!en._rm){shardBump(en,upg.ghostX,upg.ghostY);}
    if(!en._rm){
      const _ddx=en.x-towerX,_ddy=en.y-towerY;
      if(_ddx*_ddx+_ddy*_ddy<_dangerR2)dangerNearTowerCount++;
      enemies[_ej++]=en;
    }
  }
  enemies.length=_ej;
  // Rebuild spatial grid now that enemies have moved — used by nearestEnemy below
  _sgBuild();
  if(tower.hitFlash>0)tower.hitFlash-=dt;
  if(tower.healGlow>0)tower.healGlow-=dt;
  tower.regenTimer+=dt;
  if(tower.regenTimer>=_tc.towerRegenInterval&&tower.hp<tower.maxHp){tower.hp=Math.min(tower.maxHp,tower.hp+_tc.towerRegenAmount);tower.regenTimer=0;}
  for(let pi=0;pi<projectiles.length;pi++){
    const p=projectiles[pi];
    if(p.homing>0&&!p.dead){
      const ne=nearestEnemy(p.x,p.y);
      if(ne){
        const dx=ne.x-p.x,dy=ne.y-p.y,d=Math.hypot(dx,dy)||1;
        const str=p.homing*0.06;
        p.vx+=(dx/d)*str;p.vy+=(dy/d)*str;
        const spd=Math.hypot(p.vx,p.vy)||1,tgt=_tc.dartSpeedBase*upg.dartSpeed;
        p.vx=p.vx/spd*tgt;p.vy=p.vy/spd*tgt;
      }
    }
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
  }
  let _plj=0;
  for(let i=0;i<projectiles.length;i++){
    const p=projectiles[i];if(p.life>0&&!p.dead)projectiles[_plj++]=p;
  }
  projectiles.length=_plj;
  // Projectile-enemy collision — direct double loop.
  // With enemy cap ~40 and dart count ~20 this is ~800 dist² checks; far cheaper
  // than maintaining a spatial grid that gets invalidated by enemy movement.
  const _ne=enemies.length;
  for(let pi=0;pi<projectiles.length;pi++){
    const p=projectiles[pi];if(p.dead)continue;
    for(let ei=0;ei<_ne;ei++){
      const en=enemies[ei];if(p.dead||en._rm)continue;
      const _dx=p.x-en.x,_dy=p.y-en.y,_r=en.radius+5;
      if(_dx*_dx+_dy*_dy<_r*_r){
        hitEnemy(en,_tc.projectileDamageMult,true);
        if(!upg.pierce||p.pierced){
          p.dead=true;
          if(upg.burstDarts&&!p.isBurst){
            for(let bi=0;bi<3;bi++){
              const ba=Math.atan2(p.vy,p.vx)+(bi-1)*0.65;
              const bs=_tc.dartSpeedBase*upg.dartSpeed*0.7;
              projectiles.push({x:p.x,y:p.y,vx:Math.cos(ba)*bs,vy:Math.sin(ba)*bs,
                life:0.55,dead:false,pierced:false,isBurst:true,homing:0});
            }
          }
        }else p.pierced=true;
      }
    }
  }
  // In-place dead-projectile removal
  let _pj=0;
  for(let pi=0;pi<projectiles.length;pi++){if(!projectiles[pi].dead)projectiles[_pj++]=projectiles[pi];}
  projectiles.length=_pj;
  let _rkj=0;
  for(let i=0;i<recentKills.length;i++){
    if(elapsed-recentKills[i]<10)recentKills[_rkj++]=recentKills[i];
  }
  recentKills.length=_rkj;
  const killsPer10s=recentKills.length;
  const scorePer10=score-recentScoreSnap;
  if(elapsed%10<dt){recentScoreSnap=score;}
  if(elapsed>20&&killsPer10s<3&&dangerNearTowerCount<2&&rng()<0.015)spawnFodderPack();
  if(elapsed>90&&rng()<0.0015)spawnEscortPack();
  if(elapsed>30&&scorePer10<12){pacingBoost=true;pacingBoostTimer=8;}
  if(pacingBoostTimer>0){pacingBoostTimer-=dt;if(pacingBoostTimer<=0)pacingBoost=false;}
  spawnTimer-=dt;
  if(spawnTimer<=0){spawnEnemy();spawnTimer=getSpawnInterval();}
  if(bossBannerTimer>0){bossBannerTimer-=dt;if(bossBannerTimer<=0)document.getElementById('boss-banner').classList.add('hidden');}
  tutUpdate(dt);
  if(bossActive){
    bossTimer-=dt;
    if(bossSpawnTimer>0){
      bossSpawnTimer-=dt;
      if(bossSpawnTimer<=0){
        if(!enemies.some(e=>e.isBoss&&!e._rm))spawnBoss(bossEventsTriggered.size-1);
        bossSpawnTimer=-1;
      }
    }
    if(bossTimer<=0)bossActive=false;
  }
  let _parj=0;
  for(let i=0;i<particles.length;i++){
    const p=particles[i];
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=28*dt;p.vx*=.97;p.life-=dt;
    if(p.life>0)particles[_parj++]=p;
  }
  particles.length=_parj;
  const _pcap=ultraMode?100:240;
  if(particles.length>_pcap)particles.splice(0,particles.length-_pcap);
}

// ── HIGHSCORE + SHARE ─────────────────────────────────────────────────
const SNIDE=["Not bad. The tower still thinks you got lucky.","Your thumbs have opinions. Mostly violence.","Defense held… barely. Try again.","Congrats. Now do it without panic-spinning.","The enemies will be back. They always come back.","Some call it skill. The tower calls it desperation."];
function getHighScores(){try{return JSON.parse(localStorage.getItem('psd_scores')||'[]');}catch(e){return[];}}
function saveHighScore(s,t){let arr=getHighScores();arr.push({score:s,time:Math.floor(t),date:new Date().toLocaleDateString()});arr.sort((a,b)=>b.score-a.score);arr=arr.slice(0,5);try{localStorage.setItem('psd_scores',JSON.stringify(arr));}catch(e){}return arr;}
function formatTime(s){return`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;}
function showHighScores(cur){
  const arr=getHighScores(),el=document.getElementById('hs-list');
  if(!arr.length){el.innerHTML='';return;}
  let h='<div style="color:#00e5ff;letter-spacing:2px;font-size:.68rem;margin-bottom:3px">TOP SCORES</div>';
  arr.forEach((a,i)=>{const cls=a.score===cur?'hs-new':'';h+=`<div class="${cls}">${i+1}. ${a.score} — ${formatTime(a.time)}</div>`;});
  el.innerHTML=h;
}
let _posterUrl=null,_snideText='';
// Preload the landing poster so it can be embedded in the share card
let _posterImgEl=null;
(function preloadPosterImg(){
  _posterImgEl=new Image();
  _posterImgEl.src='assets/poster.png';
})();
function generatePoster(){
  const snide=SNIDE[Math.floor(rng()*SNIDE.length)];_snideText=snide;
  const oc=document.createElement('canvas');oc.width=1080;oc.height=1920;
  const c=oc.getContext('2d');
  const t=T();const bgs=t.bgColors;
  const g=c.createLinearGradient(0,0,0,1920);
  g.addColorStop(0,bgs[Math.min(bgPhase,bgs.length-1)][0]);
  g.addColorStop(1,bgs[Math.min(bgPhase,bgs.length-1)][2]||bgs[0][2]);
  c.fillStyle=g;c.fillRect(0,0,1080,1920);
  // Overlay the landing poster image as a moody background
  if(_posterImgEl&&_posterImgEl.complete&&_posterImgEl.naturalWidth>0){
    c.save();
    c.globalAlpha=0.38;
    const imgScale=Math.max(1080/_posterImgEl.naturalWidth,1920/_posterImgEl.naturalHeight);
    const iw=_posterImgEl.naturalWidth*imgScale,ih=_posterImgEl.naturalHeight*imgScale;
    c.drawImage(_posterImgEl,(1080-iw)/2,(1920-ih)/2,iw,ih);
    c.restore();
    // Re-apply dark gradient over it to keep text readable
    const ov=c.createLinearGradient(0,0,0,1920);
    ov.addColorStop(0,'rgba(4,2,15,0.55)');ov.addColorStop(0.55,'rgba(4,2,15,0.45)');ov.addColorStop(1,'rgba(4,2,15,0.80)');
    c.fillStyle=ov;c.fillRect(0,0,1080,1920);
  }
  c.strokeStyle='rgba(255,255,255,.05)';c.lineWidth=1;
  for(let x=0;x<1080;x+=60){c.beginPath();c.moveTo(x,0);c.lineTo(x,1920);c.stroke();}
  for(let y=0;y<1920;y+=60){c.beginPath();c.moveTo(0,y);c.lineTo(1080,y);c.stroke();}
  c.font='bold 72px Orbitron,sans-serif';c.fillStyle=t.accent;c.textAlign='center';
  c.shadowColor=t.accent;c.shadowBlur=28;c.fillText('PLASMA',540,200);c.fillText('DEFENCE',540,290);c.shadowBlur=0;
  c.strokeStyle='rgba(255,255,255,.2)';c.lineWidth=1;c.beginPath();c.moveTo(120,330);c.lineTo(960,330);c.stroke();
  c.font='bold 150px Orbitron,sans-serif';c.fillStyle='#fff';c.shadowColor=t.accent;c.shadowBlur=36;
  c.fillText(lastFinalScore.toString(),540,540);c.shadowBlur=0;
  c.font='46px Share Tech Mono,monospace';c.fillStyle='#8ab8cc';c.fillText(formatTime(lastFinalTime)+' SURVIVED',540,625);
  c.save();c.translate(540,960);c.strokeStyle=t.shipGlow+'cc';c.lineWidth=4;c.shadowColor=t.shipGlow;c.shadowBlur=18;
  const sr=86;c.beginPath();c.arc(0,0,sr*.72,0,Math.PI*2);c.stroke();
  c.beginPath();c.moveTo(0,sr*.72);c.lineTo(0,-sr*1.6);c.stroke();
  c.beginPath();c.moveTo(0,-sr*1.6);c.lineTo(-sr*.36,-sr*1.04);c.moveTo(0,-sr*1.6);c.lineTo(sr*.36,-sr*1.04);c.stroke();c.restore();
  c.font='italic 36px Georgia,serif';c.fillStyle='rgba(180,200,215,.9)';c.shadowBlur=0;
  const ws=snide.split(' '),mW=820;let ln='',lns=[];
  ws.forEach(w=>{const test=ln?ln+' '+w:w;if(c.measureText(test).width>mW){lns.push(ln);ln=w;}else ln=test;});lns.push(ln);
  lns.forEach((l,i)=>c.fillText(l,540,1450+i*50));
  c.font='28px Orbitron,sans-serif';c.fillStyle='rgba(0,229,255,.55)';c.fillText('pd1.rameing.com',540,1875);
  c.font='22px Share Tech Mono,monospace';c.fillStyle='rgba(0,229,255,.28)';c.fillText('MADE BY ROOPAM',540,1905);
  return oc.toDataURL('image/png');
}
async function handleShare(){
  const dataUrl=_posterUrl||(_posterUrl=generatePoster());
  const invites=[
    'Need a quick stress buster? Try this — 2 minutes, no sign up needed 🎮',
    'This game is weirdly relaxing. Give it 2 minutes 👾',
    'Pure arcade fun — I dare you to beat my score 🚀',
    'Quick fun during a break? This hits different ⚡',
    'No downloads, just open and play. Great for a quick recharge 🎯',
  ];
  const invite=invites[Math.floor(rng()*invites.length)];
  const caption=`${invite}\n\n🎮 Plasma Defence\n⚡ Score: ${lastFinalScore} · ${formatTime(lastFinalTime)} survived\n${_snideText}\n\n▶ Play free: https://pd1.rameing.com`;
  try{
    const blob=await(await fetch(dataUrl)).blob();
    const file=new File([blob],'plasma.png',{type:'image/png'});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({title:'Plasma Defence',text:caption,files:[file]});return;
    }
  }catch(e){}
  // Fallback: download poster + copy text
  const a=document.createElement('a');a.href=dataUrl;a.download='plasma_defense.png';a.click();
  try{await navigator.clipboard.writeText(caption);}catch(e){}
}

// ── GAME FLOW ─────────────────────────────────────────────────────────
function startGame(){
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('upgrade-overlay').classList.add('hidden');
  document.getElementById('pause-overlay').classList.add('hidden');
  document.getElementById('boss-banner').classList.add('hidden');
  score=0;elapsed=0;waveStage=0;bgPhase=0;
  const _hp=Tuning.get("towerHp"); tower.hp=tower.maxHp=_hp;tower.hitFlash=0;tower.regenTimer=0;tower.healGlow=0;
  shard.x=W/2;shard.y=H*0.32;
  // Reset tutorial state for this run
  _tutActive=false;_tutStep=0;_tutTimer=0;_tutFadeIn=0;
  _tutUpgHint=false;_tutUpgTimer=0;_tutUpgShown=false;
  shard.aimAngle=-Math.PI/2;shard._aimTarget=-Math.PI/2;shard._joyDx=0;shard._joyDy=0;shard._joyMag=0;shard.aimLocked=false;shard.autoAimGrace=0;
  shard.fireCooldown=0;shard.fireRate=Tuning.get("playerFireRate");shard.isDragged=false;shard.hasPlasmaTrail=false;shard.trailDmgMult=1;
  shard.overdriveMode=false;shard.overdriveTimer=0;
  shard.trailX=[];shard.trailY=[];
  controls.aim.active=false;controls.aim.pid=null;controls.aim.dx=0;controls.aim.dy=0;
  controls.move.active=false;controls.move.pid=null;
  upg={fireRate:1,dartSpeed:1,knockbackMult:1,pulseCdMult:1,shotCount:1,pierce:false,slowAura:false,slowAuraR:82,attractForce:false,attractStrength:0,ghostActive:false,ghostLife:0,ghostX:0,ghostY:0,ramDmg:Tuning.get('ramDamageBase'),projTier:1,homingLevel:0,burstDarts:false,stackCounts:{}};
  pulse.cd=0;pulse.rings=[];
  enemies=[];projectiles=[];particles=[];
  spawnTimer=0.5;  // first enemy arrives in 0.5s, not 2s
  milestonesHit=new Set();upgradeFlash={text:'',timer:0};
  // Seed 2 runners immediately so the player has something to engage right away
  for(let i=0;i<2;i++){
    const halfW=W/2+20,halfH=H/2+20;
    let ex,ey;
    if(i===0){ex=towerX-halfW-10;ey=towerY+(rng()*2-1)*halfH*0.6;}
    else     {ex=towerX+halfW+10;ey=towerY+(rng()*2-1)*halfH*0.6;}
    enemies.push(makeEnemy('runner',ex,ey));
  }
  upgradePendingCount=0;updateUpgradePin();
  recentKills=[];recentScoreSnap=0;recentScoreTime=elapsed;
  pacingBoost=false;pacingBoostTimer=0;safetyValveTimer=0;
  combo=1;lastKillTime=0;
  bossEventsTriggered=new Set();bossActive=false;bossTimer=0;bossBannerTimer=0;bossSpawnTimer=0;
  musicIntensityBoost=0;dangerNearTowerCount=0;
  _rngS=Date.now()&0xFFFFFFFF;_posterUrl=null;_lastThemeBgPhase=-1;
  state=S.PLAY;
  _rebuildTuningCache();  // cache Tuning values for this run
  applyBrandCSS();
  // Show tutorial every game unless user explicitly clicked 'Don't show again'
  try{ if(!localStorage.getItem('pd_tut_never'))tutStart(); }catch(_){ tutStart(); }
  document.getElementById('play-btn').textContent='RETRY';
  startMusic();unduckMusic(0.1);
}
function gameOver(){
  state=S.OVER;lastFinalScore=score;lastFinalTime=elapsed;
  const arr=saveHighScore(score,elapsed);duckMusic(0.06,0.8);
  const ov=document.getElementById('overlay');
  ov.querySelector('#main-title').innerHTML='GAME<br>OVER';
  ov.querySelector('#main-sub').textContent='';
  document.getElementById('play-btn').textContent='RETRY';
  showHighScores(score);
  document.getElementById('share-btn').classList.remove('hidden');
  ov.classList.remove('hidden');
}
function togglePause(){
  if(state===S.PLAY){state=S.PAUSE;document.getElementById('pause-overlay').classList.remove('hidden');pauseBtn.textContent='▶';duckMusic();}
  else if(state===S.PAUSE)resumeGame();
}
function resumeGame(){
  state=S.PLAY;document.getElementById('pause-overlay').classList.add('hidden');pauseBtn.textContent='⏸';unduckMusic();
}

// ── RENDER ────────────────────────────────────────────────────────────
let plasmaT=0,recentScoreSnap=0;

// ── STARFIELD (offscreen-cached) ─────────────────────────────────────
// Pre-rendered to offscreen canvas — no per-star arc/shadow each frame.
// Twinkle is faked by varying globalAlpha of the whole bitmap (cheap).
const STARS=(()=>{
  const s=[];
  for(let i=0;i<110;i++){
    s.push({
      x:Math.random(),y:Math.random(),
      r:Math.random()*1.4+0.2,
      twinkle:Math.random()*Math.PI*2,
      speed:Math.random()*0.8+0.3,
      bright:Math.random()*0.5+0.25,
    });
  }
  return s;
})();

// Offscreen canvas for static background gradient (phase/theme keyed)
let _bgOC=null,_bgOCtx=null,_bgCacheKey='';
// Offscreen canvas for pre-rendered starfield (phase/resize keyed)
let _starOC=null,_starOCtx=null,_starCacheKey='';

function _invalidateBgCache(){_bgCacheKey='';_starCacheKey='';}
window.addEventListener('brandChanged',_invalidateBgCache);

function _renderBgCache(th,ph){
  const key=th.name+'|'+ph+'|'+W+'|'+H;
  if(_bgCacheKey===key)return;
  _bgCacheKey=key;
  if(!_bgOC){_bgOC=document.createElement('canvas');}
  _bgOC.width=Math.round(W*DPR);_bgOC.height=Math.round(H*DPR);
  _bgOCtx=_bgOC.getContext('2d');
  const c=_bgOCtx,bcs=th.bgColors;
  const [c0,c1,c2]=bcs[Math.min(ph,bcs.length-1)];
  const bg=c.createRadialGradient(CX*DPR,H*.38*DPR,0,CX*DPR,H*.55*DPR,Math.max(W,H)*.95*DPR);
  bg.addColorStop(0,c0);bg.addColorStop(.45,c1||c0);bg.addColorStop(1,c2||c1||c0);
  c.fillStyle=bg;c.fillRect(0,0,_bgOC.width,_bgOC.height);
}

function _renderStarCache(ph){
  const key='s'+ph+'|'+W+'|'+H;
  if(_starCacheKey===key)return;
  _starCacheKey=key;
  if(!_starOC){_starOC=document.createElement('canvas');}
  _starOC.width=Math.round(W*DPR);_starOC.height=Math.round(H*DPR);
  _starOCtx=_starOC.getContext('2d');
  const c=_starOCtx;
  c.clearRect(0,0,_starOC.width,_starOC.height);
  const bright=clamp(.6+(ph*.06),0,1);
  // Batch large stars (r>1) first with soft glow, then small ones — 2 state changes total
  c.shadowColor='#aaddff';c.fillStyle='#ffffff';
  c.shadowBlur=4*DPR;
  for(let i=0;i<STARS.length;i++){
    const s=STARS[i];if(s.r<=1)continue;
    c.globalAlpha=s.bright*bright;
    c.beginPath();c.arc(s.x*W*DPR,s.y*H*DPR,s.r*DPR,0,Math.PI*2);c.fill();
  }
  c.shadowBlur=0;
  for(let i=0;i<STARS.length;i++){
    const s=STARS[i];if(s.r>1)continue;
    c.globalAlpha=s.bright*bright;
    c.beginPath();c.arc(s.x*W*DPR,s.y*H*DPR,s.r*DPR,0,Math.PI*2);c.fill();
  }
  c.globalAlpha=1;
}

function render(){
  _refreshTheme();  // cache T() for this frame — all code below uses th, never T()
  ctx.setTransform(DPR,0,0,DPR,shake.x,shake.y);
  ctx.clearRect(-2,-2,W+4,H+4);
  plasmaT+=0.014;
  const th=T();
  const ph=Math.min(bgPhase,th.bgColors.length-1);

  // ── Background fill — cached offscreen canvas (rebuilt only on phase/theme change)
  _renderBgCache(th,ph);
  // Draw bg offscreen canvas — DPR transform is active so W×H = full CSS screen
  ctx.drawImage(_bgOC,0,0,W,H);

  if(!ultraMode){
    // Nebula bloom — animated radial glow (skip in ultra mode)
    ctx.save();
    const nebulaA=.055+Math.sin(plasmaT*.4)*.018;
    const nb=ctx.createRadialGradient(CX,H*.35,0,CX,H*.35,Math.min(W,H)*.62);
    nb.addColorStop(0,th.accent+'28');nb.addColorStop(.5,th.accent+'0a');nb.addColorStop(1,'transparent');
    ctx.globalAlpha=nebulaA*3;ctx.fillStyle=nb;ctx.fillRect(0,0,W,H);
    ctx.restore();
  }

  // Starfield — offscreen bitmap blit with subtle twinkle via globalAlpha
  if(!ultraMode){
    _renderStarCache(ph);
    const twinkleAlpha=clamp(.85+Math.sin(plasmaT*0.7)*.12,0,1);
    ctx.save();ctx.globalAlpha=twinkleAlpha;
    // DPR transform active — W×H = full CSS screen
    ctx.drawImage(_starOC,0,0,W,H);
    ctx.restore();
  } else {
    // Ultra: 20 plain dots, zero shadow
    ctx.save();ctx.fillStyle='#ffffff';
    for(let i=0;i<20;i++){const s=STARS[i*5];ctx.globalAlpha=s.bright*.7;ctx.fillRect(s.x*W-1,s.y*H-1,2,2);}
    ctx.globalAlpha=1;ctx.restore();
  }

  // Phase tint overlay
  if(bgPhase>0){
    ctx.save();
    ctx.globalAlpha=(.28+Math.sin(plasmaT*2)*.22)*.38;
    ctx.fillStyle=th.accent+'44';ctx.fillRect(0,0,W,H);
    ctx.restore();
  }

  // Grid — batched into single path (was N separate stroke() calls)
  if(!ultraMode){
    ctx.save();ctx.strokeStyle=th.gridColor;ctx.lineWidth=.5;
    const gridOff=(plasmaT*12)%60;
    ctx.globalAlpha=.06;
    ctx.beginPath();
    for(let gx=0;gx<W;gx+=60){ctx.moveTo(gx,0);ctx.lineTo(gx,H);}
    for(let gy=-gridOff;gy<H;gy+=60){ctx.moveTo(0,gy);ctx.lineTo(W,gy);}
    ctx.stroke();
    ctx.restore();
  }

  // Range rings — batched into single arc path
  if(!ultraMode){
    ctx.save();ctx.strokeStyle='rgba(0,180,255,.05)';ctx.lineWidth=1;ctx.setLineDash([4,10]);
    const _rrR=Math.min(W,H);
    ctx.beginPath();
    [.28,.48,.68].forEach(f=>{ctx.arc(towerX,towerY,_rrR*f,0,Math.PI*2);ctx.moveTo(towerX+_rrR*.69,towerY);});
    ctx.stroke();ctx.setLineDash([]);ctx.restore();
  }

  // Pulse rings — style can be 'ripple' or 'ring' from brand
  const pStyle=th.pulseStyle||'ring';
  pulse.rings.forEach(ring=>{
    const a=1-ring.r/ring.maxR;
    ctx.save();
    if(pStyle==='ripple'){
      // Multiple faint concentric rings give slow-distortion feel
      for(let ri=0;ri<3;ri++){
        const off=ri*18*(1-a);
        ctx.strokeStyle=th.pulseColor+(a*.38*(1-ri*.28))+')';
        ctx.lineWidth=2*(1-ri*.25)*a+.3;
        ctx.shadowColor=th.accent;ctx.shadowBlur=8*a;
        ctx.beginPath();ctx.arc(towerX,towerY,ring.r-off,0,Math.PI*2);ctx.stroke();
      }
    }else if(pStyle==='burst'){
      // Extra thick energetic ring + inner glow
      ctx.strokeStyle=th.pulseColor+(a*.8)+')';ctx.lineWidth=5*a+1;
      ctx.shadowColor=th.accent;ctx.shadowBlur=22*a;
      ctx.beginPath();ctx.arc(towerX,towerY,ring.r,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle=th.pulseColor+(a*.3)+')';ctx.lineWidth=12*a;ctx.shadowBlur=0;
      ctx.beginPath();ctx.arc(towerX,towerY,ring.r,0,Math.PI*2);ctx.stroke();
    }else{
      ctx.strokeStyle=th.pulseColor+(a*.65)+')';ctx.lineWidth=3*a+.5;
      ctx.shadowColor=th.accent;ctx.shadowBlur=14*a;
      ctx.beginPath();ctx.arc(towerX,towerY,ring.r,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
  });

  // Healer aura
  if(!ultraMode){
    for(let i=0;i<enemies.length;i++){
      const en=enemies[i];
      if(!en._rm&&en.healAura){
        ctx.save();ctx.globalAlpha=.08+Math.sin(plasmaT*3)*.04;
        const ag=ctx.createRadialGradient(en.x,en.y,0,en.x,en.y,100);
        ag.addColorStop(0,'#44ff88');ag.addColorStop(1,'transparent');
        ctx.fillStyle=ag;ctx.beginPath();ctx.arc(en.x,en.y,100,0,Math.PI*2);ctx.fill();
        ctx.restore();
      }
    }
  }

  drawTower();
  for(let i=0;i<enemies.length;i++){const en=enemies[i];if(!en._rm)drawEnemy(en);}

  // Plasma trail
  if(shard.hasPlasmaTrail&&shard.trailX.length>1){
    ctx.save();
    if(!ultraMode){ctx.shadowColor=th.accent;ctx.shadowBlur=7;}
    for(let i=1;i<shard.trailX.length;i++){
      ctx.globalAlpha=(1-i/shard.trailX.length)*.48;
      ctx.strokeStyle=th.accent;ctx.lineWidth=shard.radius*.5*(1-i/shard.trailX.length);
      ctx.beginPath();ctx.moveTo(shard.trailX[i-1],shard.trailY[i-1]);ctx.lineTo(shard.trailX[i],shard.trailY[i]);ctx.stroke();
    }
    ctx.restore();
  }

  // Slow aura
  if(upg.slowAura){
    ctx.save();ctx.globalAlpha=.11;
    if(ultraMode){
      ctx.strokeStyle=th.accent+'88';ctx.lineWidth=1.5;ctx.setLineDash([4,6]);
      ctx.beginPath();ctx.arc(shard.x,shard.y,82+shard.radius,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const sg=ctx.createRadialGradient(shard.x,shard.y,0,shard.x,shard.y,82+shard.radius);
      sg.addColorStop(0,th.accent);sg.addColorStop(1,'transparent');
      ctx.fillStyle=sg;ctx.beginPath();ctx.arc(shard.x,shard.y,82+shard.radius,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  if(upg.ghostActive&&upg.ghostLife>0)drawShipAt(upg.ghostX,upg.ghostY,shard.aimAngle,clamp(upg.ghostLife/8,0,1)*.4);
  drawAimLine();
  drawShipAt(shard.x,shard.y,shard.aimAngle,1);

  // Thumb ring
  if(shard.isDragged&&controls.move.active){
    const rx=controls.move.rawX,ry=controls.move.rawY;
    ctx.save();
    ctx.shadowBlur=20;ctx.shadowColor=th.accent+'cc';ctx.strokeStyle=th.accent+'b0';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.arc(rx,ry,26,0,Math.PI*2);ctx.stroke();
    ctx.shadowBlur=8;ctx.strokeStyle=th.accent+'33';ctx.lineWidth=8;
    ctx.beginPath();ctx.arc(rx,ry,26,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }

  // Projectiles
  const tc=getTierColor();
  const projStyle=th.projStyle||'dart';
  // Projectiles — single save/restore, shadowBlur set once outside the loop
  ctx.save();
  ctx.fillStyle=tc;ctx.strokeStyle=tc;
  if(!ultraMode){ctx.shadowColor=tc;ctx.shadowBlur=9+upg.projTier*3;}
  const _pTailLen=20+upg.projTier*3,_pLW=1.5+upg.projTier*.35;
  for(let pi=0;pi<projectiles.length;pi++){
    const p=projectiles[pi];
    const angle=Math.atan2(p.vy,p.vx);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);
    // Tail streak
    if(!ultraMode){
      ctx.globalAlpha=.32;ctx.lineWidth=_pLW;
      if(!ultraMode)ctx.shadowBlur=6;
      ctx.beginPath();ctx.moveTo(-_pTailLen,0);ctx.lineTo(0,0);ctx.stroke();
      ctx.shadowBlur=9+upg.projTier*3;
    }
    ctx.globalAlpha=1;
    if(projStyle==='fry'){
      ctx.fillRect(-2,-12+upg.projTier,4,12);
    }else if(projStyle==='droplet'){
      ctx.beginPath();ctx.arc(0,0,3+upg.projTier*.5,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.moveTo(-2.5,0);ctx.lineTo(0,12+upg.projTier*2);ctx.lineTo(2.5,0);ctx.closePath();ctx.fill();
    }else if(projStyle==='gear'){
      const gr=4+upg.projTier;
      for(let gi=0;gi<8;gi++){const ga=gi/8*Math.PI*2;ctx.fillRect(Math.cos(ga)*gr-1.5,-1.5,3,3);}
      ctx.beginPath();ctx.arc(0,0,gr*.55,0,Math.PI*2);ctx.fill();
    }else{
      ctx.beginPath();ctx.moveTo(11+upg.projTier,0);ctx.lineTo(-4,2.5+upg.projTier*.5);ctx.lineTo(-4,-2.5-upg.projTier*.5);ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
  ctx.shadowBlur=0;ctx.restore();

  // Particles — batched by type to minimise GPU state changes
  ctx.save();
  const _pShadow=!ultraMode;
  for(let pi=0;pi<particles.length;pi++){
    const p=particles[pi];
    const _pa=clamp(p.life*2.5,0,1);
    ctx.globalAlpha=_pa;
    if(p.type==='flash'){
      if(_pShadow){ctx.shadowBlur=26;ctx.shadowColor=p.color;}
      ctx.fillStyle=p.color;ctx.globalAlpha=_pa*.5;
      ctx.beginPath();ctx.arc(p.x,p.y,p.size*(1-p.life*.5+.1),0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=_pa;
      if(_pShadow)ctx.shadowBlur=0;
    } else if(p.type==='glow'){
      if(_pShadow){ctx.shadowBlur=13;ctx.shadowColor=p.color;}
      ctx.fillStyle=p.color;
      ctx.beginPath();ctx.arc(p.x,p.y,p.size/2,0,Math.PI*2);ctx.fill();
      if(_pShadow)ctx.shadowBlur=0;
    } else if(p.type==='rect'){
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot+p.life*4);
      if(_pShadow){ctx.shadowBlur=7;ctx.shadowColor=p.color;}
      ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/3,p.size,p.size*.5);
      ctx.restore();
    } else {
      if(_pShadow){ctx.shadowBlur=4;ctx.shadowColor=p.color;}
      ctx.fillStyle=p.color;
      ctx.beginPath();ctx.arc(p.x,p.y,p.size/2,0,Math.PI*2);ctx.fill();
      if(_pShadow)ctx.shadowBlur=0;
    }
  }
  ctx.shadowBlur=0;ctx.restore();

  drawControls();
  drawHUD();
  drawTutorial();
}

function drawTower(){
  ctx.save();
  const flash=tower.hitFlash>0?tower.hitFlash/.3:0,heal=tower.healGlow;
  const ps=1+Math.sin(elapsed*4)*.03;
  const th=T();
  const colors=th.towerColors;
  [28,20,13,7].forEach((r,i)=>{
    ctx.beginPath();ctx.arc(towerX,towerY,r*ps,0,Math.PI*2);
    ctx.fillStyle=flash>0?`rgba(255,60,120,${.4+flash*.5})`:heal>0?`rgba(0,255,153,${.18+heal*.28})`:colors[i]||'#1a0840';
    ctx.shadowBlur=flash>0?18:heal>0?13:9;
    ctx.shadowColor=flash>0?'#ff3c78':heal>0?'#00ff99':'#6622cc';
    ctx.fill();ctx.strokeStyle='rgba(100,60,255,.35)';ctx.lineWidth=1;ctx.stroke();
  });
  const hf=tower.hp/tower.maxHp;
  ctx.shadowBlur=7;ctx.strokeStyle=hf>.5?'#00ffaa':hf>.25?'#ffaa00':'#ff3333';ctx.shadowColor=ctx.strokeStyle;
  ctx.lineWidth=3.5;ctx.lineCap='round';
  ctx.beginPath();ctx.arc(towerX,towerY,33,-Math.PI/2,-Math.PI/2+Math.PI*2*hf);ctx.stroke();
  ctx.restore();
}
function drawShipAt(x,y,angle,alpha){
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(angle+Math.PI/2);
  const r=shard.radius,od=shard.overdriveMode;
  const th=T();
  const gc=od?'#ff4400':th.shipGlow,cc=od?'#ffaa00':th.shipCore;
  ctx.save();
  const bl=ctx.createRadialGradient(0,0,r*.3,0,0,r*1.8);
  bl.addColorStop(0,od?'rgba(255,100,0,.13)':gc+'1c');bl.addColorStop(1,'transparent');
  ctx.fillStyle=bl;ctx.beginPath();ctx.arc(0,0,r*1.8,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.save();ctx.shadowBlur=13;ctx.shadowColor=gc;ctx.strokeStyle=gc;ctx.lineWidth=2.5;
  ctx.beginPath();ctx.arc(0,0,r*.72,0,Math.PI*2);ctx.stroke();
  ctx.globalAlpha=.38;ctx.strokeStyle=cc;ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(0,0,r*.52,0,Math.PI*2);ctx.stroke();ctx.restore();
  ctx.save();ctx.shadowBlur=15;ctx.shadowColor=gc;ctx.strokeStyle=gc;ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(0,r*.72);ctx.lineTo(0,-r*1.6);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,-r*1.6);ctx.lineTo(-r*.37,-r*1.04);ctx.moveTo(0,-r*1.6);ctx.lineTo(r*.37,-r*1.04);ctx.stroke();
  ctx.globalAlpha=.65;ctx.beginPath();ctx.moveTo(-r*.72,0);ctx.lineTo(-r*.45,r*.6);ctx.moveTo(r*.72,0);ctx.lineTo(r*.45,r*.6);ctx.stroke();ctx.restore();
  ctx.save();
  const og=ctx.createRadialGradient(0,0,0,0,0,r*.38);
  og.addColorStop(0,'#fff');og.addColorStop(.4,cc);og.addColorStop(1,'transparent');
  ctx.shadowBlur=18;ctx.shadowColor=cc;ctx.fillStyle=og;
  ctx.beginPath();ctx.arc(0,0,r*.38,0,Math.PI*2);ctx.fill();ctx.restore();
  if(shard.overdriveMode){ctx.save();ctx.strokeStyle='rgba(255,160,0,.55)';ctx.lineWidth=2;ctx.shadowBlur=14;ctx.shadowColor='#ffaa00';ctx.beginPath();ctx.arc(0,0,r+8,0,Math.PI*2);ctx.stroke();ctx.restore();}
  ctx.restore();
}
function drawEnemy(en){
  ctx.save();ctx.translate(en.x,en.y);
  const r=en.radius;
  const perf=ultraMode||!!(T().perfMode);
  if(en.stunTimer>0||en.hitTimer>0){const s=1+Math.sin(en.hitTimer*30)*.1;ctx.scale(s,1/s);}
  if(!perf&&en.teleportGlow>0){ctx.shadowBlur=28*en.teleportGlow;ctx.shadowColor='#aa00ff';}
  ctx.rotate(en.wobble*.05+elapsed*(en.type==='bruteNgon'||en.type==='anchored'||en.type==='sentinelBrute'?.35:en.type==='skitter'?2:en.type==='spiralHunter'?(1.1+(1-clamp(en.hp/en.maxHp,0,1))*2.2):0.8));
  if(!perf&&en.type==='spiralHunter'){
    const enrT=1-clamp(en.hp/en.maxHp,0,1);
    ctx.save();ctx.strokeStyle=`rgba(255,80,255,${0.25+enrT*0.45})`;ctx.lineWidth=1.5+enrT*1.5;
    ctx.shadowBlur=14+enrT*18;ctx.shadowColor='#ff55ff';
    ctx.beginPath();ctx.arc(0,0,r*1.45,0,Math.PI*2);ctx.stroke();ctx.restore();
    ctx.shadowBlur=14+enrT*12;ctx.shadowColor='#ff55ff';
  }
  if(!perf&&en.anchored){
    ctx.save();ctx.strokeStyle=en.color+'88';ctx.lineWidth=1;ctx.shadowBlur=10;ctx.shadowColor=en.color;
    ctx.setLineDash([3,5]);ctx.beginPath();ctx.arc(0,0,r*1.5,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
  }
  if(!perf){ctx.shadowBlur=12;ctx.shadowColor=en.color;}
  ctx.fillStyle=en.color;
  drawEPath(en);ctx.fill();
  ctx.strokeStyle=en.isBoss?'rgba(255,255,255,.38)':'rgba(255,255,255,.18)';ctx.lineWidth=en.isBoss?2.5:1;ctx.stroke();
  if(!perf&&en.shieldHp>0){
    ctx.save();
    const shieldA=.3+.3*(en.shieldHp/Math.max(en.shieldMax,1));
    ctx.strokeStyle=`rgba(100,220,255,${shieldA})`;ctx.lineWidth=3;ctx.shadowBlur=14;ctx.shadowColor='#44ddff';
    ctx.beginPath();ctx.arc(0,0,r+6+Math.sin(elapsed*4)*2,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  if(en.hp<en.maxHp){
    const bw=r*2.4;ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(-bw/2,-r-9,bw,4);
    ctx.fillStyle=en.color;ctx.fillRect(-bw/2,-r-9,bw*(en.hp/en.maxHp),4);
  }
  // Red flash on hit
  // Blitz enemy: extra white outer ring to visually signal speed
  if(en.blitz&&!perf){
    ctx.save();
    ctx.strokeStyle='rgba(255,255,255,0.85)';
    ctx.lineWidth=2;
    ctx.shadowBlur=14;ctx.shadowColor='#ffffff';
    ctx.beginPath();ctx.arc(0,0,r*1.55,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
  if(en.flashTimer>0){
    ctx.save();
    ctx.globalAlpha=en.flashTimer*0.78;
    ctx.fillStyle='#ff1a1a';
    if(!perf){ctx.shadowBlur=20;ctx.shadowColor='#ff0000';}
    drawEPath(en);ctx.fill();
    ctx.restore();
  }
  // Brand emoji skin (skipped in perf mode)
  if(!perf){
    const glyph=T().enemySkin[en.type];
    if(glyph){
      const sprite=getGlyphSprite(glyph,r);
      const drawSize=r*3.3;
      ctx.save();ctx.globalAlpha=0.97;
      ctx.drawImage(sprite,-drawSize/2,-drawSize/2,drawSize,drawSize);
      ctx.restore();
    }
  }
  ctx.restore();
}
function drawEPath(en){
  const r=en.radius,s=en.shape;
  ctx.beginPath();
  if(s==='ngon'){
    const n=en.sides||6;
    for(let i=0;i<n;i++){const a=i/n*Math.PI*2-Math.PI/n;i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}
    ctx.closePath();
  }else if(s==='tri'){ctx.moveTo(0,-r*1.2);ctx.lineTo(r,r*.7);ctx.lineTo(-r,r*.7);ctx.closePath();}
  else if(s==='hex'){for(let i=0;i<6;i++){const a=i/6*Math.PI*2-Math.PI/6;i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();}
  else if(s==='circ'){ctx.arc(0,0,r,0,Math.PI*1.82);ctx.lineTo(0,0);ctx.closePath();}
  else if(s==='diamond'){ctx.moveTo(0,-r*1.3);ctx.lineTo(r*.7,0);ctx.lineTo(0,r*1.3);ctx.lineTo(-r*.7,0);ctx.closePath();}
}
function drawControls(){
  if(state!==S.PLAY&&state!==S.PAUSE)return;
  const th=T();
  ctx.save();

  // ── Aim joystick (bottom-left) ─────────────────────────────────────
  const ax=controls.aim.x,ay=controls.aim.y,ar=controls.aim.r;
  // Outer glow disc
  ctx.globalAlpha=.08;ctx.fillStyle=th.accent;
  ctx.beginPath();ctx.arc(ax,ay,ar,0,Math.PI*2);ctx.fill();
  // Outer ring
  ctx.globalAlpha=.35;ctx.strokeStyle=th.accent;ctx.lineWidth=2;
  ctx.shadowBlur=8;ctx.shadowColor=th.accent;
  ctx.beginPath();ctx.arc(ax,ay,ar,0,Math.PI*2);ctx.stroke();
  // Middle ring
  ctx.shadowBlur=0;ctx.globalAlpha=.14;ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(ax,ay,ar*.6,0,Math.PI*2);ctx.stroke();
  // Crosshair lines
  ctx.globalAlpha=.10;ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(ax-ar,ay);ctx.lineTo(ax+ar,ay);ctx.stroke();
  ctx.beginPath();ctx.moveTo(ax,ay-ar);ctx.lineTo(ax,ay+ar);ctx.stroke();
  // Thumb nub — bright with glow
  const tx2=ax+controls.aim.dx,ty2=ay+controls.aim.dy;
  ctx.shadowBlur=12;ctx.shadowColor=th.accent;
  ctx.globalAlpha=.65;ctx.fillStyle=th.accent;
  ctx.beginPath();ctx.arc(tx2,ty2,ar*.28,0,Math.PI*2);ctx.fill();
  // Direction arrow from nub outward
  if(Math.abs(controls.aim.dx)>4||Math.abs(controls.aim.dy)>4){
    const ang=Math.atan2(controls.aim.dy,controls.aim.dx);
    const tipX=ax+Math.cos(ang)*ar*.88,tipY=ay+Math.sin(ang)*ar*.88;
    ctx.shadowBlur=16;ctx.shadowColor=th.accent;
    ctx.globalAlpha=.85;ctx.strokeStyle=th.accent;ctx.lineWidth=2.5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(tx2,ty2);ctx.lineTo(tipX,tipY);ctx.stroke();
    // Arrow head
    ctx.save();ctx.translate(tipX,tipY);ctx.rotate(ang);
    ctx.fillStyle=th.accent;ctx.globalAlpha=1;
    ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-5,5);ctx.lineTo(-5,-5);ctx.closePath();ctx.fill();
    ctx.restore();
  }
  ctx.shadowBlur=0;
  // Label — larger and brighter
  ctx.globalAlpha=.75;ctx.fillStyle=th.accent;
  ctx.shadowBlur=8;ctx.shadowColor=th.accent;
  ctx.font=`bold ${clamp(W*.028, 10, 14)}px ${th.hudFont}`;ctx.textAlign='center';
  ctx.fillText('AIM / FIRE',ax,ay+ar+16);
  ctx.shadowBlur=0;

  // ── Pulse button (bottom-right) ────────────────────────────────────
  const px=controls.pulse.x,py=controls.pulse.y,pr=controls.pulse.r;
  const maxCd=_tc.pulseMaxCd*_tc.pulseCooldownMult*upg.pulseCdMult;
  const frac=maxCd>0?pulse.cd/maxCd:0;
  const ready=pulse.cd<=0;
  // Glow disc
  ctx.globalAlpha=ready?.18:.08;
  ctx.fillStyle=ready?th.accent:'#223344';
  ctx.shadowBlur=ready?20:0;ctx.shadowColor=th.accent;
  ctx.beginPath();ctx.arc(px,py,pr,0,Math.PI*2);ctx.fill();
  // Border ring
  ctx.globalAlpha=ready?.80:.30;
  ctx.strokeStyle=ready?th.accent:'rgba(80,120,150,.5)';
  ctx.lineWidth=ready?2.5:1.5;ctx.shadowBlur=ready?14:0;
  ctx.beginPath();ctx.arc(px,py,pr,0,Math.PI*2);ctx.stroke();
  // Recharge sweep arc
  if(!ready&&frac>0){
    ctx.globalAlpha=.85;ctx.strokeStyle=th.accent;ctx.lineWidth=3.5;ctx.lineCap='round';
    ctx.shadowBlur=10;ctx.shadowColor=th.accent;
    ctx.beginPath();ctx.arc(px,py,pr-2,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-frac));ctx.stroke();
    ctx.shadowBlur=0;ctx.lineCap='butt';
  }
  // Central icon — shockwave rings symbol
  ctx.shadowBlur=ready?18:0;ctx.shadowColor=th.accent;
  ctx.globalAlpha=ready?1:.40;ctx.fillStyle=ready?th.accent:'rgba(120,160,180,.7)';
  ctx.font=`bold ${Math.round(pr*1.05)}px sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('◎',px,py);
  ctx.textBaseline='alphabetic';ctx.shadowBlur=0;
  // Label — larger and brighter
  ctx.globalAlpha=ready?.80:.45;ctx.fillStyle=ready?th.accent:'rgba(160,200,220,.8)';
  ctx.shadowBlur=ready?10:0;ctx.shadowColor=th.accent;
  ctx.font=`bold ${clamp(W*.028,10,14)}px ${th.hudFont}`;ctx.textAlign='center';
  ctx.fillText('SHOCKWAVE',px,py+pr+16);
  ctx.shadowBlur=0;

  ctx.restore();
}
function drawAimLine(){
  const th=T();
  const locked=shard.aimLocked;
  const lc=locked?'#ff3c78':th.accent;
  const len=78;  // fixed length — no oscillation
  const ax=shard.x+Math.cos(shard.aimAngle)*len;
  const ay=shard.y+Math.sin(shard.aimAngle)*len;
  ctx.save();

  // Straight dash line from ship to reticle
  ctx.strokeStyle=locked?'rgba(255,60,120,.7)':th.accent+'88';
  ctx.lineWidth=2;ctx.setLineDash([6,6]);ctx.lineDashOffset=-elapsed*18;
  ctx.shadowColor=lc;ctx.shadowBlur=6;
  ctx.beginPath();ctx.moveTo(shard.x,shard.y);ctx.lineTo(ax,ay);ctx.stroke();
  ctx.setLineDash([]);ctx.shadowBlur=0;

  // Reticle — fixed-size crosshair bracket (no pulse oscillation)
  ctx.save();ctx.translate(ax,ay);ctx.rotate(shard.aimAngle);
  const rc=12;  // fixed radius — no sine wobble
  ctx.strokeStyle=lc;ctx.lineWidth=2.5;ctx.shadowColor=lc;ctx.shadowBlur=12;
  for(let q=0;q<4;q++){
    ctx.save();ctx.rotate(q*Math.PI/2);
    ctx.beginPath();ctx.arc(0,0,rc,-0.5,0.5);ctx.stroke();
    ctx.restore();
  }
  // Center dot
  ctx.shadowBlur=16;
  ctx.fillStyle=lc;ctx.globalAlpha=locked?.9:.6;
  ctx.beginPath();ctx.arc(0,0,3.5,0,Math.PI*2);ctx.fill();
  ctx.restore();

  // Arrow tip pointing from ship toward reticle
  ctx.save();ctx.translate(ax,ay);ctx.rotate(shard.aimAngle);
  ctx.fillStyle=lc;ctx.globalAlpha=.9;ctx.shadowColor=lc;ctx.shadowBlur=10;
  ctx.beginPath();ctx.moveTo(rc+14,0);ctx.lineTo(rc+5,5);ctx.lineTo(rc+5,-5);ctx.closePath();ctx.fill();
  ctx.restore();

  ctx.restore();
}
function drawHUD(){
  const fnt=T().hudFont||'Orbitron,sans-serif';
  const acc=T().accent;
  ctx.save();
  // Score — top-left, weight 900
  ctx.font=`900 ${clamp(W*.045,20,32)}px ${fnt}`;
  ctx.shadowColor=acc;ctx.shadowBlur=18;ctx.fillStyle='#ffffff';
  ctx.fillText(score,18,38);
  // Combo — below score with clear gap
  if(combo>1.05){
    ctx.font=`bold ${clamp(W*.024,10,15)}px ${fnt}`;
    ctx.fillStyle='#ffee00';ctx.shadowColor='#ffee00';ctx.shadowBlur=10;
    ctx.fillText(`×${combo.toFixed(1)}`,20,60);
  }
  ctx.restore();

  // Timer top-right — clears pause btn (right:14 w:44 → avoid W-68)
  ctx.save();
  ctx.font=`${clamp(W*.026,11,17)}px ${fnt}`;ctx.fillStyle=acc+'cc';ctx.textAlign='right';
  const m=Math.floor(elapsed/60),sec=Math.floor(elapsed%60).toString().padStart(2,'0');
  ctx.fillText(`${m}:${sec}`,W-76,32);
  ctx.font=`${clamp(W*.017,7,11)}px ${fnt}`;ctx.fillStyle=acc+'70';
  ctx.fillText(`WAVE ${waveStage+1}`,W-76,48);
  ctx.textAlign='left';ctx.restore();

  // Milestone progress bar — below score, with gap after combo line
  let nextMs=-1,prevMs=0;
  for(let i=0;i<MILESTONES.length;i++){if(!milestonesHit.has(i)){nextMs=MILESTONES[i];prevMs=i>0?MILESTONES[i-1]:0;break;}}
  if(nextMs>0){
    const bw=clamp(W*.22,110,190),bh=4,bx=18,by=72;
    const prog=clamp((score-prevMs)/(nextMs-prevMs),0,1);
    ctx.save();
    ctx.fillStyle=acc+'20';ctx.fillRect(bx,by,bw,bh);
    ctx.shadowColor=acc;ctx.shadowBlur=5;ctx.fillStyle=acc+'cc';ctx.fillRect(bx,by,bw*prog,bh);
    ctx.shadowBlur=0;
    ctx.font=`bold ${clamp(W*.016,6,10)}px ${fnt}`;ctx.fillStyle=acc+'cc';
    ctx.fillText(`NEXT ${nextMs}`,bx,by-2);
    ctx.restore();
  }

  // Upgrade medals bar — top-center strip showing all owned upgrades with stack counts
  const owned=UPG_DEFS.filter(u=>(upg.stackCounts[u.id]||0)>0||(u.id==='pierce'&&upg.pierce)||(u.id==='slowAura'&&upg.slowAura)||(u.id==='attract'&&upg.attractForce)||(u.id==='ghost'&&upg.ghostActive));
  if(owned.length>0){
    const mSize=20,mGap=4,totalW=owned.length*(mSize+mGap)-mGap;
    const startX=CX-totalW/2,startY=8;
    ctx.save();
    owned.forEach((u,i)=>{
      const mx=startX+i*(mSize+mGap),my=startY;
      const stk=upg.stackCounts[u.id]||1;
      // Pill background
      ctx.globalAlpha=.55;ctx.fillStyle='rgba(0,0,0,.6)';
      roundRectHUD(mx-1,my-1,mSize+2,mSize+2,5);ctx.fill();
      // Colored border
      ctx.globalAlpha=.8;ctx.strokeStyle=u.color;ctx.lineWidth=1.5;
      ctx.shadowBlur=6;ctx.shadowColor=u.color;
      roundRectHUD(mx,my,mSize,mSize,4);ctx.stroke();
      ctx.shadowBlur=0;
      // Icon
      ctx.globalAlpha=1;ctx.font=`${mSize*.6}px sans-serif`;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(u.icon,mx+mSize/2,my+mSize/2+1);
      // Stack count badge
      if(stk>1){
        ctx.fillStyle=u.color;ctx.font=`bold 8px ${fnt}`;
        ctx.textAlign='right';ctx.textBaseline='top';
        ctx.fillText(stk,mx+mSize-1,my);
      }
    });
    ctx.textBaseline='alphabetic';ctx.restore();
  }

  if(upgradeFlash.timer>0){
    const a=clamp(upgradeFlash.timer,0,1);
    ctx.save();ctx.globalAlpha=a;ctx.font=`bold ${clamp(W*.03,11,19)}px ${fnt}`;
    ctx.textAlign='center';ctx.shadowColor='#00ff99';ctx.shadowBlur=14;ctx.fillStyle='#00ff99';
    ctx.fillText('⬡ '+upgradeFlash.text+' ⬡',CX,H*.13);
    ctx.restore();upgradeFlash.timer-=1/60;
  }
  const brandId=window.BrandEngine.getCurrentId();
  if(bgPhase>0||brandId!=='default'){
    ctx.save();ctx.font=`${clamp(W*.016,6,10)}px ${fnt}`;ctx.fillStyle=acc+'44';ctx.textAlign='right';
    ctx.fillText(`PHASE ${bgPhase} · ${T().name}`,W-16,H-10);ctx.textAlign='left';ctx.restore();
  }
  if(dangerNearTowerCount>3){
    ctx.save();ctx.globalAlpha=.45+Math.sin(elapsed*8)*.25;
    ctx.font=`${clamp(W*.022,9,14)}px ${fnt}`;ctx.textAlign='center';ctx.fillStyle='#ff3333';ctx.shadowColor='#ff3333';ctx.shadowBlur=10;
    ctx.fillText('⚠ TOWER UNDER ATTACK',CX,H*.06);
    ctx.restore();
  }
}
function roundRectHUD(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}

// ── LOOP ──────────────────────────────────────────────────────────────
let lastT=0;
function loop(ts){
  requestAnimationFrame(loop);
  const dt=Math.min((ts-lastT)/1000,.05);lastT=ts;
  if(state===S.PLAY){accumulator+=dt;while(accumulator>=FIXED_DT){update(FIXED_DT);accumulator-=FIXED_DT;}}
  render();
}

// ── INIT ──────────────────────────────────────────────────────────────
applyResize();
// BrandEngine.init() was already called by index.html after loading brands.
// Just start the loop.
requestAnimationFrame(ts=>{lastT=ts;requestAnimationFrame(loop);});

// ══════════════════════════════════════════════════════════════════════
// IN-GAME STEP-BY-STEP TUTORIAL
// Draws arrow + speech bubble on canvas — no DOM layout concerns.
// Auto-advances every TUT_STEP_DUR ms. Tap anywhere to skip current step,
// double-tap (or tap "skip") to dismiss entirely.
// ══════════════════════════════════════════════════════════════════════

const TUT_STEP_DUR = 7000;   // ms per step (auto-advance) — enough time to read
const TUT_FADE     = 340;    // ms fade in/out

let _tutActive    = false;
let _tutStep      = 0;
let _tutTimer     = 0;       // ms elapsed on current step
let _tutFadeIn    = 0;       // ms (0→TUT_FADE = fully visible)
let _tutFadeOut   = 0;       // ms when exiting
let _tutUpgHint   = false;   // separate upgrade-pill hint
let _tutUpgTimer  = 0;
let _tutDone      = false;   // set once tutorial finishes

// Each step: target() returns {x,y} in CSS-px, side = which side bubble appears
// arrowOffset: extra px nudge so arrow tip hits the visual centre
const _tutSteps = [
  {
    target:      () => ({x: towerX, y: towerY - tower.radius - 12}),
    bubbleSide:  'top',        // bubble above target
    title:       'PROTECT THE TOWER',
    body:        'If this falls, it\'s game over.\nKeep enemies away from it!',
    color:       '#ff4466',
  },
  {
    target:      () => ({x: shard.x, y: shard.y}),
    bubbleSide:  'top',
    title:       'AUTO-AIM + AUTO-FIRE',
    body:        'Your ship locks on and fires\nautomatically. Just move!',
    color:       '#00e5ff',
  },
  {
    target:      () => ({x: controls.aim.x, y: controls.aim.y - controls.aim.r}),
    bubbleSide:  'top',
    title:       'JOYSTICK → MANUAL AIM',
    body:        'Drag the joystick to aim manually.\nHolding fires 3× faster!',
    color:       '#00ffcc',
  },
  {
    target:      () => ({x: controls.pulse.x, y: controls.pulse.y - controls.pulse.r}),
    bubbleSide:  'top',
    title:       'SHOCKWAVE',
    body:        'Tap for a blast that clears\nnearby enemies. Recharges on kills.',
    color:       '#ffaa00',
  },
  {
    target:      () => ({x: shard.x, y: shard.y}),
    bubbleSide:  'top',
    title:       'SHIP = WEAPON',
    body:        'Your ship is indestructible.\nRam enemies to push & destroy them!',
    color:       '#ff66ff',
  },
];

function tutStart() {
  _tutStep   = 0;
  _tutTimer  = 0;
  _tutFadeIn = 0;
  _tutFadeOut = 0;
  _tutActive  = true;
  _tutDone    = false;
}

function tutSkip(neverShow) {
  _tutActive = false;
  _tutDone   = true;
  _tutHideButtons();
  if (neverShow) { try { localStorage.setItem('pd_tut_never','1'); } catch(_){} }
}

function tutTap() {
  // Tap advances to next step (or dismisses if last)
  if (!_tutActive) return;
  _tutStep++;
  if (_tutStep >= _tutSteps.length) { tutSkip(false); return; }
  _tutTimer  = 0;
  _tutFadeIn = 0;
}

// Called from update() — dt in seconds
function tutUpdate(dt) {
  if (!_tutActive) {
    // Upgrade pill hint: auto-dismiss after 5s
    if (_tutUpgHint) {
      _tutUpgTimer += dt * 1000;
      if (_tutUpgTimer > 5000) _tutUpgHint = false;
    }
    return;
  }
  _tutFadeIn  = Math.min(_tutFadeIn  + dt * 1000, TUT_FADE);
  _tutFadeOut = Math.max(_tutFadeOut - dt * 1000, 0);
  _tutTimer  += dt * 1000;

  if (_tutTimer >= TUT_STEP_DUR) {
    _tutStep++;
    _tutTimer  = 0;
    _tutFadeIn = 0;
    if (_tutStep >= _tutSteps.length) tutSkip(false);
  }
}

// Show upgrade hint once (called when first upgrade appears)
let _tutUpgShown = false;
function tutShowUpgradeHint() {
  if (_tutUpgShown || _tutActive) return;
  _tutUpgShown  = true;
  _tutUpgHint   = true;
  _tutUpgTimer  = 0;
}

// ── Draw ──────────────────────────────────────────────────────────────
function _tutDrawBubble(cx, cy, side, title, body, color, alpha, step, total) {
  const c  = ctx;
  const BW = Math.min(W * 0.72, 310);   // bubble width
  const PAD= 16;
  const R  = 14;

  // Font setup — measure body height
  const titleFont = `bold ${Math.round(clamp(W*0.035, 13, 18))}px Orbitron,sans-serif`;
  const bodyFont  = `${Math.round(clamp(W*0.03, 11, 14))}px "Share Tech Mono",monospace`;
  c.font = bodyFont;
  const lines = body.split('\n');
  const lineH = Math.round(clamp(W*0.038, 15, 19));
  const TH    = Math.round(clamp(W*0.042, 16, 22));
  const BH    = PAD*2 + TH + 6 + lines.length*lineH + 10;  // total bubble height

  // Position: bubble above or below target
  let bx, by;
  const ARROW_LEN = 36;
  if (side === 'top') {
    bx = clamp(cx - BW/2, 8, W - BW - 8);
    by = cy - ARROW_LEN - BH - 8;
    if (by < 60) { by = cy + ARROW_LEN + 8; }  // flip below if too high
  } else {
    bx = clamp(cx - BW/2, 8, W - BW - 8);
    by = cy + ARROW_LEN + 8;
  }

  // Arrow tip is at (cx, cy), arrow base is bubble edge
  const arrowBasY = (by < cy) ? by + BH : by;
  const arrowBasX = clamp(cx, bx + 24, bx + BW - 24);

  c.save();
  c.globalAlpha = alpha;

  // Glow behind bubble
  c.shadowColor = color;
  c.shadowBlur  = 28;

  // Draw arrow (triangle + stem)
  c.fillStyle = 'rgba(4,2,20,0.92)';
  c.beginPath();
  const AW = 11;
  if (by < cy) {
    // Arrow pointing down from bubble base
    c.moveTo(arrowBasX - AW, arrowBasY);
    c.lineTo(arrowBasX + AW, arrowBasY);
    c.lineTo(arrowBasX, cy);
  } else {
    // Arrow pointing up from bubble top
    c.moveTo(arrowBasX - AW, arrowBasY);
    c.lineTo(arrowBasX + AW, arrowBasY);
    c.lineTo(arrowBasX, cy);
  }
  c.closePath();
  c.fill();
  c.strokeStyle = color + 'cc';
  c.lineWidth   = 1.5;
  c.stroke();

  // Bubble background
  c.shadowBlur = 22;
  c.fillStyle  = 'rgba(4,2,20,0.92)';
  _roundRect(c, bx, by, BW, BH, R);
  c.fill();
  // Border
  c.shadowBlur  = 0;
  c.strokeStyle = color;
  c.lineWidth   = 2;
  _roundRect(c, bx, by, BW, BH, R);
  c.stroke();

  // Top accent bar
  c.fillStyle = color + '33';
  _roundRect(c, bx, by, BW, TH + PAD + 4, R);
  c.fill();

  // Title text
  c.shadowBlur  = 12;
  c.shadowColor = color;
  c.fillStyle   = color;
  c.font        = titleFont;
  c.textAlign   = 'center';
  c.textBaseline= 'top';
  c.fillText(title, bx + BW/2, by + PAD);

  // Body text
  c.shadowBlur  = 0;
  c.fillStyle   = 'rgba(200,230,255,0.88)';
  c.font        = bodyFont;
  lines.forEach((ln, i) => {
    c.fillText(ln, bx + BW/2, by + PAD + TH + 8 + i * lineH);
  });

  // Step dots
  const dotY = by + BH - 12;
  const dotR = 3.5;
  const dotGap = 10;
  const dotsW  = total * (dotR*2 + dotGap) - dotGap;
  let dotX = bx + (BW - dotsW)/2 + dotR;
  for (let i = 0; i < total; i++) {
    c.beginPath();
    c.arc(dotX, dotY, dotR, 0, Math.PI*2);
    c.fillStyle = i === step ? color : 'rgba(255,255,255,0.2)';
    c.fill();
    dotX += dotR*2 + dotGap;
  }

  // Pulse animation dot on target
  const pulseR = 18 + Math.sin(elapsed * 6) * 5;
  c.globalAlpha = alpha * (0.5 + Math.sin(elapsed*6)*0.3);
  c.strokeStyle = color;
  c.lineWidth   = 2.5;
  c.shadowBlur  = 14;
  c.shadowColor = color;
  c.beginPath();
  c.arc(cx, cy, pulseR, 0, Math.PI*2);
  c.stroke();
  c.shadowBlur = 0;

  c.restore();
}

function _roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x+r, y);
  c.lineTo(x+w-r, y);  c.arcTo(x+w, y,   x+w, y+r,   r);
  c.lineTo(x+w, y+h-r);c.arcTo(x+w, y+h, x+w-r, y+h, r);
  c.lineTo(x+r, y+h);  c.arcTo(x,   y+h, x,   y+h-r, r);
  c.lineTo(x, y+r);    c.arcTo(x,   y,   x+r, y,     r);
  c.closePath();
}


// ── Tutorial UI buttons ────────────────────────────────────────────────
// Two separate fixed DOM elements — no container wrapper (simpler z-index).
// Appended to body once; shown/hidden via display:block/none.
let _tutNextBtn = null;
let _tutNeverBtn = null;

function _tutInitButtons() {
  if (_tutNextBtn) return;

  // NEXT / DONE — right edge pill, tall thumb target
  _tutNextBtn = document.createElement('button');
  Object.assign(_tutNextBtn.style, {
    position:'fixed', right:'0', top:'50%', transform:'translateY(-50%)',
    width:'54px', height:'130px', borderRadius:'14px 0 0 14px',
    background:'rgba(0,229,255,.22)', border:'2px solid rgba(0,229,255,.8)',
    borderRight:'none', color:'#00e5ff',
    fontFamily:"Orbitron,sans-serif", fontSize:'.58rem', fontWeight:'700',
    letterSpacing:'2px', writingMode:'vertical-rl',
    display:'none', alignItems:'center', justifyContent:'center',
    cursor:'pointer', zIndex:'50', touchAction:'none',
    boxShadow:'-4px 0 24px rgba(0,229,255,.35)',
    WebkitTapHighlightColor:'transparent', padding:'0',
  });
  _tutNextBtn.style.display = 'none';  // hidden initially
  _tutNextBtn.textContent = 'NEXT ▶';
  _tutNextBtn.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    tutTap();
  });
  document.body.appendChild(_tutNextBtn);

  // DON'T SHOW AGAIN — bottom centre, wide button
  _tutNeverBtn = document.createElement('button');
  Object.assign(_tutNeverBtn.style, {
    position:'fixed', bottom:'80px', left:'50%', transform:'translateX(-50%)',
    background:'rgba(4,2,20,.85)', border:'1.5px solid rgba(0,229,255,.4)',
    borderRadius:'8px', color:'rgba(0,229,255,.75)',
    fontFamily:'"Share Tech Mono",monospace', fontSize:'.62rem', letterSpacing:'1.5px',
    padding:'11px 20px', cursor:'pointer', zIndex:'50', touchAction:'none',
    whiteSpace:'nowrap', WebkitTapHighlightColor:'transparent',
    display:'none',
  });
  _tutNeverBtn.textContent = "✕  DON'T SHOW AGAIN";
  _tutNeverBtn.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    tutSkip(true);
  });
  document.body.appendChild(_tutNeverBtn);
}

function _tutShowButtons(alpha) {
  _tutInitButtons();
  const show = alpha > 0.05;
  _tutNextBtn.style.display  = show ? 'flex' : 'none';
  _tutNeverBtn.style.display = show ? 'block' : 'none';
  _tutNextBtn.textContent = (_tutStep >= _tutSteps.length - 1) ? 'DONE ✓' : 'NEXT ▶';
}

function _tutHideButtons() {
  if (_tutNextBtn)  _tutNextBtn.style.display  = 'none';
  if (_tutNeverBtn) _tutNeverBtn.style.display = 'none';
}

function drawTutorial() {
  if (!_tutActive && !_tutUpgHint) return;

  if (_tutActive && _tutStep < _tutSteps.length) {
    const step = _tutSteps[_tutStep];
    const tgt  = step.target();
    const fadeAlpha = Math.min(_tutFadeIn / TUT_FADE, 1);
    _tutDrawBubble(
      tgt.x, tgt.y,
      step.bubbleSide,
      step.title, step.body, step.color,
      fadeAlpha,
      _tutStep, _tutSteps.length
    );

    // Skip instructions — drawn bottom-centre on canvas (non-interactive reminder)
    ctx.save();
    ctx.globalAlpha = fadeAlpha * 0.38;
    ctx.font = `${clamp(W*0.026, 10, 12)}px "Share Tech Mono",monospace`;
    ctx.fillStyle = 'rgba(200,230,255,0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('tap anywhere to advance', W/2, H - 14);
    ctx.restore();
    // Draw the NEXT button (right edge) — HTML element positioned via JS below
    _tutShowButtons(fadeAlpha);
  }

  if (_tutUpgHint) {
    // Arrow pointing up at upgrade pill (top-centre of screen)
    const pillY = 44;  // approximate pill top
    const alpha = Math.min(_tutUpgTimer / 400, 1) * (1 - Math.max(_tutUpgTimer - 4600, 0)/400);
    _tutDrawBubble(
      W/2, pillY,
      'bottom',
      'UPGRADE READY!',
      'Tap the pill to\npower up your ship!',
      '#ffee00',
      clamp(alpha, 0, 1),
      0, 1
    );
  }
}
