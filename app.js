(() => {
  'use strict';
  const DATA = window.OFFICIAL_DATA;
  const $app = document.getElementById('app');
  const $home = document.getElementById('homeBtn');
  const $font = document.getElementById('fontBtn');
  const $toast = document.getElementById('toast');
  const CIRCLES = ['','①','②','③','④'];
  const LS = {
    active:'kashikin.active.v2', history:'kashikin.history.v2', stats:'kashikin.stats.v2',
    seen:'kashikin.seen.v2', flags:'kashikin.flags.v2', bookmarks:'kashikin.bookmarks.v2', font:'kashikin.font.v2'
  };
  const qById = new Map(DATA.questions.map(q => [q.id,q]));
  let view='home';
  let session=null;
  let timerHandle=null;
  let practiceConfig={count:20,section:'all',topic:'all',feedback:true};

  function read(key,fallback){try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback}catch{return fallback}}
  function write(key,val){localStorage.setItem(key,JSON.stringify(val))}
  function esc(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
  function shuffle(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}
  function toast(msg){$toast.textContent=msg;$toast.classList.add('show');setTimeout(()=>$toast.classList.remove('show'),1800)}
  function fmtDate(ts){return new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(ts))}
  function saveActive(){
    if(!session)return localStorage.removeItem(LS.active);
    const copy={...session,questionIds:session.questions.map(q=>q.id)};delete copy.questions;
    write(LS.active,copy);
  }
  function restoreActive(){
    const s=read(LS.active,null);if(!s||!Array.isArray(s.questionIds))return null;
    const qs=s.questionIds.map(id=>qById.get(id)).filter(Boolean);if(qs.length!==s.questionIds.length)return null;
    delete s.questionIds;s.questions=qs;return s;
  }
  function clearTimer(){if(timerHandle){clearInterval(timerHandle);timerHandle=null}}
  function setView(v){view=v;$home.hidden=v==='home';window.scrollTo({top:0,behavior:'instant'});clearTimer()}
  function sourceFooter(){return `<div class="footer-note">出典：日本貸金業協会「貸金業務取扱主任者資格試験問題」「試験問題の正答」。問題文は出典を明示して収録し、写真・画像は転載していません。<br><a href="${DATA.archiveUrl}" target="_blank" rel="noopener">公式の過去問題ページを開く</a></div>`}

  function renderHome(){
    setView('home'); session=null;
    const hist=read(LS.history,[]), stats=read(LS.stats,{});
    const attempts=Object.values(stats).reduce((n,s)=>n+(s.attempts||0),0);
    const correct=Object.values(stats).reduce((n,s)=>n+(s.correct||0),0);
    const active=restoreActive();
    const recent=hist.slice(0,3);
    $app.innerHTML=`
      <section class="hero"><h1>公式過去問を、重複なしで毎日。</h1><p>第1回〜第20回の全1,000問を収録。過去問は本来の順番で、ランダム演習は未出題問題から選びます。</p>
        <div class="hero-stats"><div class="hero-stat"><strong>1,000</strong><span>収録問題</span></div><div class="hero-stat"><strong>${attempts}</strong><span>解答数</span></div><div class="hero-stat"><strong>${attempts?Math.round(correct/attempts*100):0}%</strong><span>総正答率</span></div></div>
      </section>
      ${active?`<div class="notice"><b>途中の演習があります</b><br>${active.mode==='exam'?`第${active.exam}回 過去問`:`ランダム${active.questions.length}問`}・問題${active.current+1}まで進行中。<br><button class="primary" style="margin-top:10px" id="resumeBtn">続きから再開</button></div>`:''}
      <h2>学習モード</h2><div class="grid">
        <button class="menu-card" id="pastBtn"><span class="menu-icon">📝</span><b>回別過去問</b><span>各回50問を公式の問題順で解く。各回の実際の合格基準で判定。</span></button>
        <button class="menu-card" id="practiceBtn"><span class="menu-icon">🎲</span><b>重複なし演習</b><span>分野・問題数を選択。未出題問題を優先し、同じ文章を繰り返さない。</span></button>
        <button class="menu-card" id="wrongBtn"><span class="menu-icon">↻</span><b>間違い復習</b><span>過去に誤答した問題だけを最大20問出題。</span></button>
        <button class="menu-card" id="statsBtn"><span class="menu-icon">📊</span><b>成績・履歴</b><span>分野別正答率と直近の受験結果を確認。</span></button>
      </div>
      ${recent.length?`<h2>最近の結果</h2><div class="card">${recent.map(h=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><span>${h.mode==='exam'?`第${h.exam}回`:'ランダム演習'} <small class="subtle">${fmtDate(h.at)}</small></span><b>${h.score}/${h.total}</b></div>`).join('')}</div>`:''}
      ${sourceFooter()}`;
    document.getElementById('pastBtn').onclick=renderPastList;
    document.getElementById('practiceBtn').onclick=renderPracticeSetup;
    document.getElementById('wrongBtn').onclick=startWrongReview;
    document.getElementById('statsBtn').onclick=renderStats;
    if(active)document.getElementById('resumeBtn').onclick=()=>{session=active;renderQuiz()};
  }

  function renderPastList(){
    setView('past');
    $app.innerHTML=`<h2 style="margin-top:4px">回別過去問</h2><p class="subtle">各回50問・公式の問題順です。回答中は正誤を表示せず、提出後に採点します。</p><div class="exam-list">
      ${DATA.exams.map(e=>`<div class="exam-item"><div class="meta"><b>${e.label} <span class="subtle">${e.year}</span></b><small>50問／120分</small></div><span class="pass-chip">合格 ${e.passMark}点</span><button class="mini-go" data-exam="${e.exam}">解く</button></div>`).join('')}
      </div>${sourceFooter()}`;
    $app.querySelectorAll('[data-exam]').forEach(b=>b.onclick=()=>startExam(Number(b.dataset.exam)));
  }

  function renderPracticeSetup(){
    setView('setup');
    const sections=[...new Set(DATA.questions.map(q=>q.section))];
    const topics=[...new Set(DATA.questions.map(q=>q.topic))].sort((a,b)=>a.localeCompare(b,'ja'));
    const seen=read(LS.seen,{});
    $app.innerHTML=`<h2 style="margin-top:4px">重複なし演習</h2>
      <div class="notice">選んだ条件ごとに出題済みIDを端末内へ保存し、未出題問題を優先します。対象問題を一巡した場合だけ履歴をリセットして再出題します。</div>
      <div class="card">
        <div class="field"><label>問題数</label><div class="seg" id="countSeg">${[10,20,30,50].map(n=>`<button data-count="${n}" class="${practiceConfig.count===n?'active':''}">${n}問</button>`).join('')}</div></div>
        <div class="field"><label>公式4科目</label><select id="sectionSel"><option value="all">すべて</option>${sections.map(s=>`<option ${practiceConfig.section===s?'selected':''}>${esc(s)}</option>`).join('')}</select></div>
        <div class="field"><label>細分類</label><select id="topicSel"><option value="all">すべて</option>${topics.map(s=>`<option ${practiceConfig.topic===s?'selected':''}>${esc(s)}</option>`).join('')}</select></div>
        <div class="field"><label>回答後の表示</label><select id="feedbackSel"><option value="yes" ${practiceConfig.feedback?'selected':''}>その場で正誤を表示</option><option value="no" ${!practiceConfig.feedback?'selected':''}>最後にまとめて採点</option></select></div>
        <div id="poolInfo" class="subtle" style="margin-bottom:14px"></div>
        <button class="primary" id="startPractice">演習を始める</button>
        <button class="secondary" id="resetSeen" style="margin-top:10px">この条件の出題履歴をリセット</button>
      </div>`;
    function configNow(){return {count:practiceConfig.count,section:document.getElementById('sectionSel').value,topic:document.getElementById('topicSel').value,feedback:document.getElementById('feedbackSel').value==='yes'}}
    function key(c){return `${c.section}|${c.topic}`}
    function update(){const c=configNow();const pool=eligible(c);const used=new Set(seen[key(c)]||[]);const left=pool.filter(q=>!used.has(q.id)).length;document.getElementById('poolInfo').textContent=`対象 ${pool.length}問／未出題 ${left}問`;}
    $app.querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{practiceConfig.count=Number(b.dataset.count);$app.querySelectorAll('[data-count]').forEach(x=>x.classList.toggle('active',x===b));update()});
    ['sectionSel','topicSel'].forEach(id=>document.getElementById(id).onchange=update);
    document.getElementById('feedbackSel').onchange=()=>{};
    document.getElementById('startPractice').onclick=()=>{practiceConfig=configNow();startPractice(practiceConfig)};
    document.getElementById('resetSeen').onclick=()=>{const c=configNow();delete seen[key(c)];write(LS.seen,seen);toast('出題履歴をリセットしました');update()};
    update();
  }

  function eligible(c){return DATA.questions.filter(q=>(c.section==='all'||q.section===c.section)&&(c.topic==='all'||q.topic===c.topic))}
  function seenKey(c){return `${c.section}|${c.topic}`}
  function chooseNoRepeat(c){
    const pool=eligible(c); if(!pool.length)return [];
    const seen=read(LS.seen,{}), key=seenKey(c);const used=new Set(seen[key]||[]);
    const take=Math.min(c.count,pool.length);
    const fresh=shuffle(pool.filter(q=>!used.has(q.id)));
    let chosen=[];
    if(fresh.length>=take){
      chosen=fresh.slice(0,take);
      seen[key]=[...(seen[key]||[]),...chosen.map(q=>q.id)];
    }else{
      // Finish every remaining unseen item first, then begin a new cycle only for the shortage.
      chosen=[...fresh];
      const picked=new Set(chosen.map(q=>q.id));
      const fill=shuffle(pool.filter(q=>!picked.has(q.id))).slice(0,take-chosen.length);
      chosen.push(...fill);
      // Stored IDs now represent progress in the new cycle. Items used to finish the old cycle are not counted twice.
      seen[key]=fill.map(q=>q.id);
    }
    seen[key]=[...new Set(seen[key])].slice(-pool.length);
    write(LS.seen,seen);return chosen;
  }

  function newSession(opts){
    clearTimer();
    session={mode:opts.mode,exam:opts.exam||null,passMark:opts.passMark||null,questions:opts.questions,current:0,answers:{},flags:[],feedback:!!opts.feedback,startedAt:Date.now(),duration:opts.duration||null,finished:false,config:opts.config||null};
    saveActive();renderQuiz();
  }
  function startExam(exam){const meta=DATA.exams.find(e=>e.exam===exam);const qs=DATA.questions.filter(q=>q.exam===exam).sort((a,b)=>a.questionNo-b.questionNo);newSession({mode:'exam',exam,passMark:meta.passMark,questions:qs,feedback:false,duration:120*60})}
  function startPractice(c){const qs=chooseNoRepeat(c);if(!qs.length){toast('対象問題がありません');return}newSession({mode:'practice',questions:qs,feedback:c.feedback,config:c})}
  function startWrongReview(){
    const stats=read(LS.stats,{});let qs=DATA.questions.filter(q=>stats[q.id]&&stats[q.id].attempts>stats[q.id].correct);
    qs=shuffle(qs).slice(0,20);if(!qs.length){toast('間違えた問題はまだありません');return}
    newSession({mode:'practice',questions:qs,feedback:true,config:{count:qs.length,section:'wrong',topic:'wrong',feedback:true}})
  }

  function renderQuiz(){
    setView('quiz'); if(!session||!session.questions.length)return renderHome();
    const q=session.questions[session.current], answer=session.answers[q.id], isAnswered=answer!=null;
    const showFeedback=session.feedback&&isAnswered;
    const correct=answer===q.correct;
    const flags=new Set(session.flags||[]), bookmarked=new Set(read(LS.bookmarks,[]));
    $app.innerHTML=`
      <div class="quiz-head"><div class="grow"><b>${session.mode==='exam'?`第${session.exam}回 過去問`:`重複なし演習 ${session.questions.length}問`}</b><small>問題 ${session.current+1} / ${session.questions.length}</small></div>${session.duration?'<span class="timer" id="timer">--:--</span>':''}</div>
      <div class="progress"><div style="width:${(session.current+1)/session.questions.length*100}%"></div></div>
      <section class="question-card">
        <div class="q-tags"><span class="tag">${esc(q.section)}</span><span class="tag">${esc(q.topic)}</span><span class="tag">第${q.exam}回 問${q.questionNo}</span></div>
        <div class="question-text">${esc(q.text)}</div>
        <div class="answer-title">解答を選択</div>
        <div class="answer-grid">${[1,2,3,4].map(n=>{
          let cl='answer-btn';if(answer===n)cl+=' selected';if(showFeedback&&n===q.correct)cl+=' correct';if(showFeedback&&answer===n&&n!==q.correct)cl+=' wrong';
          return `<button class="${cl}" data-answer="${n}" ${showFeedback?'disabled':''}>${CIRCLES[n]}</button>`}).join('')}</div>
        ${showFeedback?`<div class="feedback ${correct?'ok':'bad'}"><b>${correct?'正解':'不正解'}　公式正答 ${CIRCLES[q.correct]}</b><div class="explain">日本貸金業協会の正答表に基づく判定です。公式資料には個別の解説は掲載されていません。</div></div>`:''}
      </section>
      <div class="quiz-actions">
        <button class="secondary" id="prevBtn" ${session.current===0?'disabled':''}>前の問題</button>
        <button class="secondary" id="nextBtn">${session.current===session.questions.length-1?'結果へ':'次の問題'}</button>
        <button class="secondary" id="flagBtn">${flags.has(q.id)?'★ 後で見直す':'☆ 後で見直す'}</button>
        <button class="secondary" id="bookmarkBtn">${bookmarked.has(q.id)?'★ 保存済み':'☆ ブックマーク'}</button>
        <button class="danger wide" id="finishBtn">演習を終了して採点</button>
      </div>
      ${session.mode==='exam'?`<details class="navigator"><summary>問題一覧（回答済み ${Object.keys(session.answers).length}/${session.questions.length}）</summary><div class="qnav">${session.questions.map((x,i)=>`<button data-go="${i}" class="${session.answers[x.id]!=null?'done':''} ${i===session.current?'current':''} ${flags.has(x.id)?'flag':''}">${i+1}</button>`).join('')}</div></details>`:''}
      <div class="source-note">出典：${esc(q.source)}　<a href="${q.sourceUrl}" target="_blank" rel="noopener">公式ページ</a></div>`;
    $app.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>answerQuestion(Number(b.dataset.answer)));
    document.getElementById('prevBtn').onclick=()=>goTo(session.current-1);
    document.getElementById('nextBtn').onclick=()=>{
      if(session.current===session.questions.length-1) finishSession(); else goTo(session.current+1);
    };
    document.getElementById('finishBtn').onclick=finishSession;
    document.getElementById('flagBtn').onclick=()=>toggleFlag(q.id);
    document.getElementById('bookmarkBtn').onclick=()=>toggleBookmark(q.id);
    $app.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>goTo(Number(b.dataset.go)));
    if(session.duration)startTimer();
  }
  function answerQuestion(n){const q=session.questions[session.current];session.answers[q.id]=n;saveActive();renderQuiz()}
  function goTo(i){if(i<0||i>=session.questions.length)return;session.current=i;saveActive();renderQuiz()}
  function toggleFlag(id){const s=new Set(session.flags||[]);s.has(id)?s.delete(id):s.add(id);session.flags=[...s];saveActive();renderQuiz()}
  function toggleBookmark(id){const s=new Set(read(LS.bookmarks,[]));s.has(id)?s.delete(id):s.add(id);write(LS.bookmarks,[...s]);renderQuiz()}
  function startTimer(){
    const el=document.getElementById('timer');if(!el)return;
    const tick=()=>{const left=Math.max(0,session.duration-Math.floor((Date.now()-session.startedAt)/1000));const m=Math.floor(left/60),s=left%60;el.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;if(left<=0){clearTimer();toast('制限時間が終了しました');finishSession(true)}};
    tick();timerHandle=setInterval(tick,1000);
  }

  function finishSession(force=false){
    if(!session)return;
    const unanswered=session.questions.length-Object.keys(session.answers).length;
    if(!force&&unanswered&& !confirm(`未回答が${unanswered}問あります。採点しますか？`))return;
    clearTimer();session.finished=true;
    const stats=read(LS.stats,{});let score=0;
    for(const q of session.questions){const ok=session.answers[q.id]===q.correct;if(ok)score++;const st=stats[q.id]||{attempts:0,correct:0};st.attempts++;if(ok)st.correct++;st.last=Date.now();stats[q.id]=st}
    write(LS.stats,stats);
    const hist=read(LS.history,[]);hist.unshift({at:Date.now(),mode:session.mode,exam:session.exam,score,total:session.questions.length,passMark:session.passMark});write(LS.history,hist.slice(0,100));
    localStorage.removeItem(LS.active);renderResults(score);
  }

  function renderResults(score){
    setView('results');
    const total=session.questions.length,pct=Math.round(score/total*100),pass=session.mode==='exam'?score>=session.passMark:null;
    const groups={};for(const q of session.questions){const g=q.topic;groups[g]??={n:0,c:0};groups[g].n++;if(session.answers[q.id]===q.correct)groups[g].c++}
    const weak=Object.entries(groups).sort((a,b)=>(a[1].c/a[1].n)-(b[1].c/b[1].n)).slice(0,3);
    $app.innerHTML=`
      <h2 style="text-align:center;margin-top:4px">採点結果</h2>
      <div class="score-ring" style="--pct:${pct}%"><div class="inside"><strong>${score}/${total}</strong><span>正答率 ${pct}%</span></div></div>
      ${pass!==null?`<div class="verdict ${pass?'pass':'fail'}">${pass?'合格':'不合格'}</div><p class="subtle" style="text-align:center">第${session.exam}回の公式合格基準：${session.passMark}点／50点</p>`:`<div class="verdict">演習完了</div>`}
      <div class="card"><b>分野別結果</b><div class="breakdown" style="margin-top:12px">${Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0],'ja')).map(([g,v])=>`<div class="bar-row"><span>${esc(g)}<br><small>${v.c}/${v.n}</small></span><div class="bar-track"><i style="width:${v.c/v.n*100}%"></i></div></div>`).join('')}</div></div>
      <div class="notice ${pct<60?'warning':''}"><b>重点復習</b><br>${weak.map(([g,v])=>`${esc(g)}（${v.c}/${v.n}）`).join('、')}を優先して復習してください。</div>
      <div class="row"><button class="primary" id="retryBtn">${session.mode==='exam'?'もう一度同じ回を解く':'新しい問題を解く'}</button><button class="secondary" id="homeResult">ホームへ</button></div>
      <h2>全問題の回答一覧</h2>
      ${session.questions.map((q,i)=>{const a=session.answers[q.id],ok=a===q.correct;return `<details class="review-card" ${!ok?'open':''}><summary><span class="review-num ${ok?'ok':'bad'}">${i+1}</span><span style="flex:1"><b>${ok?'正解':'不正解'}</b><br><small class="subtle">第${q.exam}回 問${q.questionNo}・${esc(q.topic)}</small></span><span>${a?CIRCLES[a]:'未'} → ${CIRCLES[q.correct]}</span></summary><div class="review-body"><div class="review-text">${esc(q.text)}</div><div class="answer-line">あなたの回答：${a?CIRCLES[a]:'未回答'}　／　公式正答：${CIRCLES[q.correct]}</div><div class="source-note">個別解説は公式には掲載されていません。正答は日本貸金業協会の正答表に基づきます。</div></div></details>`}).join('')}
      ${sourceFooter()}`;
    document.getElementById('homeResult').onclick=renderHome;
    document.getElementById('retryBtn').onclick=()=>{const old=session;if(old.mode==='exam')startExam(old.exam);else startPractice(old.config||practiceConfig)};
  }

  function renderStats(){
    setView('stats');const stats=read(LS.stats,{}),hist=read(LS.history,[]);
    const group={};for(const q of DATA.questions){const s=stats[q.id];if(!s)continue;group[q.topic]??={a:0,c:0};group[q.topic].a+=s.attempts;group[q.topic].c+=s.correct}
    const attempts=Object.values(stats).reduce((n,s)=>n+s.attempts,0),correct=Object.values(stats).reduce((n,s)=>n+s.correct,0);
    $app.innerHTML=`<h2 style="margin-top:4px">成績・履歴</h2>
      <div class="hero" style="padding:17px"><div class="hero-stats" style="margin:0"><div class="hero-stat"><strong>${attempts}</strong><span>解答数</span></div><div class="hero-stat"><strong>${Object.keys(stats).length}</strong><span>学習済み問題</span></div><div class="hero-stat"><strong>${attempts?Math.round(correct/attempts*100):0}%</strong><span>正答率</span></div></div></div>
      <h2>細分類別</h2><div class="card">${Object.keys(group).length?Object.entries(group).sort((a,b)=>(a[1].c/a[1].a)-(b[1].c/b[1].a)).map(([g,v])=>`<div class="bar-row" style="margin:11px 0"><span>${esc(g)}<br><small>${v.c}/${v.a}</small></span><div class="bar-track"><i style="width:${v.c/v.a*100}%"></i></div></div>`).join(''):'<div class="empty">まだ学習履歴がありません。</div>'}</div>
      <h2>受験履歴</h2><div class="card">${hist.length?hist.slice(0,30).map(h=>`<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--line)"><span style="flex:1"><b>${h.mode==='exam'?`第${h.exam}回`:'ランダム演習'}</b><br><small class="subtle">${fmtDate(h.at)}</small></span><b>${h.score}/${h.total}</b>${h.mode==='exam'?`<span class="pass-chip">基準 ${h.passMark}</span>`:''}</div>`).join(''):'<div class="empty">履歴はありません。</div>'}</div>
      <button class="danger" id="resetAll">成績・出題履歴をすべて削除</button>${sourceFooter()}`;
    document.getElementById('resetAll').onclick=()=>{if(confirm('成績、受験履歴、重複防止用の出題履歴をすべて削除しますか？')){[LS.history,LS.stats,LS.seen,LS.active].forEach(k=>localStorage.removeItem(k));toast('削除しました');renderStats()}};
  }

  $home.onclick=()=>{if(view==='quiz'&&session&&!session.finished&&Object.keys(session.answers).length){if(!confirm('回答は端末に保存されます。ホームへ戻りますか？'))return}renderHome()};
  const sizes=[15,16,18,20];let fontIndex=Math.max(0,sizes.indexOf(read(LS.font,16)));document.documentElement.style.setProperty('--qfont',sizes[fontIndex]+'px');
  $font.onclick=()=>{fontIndex=(fontIndex+1)%sizes.length;const n=sizes[fontIndex];write(LS.font,n);document.documentElement.style.setProperty('--qfont',n+'px');toast(`問題文 ${n}px`)};
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  renderHome();
})();
