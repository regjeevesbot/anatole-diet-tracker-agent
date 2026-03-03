#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const DAILY = path.join(DATA, 'daily-logs');
const SYM = path.join(DATA, 'symptom-logs');
const WATER = path.join(DATA, 'water-logs');
const CONFIRMATIONS = path.join(DATA, 'pending-confirmations.json');
const PENDING_LABELS = path.join(DATA, 'pending-labels.json');
const LABELS_DIR = path.join(DATA, 'labels');
const SAVED_MEALS = path.join(DATA, 'saved-meals.json');

// ─── USER CONFIG ───────────────────────────────────────────────
// Set your timezone (IANA format) and daily targets here.
const USER_TIMEZONE = process.env.ANATOLE_TIMEZONE || 'Europe/London';
const DEFAULT_CALORIE_TARGET = Number(process.env.ANATOLE_CAL_TARGET) || 2000;
const DEFAULT_PROTEIN_TARGET = Number(process.env.ANATOLE_PROTEIN_TARGET) || 150;
const DEFAULT_SAT_FAT_MAX = Number(process.env.ANATOLE_SAT_FAT_MAX) || 20;
// ───────────────────────────────────────────────────────────────

function today() { return new Date().toLocaleDateString('en-CA', {timeZone: USER_TIMEZONE}); }
function hm() { return new Date().toLocaleTimeString('en-GB', {timeZone: USER_TIMEZONE, hour:'2-digit', minute:'2-digit', hour12:false}); }
const n = (x, d=0)=> Number.isFinite(Number(x)) ? Number(Number(x).toFixed(1)) : d;
function ensureDir(d){ fs.mkdirSync(d,{recursive:true}); }
function readJson(p, fallback){ try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch{return fallback;} }
function writeJson(p,obj){ fs.writeFileSync(p, JSON.stringify(obj,null,2)); }
function normalize(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }
function nowIso(){ return new Date().toISOString(); }

function dayPath(date){ return path.join(DAILY, `${date}.json`); }
function symPath(date){ return path.join(SYM, `${date}.json`); }
function waterPath(date){ return path.join(WATER, `${date}.json`); }

function defaultDay(date){ return {date, entries:[], totals:{calories:0,protein:0,carbs:0,fat:0,sat_fat:0}, targets:{calories:DEFAULT_CALORIE_TARGET,protein:DEFAULT_PROTEIN_TARGET,sat_fat_max:DEFAULT_SAT_FAT_MAX}}; }
function defaultSym(date){ return {date, entries:[]}; }
function defaultWater(date){ return {date, entries:[], total_ml:0, target_ml:null}; }
function defaultPending(){ return {pending:[]}; }
function defaultPendingLabels(){ return {pending:[]}; }

function recalcDay(day){
  const t={calories:0,protein:0,carbs:0,fat:0,sat_fat:0};
  for(const e of day.entries||[]){
    for(const it of e.items||[]){
      for(const k of Object.keys(t)) t[k]+=Number(it.macros?.[k]||0);
    }
  }
  for(const k of Object.keys(t)) t[k]=n(t[k]);
  day.totals=t;
  return day;
}

function recalcWater(w){ w.total_ml = n((w.entries||[]).reduce((a,e)=>a+Number(e.ml||0),0),0); return w; }

function parseWater(input){
  const s=String(input).toLowerCase();
  const ml = s.match(/(\d+(?:\.\d+)?)\s*ml/);
  if(ml) return Math.round(Number(ml[1]));
  const l = s.match(/(\d+(?:\.\d+)?)\s*l\b/);
  if(l) return Math.round(Number(l[1])*1000);
  if(/glass/.test(s)) return 250;
  const bare=s.match(/^(\d{2,4})$/); if(bare) return Number(bare[1]);
  return null;
}

function addFood(args){
  const date=args.date||today(); const time=args.time||hm();
  const label=args.label||'Meal';
  const items=JSON.parse(args.items||'[]').map(it=>({
    ...it,
    source: it.source || 'estimate',
    source_detail: it.source_detail || null
  }));
  const p=dayPath(date); ensureDir(DAILY);
  const day=readJson(p, defaultDay(date));
  day.entries.push({id:`e_${Date.now()}`, time, type:'meal', label, items});
  recalcDay(day); writeJson(p, day);
  return day;
}

function addWater(args){
  const date=args.date||today(); const time=args.time||hm();
  const ml = args.ml? Number(args.ml): parseWater(args.input||'');
  if(!ml) throw new Error('Could not parse water amount');
  const p=waterPath(date); ensureDir(WATER);
  const w=readJson(p, defaultWater(date));
  w.entries.push({id:`w_${Date.now()}`, time, type:'water', ml, source:'text'});
  recalcWater(w); writeJson(p,w); return w;
}

function addSymptom(args){
  const date=args.date||today(); const time=args.time||hm();
  const p=symPath(date); ensureDir(SYM);
  const s=readJson(p, defaultSym(date));
  const entry={id:`s_${Date.now()}`, time, type:args.type||'symptom', description:args.description||'', severity:args.severity?Number(args.severity):null, tags:args.tags?String(args.tags).split(',').map(x=>x.trim()).filter(Boolean):[]};
  s.entries.push(entry); writeJson(p,s); return s;
}

function daySummary(args){
  const date=args.date||today();
  const d=readJson(dayPath(date), defaultDay(date));
  const w=readJson(waterPath(date), defaultWater(date));
  const s=readJson(symPath(date), defaultSym(date));
  recalcDay(d); recalcWater(w);
  return {date, totals:d.totals, targets:d.targets, water_ml:w.total_ml, meals:d.entries.length, symptoms:s.entries.length};
}

function patterns(args){
  const files=fs.existsSync(SYM)?fs.readdirSync(SYM).filter(f=>f.endsWith('.json')).sort():[];
  let dairyDays=0,bloatDays=0,both=0;
  for(const f of files){
    const date=f.slice(0,10);
    const d=readJson(dayPath(date), null); const s=readJson(symPath(date), null);
    const hasDairy=JSON.stringify(d||{}).toLowerCase().includes('dairy');
    const hasBloat=JSON.stringify(s||{}).toLowerCase().includes('bloat');
    if(hasDairy) dairyDays++; if(hasBloat) bloatDays++; if(hasDairy&&hasBloat) both++;
  }
  return {dairyDays,bloatDays,both,confidence: both>=4?'medium':'low'};
}

function deleteEntry(args){
  const date=args.date||today(); const id=args.id; const bucket=args.bucket||'daily';
  if(!id) throw new Error('id required');
  const map={daily:[dayPath(date),defaultDay(date),'entries'],symptom:[symPath(date),defaultSym(date),'entries'],water:[waterPath(date),defaultWater(date),'entries']};
  const [p,def,key]=map[bucket];
  const obj=readJson(p,def); const before=obj[key].length;
  obj[key]=obj[key].filter(e=>e.id!==id);
  if(bucket==='daily') recalcDay(obj); if(bucket==='water') recalcWater(obj);
  writeJson(p,obj); return {removed: before-obj[key].length};
}

function updateFoodItem(args){
  const date=args.date||today();
  const p=dayPath(date); ensureDir(DAILY);
  const day=readJson(p, defaultDay(date));

  const qMeal=normalize(args.meal||'');
  const qItem=normalize(args.item||'');
  if(!qItem) throw new Error('item required');

  let entry = null;
  if(args.entry_id){
    entry = (day.entries||[]).find(e=>e.id===args.entry_id) || null;
  }
  if(!entry){
    const candidates=(day.entries||[]).filter(e=>{
      if((e.type||'meal')!=='meal') return false;
      if(!qMeal) return true;
      return normalize(e.label||'').includes(qMeal);
    });
    entry = candidates[candidates.length-1] || null;
  }
  if(!entry) throw new Error('meal entry not found');

  const item = (entry.items||[]).find(it=> normalize(it.name||'').includes(qItem));
  if(!item) throw new Error('item not found in selected meal');

  const old = JSON.parse(JSON.stringify(item));

  if(args.name) item.name = String(args.name);
  if(args.grams) item.grams = n(args.grams);
  if(args.confidence) item.confidence = String(args.confidence);
  if(args.source) item.source = String(args.source);
  if(args.source_detail) item.source_detail = String(args.source_detail);

  if(args.calories) item.macros = {...(item.macros||{}), calories:n(args.calories)};
  if(args.protein) item.macros = {...(item.macros||{}), protein:n(args.protein)};
  if(args.carbs) item.macros = {...(item.macros||{}), carbs:n(args.carbs)};
  if(args.fat) item.macros = {...(item.macros||{}), fat:n(args.fat)};
  if(args.sat_fat) item.macros = {...(item.macros||{}), sat_fat:n(args.sat_fat)};

  const shouldUpdateLibrary = String(args.update_library||'true')!=='false';
  const libraryUpdate = shouldUpdateLibrary
    ? upsertProductLibraryFromItem(item, {method:'user-correction', source: args.source || item.source || 'local', alias: args.item || item.name})
    : null;

  recalcDay(day); writeJson(p, day);
  return {updated:true, date, entry_id:entry.id, before:old, after:item, totals:day.totals, library_update: libraryUpdate};
}

function addItemToMeal(args){
  const date=args.date||today();
  const p=dayPath(date); ensureDir(DAILY);
  const day=readJson(p, defaultDay(date));

  const qMeal=normalize(args.meal||'');
  let entry = null;
  if(args.entry_id){
    entry = (day.entries||[]).find(e=>e.id===args.entry_id) || null;
  }
  if(!entry){
    const candidates=(day.entries||[]).filter(e=>{
      if((e.type||'meal')!=='meal') return false;
      if(!qMeal) return true;
      return normalize(e.label||'').includes(qMeal);
    });
    entry = candidates[candidates.length-1] || null;
  }
  if(!entry) throw new Error('meal entry not found');

  const name=String(args.name||'').trim();
  if(!name) throw new Error('name required');

  const item={
    product_id: args.product_id || null,
    name,
    grams: args.grams? n(args.grams): null,
    macros:{
      calories:n(args.calories),
      protein:n(args.protein),
      carbs:n(args.carbs),
      fat:n(args.fat),
      sat_fat:n(args.sat_fat)
    },
    source: args.source || 'estimate',
    source_detail: args.source_detail || null
  };
  if(args.confidence) item.confidence=String(args.confidence);

  entry.items = Array.isArray(entry.items) ? entry.items : [];
  entry.items.push(item);

  recalcDay(day); writeJson(p, day);
  return {added:true, date, entry_id:entry.id, item, totals:day.totals};
}

function upsertProductLibraryFromItem(item, opts={}){
  const libPath=path.join(DATA,'product-library.json');
  const lib=readJson(libPath,[]);
  const idCandidate = item.product_id ? String(item.product_id) : null;
  const nameNorm = normalize(item.name||'');
  const idx=lib.findIndex(p=> (idCandidate && String(p.id)===idCandidate) || normalize(p.name||'')===nameNorm);

  const grams = Number(item.grams||0);
  const macros = item.macros||{};
  const per100 = grams>0 ? {
    calories:n((Number(macros.calories||0)/grams)*100),
    protein:n((Number(macros.protein||0)/grams)*100),
    carbs:n((Number(macros.carbs||0)/grams)*100),
    fat:n((Number(macros.fat||0)/grams)*100),
    sat_fat:n((Number(macros.sat_fat||0)/grams)*100)
  } : {
    calories:n(macros.calories), protein:n(macros.protein), carbs:n(macros.carbs), fat:n(macros.fat), sat_fat:n(macros.sat_fat)
  };

  const source = opts.source || item.source || 'local';
  const method = opts.method || 'user-correction';
  const alias = normalize(opts.alias || item.name || '');

  if(idx>=0){
    const p=lib[idx];
    p.per_100g = per100;
    p.source = source;
    p.verification_status = 'verified';
    p.confidence_score = 1.0;
    p.aliases = Array.isArray(p.aliases)?p.aliases:[];
    if(alias && !p.aliases.map(normalize).includes(alias)) p.aliases.push(alias);
    const extraMeta={};
    if(opts.photo_path) extraMeta.photo_path=opts.photo_path;
    p.source_meta = {...(p.source_meta||{}), method, corrected_at: nowIso(), ...extraMeta};
    lib[idx]=p;
  } else {
    const extraMeta={};
    if(opts.photo_path) extraMeta.photo_path=opts.photo_path;
    lib.push({
      id: item.product_id || `local_${Date.now()}`,
      name: item.name,
      brand: null,
      per_100g: per100,
      source,
      verification_status:'verified',
      confidence_score:1.0,
      aliases: alias ? [alias] : [],
      source_meta:{method, corrected_at: nowIso(), ...extraMeta}
    });
  }
  writeJson(libPath, lib);
  return {library_size:lib.length, per_100g:per100, method, source};
}

function scoreName(q, name){
  const nName=normalize(name);
  if(nName===q) return 100;
  if(nName.startsWith(q)) return 80;
  if(nName.includes(q)) return 60;
  return 0;
}

function resolveProduct(args){
  const q=normalize(args.query||'');
  if(!q) throw new Error('query required');
  const local=readJson(path.join(DATA,'product-library.json'),[]);
  const cofid=readJson(path.join(DATA,'reference','cofid-products.json'),[]);

  const exactVerified=(local||[]).find(p=>{
    const names=[p.name,...(Array.isArray(p.aliases)?p.aliases:[])].map(normalize);
    return (p.verification_status||'verified')==='verified' && names.includes(q);
  });
  if(exactVerified){
    return {
      query:q,
      candidates:[{
        id:exactVerified.id,
        name:exactVerified.name,
        brand:exactVerified.brand||null,
        per_100g:exactVerified.per_100g,
        source:exactVerified.source||'local',
        verification_status:exactVerified.verification_status||'verified',
        confidence_score:exactVerified.confidence_score??1,
        score:100,
        matched_by:'exact_alias'
      }],
      requires_confirmation:false
    };
  }

  const localHits=(local||[]).map(p=>({
    id:p.id,name:p.name,brand:p.brand||null,per_100g:p.per_100g,source:p.source||'local',verification_status:p.verification_status||'verified',confidence_score:p.confidence_score??0.9,
    score:Math.max(scoreName(q,p.name),...(Array.isArray(p.aliases)?p.aliases:[]).map(a=>scoreName(q,a)))
  })).filter(x=>x.score>0);

  let hits=localHits;
  if(hits.length===0){
    const cofidHits=(cofid||[]).map(p=>({
      id:p.id,name:p.name,brand:null,per_100g:p.per_100g,source:'cofid-2021',verification_status:'verified',confidence_score:0.95,score:scoreName(q,p.name)
    })).filter(x=>x.score>0).slice(0,20);
    hits=cofidHits;
  }

  hits.sort((a,b)=>b.score-a.score);
  const top=hits.slice(0,5);

  const requiresConfirmation = top.length > 1 || (top[0] && top[0].score < 100);
  let confirmation_token = null;
  if(top.length>0){
    const store=readJson(CONFIRMATIONS, defaultPending());
    confirmation_token = `c_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    store.pending = (store.pending||[]).filter(x=>x.created_at && Date.now()-new Date(x.created_at).getTime() < 7*24*60*60*1000);
    store.pending.push({
      token: confirmation_token,
      query: q,
      created_at: nowIso(),
      candidates: top
    });
    writeJson(CONFIRMATIONS, store);
  }

  return {query:q,candidates:top,requires_confirmation:requiresConfirmation,confirmation_token};
}

function confirmCandidate(args){
  const token=String(args.token||'').trim();
  const idx=Number(args.index||0);
  if(!token) throw new Error('token required');

  const store=readJson(CONFIRMATIONS, defaultPending());
  const pending=(store.pending||[]);
  const recIndex=pending.findIndex(x=>x.token===token);
  if(recIndex===-1) throw new Error('confirmation token not found');

  const rec=pending[recIndex];
  const candidate=rec.candidates?.[idx];
  if(!candidate) throw new Error('candidate index out of range');

  const libPath=path.join(DATA,'product-library.json');
  const lib=readJson(libPath,[]);

  const existingIdx=lib.findIndex(p=>String(p.id)===String(candidate.id));
  const queryAlias=rec.query;

  if(existingIdx>=0){
    const p=lib[existingIdx];
    p.aliases=Array.isArray(p.aliases)?p.aliases:[];
    if(queryAlias && !p.aliases.map(normalize).includes(queryAlias)) p.aliases.push(queryAlias);
    if(p.verification_status!=='verified') p.verification_status='verified';
    if((p.confidence_score??0)<0.99) p.confidence_score=0.99;
    p.source_meta={...(p.source_meta||{}), method:'user-confirmation', confirmed_at:nowIso()};
    lib[existingIdx]=p;
  } else {
    lib.push({
      id:candidate.id || `local_${Date.now()}`,
      name:candidate.name,
      brand:candidate.brand||null,
      per_100g:candidate.per_100g||null,
      source:candidate.source||'local',
      verification_status:'verified',
      confidence_score:0.99,
      aliases: queryAlias ? [queryAlias] : [],
      source_meta:{source:candidate.source||'unknown',source_id:candidate.id||null,fetched_at:rec.created_at,method:'user-confirmation',confirmed_at:nowIso()}
    });
  }

  writeJson(libPath, lib);
  store.pending.splice(recIndex,1);
  writeJson(CONFIRMATIONS, store);

  return {
    confirmed:true,
    query:rec.query,
    selected_index:idx,
    product_id:candidate.id,
    alias_saved:queryAlias || null,
    library_size:lib.length
  };
}

function queueLabelParse(args){
  const name=String(args.name||'').trim();
  if(!name) throw new Error('name required');
  const per100={
    calories:n(args.calories),
    protein:n(args.protein),
    carbs:n(args.carbs),
    fat:n(args.fat),
    sat_fat:n(args.sat_fat)
  };
  const store=readJson(PENDING_LABELS, defaultPendingLabels());
  const token=`lbl_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

  let photo_path=null;
  if(args.photo && fs.existsSync(args.photo)){
    ensureDir(LABELS_DIR);
    const ext=path.extname(args.photo)||'.jpg';
    const dest=path.join(LABELS_DIR, `${token}${ext}`);
    fs.copyFileSync(args.photo, dest);
    photo_path=path.relative(ROOT, dest);
  }

  const rec={
    token,
    created_at: nowIso(),
    name,
    brand: args.brand||null,
    per_100g: per100,
    source: 'label-photo',
    method: 'vision-parse',
    notes: args.notes||null,
    photo_path
  };
  store.pending=(store.pending||[]).filter(x=>x.created_at && Date.now()-new Date(x.created_at).getTime()<14*24*60*60*1000);
  store.pending.push(rec);
  writeJson(PENDING_LABELS, store);
  return {queued:true, token, parsed:rec};
}

function confirmLabelParse(args){
  const token=String(args.token||'').trim();
  if(!token) throw new Error('token required');
  const store=readJson(PENDING_LABELS, defaultPendingLabels());
  const idx=(store.pending||[]).findIndex(x=>x.token===token);
  if(idx===-1) throw new Error('label token not found');
  const rec=store.pending[idx];

  const productId = args.product_id || `local_${Date.now()}`;

  let final_photo_path=null;
  if(rec.photo_path){
    const absOld=path.join(ROOT, rec.photo_path);
    if(fs.existsSync(absOld)){
      const ext=path.extname(absOld)||'.jpg';
      const absNew=path.join(LABELS_DIR, `${productId}${ext}`);
      fs.renameSync(absOld, absNew);
      final_photo_path=path.relative(ROOT, absNew);
    }
  }

  const item={
    product_id: productId,
    name: args.name || rec.name,
    grams: 100,
    macros: rec.per_100g,
    source: 'label-photo',
    source_detail: rec.brand || null
  };

  const meta={method:'user-label-confirmation',source:'label-photo',alias:args.alias||rec.name};
  if(final_photo_path) meta.photo_path=final_photo_path;
  const update=upsertProductLibraryFromItem(item, meta);

  store.pending.splice(idx,1);
  writeJson(PENDING_LABELS, store);
  return {confirmed:true, token, product_name:item.name, photo_path:final_photo_path, library_update:update};
}

function saveMeal(args){
  const name=String(args.name||'').trim();
  if(!name) throw new Error('name required');
  const meals=readJson(SAVED_MEALS,[]);
  if(meals.find(m=>normalize(m.name)===normalize(name))) throw new Error('A saved meal with this name already exists. Use a different name or delete the existing one first.');

  let items=[];
  const fromDate=args['from-date']||args.from_date;
  const entryId=args['entry-id']||args.entry_id;
  if(fromDate && entryId){
    const date=fromDate;
    const day=readJson(dayPath(date), null);
    if(!day) throw new Error(`No day log for ${date}`);
    const entry=(day.entries||[]).find(e=>e.id===entryId);
    if(!entry) throw new Error(`Entry ${entryId} not found in ${date}`);
    items=(entry.items||[]).map(it=>{
      const g=Number(it.grams||0);
      const m=it.macros||{};
      const per100=g>0?{
        calories:n((Number(m.calories||0)/g)*100),
        protein:n((Number(m.protein||0)/g)*100),
        carbs:n((Number(m.carbs||0)/g)*100),
        fat:n((Number(m.fat||0)/g)*100),
        sat_fat:n((Number(m.sat_fat||0)/g)*100)
      }:{calories:n(m.calories),protein:n(m.protein),carbs:n(m.carbs),fat:n(m.fat),sat_fat:n(m.sat_fat)};
      return {
        product_id:it.product_id||null,
        name:it.name,
        per_100g:per100,
        default_grams:g||100,
        source:it.source||'estimate'
      };
    });
    if(!args.label) args.label=entry.label;
  } else if(args.items){
    items=JSON.parse(args.items);
  } else {
    throw new Error('Provide --items JSON or --from-date + --entry-id');
  }
  if(items.length===0) throw new Error('No items to save');

  const aliases=(args.aliases||'').split(',').map(a=>a.trim()).filter(Boolean);
  const id=`sm_${Date.now()}`;
  const meal={
    id,
    name,
    aliases,
    items,
    default_label:args.label||'Meal',
    created_at:nowIso(),
    last_used:null,
    use_count:0
  };
  meals.push(meal);
  writeJson(SAVED_MEALS, meals);
  return {saved:true, id, name, item_count:items.length, items:items.map(i=>({name:i.name,default_grams:i.default_grams}))};
}

function getMeal(args){
  const q=normalize(args.query||'');
  if(!q) throw new Error('query required');
  const meals=readJson(SAVED_MEALS,[]);
  const scored=meals.map(m=>{
    const names=[m.name,...(Array.isArray(m.aliases)?m.aliases:[])];
    const best=Math.max(...names.map(nm=>scoreName(q,nm)));
    return {...m, score:best};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
  const top=scored[0];
  return {
    query:q,
    meals:scored,
    requires_confirmation: !top || top.score<100 || scored.length>1
  };
}

function listMeals(){
  const meals=readJson(SAVED_MEALS,[]);
  const summaries=meals.map(m=>({
    id:m.id,
    name:m.name,
    aliases:m.aliases||[],
    item_count:(m.items||[]).length,
    default_label:m.default_label,
    use_count:m.use_count||0,
    last_used:m.last_used||null
  })).sort((a,b)=>(b.use_count-a.use_count)||a.name.localeCompare(b.name));
  return {count:summaries.length, meals:summaries};
}

function deleteMeal(args){
  const meals=readJson(SAVED_MEALS,[]);
  let idx=-1;
  if(args.id) idx=meals.findIndex(m=>m.id===args.id);
  else if(args.name) idx=meals.findIndex(m=>normalize(m.name)===normalize(args.name));
  if(idx===-1) throw new Error('Saved meal not found');
  const removed=meals.splice(idx,1)[0];
  writeJson(SAVED_MEALS, meals);
  return {deleted:true, id:removed.id, name:removed.name};
}

function logSavedMeal(args){
  const meals=readJson(SAVED_MEALS,[]);
  const meal=meals.find(m=>m.id===args.id);
  if(!meal) throw new Error('Saved meal not found');

  const overrides=(args['grams-overrides']||args.grams_overrides)?JSON.parse(args['grams-overrides']||args.grams_overrides):{};
  const date=args.date||today();
  const time=args.time||hm();
  const label=args.label||meal.default_label||'Meal';

  const items=(meal.items||[]).map(it=>{
    const overrideKey=Object.keys(overrides).find(k=>normalize(k)===normalize(it.name));
    const grams=overrideKey?Number(overrides[overrideKey]):it.default_grams;
    const p=it.per_100g||{};
    return {
      product_id:it.product_id||null,
      name:it.name,
      grams,
      macros:{
        calories:n((Number(p.calories||0)/100)*grams),
        protein:n((Number(p.protein||0)/100)*grams),
        carbs:n((Number(p.carbs||0)/100)*grams),
        fat:n((Number(p.fat||0)/100)*grams),
        sat_fat:n((Number(p.sat_fat||0)/100)*grams)
      },
      confidence:'high',
      source:it.source||'saved-meal',
      source_detail:`saved-meal:${meal.id}`
    };
  });

  const p=dayPath(date); ensureDir(DAILY);
  const day=readJson(p, defaultDay(date));
  const entryId=`e_${Date.now()}`;
  day.entries.push({id:entryId, time, type:'meal', label, items});
  recalcDay(day); writeJson(p, day);

  meal.last_used=nowIso();
  meal.use_count=(meal.use_count||0)+1;
  writeJson(SAVED_MEALS, meals);

  return day;
}

function parseArgs(argv){
  const out={}; for(let i=0;i<argv.length;i++){ if(argv[i].startsWith('--')){ out[argv[i].slice(2)]=argv[i+1]; i++; }} return out;
}

const cmd=process.argv[2]; const args=parseArgs(process.argv.slice(3));
let result;
switch(cmd){
  case 'add-food': result=addFood(args); break;
  case 'add-water': result=addWater(args); break;
  case 'add-symptom': result=addSymptom(args); break;
  case 'summary': result=daySummary(args); break;
  case 'patterns': result=patterns(args); break;
  case 'delete-entry': result=deleteEntry(args); break;
  case 'update-food-item': result=updateFoodItem(args); break;
  case 'add-item-to-meal': result=addItemToMeal(args); break;
  case 'resolve-product': result=resolveProduct(args); break;
  case 'confirm-candidate': result=confirmCandidate(args); break;
  case 'queue-label-parse': result=queueLabelParse(args); break;
  case 'confirm-label-parse': result=confirmLabelParse(args); break;
  case 'save-meal': result=saveMeal(args); break;
  case 'get-meal': result=getMeal(args); break;
  case 'list-meals': result=listMeals(args); break;
  case 'delete-meal': result=deleteMeal(args); break;
  case 'log-saved-meal': result=logSavedMeal(args); break;
  default:
    console.error('Commands: add-food, add-water, add-symptom, summary, patterns, delete-entry, update-food-item, add-item-to-meal, resolve-product, confirm-candidate, queue-label-parse, confirm-label-parse, save-meal, get-meal, list-meals, delete-meal, log-saved-meal'); process.exit(1);
}
console.log(JSON.stringify(result,null,2));
