import * as E from './engine.js';
const $=s=>document.querySelector(s), app=$('#app'), STORE='studyroom-phone', FORMAT=1, tabs=[['today','오늘','🏠'],['english','영어','🔤'],['logic','Logic','🎚️'],['finalcut','Final Cut','🎬'],['settings','설정','⚙️']];
let data={},events=[],page='today',warning='',quizBusy=false,storageReadFailed=false,solvingQuiz=false,pendingReload=false,reloadHandled=false;
const STORAGE_WARNING='기록 저장소를 읽지 못했어요. 백업을 복원하거나 앱을 다시 열 때까지 기록을 저장할 수 없어요.';
function warn(message){warning=storageReadFailed?STORAGE_WARNING:message}
const day=()=>{const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function node(tag,attrs={},...children){const n=document.createElement(tag);
  for(const [k,v]of Object.entries(attrs)){if(k==='class')n.className=v;
    else if(k==='on')n.onclick=v;
    else if(k==='checked')n.checked=v;
    else if(k==='disabled')n.disabled=!!v;
    else if(v!=null)n.setAttribute(k,v===true?'':v)}for(const c of children.flat())if(c!=null)n.append(c instanceof Node?c:document.createTextNode(String(c)));
  return n}
const btn=(s,fn,cls='',disabled=false)=>node('button',{class:'btn '+cls,on:fn,disabled},s), card=(...c)=>node('section',{class:'card'},...c), norm=s=>String(s).toLowerCase().replace(/[’‘]/g,"'").replace(/[.,!?;:"]/g,'').replace(/\s+/g,' ').trim(), loose=s=>norm(s).replace(/'/g,''), shuffle=a=>{a=[...a];
  for(let i=a.length-1; i>0; i--){const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]]}return a};
let db;
async function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(STORE,1); r.onupgradeneeded=()=>r.result.createObjectStore('state'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error)})}
async function load(){try{db=await openDb();
    events=await new Promise((resolve,reject)=>{const r=db.transaction('state').objectStore('state').get('main'); r.onsuccess=()=>resolve(r.result?.events||[]); r.onerror=()=>reject(r.error)})}catch(err){db=null;
    try{events=JSON.parse(localStorage.getItem(STORE)||'{"events":[]}').events||[]}catch{events=[];
      storageReadFailed=true;
      warning=STORAGE_WARNING}}}
async function save(ev){const next=[...events,{...ev,day:day()}],payload={formatVersion:FORMAT,events:next,updatedAt:new Date().toISOString()};
  if(storageReadFailed){warning=STORAGE_WARNING; render(); return false}
  try{if(db)await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite'); tx.objectStore('state').put(payload,'main'); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error)});
    else localStorage.setItem(STORE,JSON.stringify(payload));
    events=next;
    warning='';
    return true}catch(err){warning='기록 저장에 실패했어요. 저장 공간을 확인하고 백업해 주세요.';
    render();
    return false}}
function ct(s){return E.buildContent(data[s])}function state(s){return E.subjectView(ct(s),events,day())}function enabledLessons(s){const c=ct(s),S=E.replay(c,events);
  return c.order.filter(id=>!E.missing(c,S,(c.lessons[id].kind==='practice'?c.lessons[id].concepts:c.lessons[id].concepts.flatMap(x=>c.concepts[x].prereq||[]))).length)}
function setPage(p){page=p;
  render(); applyPendingReload()}
function renderTabs(){const nav=$('#tabs');
  nav.replaceChildren(...tabs.map(([id,label,icon])=>node('button',{class:page===id?'on':'',on:()=>setPage(id)},node('span',{},icon),label)))}
function render(){renderTabs();
  $('#version').textContent=window.PHONE_VERSION||'';
  app.replaceChildren();
  if(warning)app.append(node('div',{class:'banner'},warning));
  if(page==='today')home();
  else if(page==='settings')settings();
  else subject(page)}
function home(){const today=day();
  app.append(node('div',{class:'muted'},new Date().toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'})));
  for(const s of E.SUBJECTS){const v=state(s),box=card(node('h2',{},data[s].name));
    if(!v.started){box.append(node('p',{class:'muted'},'처음부터 시작해요. 수준 평가는 사용하지 않아요.'),btn('처음부터 시작',async()=>{if(await save({type:'start_choice',subject:s,mode:'basic'}))render()},'primary'));
      app.append(box);
      continue}box.append(node('div',{class:'meta'},`오늘 ${v.minutesToday}분 / ${v.budget}분`),node('div',{class:'progress'},node('i',{style:`width:${Math.min(100,v.minutesToday/v.budget*100)}%`})));
    if(v.note)box.append(node('p',{class:'muted'},v.note));
    if(!v.recs.length)box.append(node('p',{class:'muted'},'오늘 추천할 수업이 없어요.'));
    for(const r of v.recs){const act=()=>r.kind==='review'?runReview(s,r.id):openLesson(s,r.id);
      box.append(node('div',{class:'rec'},node('div',{},node('div',{class:'rec-title'},r.title),node('div',{class:'why'},`왜: ${r.reason} · 약 ${r.minutes}분`)),btn(r.extra?'더 하기':'열기',act,r.extra?'':'primary')))}app.append(box)}}
function subject(s){if(!data[s])return;
  const c=ct(s),S=E.replay(c,events),open=enabledLessons(s);
  app.append(node('p',{class:'muted'},data[s].name+' · 처음부터 순서대로 진행'));
  if(!S.started)app.append(card(node('p',{class:'muted'},'아직 시작 전이에요. 처음부터 순서대로 배워요.'),btn('처음부터 시작',async()=>{if(await save({type:'start_choice',subject:s,mode:'basic'}))render()},'primary')));
  for(const id of c.order){const L=c.lessons[id],done=E.lessonFinished(S,L),locked=!open.includes(id);
    const b=card(node('div',{class:'meta'},L.kind==='practice'?'실습 체크리스트':'수업'),node('h2',{},L.title),node('div',{class:'muted'},done?'완료':locked?'선수 수업을 먼저 마쳐 주세요':`약 ${L.minutes}분`));
    b.append(btn(done?'다시 보기':L.kind==='practice'?'실습 열기':'수업 열기',()=>L.kind==='practice'?openPractice(s,id):openLesson(s,id),'',locked));
    app.append(b)}}
const SVG_CACHE = Object.create(null);
const IMAGE_NAME = /^[A-Za-z0-9_-]+\.(?:svg|jpe?g|png)$/i;
function inlineSvg(holder, text) {
    const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = parsed.documentElement;
    if (svg.nodeName.toLowerCase() !== 'svg' || parsed.querySelector('parsererror')) {
        throw new Error('올바르지 않은 SVG 파일이에요.');
      }
    svg.querySelectorAll('script, foreignObject').forEach(element => element.remove());
    holder.replaceChildren(document.importNode(svg, true));
}
function bodyBlocks(parent, blocks) {
    for (const block of blocks || []) {
        if (typeof block === 'string') {
            const line = block.trim();
            if (!line) continue;
            if (line.startsWith('# ')) parent.append(node('h3', {}, line.slice(2)));
            else if (line.startsWith('* ')) parent.append(node('p', {}, '• ' + line.slice(2)));
            else parent.append(node('p', {}, line));
            continue;
          }
        if (!block || typeof block.img !== 'string' || !IMAGE_NAME.test(block.img)) continue;
        const figure = node('figure', {class: 'figure'});
        const imageUrl = `content/img/${encodeURIComponent(block.img)}`;
        if (/\.svg$/i.test(block.img)) {
            const holder = node('div', {class: 'svg'});
            figure.append(holder);
            const showSvg = text => {
                try {
                    inlineSvg(holder, text);
                  } catch {
                    holder.replaceChildren(node('p', {class: 'muted'}, '그림을 불러오지 못했어요.'));
                  }
              };
            if (SVG_CACHE[block.img]) showSvg(SVG_CACHE[block.img]);
            else fetch(imageUrl)
              .then(response => response.ok ? response.text() : Promise.reject())
              .then(text => {
                  SVG_CACHE[block.img] = text;
                  showSvg(text);
                })
              .catch(() => holder.replaceChildren(node('p', {class: 'muted'}, '그림을 불러오지 못했어요.')));
          } else {
            const photo = node('div', {class: 'photo'});
            photo.append(node('img', {src: imageUrl, alt: block.cap || '', loading: 'lazy'}));
            if (block.marks) {
                block.marks.forEach(([x, y], index) => {
                    photo.append(node('span', {
                        class: 'mark',
                        style: `left:${x}%;top:${y}%`
                      }, String(index + 1)));
                  });
              }
            figure.append(photo);
            if (block.marks?.length) {
                figure.append(node('ol', {class: 'muted'},
                  ...block.marks.map(mark => node('li', {}, mark[2]))));
              }
          }
        if (block.cap) figure.append(node('figcaption', {class: 'muted'}, block.cap));
        parent.append(figure);
      }
}
function openLesson(s,id){const c=ct(s),L=c.lessons[id],box=card(node('div',{class:'meta'},data[s].name+' · 수업'),node('h2',{},L.title)),content=node('article',{class:'lesson'});
  bodyBlocks(content,L.body);
  box.append(content,btn(`확인 문제 풀기 (${L.quiz.length}문항)`,()=>quiz(s,L.quiz.map(i=>c.items[i]),'lesson',id),'primary'),btn('목록',()=>setPage(s),'small'));
  app.replaceChildren(box)}
function openPractice(s,id){const c=ct(s),L=c.lessons[id],S=E.replay(c,events),checked=new Set(S.checks[id]||[]),box=card(node('div',{class:'meta'},data[s].name+' · 실습 · 채점 없음'),node('h2',{},L.title)),body=node('article',{class:'lesson'});
  bodyBlocks(body,L.body);
  box.append(body,node('h3',{},`체크리스트 ${checked.size}/${L.checklist.length}`));
  L.checklist.forEach((text,idx)=>{const input=node('input',{type:'checkbox',checked:checked.has(idx)}); input.addEventListener('change',async()=>{input.disabled=true; if(await save({type:'check',subject:s,lesson:id,idx,done:input.checked})){openPractice(s,id)}else input.checked=!input.checked; input.disabled=false}); box.append(node('label',{class:'check'},input,node('span',{},text)))});
  box.append(btn('목록',()=>setPage(s),'small'));
  app.replaceChildren(box)}
function reviewQuizItems(s,cid){return E.pickReview(ct(s),E.replay(ct(s),events),cid).map(id=>ct(s).items[id])}
function runReview(s,cid){const it=reviewQuizItems(s,cid);
  quiz(s,it,'review',cid)}
function quiz(s,items,mode,id){let i=0,score=0,chosen=[]; solvingQuiz=true;
  const show=()=>{if(i>=items.length){const event=mode==='review'?{type:'review_done',subject:s,concept:id,score:score/items.length,items:chosen}:{type:'lesson_done',subject:s,lesson:id,score:score/items.length};
      save(event).then(ok=>{if(ok){solvingQuiz=false;const box=card(node('h2',{},`${score}/${items.length} 정답`),node('p',{},mode==='review'?(score/items.length>=.8?'좋아요! 다음 복습 간격이 늘어나요.':score/items.length>=.6?'통과. 같은 간격으로 복습해요.':'내일 다시 복습해요.'):(score/items.length>=E.PASS?'통과했어요! 내일 복습이 나와요.':'60% 미만이라 내일 복습해요. 통과하면 다음 수업이 열려요.')),btn('오늘로',()=>setPage('today'),'primary')); app.replaceChildren(box); applyPendingReload()} });
      return}const it=items[i],box=card(node('div',{class:'meta'},`${mode==='review'?'복습':'수업'} · ${i+1}/${items.length}`),node('div',{class:'progress'},node('i',{style:`width:${i/items.length*100}%`})));
    if(it.type==='listen')box.append(btn('🔊 듣기',()=>speak(it.say,box),'small'));
    box.append(node('div',{class:'q'},it.q));
    const answer=async(value,correct,right)=>{if(quizBusy)return;
      quizBusy=true;
      const ok=await save({type:'answer',subject:s,item:it.id,ok:correct,mode});
      quizBusy=false;
      if(!ok)return;
      if(correct)score++;
      if(mode==='review')chosen.push(it.id);
      box.append(node('div',{class:`feedback ${correct?'':'bad'}`},correct?'맞았어요 ✓':`틀렸어요 · 정답: ${right}`,it.x?node('p',{},it.x):null),btn(i+1<items.length?'다음':'결과',()=>{i++; show()},'primary'))};
    if(it.type==='choice'||it.type==='listen'){for(const opt of shuffle(it.c))box.append(node('button',{class:'choice',on:()=>answer(opt,opt===it.c[0],it.c[0])},opt))}else if(it.type==='fill'){const input=node('input',{class:'input',placeholder:'빈칸에 들어갈 말',autocomplete:'off'});
      box.append(input,btn('확인',()=>answer(input.value,it.a.some(a=>loose(a)===loose(input.value)),it.a[0]),'primary'))}else if(it.type==='order'){let picked=[];
      const pool=shuffle(it.t.map((w,n)=>({w,n}))),line=node('div',{class:'tokens'}),bank=node('div',{class:'tokens'});
      const draw=()=>{line.replaceChildren(...picked.map((x,j)=>btn(x.w,()=>{picked.splice(j,1); draw()},'token')));
        bank.replaceChildren(...pool.filter(x=>!picked.includes(x)).map(x=>btn(x.w,()=>{picked.push(x); draw()},'token')))};
      draw();
      box.append(line,bank,btn('확인',()=>{if(picked.length===it.t.length){const mine=picked.map(x=>x.w).join(' '); answer(mine,norm(mine)===norm(it.a),it.a)}},'primary'))}box.append(btn('나가기',()=>setPage('today'),'small'));
    app.replaceChildren(box)};
  show()}
function speak(text,box){const fallback=()=>{if(!box.querySelector('.speech-fallback'))box.append(node('p',{class:'muted speech-fallback'},`듣기 기능을 사용할 수 없어요. 문장: ${text}`))};
  if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window)){fallback(); return}
  try{const u=new SpeechSynthesisUtterance(text); u.lang='en-US'; u.onerror=fallback; speechSynthesis.speak(u)}catch{fallback()}}
function settings(){const box=card(node('h2',{},'기록과 백업'),node('p',{class:'muted'},`저장한 답·수업 기록 ${events.length}개 · 이 기기에만 저장돼요.`),btn('JSON 백업 저장 / 공유',backup,'primary'));
  const file=node('input',{type:'file',accept:'application/json,.json',class:'input'});
  file.addEventListener('change',()=>restore(file.files?.[0]));
  box.append(node('p',{},'백업 파일에서 복원'),file,btn('복원하기',()=>restore(file.files?.[0])));
  box.append(node('p',{class:'muted'},'사파리와 홈 화면 앱은 기록이 따로라, 홈 화면에 추가한 뒤에는 홈 화면 앱으로만 쓰세요.'));
  if(!localStorage.getItem('phone-home-tip'))box.append(node('div',{class:'banner'},'아이폰 Safari: 공유 버튼 → 홈 화면에 추가를 선택하면 앱처럼 열 수 있어요.',btn('확인',()=>{localStorage.setItem('phone-home-tip','1'); render()},'small')));
  app.append(box)}
async function backup(){const payload=E.makeBackup(events),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),file=new File([blob],`공부방-백업-${day()}.json`,{type:'application/json'});
  let shared=false;
  if(navigator.share){try{if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'공부방 기록 백업'}); shared=true}}catch(err){if(err.name==='AbortError')return}}
  if(!shared){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=file.name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  localStorage.setItem('phone-backup-date',day());
  warn('백업 파일을 만들었어요.');
  render()}
async function restore(file){if(!file)return;
  try{const result=E.readBackup(JSON.parse(await file.text())),{events:next,rejectedCount}=result;
    if(!next.length){warn(`복원하지 않았어요. 유효한 기록이 없고 ${rejectedCount}개 항목을 거부했어요.`); render(); return}
    if(!confirm(`백업의 기록 ${next.length}개로 현재 기록을 바꿀까요? (거부한 항목 ${rejectedCount}개)`))return;
    events=await E.persistRestore(next,async saved=>{if(db)await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite'); tx.objectStore('state').put({formatVersion:FORMAT,events:saved,updatedAt:new Date().toISOString()},'main'); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error)});
      else localStorage.setItem(STORE,JSON.stringify({formatVersion:FORMAT,events:saved,updatedAt:new Date().toISOString()}))});
    storageReadFailed=false;
    warning=`백업 기록 ${next.length}개를 복원했어요. 거부한 항목 ${rejectedCount}개.`;
    render()}catch(err){warn('복원 실패: '+err.message);
    render()}}
async function init(){try{for(const s of E.SUBJECTS){const r=await fetch(`content/${s}.json`);
      if(!r.ok)throw Error(`${s} 자료를 읽지 못했어요`);
      data[s]=await r.json()}await load();
    $('#version').textContent=window.PHONE_VERSION||'';
    if('serviceWorker'in navigator){navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloadHandled)return; reloadHandled=true; pendingReload=true; applyPendingReload()});
      navigator.serviceWorker.register('./sw.js').then(registration=>registration.update()).catch(()=>warn('오프라인 저장 설정을 완료하지 못했어요.'))}
    const first=localStorage.getItem('phone-first-open')||day();
    localStorage.setItem('phone-first-open',first);
    const last=localStorage.getItem('phone-backup-date');
    if(E.daysBetween(last||first,day())>7)warn('마지막 백업이 7일 넘었어요. 설정에서 기록을 백업해 주세요.');
    if(!localStorage.getItem('phone-home-tip'))page='settings';
    render()}catch(e){app.replaceChildren(card(node('h2',{},'자료를 불러오지 못했어요'),node('p',{class:'muted'},e.message+' · 처음 열 때는 인터넷 연결이 필요해요. 다시 열어 주세요.')))}}
init();
function applyPendingReload(){if(pendingReload&&!solvingQuiz){pendingReload=false; location.reload()}}
