(() => {
  'use strict';
  const DATA = window.OFFICIAL_DATA;
  const $app = document.getElementById('app');
  const $home = document.getElementById('homeBtn');
  const $font = document.getElementById('fontBtn');
  const $theme = document.getElementById('themeBtn');
  const $toast = document.getElementById('toast');
  const $themeColor = document.getElementById('themeColor');
  const CIRCLES = ['', '①', '②', '③', '④'];
  const LS = {
    active:'kashikin.active.v3', history:'kashikin.history.v3', stats:'kashikin.stats.v3',
    seen:'kashikin.seen.v3', flags:'kashikin.flags.v3', bookmarks:'kashikin.bookmarks.v3',
    font:'kashikin.font.v3', theme:'kashikin.theme.v3'
  };
  const qById = new Map(DATA.questions.map(q => [q.id, q]));
  let view = 'home';
  let session = null;
  let timerHandle = null;
  let practiceConfig = {count:20, section:'all', topic:'all', feedback:true};

  const TOPIC_GUIDES = {
    '貸金業法':'貸金業法では、登録・主任者配置・契約書面・広告勧誘・取立て・帳簿保存などについて、主体、期限、記載事項、例外の区別が重要です。',
    '信用情報':'指定信用情報機関への照会・提供は、加入貸金業者の義務、本人同意、登録情報、保存期間、返済能力調査との関係を分けて整理します。',
    '総量規制・返済能力調査':'個人向け貸付けでは年収等の3分の1基準、除外貸付け・例外貸付け、収入証明書の要否、指定信用情報機関の利用を区別します。',
    '利息制限法':'元本額ごとの上限利率、遅延損害金、みなし利息、営業的金銭消費貸借の特則を、金額と例外まで正確に確認します。',
    '出資法':'出資法では刑事罰の対象となる上限金利や、預り金・媒介手数料等の規制を、利息制限法の民事上の効力と混同しないことが重要です。',
    '民法':'民法では契約成立、意思表示、代理、保証、債権譲渡、相殺、時効、担保などについて、要件と効果、当事者間と第三者との関係を整理します。',
    '民事手続':'民事訴訟・執行・保全では、管轄、債務名義、差押え、取立権、配当、申立ての要件と手続の順序を確認します。',
    '倒産法':'破産・民事再生等では、手続開始の効果、届出、相殺、否認、担保権、免責の範囲を区別します。',
    '商法・会社法':'商法・会社法では商行為、商人、会社機関、代表権、計算書類、株主・取締役の権限と責任を整理します。',
    '個人情報保護法':'個人情報・個人データ・保有個人データの違い、利用目的、第三者提供、安全管理、開示等請求の要件を確認します。',
    '消費者契約法':'消費者契約法では不実告知、断定的判断、困惑類型、取消権、無効となる条項、期間制限を区別します。',
    'その他の消費者保護':'消費者保護関連法では、適用対象、表示・勧誘規制、解除・取消し、事業者の義務を法律ごとに整理します。',
    '資金需要者保護':'資金需要者保護では、苦情処理、貸付自粛、個人情報、広告・勧誘、取立て等の実務上の保護措置を確認します。',
    '貸金業協会・紛争解決':'日本貸金業協会と金融ADRでは、加入・手続実施基本契約、苦情処理、紛争解決、規則・処分の主体を区別します。',
    '財務・会計':'財務・会計では、資産・負債・純資産、収益・費用、流動・固定区分、引当金、財務指標の定義と計算を確認します。'
  };

  function read(key, fallback){ try{ const v=localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }catch{ return fallback; } }
  function write(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
  function esc(s=''){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function shuffle(a){ const x=[...a]; for(let i=x.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [x[i],x[j]]=[x[j],x[i]]; } return x; }
  function toast(msg){ $toast.textContent=msg; $toast.classList.add('show'); setTimeout(()=>$toast.classList.remove('show'),1800); }
  function fmtDate(ts){ return new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(ts)); }
  function clearTimer(){ if(timerHandle){ clearInterval(timerHandle); timerHandle=null; } }
  function setView(v, scroll=true){ const changed=view!==v; view=v; $home.hidden=v==='home'; clearTimer(); if(scroll && changed) window.scrollTo({top:0,behavior:'instant'}); }
  function sourceFooter(){ return `<div class="footer-note">出典：日本貸金業協会「貸金業務取扱主任者資格試験問題」「試験問題の正答」。<br><a href="${DATA.archiveUrl}" target="_blank" rel="noopener">公式の過去問題ページを開く</a></div>`; }

  function saveActive(){
    if(!session) return localStorage.removeItem(LS.active);
    const copy={...session,questionIds:session.questions.map(q=>q.id)}; delete copy.questions;
    write(LS.active,copy);
  }
  function restoreActive(){
    const s=read(LS.active,null); if(!s||!Array.isArray(s.questionIds)) return null;
    const qs=s.questionIds.map(id=>qById.get(id)).filter(Boolean); if(qs.length!==s.questionIds.length) return null;
    delete s.questionIds; s.questions=qs; return s;
  }

  function compactText(raw){
    const lines=String(raw||'').replace(/\r/g,'').replace(/\u3000/g,' ').split('\n').map(x=>x.replace(/[ \t]+/g,' ').trim()).filter(Boolean);
    let out='';
    for(const line of lines){
      const listStart=/^(?:[ａｂｃｄＡＢＣＤabcdABCD](?:[.．、）)]?)(?:\s|$)|[①②③④](?:\s|$))/.test(line);
      const addSpace=out && /[A-Za-z0-9]$/.test(out) && /^[A-Za-z0-9]/.test(line);
      out += out ? (listStart?'\n':(addSpace?' ':'')) : '';
      out += line;
    }
    return out.replace(/[ \t]{2,}/g,' ').trim();
  }

  function parseQuestion(q){
    const text=compactText(q.text);
    const marks=[...text.matchAll(/[①②③④]/g)].map(m=>({pos:m.index,label:m[0]}));
    let startIndex=-1;
    for(let i=0;i<=marks.length-4;i++){
      if(marks.slice(i,i+4).map(x=>x.label).join('')==='①②③④') startIndex=i;
    }
    if(startIndex<0) return {stem:text,choices:[]};
    const seq=marks.slice(startIndex,startIndex+4);
    const stem=text.slice(0,seq[0].pos).trim().replace(/[、，]?\s*$/,'');
    const choices=seq.map((m,i)=>{
      const end=i<3?seq[i+1].pos:text.length;
      return text.slice(m.pos+1,end).trim().replace(/^[:：、．.）)]\s*/,'');
    });
    return {stem,choices};
  }

  function formatStemHtml(stem){
    const chunks=[];
    const re=/(^|\s)([ａｂｃｄＡＢＣＤabcd])(?:[\.．、）)]?)[ \t]+/g;
    const matches=[...stem.matchAll(re)];
    if(!matches.length) return `<div class="stem">${esc(stem)}</div>`;
    const firstPos=matches[0].index+(matches[0][1]?matches[0][1].length:0);
    const prefix=stem.slice(0,firstPos).trim();
    if(prefix) chunks.push({type:'stem',text:prefix});
    for(let i=0;i<matches.length;i++){
      const m=matches[i];
      const bodyStart=m.index+m[0].length;
      const next=matches[i+1];
      const bodyEnd=next ? next.index+(next[1]?next[1].length:0) : stem.length;
      const body=stem.slice(bodyStart,bodyEnd).trim();
      chunks.push({type:'sub',label:m[2],text:body});
    }
    return chunks.map(x=>x.type==='sub'
      ? `<div class="substatement"><span class="sub-label">${esc(x.label)}</span><span>${esc(x.text)}</span></div>`
      : `<div class="stem">${esc(x.text)}</div>`).join('');
  }

  function questionHtml(q, compact=false){
    const p=parseQuestion(q);
    if(compact) return `<div class="review-question">${formatStemHtml(p.stem)}${p.choices.length?`<div class="choices-view">${p.choices.map((c,i)=>`<div class="choice-view"><span class="choice-symbol">${CIRCLES[i+1]}</span><div class="choice-body">${esc(c)}</div></div>`).join('')}</div>`:''}</div>`;
    return `<div class="question-text">${formatStemHtml(p.stem)}${p.choices.length?`<div class="choices-view">${p.choices.map((c,i)=>`<div class="choice-view"><span class="choice-symbol">${CIRCLES[i+1]}</span><div class="choice-body">${esc(c)}</div></div>`).join('')}</div>`:''}</div>`;
  }

  function negativeQuestion(stem){ return /適切でない|正しくない|誤っている|妥当でない|不適切/.test(stem); }
  function comboQuestion(stem){ return /個数|組み合わせ|組合せ|正誤の組/.test(stem); }
  function riskyPhrases(text){
    const rules=['必ず','常に','一切','のみ','直ちに','含まれない','必要はない','できない','ならない','超える','未満','以内','以上','以下'];
    const found=rules.filter(x=>text.includes(x));
    const nums=[...text.matchAll(/\d+(?:[,.]\d+)?\s*(?:日|月|年|分の\d+|％|%|万円|円|人)/g)].map(x=>x[0]);
    return [...new Set([...found,...nums])].slice(0,4);
  }
  function correctedSuggestion(text){
    const replacements=[
      [/必要はない/g,'必要となる場合がある'],[/含まれない/g,'含まれる場合がある'],[/できない/g,'要件を満たせばできる'],
      [/一切/g,'原則として'],[/常に/g,'原則として'],[/必ず/g,'法定要件を満たす場合に'],[/直ちに/g,'法定の時期・期限に従って'],
      [/のみ/g,'に限られない']
    ];
    let s=text;
    for(const [a,b] of replacements){ if(a.test(s)){ s=s.replace(a,b); break; } }
    if(s===text) return 'この記述は、主体・要件・期限・数値・例外のいずれかが法令上の扱いと一致しません。公式正答の選択肢と対比して、条件を限定して覚えてください。';
    return `断定部分を修正すると、概ね「${s}」という方向で理解します。ただし、正確な要件は関連条文で確認してください。`;
  }
  function aiUrl(q){ return `https://kakomonai.com/kashinkin/practice/r${q.exam}/q${String(q.questionNo).padStart(2,'0')}/`; }

  function explanationHtml(q, selected=null){
    const p=parseQuestion(q), correctText=p.choices[q.correct-1]||`選択肢${q.correct}`;
    const neg=negativeQuestion(p.stem), combo=comboQuestion(p.stem);
    const selectedText=selected ? (p.choices[selected-1]||`選択肢${selected}`) : '';
    const guide=TOPIC_GUIDES[q.topic]||'この問題では、法令上の主体、要件、期限、数値、例外を正確に区別することが重要です。';
    const phrases=riskyPhrases(selectedText||correctText);
    let quoteLabel='正しい選択肢';
    let quoteText=correctText;
    let correction='';

    if(combo){
      quoteLabel='公式正答';
      correction=`${CIRCLES[q.correct]}「${correctText}」が公式正答です。設問中の各記述を一つずつ正誤判定し、その個数または組合せがこの選択肢と一致します。`;
    }else if(neg){
      quoteLabel='問題文中の誤った記述';
      correction=correctedSuggestion(correctText);
    }else if(selected && selected!==q.correct){
      quoteLabel='選んだ選択肢のうち誤っている記述';
      quoteText=selectedText;
      correction=`正しい選択肢は${CIRCLES[q.correct]}です。「${correctText}」が設問の条件に合致します。${correctedSuggestion(selectedText)}`;
    }else{
      correction=`${CIRCLES[q.correct]}の記述が、設問で問われている法令上の要件に合致します。${guide}`;
    }

    return `<div class="explanation-card">
      <h3>AI補助解説</h3>
      <div class="explanation-block"><div class="explanation-label">${esc(quoteLabel)}</div><div class="quote">「${esc(quoteText)}」</div></div>
      <div class="explanation-block"><div class="explanation-label">正しい内容・考え方</div><div class="correction">${esc(correction)}</div></div>
      <div class="explanation-block"><div class="explanation-label">この問題の確認ポイント</div><div class="correction">${esc(guide)}${phrases.length?` 特に「${esc(phrases.join('」「'))}」の断定・数値・期限に注意してください。`:''}</div></div>
      <a class="ai-link" href="${aiUrl(q)}" target="_blank" rel="noopener">選択肢別の詳しいAI解説を開く ↗</a>
      <div class="ai-note">内蔵解説は公式正答と問題文を基に自動生成した学習補助で、専門家監修ではありません。法改正や旧法問題を含むため、疑義がある場合は現行法令・公式資料を優先してください。</div>
    </div>`;
  }

  function renderHome(){
    setView('home'); session=null;
    const hist=read(LS.history,[]), stats=read(LS.stats,{});
    const attempts=Object.values(stats).reduce((n,s)=>n+(s.attempts||0),0);
    const correct=Object.values(stats).reduce((n,s)=>n+(s.correct||0),0);
    const active=restoreActive(); const recent=hist.slice(0,3);
    $app.innerHTML=`
      <section class="hero"><h1>公式過去問を、見やすく毎日。</h1><p>第1回〜第20回の全1,000問を収録。iPhone 17 Proの6.3インチ画面を基準に、問題文・選択肢・操作ボタンを読みやすく配置しています。</p>
        <div class="hero-stats"><div class="hero-stat"><strong>1,000</strong><span>収録問題</span></div><div class="hero-stat"><strong>${attempts}</strong><span>解答数</span></div><div class="hero-stat"><strong>${attempts?Math.round(correct/attempts*100):0}%</strong><span>総正答率</span></div></div>
      </section>
      ${active?`<div class="notice"><b>途中の演習があります</b><br>${active.mode==='exam'?`第${active.exam}回 過去問`:`ランダム${active.questions.length}問`}・問題${active.current+1}まで進行中。<br><button class="primary" style="margin-top:10px" id="resumeBtn">続きから再開</button></div>`:''}
      <h2>学習モード</h2><div class="grid">
        <button class="menu-card" id="pastBtn"><span class="menu-icon">📝</span><b>回別過去問</b><span>各回50問を公式の問題順で解く。各回の実際の合格基準で判定。</span></button>
        <button class="menu-card" id="practiceBtn"><span class="menu-icon">🎲</span><b>重複なし演習</b><span>分野・問題数を選択。未出題問題を優先して出題。</span></button>
        <button class="menu-card" id="wrongBtn"><span class="menu-icon">↻</span><b>間違い復習</b><span>過去に誤答した問題だけを最大20問出題。</span></button>
        <button class="menu-card" id="statsBtn"><span class="menu-icon">📊</span><b>成績・履歴</b><span>分野別正答率と直近の受験結果を確認。</span></button>
      </div>
      ${recent.length?`<h2>最近の結果</h2><div class="card">${recent.map(h=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><span>${h.mode==='exam'?`第${h.exam}回`:'ランダム演習'} <small class="subtle">${fmtDate(h.at)}</small></span><b>${h.score}/${h.total}</b></div>`).join('')}</div>`:''}
      ${sourceFooter()}`;
    document.getElementById('pastBtn').onclick=renderPastList;
    document.getElementById('practiceBtn').onclick=renderPracticeSetup;
    document.getElementById('wrongBtn').onclick=startWrongReview;
    document.getElementById('statsBtn').onclick=renderStats;
    if(active) document.getElementById('resumeBtn').onclick=()=>{session=active;renderQuiz(false);};
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
      <div class="notice">選んだ条件ごとに出題済みIDを端末内へ保存し、未出題問題を優先します。対象問題を一巡した場合だけ、新しい周回を始めます。</div>
      <div class="card">
        <div class="field"><label>問題数</label><div class="seg" id="countSeg">${[10,20,30,50].map(n=>`<button data-count="${n}" class="${practiceConfig.count===n?'active':''}">${n}問</button>`).join('')}</div></div>
        <div class="field"><label>公式4科目</label><select id="sectionSel"><option value="all">すべて</option>${sections.map(s=>`<option ${practiceConfig.section===s?'selected':''}>${esc(s)}</option>`).join('')}</select></div>
        <div class="field"><label>細分類</label><select id="topicSel"><option value="all">すべて</option>${topics.map(s=>`<option ${practiceConfig.topic===s?'selected':''}>${esc(s)}</option>`).join('')}</select></div>
        <div class="field"><label>回答後の表示</label><select id="feedbackSel"><option value="yes" ${practiceConfig.feedback?'selected':''}>その場で正誤と解説を表示</option><option value="no" ${!practiceConfig.feedback?'selected':''}>最後にまとめて採点</option></select></div>
        <div id="poolInfo" class="subtle" style="margin-bottom:14px"></div>
        <button class="primary" id="startPractice">演習を始める</button>
        <button class="secondary" id="resetSeen" style="margin-top:10px">この条件の出題履歴をリセット</button>
      </div>`;
    function configNow(){ return {count:practiceConfig.count,section:document.getElementById('sectionSel').value,topic:document.getElementById('topicSel').value,feedback:document.getElementById('feedbackSel').value==='yes'}; }
    function key(c){return `${c.section}|${c.topic}`;}
    function update(){ const c=configNow(), pool=eligible(c), used=new Set(seen[key(c)]||[]), left=pool.filter(q=>!used.has(q.id)).length; document.getElementById('poolInfo').textContent=`対象 ${pool.length}問／未出題 ${left}問`; }
    $app.querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{practiceConfig.count=Number(b.dataset.count);$app.querySelectorAll('[data-count]').forEach(x=>x.classList.toggle('active',x===b));update();});
    ['sectionSel','topicSel'].forEach(id=>document.getElementById(id).onchange=update);
    document.getElementById('startPractice').onclick=()=>{practiceConfig=configNow();startPractice(practiceConfig);};
    document.getElementById('resetSeen').onclick=()=>{const c=configNow();delete seen[key(c)];write(LS.seen,seen);toast('出題履歴をリセットしました');update();};
    update();
  }

  function eligible(c){ return DATA.questions.filter(q=>(c.section==='all'||q.section===c.section)&&(c.topic==='all'||q.topic===c.topic)); }
  function seenKey(c){ return `${c.section}|${c.topic}`; }
  function chooseNoRepeat(c){
    const pool=eligible(c); if(!pool.length) return [];
    const seen=read(LS.seen,{}), key=seenKey(c), used=new Set(seen[key]||[]), take=Math.min(c.count,pool.length);
    const fresh=shuffle(pool.filter(q=>!used.has(q.id))); let chosen=[];
    if(fresh.length>=take){ chosen=fresh.slice(0,take); seen[key]=[...(seen[key]||[]),...chosen.map(q=>q.id)]; }
    else{
      chosen=[...fresh]; const picked=new Set(chosen.map(q=>q.id)); const fill=shuffle(pool.filter(q=>!picked.has(q.id))).slice(0,take-chosen.length);
      chosen.push(...fill); seen[key]=fill.map(q=>q.id);
    }
    seen[key]=[...new Set(seen[key])].slice(-pool.length); write(LS.seen,seen); return chosen;
  }

  function newSession(opts){
    clearTimer();
    session={mode:opts.mode,exam:opts.exam||null,passMark:opts.passMark||null,questions:opts.questions,current:0,answers:{},flags:[],feedback:!!opts.feedback,startedAt:Date.now(),duration:opts.duration||null,finished:false,config:opts.config||null};
    saveActive(); renderQuiz(false);
  }
  function startExam(exam){ const meta=DATA.exams.find(e=>e.exam===exam), qs=DATA.questions.filter(q=>q.exam===exam).sort((a,b)=>a.questionNo-b.questionNo); newSession({mode:'exam',exam,passMark:meta.passMark,questions:qs,feedback:false,duration:120*60}); }
  function startPractice(c){ const qs=chooseNoRepeat(c); if(!qs.length){toast('対象問題がありません');return;} newSession({mode:'practice',questions:qs,feedback:c.feedback,config:c}); }
  function startWrongReview(){
    const stats=read(LS.stats,{}); let qs=DATA.questions.filter(q=>stats[q.id]&&stats[q.id].attempts>stats[q.id].correct);
    qs=shuffle(qs).slice(0,20); if(!qs.length){toast('間違えた問題はまだありません');return;}
    newSession({mode:'practice',questions:qs,feedback:true,config:{count:qs.length,section:'wrong',topic:'wrong',feedback:true}});
  }

  function renderQuiz(preserveScroll=false, revealFeedback=false){
    const y=window.scrollY;
    setView('quiz',!preserveScroll); if(!session||!session.questions.length) return renderHome();
    const q=session.questions[session.current], answer=session.answers[q.id], isAnswered=answer!=null;
    const showFeedback=session.feedback&&isAnswered, correct=answer===q.correct;
    const flags=new Set(session.flags||[]), bookmarked=new Set(read(LS.bookmarks,[]));
    $app.innerHTML=`
      <div class="quiz-head"><div class="grow"><b>${session.mode==='exam'?`第${session.exam}回 過去問`:`重複なし演習 ${session.questions.length}問`}</b><small>問題 ${session.current+1} / ${session.questions.length}</small></div>${session.duration?'<span class="timer" id="timer">--:--</span>':''}</div>
      <div class="progress"><div style="width:${(session.current+1)/session.questions.length*100}%"></div></div>
      <section class="question-card">
        <div class="question-top"><div class="q-tags"><span class="tag">${esc(q.section)}</span><span class="tag">${esc(q.topic)}</span><span class="tag">第${q.exam}回 問${q.questionNo}</span></div><div class="tool-stack"><button class="mini-tool ${flags.has(q.id)?'active':''}" id="flagBtn" aria-label="後で見直す">${flags.has(q.id)?'★':'☆'}</button><button class="mini-tool ${bookmarked.has(q.id)?'active':''}" id="bookmarkBtn" aria-label="ブックマーク">🔖</button></div></div>
        ${questionHtml(q)}
        <div class="answer-title">解答を選択</div>
        <div class="answer-grid">${[1,2,3,4].map(n=>{let cl='answer-btn';if(answer===n)cl+=' selected';if(showFeedback&&n===q.correct)cl+=' correct';if(showFeedback&&answer===n&&n!==q.correct)cl+=' wrong';return `<button class="${cl}" data-answer="${n}" ${showFeedback?'disabled':''}>${CIRCLES[n]}</button>`;}).join('')}</div>
        ${showFeedback?`<div class="feedback ${correct?'ok':'bad'}" id="feedbackBox" aria-live="assertive"><div class="result-mark">${correct?'○':'×'}</div><div class="feedback-title">${correct?'正解':'不正解'}</div><div class="feedback-answer">あなたの回答 ${CIRCLES[answer]} ／ 公式正答 ${CIRCLES[q.correct]}</div>${explanationHtml(q,answer)}</div>`:''}
      </section>
      <div class="quiz-nav"><button class="nav-btn nav-prev" id="prevBtn" ${session.current===0?'disabled':''}>‹ 前の問題</button><span class="nav-count">${session.current+1}/${session.questions.length}</span><button class="nav-btn nav-next" id="nextBtn">${session.current===session.questions.length-1?'結果へ':'次の問題 ›'}</button></div>
      <div class="session-tools">
        ${session.mode==='exam'?`<details class="navigator"><summary>問題一覧（回答済み ${Object.keys(session.answers).length}/${session.questions.length}）</summary><div class="qnav">${session.questions.map((x,i)=>`<button data-go="${i}" class="${session.answers[x.id]!=null?'done':''} ${i===session.current?'current':''} ${flags.has(x.id)?'flag':''}">${i+1}</button>`).join('')}</div></details>`:''}
        <button class="finish-link" id="finishBtn">演習を終了して採点</button>
      </div>
      <div class="source-note">出典：${esc(q.source)}　<a href="${q.sourceUrl}" target="_blank" rel="noopener">公式ページ</a></div>`;
    $app.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>answerQuestion(Number(b.dataset.answer)));
    document.getElementById('prevBtn').onclick=()=>goTo(session.current-1);
    document.getElementById('nextBtn').onclick=()=>session.current===session.questions.length-1?finishSession():goTo(session.current+1);
    document.getElementById('finishBtn').onclick=()=>finishSession();
    document.getElementById('flagBtn').onclick=()=>toggleFlag(q.id);
    document.getElementById('bookmarkBtn').onclick=()=>toggleBookmark(q.id);
    $app.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>goTo(Number(b.dataset.go)));
    if(preserveScroll) requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'instant'}));
    if(revealFeedback) setTimeout(()=>document.getElementById('feedbackBox')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
    if(session.duration) startTimer();
  }
  function answerQuestion(n){ const q=session.questions[session.current]; session.answers[q.id]=n; saveActive(); renderQuiz(true,true); }
  function goTo(i){ if(i<0||i>=session.questions.length)return; session.current=i; saveActive(); renderQuiz(false); }
  function toggleFlag(id){ const s=new Set(session.flags||[]); s.has(id)?s.delete(id):s.add(id); session.flags=[...s]; saveActive(); renderQuiz(true); }
  function toggleBookmark(id){ const s=new Set(read(LS.bookmarks,[])); s.has(id)?s.delete(id):s.add(id); write(LS.bookmarks,[...s]); renderQuiz(true); }
  function startTimer(){
    const el=document.getElementById('timer'); if(!el)return;
    const tick=()=>{const left=Math.max(0,session.duration-Math.floor((Date.now()-session.startedAt)/1000)),m=Math.floor(left/60),s=left%60;el.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;if(left<=0){clearTimer();toast('制限時間が終了しました');finishSession(true);}};
    tick(); timerHandle=setInterval(tick,1000);
  }

  function finishSession(force=false){
    if(!session)return;
    const unanswered=session.questions.length-Object.keys(session.answers).length;
    if(!force&&unanswered&&!confirm(`未回答が${unanswered}問あります。採点しますか？`)) return;
    clearTimer(); session.finished=true;
    const stats=read(LS.stats,{}); let score=0;
    for(const q of session.questions){const ok=session.answers[q.id]===q.correct;if(ok)score++;const st=stats[q.id]||{attempts:0,correct:0};st.attempts++;if(ok)st.correct++;st.last=Date.now();stats[q.id]=st;}
    write(LS.stats,stats);
    const hist=read(LS.history,[]); hist.unshift({at:Date.now(),mode:session.mode,exam:session.exam,score,total:session.questions.length,passMark:session.passMark}); write(LS.history,hist.slice(0,100));
    localStorage.removeItem(LS.active); renderResults(score);
  }

  function renderResults(score){
    setView('results');
    const total=session.questions.length,pct=Math.round(score/total*100),pass=session.mode==='exam'?score>=session.passMark:null;
    const groups={}; for(const q of session.questions){const g=q.topic;groups[g]??={n:0,c:0};groups[g].n++;if(session.answers[q.id]===q.correct)groups[g].c++;}
    const weak=Object.entries(groups).sort((a,b)=>(a[1].c/a[1].n)-(b[1].c/b[1].n)).slice(0,3);
    $app.innerHTML=`
      <h2 style="text-align:center;margin-top:4px">採点結果</h2>
      <div class="score-ring" style="--pct:${pct}%"><div class="inside"><strong>${score}/${total}</strong><span>正答率 ${pct}%</span></div></div>
      ${pass!==null?`<div class="verdict ${pass?'pass':'fail'}">${pass?'合格':'不合格'}</div><p class="subtle" style="text-align:center">第${session.exam}回の公式合格基準：${session.passMark}点／50点</p>`:`<div class="verdict">演習完了</div>`}
      <div class="card"><b>分野別結果</b><div class="breakdown" style="margin-top:12px">${Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0],'ja')).map(([g,v])=>`<div class="bar-row"><span>${esc(g)}<br><small>${v.c}/${v.n}</small></span><div class="bar-track"><i style="width:${v.c/v.n*100}%"></i></div></div>`).join('')}</div></div>
      <div class="notice ${pct<60?'warning':''}"><b>重点復習</b><br>${weak.map(([g,v])=>`${esc(g)}（${v.c}/${v.n}）`).join('、')}を優先して復習してください。</div>
      <div class="row"><button class="primary" id="retryBtn">${session.mode==='exam'?'もう一度同じ回を解く':'新しい問題を解く'}</button><button class="secondary" id="homeResult">ホームへ</button></div>
      <h2>全問題の回答一覧</h2>
      ${session.questions.map((q,i)=>{const a=session.answers[q.id],ok=a===q.correct;return `<details class="review-card" ${!ok?'open':''}><summary><span class="review-num ${ok?'ok':'bad'}">${i+1}</span><span style="flex:1"><b>${ok?'正解':'不正解'}</b><br><small class="subtle">第${q.exam}回 問${q.questionNo}・${esc(q.topic)}</small></span><span>${a?CIRCLES[a]:'未'} → ${CIRCLES[q.correct]}</span></summary><div class="review-body">${questionHtml(q,true)}<div class="answer-line">あなたの回答：${a?CIRCLES[a]:'未回答'}　／　公式正答：${CIRCLES[q.correct]}</div>${explanationHtml(q,a||null)}</div></details>`;}).join('')}
      ${sourceFooter()}`;
    document.getElementById('homeResult').onclick=renderHome;
    document.getElementById('retryBtn').onclick=()=>{const old=session;if(old.mode==='exam')startExam(old.exam);else startPractice(old.config||practiceConfig);};
  }

  function renderStats(){
    setView('stats'); const stats=read(LS.stats,{}), hist=read(LS.history,[]), group={};
    for(const q of DATA.questions){const s=stats[q.id];if(!s)continue;group[q.topic]??={a:0,c:0};group[q.topic].a+=s.attempts;group[q.topic].c+=s.correct;}
    const attempts=Object.values(stats).reduce((n,s)=>n+s.attempts,0),correct=Object.values(stats).reduce((n,s)=>n+s.correct,0);
    $app.innerHTML=`<h2 style="margin-top:4px">成績・履歴</h2>
      <div class="hero" style="padding:17px"><div class="hero-stats" style="margin:0"><div class="hero-stat"><strong>${attempts}</strong><span>解答数</span></div><div class="hero-stat"><strong>${Object.keys(stats).length}</strong><span>学習済み問題</span></div><div class="hero-stat"><strong>${attempts?Math.round(correct/attempts*100):0}%</strong><span>正答率</span></div></div></div>
      <h2>細分類別</h2><div class="card">${Object.keys(group).length?Object.entries(group).sort((a,b)=>(a[1].c/a[1].a)-(b[1].c/b[1].a)).map(([g,v])=>`<div class="bar-row" style="margin:11px 0"><span>${esc(g)}<br><small>${v.c}/${v.a}</small></span><div class="bar-track"><i style="width:${v.c/v.a*100}%"></i></div></div>`).join(''):'<div class="empty">まだ学習履歴がありません。</div>'}</div>
      <h2>受験履歴</h2><div class="card">${hist.length?hist.slice(0,30).map(h=>`<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--line)"><span style="flex:1"><b>${h.mode==='exam'?`第${h.exam}回`:'ランダム演習'}</b><br><small class="subtle">${fmtDate(h.at)}</small></span><b>${h.score}/${h.total}</b>${h.mode==='exam'?`<span class="pass-chip">基準 ${h.passMark}</span>`:''}</div>`).join(''):'<div class="empty">履歴はありません。</div>'}</div>
      <button class="danger" id="resetAll">成績・出題履歴をすべて削除</button>${sourceFooter()}`;
    document.getElementById('resetAll').onclick=()=>{if(confirm('成績、受験履歴、重複防止用の出題履歴をすべて削除しますか？')){[LS.history,LS.stats,LS.seen,LS.active].forEach(k=>localStorage.removeItem(k));toast('削除しました');renderStats();}};
  }

  function applyTheme(mode){
    const dark=mode==='dark'||(mode==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);
    document.documentElement.dataset.theme=dark?'dark':'light';
    $themeColor.setAttribute('content',dark?'#0d1312':'#0b5b4b');
    $theme.setAttribute('aria-label',dark?'ライトモードに切替':'ダークモードに切替');
    $theme.innerHTML=dark?'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.8 6.8 0 0 0 21 12.8Z"></path></svg>';
  }

  $home.onclick=()=>{if(view==='quiz'&&session&&!session.finished&&Object.keys(session.answers).length){if(!confirm('回答は端末に保存されます。ホームへ戻りますか？'))return;}renderHome();};
  const sizes=[16,17,18,20]; let fontIndex=Math.max(0,sizes.indexOf(read(LS.font,17))); document.documentElement.style.setProperty('--qfont',sizes[fontIndex]+'px');
  $font.onclick=()=>{fontIndex=(fontIndex+1)%sizes.length;const n=sizes[fontIndex];write(LS.font,n);document.documentElement.style.setProperty('--qfont',n+'px');toast(`問題文 ${n}px`);};
  let themeMode=read(LS.theme,'system'); applyTheme(themeMode);
  $theme.onclick=()=>{const isDark=document.documentElement.dataset.theme==='dark';themeMode=isDark?'light':'dark';write(LS.theme,themeMode);applyTheme(themeMode);toast(themeMode==='dark'?'ダークモード':'ライトモード');};
  matchMedia('(prefers-color-scheme:dark)').addEventListener?.('change',()=>{if(read(LS.theme,'system')==='system')applyTheme('system');});
  if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  renderHome();
})();
