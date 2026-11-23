// phone engine: engine.py의 휴대폰 학습 경로를 동일 상수로 옮김
export const INTERVALS=[1,3,7,14], MASTER=.8, PASS=.6, RECENT=8, BUDGET=15, REVIEW_MIN=4, MAX_REVIEWS=2, REVIEW_ITEMS=3;
export const SUBJECTS=['english','logic','finalcut'];
export function makeBackup(events,exportedAt=new Date().toISOString()){return{formatVersion:1,exportedAt,events:JSON.parse(JSON.stringify(events))}}
export function readBackup(payload){if(!payload||payload.formatVersion!==1||!Array.isArray(payload.events))throw Error('지원하지 않는 백업 형식이에요.');
  return payload.events.filter(x=>x&&typeof x==='object'&&SUBJECTS.includes(x.subject))}
export function addDays(day,n){const d=new Date(day+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10)}
export function daysBetween(a,b){return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000)}
export function buildContent(data){const concepts={},lessons={},items={};
  for(const c of data.concepts){concepts[c.id]=c;
    lessons[c.id]={id:c.id,kind:'theory',title:c.name,concepts:[c.id],minutes:c.minutes??12,body:c.body,quiz:[]};
    for(const [use,key] of [['lesson','l'],['diag','d'],['month','m'],['review','r']])for(const [n,it] of (c.items[use]||[]).entries()){const id=`${c.id}-${key}${n+1}`;
      items[id]={...it,id,concept:c.id,use,type:it.type||(it.say?'listen':'choice')};
      if(use==='lesson')lessons[c.id].quiz.push(id)}}for(const p of data.practice||[])lessons[p.id]={id:p.id,kind:'practice',title:p.title,concepts:p.requires,minutes:p.minutes??25,body:p.body,checklist:p.checklist};
  return{subject:data.subject,name:data.name,base_target:data.monthTarget,concepts,lessons,items,order:data.order}}
const fresh=()=>({att:[],passed:false,known:false,known_day:null,stage:0,due:null,weak:false,learned:null});
export function replay(ct,events){const S={started:null,start_day:null,c:Object.fromEntries(Object.keys(ct.concepts).map(k=>[k,fresh()])),done:{},checks:{},minutes:{},sessions:{},reviews:{},review_items:Object.fromEntries(Object.keys(ct.concepts).map(k=>[k,[]]))};
  for(const e of events){if(e.subject!==ct.subject)continue;
    try{const c=S.c[e.concept];
      if(e.type==='start_choice'){if(!S.started){S.started=e.mode;
          S.start_day=e.day}}else if(e.type==='answer'){if(e.session&&S.sessions[e.session]?.end==null)S.sessions[e.session].ans[e.item]=!!e.ok;
        if(e.mode!=='diag'&&c)c.att.push([e.day,!!e.ok])}else if(e.type==='lesson_done'){const L=ct.lessons[e.lesson];
        if(!L)continue;
        if(!S.done[L.id]){S.done[L.id]=e.day;
          S.minutes[e.day]=(S.minutes[e.day]||0)+L.minutes}for(const id of L.concepts){const x=S.c[id];
          x.learned ||=e.day;
          x.stage=0;
          x.due=addDays(e.day,1);
          if(e.score>=PASS)x.passed=true,x.weak=false}}else if(e.type==='review_done'&&c){S.review_items[e.concept].push(...(e.items||[]));
        S.minutes[e.day]=(S.minutes[e.day]||0)+REVIEW_MIN;
        S.reviews[e.day]=(S.reviews[e.day]||0)+1;
        if(e.score>=MASTER){c.passed=true;
          c.weak=false;
          c.stage++;
          c.due=c.stage<INTERVALS.length?addDays(e.day,INTERVALS[c.stage]):null}else if(e.score>=PASS){c.passed=true;
          c.weak=false;
          c.due=addDays(e.day,INTERVALS[Math.min(c.stage,INTERVALS.length-1)])}else{c.stage=0;
          c.due=addDays(e.day,1)}}else if(e.type==='check'){const L=ct.lessons[e.lesson];
        if(!L)continue;
        const set=new Set(S.checks[L.id]||[]);
        e.done?set.add(e.idx):set.delete(e.idx);
        S.checks[L.id]=[...set].sort((a,b)=>a-b);
        if(set.size>=L.checklist.length&&!S.done[L.id]){S.done[L.id]=e.day;
          S.minutes[e.day]=(S.minutes[e.day]||0)+L.minutes}}else if(e.type==='known')for(const id of e.concepts){S.c[id].known=true;
        S.c[id].passed=true;
        S.c[id].known_day||=e.day;
        S.c[id].due=null}}catch{}}
  return S}
export function status(ct,S,id){const c=S.c[id],a=c.att.slice(-RECENT),ok=a.filter(x=>x[1]).length,n=a.length;
  if(c.known&&!c.weak)return'known';
  if(!n&&!c.passed)return(ct.concepts[id].prereq||[]).some(x=>!S.c[x].passed)?'locked':'new';
  if(c.weak||(n>=3&&ok/n<PASS)||(c.learned&&!c.passed))return'review';
  if(n&&ok/n>=MASTER&&new Set(a.filter(x=>x[1]).map(x=>x[0])).size>=2)return'mastered';
  return'learning'}
export function lessonFinished(S,L){return!!S.done[L.id]||(L.kind==='theory'&&L.concepts.every(x=>S.c[x].known))}
export function missing(ct,S,ids){return ids.filter(x=>!S.c[x].passed)}
function need(ct,L){if(L.kind==='practice')return L.concepts;
  return [...new Set(L.concepts.flatMap(x=>ct.concepts[x].prereq||[]))]}
function reason(c,d,t){const a=c.att.slice(-RECENT),ok=a.filter(x=>x[1]).length,n=a.length;
  let r=c.weak?'월말 평가에서 틀린 개념':n>=3&&ok/n<PASS?`최근 문제 ${ok}/${n} → 다시 풀기`:!c.passed?'확인 문제 통과 전 → 다시 풀기':`복습 날짜 (${INTERVALS[Math.min(c.stage,3)]}일 간격)`;
  const late=daysBetween(d,t);
  if(late>0)r+=` · ${late}일 밀림`;
  return r}
export function pickReview(ct,S,cid){const all=Object.values(ct.items).filter(x=>x.use==='review'&&x.concept===cid&&!x.off),seen=S.review_items[cid]||[],freshItems=all.filter(x=>!seen.includes(x.id)),old=all.filter(x=>seen.includes(x.id)).sort((a,b)=>seen.lastIndexOf(a.id)-seen.lastIndexOf(b.id));
  return freshItems.slice(0,3).map(x=>x.id).concat(old.slice(0,Math.max(0,3-freshItems.length)).map(x=>x.id))}
export function subjectView(ct,events,today){const S=replay(ct,events),v={subject:ct.subject,name:ct.name,started:S.started,open:null,recs:[],note:null,budget:BUDGET,minutesToday:S.minutes[today]||0,checks:S.checks,reviewItems:S.review_items};
  if(!S.started)return v;
  const doneNow=Object.values(S.done).filter(d=>d.slice(0,7)===today.slice(0,7)).length,finished=ct.order.filter(id=>lessonFinished(S,ct.lessons[id])).length;
  const target=Math.min(ct.base_target,ct.order.length-finished+doneNow);
  const plan={target,done:doneNow};
  const recs=[],due=Object.entries(S.c).filter(([,c])=>c.due&&c.due<=today).sort((a,b)=>Number(b[1].weak)-Number(a[1].weak)||a[1].due.localeCompare(b[1].due));
  for(const [id,c] of due.slice(0,Math.max(0,MAX_REVIEWS-(S.reviews[today]||0))))recs.push({kind:'review',id,title:'복습 · '+ct.concepts[id].name,minutes:REVIEW_MIN,reason:reason(c,c.due,today)});
  let planned=recs.reduce((a,x)=>a+x.minutes,0),nLessons=0,left=0,blocked=null;
  for(const id of ct.order){const L=ct.lessons[id];
    if(lessonFinished(S,L))continue;
    left++;
    const miss=missing(ct,S,need(ct,L));
    if(miss.length){blocked||=[L,miss];
      continue}if(nLessons>=2||(nLessons&&planned+L.minutes>BUDGET))continue;
    let why=L.kind==='practice'?`이론 '${miss.map(x=>ct.concepts[x].name).join(', ')}' 통과 → 같은 개념 실습`:need(ct,L).length?`선수 개념 '${need(ct,L).map(x=>ct.concepts[x].name).join(', ')}' 통과 → 다음 단계`:'첫 단계 수업';
    if(plan.target&&plan.done>=plan.target)why+=' · 이번 달 목표 달성, 앞서 가기';
    recs.push({kind:L.kind,id,title:L.title,minutes:L.minutes,reason:why});
    planned+=L.minutes;
    nLessons++}if(!nLessons){if(!left)v.note='준비된 수업을 모두 끝냈어요. 복습은 날짜에 맞춰 계속 나와요.';
    else if(blocked)v.note=`다음 수업 '${blocked[0].title}'은(는) '${blocked[1].map(x=>ct.concepts[x].name).join(', ')}' 복습을 통과하면 열려요.`}if(v.minutesToday>=BUDGET&&recs.length){v.note=`오늘 ${BUDGET}분 채웠어요. 더 하고 싶을 때만 아래에서 골라요.`;
    recs.forEach(x=>x.extra=true)}v.recs=recs;
  return v}
export function cleanEvent(ct,S,b){if(b.type==='start_choice'){if(S.started||b.mode!=='basic')throw Error('시작 기록이 이상해요');
    return{type:b.type,subject:ct.subject,mode:'basic'}}if(!S.started)throw Error('먼저 시작 방식을 골라 주세요');
  if(b.type==='answer'){const it=ct.items[b.item];
    if(!it||typeof b.ok!=='boolean')throw Error('답 기록이 이상해요');
    return{type:'answer',subject:ct.subject,item:it.id,concept:it.concept,ok:b.ok,mode:b.mode}}if(b.type==='lesson_done'){const L=ct.lessons[b.lesson];
    if(!L||L.kind!=='theory'||missing(ct,S,need(ct,L)).length)throw Error('아직 열리지 않은 수업이에요');
    return{type:b.type,subject:ct.subject,lesson:L.id,score:Math.round(b.score*1000)/1000}}if(b.type==='review_done'){if(!ct.concepts[b.concept]||!Array.isArray(b.items)||b.items.length>REVIEW_ITEMS||b.items.some(id=>ct.items[id]?.use!=='review'||ct.items[id].concept!==b.concept))throw Error('복습 기록이 이상해요');
    return{type:b.type,subject:ct.subject,concept:b.concept,score:b.score,items:b.items}}if(b.type==='check'){const L=ct.lessons[b.lesson];
    if(!L||L.kind!=='practice'||!Number.isInteger(b.idx)||b.idx<0||b.idx>=L.checklist.length||missing(ct,S,need(ct,L)).length)throw Error('아직 열리지 않은 실습이에요');
    return{type:b.type,subject:ct.subject,lesson:L.id,idx:b.idx,done:!!b.done}}throw Error('모르는 기록이에요')}
