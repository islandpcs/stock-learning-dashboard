// ── 날짜 표시 ──
const d = new Date();
document.getElementById('headerDate').textContent =
  d.toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'});

// ── 탭 전환 ──
function switchTab(id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('#panel-' + id).classList.add('active');
  event.target.classList.add('active');
  // 지식창고 탭 진입 시 항상 재렌더링
  if (id === 'knowledge') {
    setTimeout(initKnowledge, 50); // 패널 표시 후 렌더링
  }
  // 관심종목 탭 진입 시 재렌더링
  if (id === 'watchlist') renderWatchList();
  // 투자일지 탭 진입 시 재렌더링
  if (id === 'journal') { renderJournal(); updateJournalStats(); }
  if (id === 'swing') swRender();
}

// ── 루틴 토글 ──
function toggleRoutine(id) {
  document.getElementById(id).classList.toggle('open');
}

// ══════════════════════════════════════════
// ✅ 체크리스트 - 날짜별 자동 초기화 + 달성률
// ══════════════════════════════════════════

// 로컬(KST) 날짜 — toISOString()은 UTC라 KST 09:00 전에는 전날로 계산됨
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
const TODAY = ymd(new Date()); // YYYY-MM-DD

// ── 날짜 체크 → 새 날이면 어제 기록 저장 후 초기화 ──
function checkDailyReset() {
  const lastDate = localStorage.getItem('routine_last_date');
  if (lastDate && lastDate !== TODAY) {
    // 어제 기록 히스토리에 저장
    saveRoutineHistory(lastDate);
    // 체크리스트 초기화
    ['checklist-morning','checklist-midday','checklist-evening','rules-today'].forEach(id => {
      localStorage.setItem(id, '{}');
    });
  }
  localStorage.setItem('routine_last_date', TODAY);
}

// ── 루틴 히스토리 저장 ──
function saveRoutineHistory(date) {
  const history = JSON.parse(localStorage.getItem('routine_history') || '{}');
  const m = countDone('checklist-morning'), d = countDone('checklist-midday'), ev = countDone('checklist-evening');
  const pct = (a,b) => b ? Math.round(a/b*100) : 0;
  const rate = pct(m.done+d.done+ev.done, m.total+d.total+ev.total);
  const rs = getRuleState();
  const rulesNg = FORBIDDEN_RULES.filter(r => rs[r]==='ng').length;
  const rulesOk = FORBIDDEN_RULES.filter(r => rs[r]==='ok').length;
  history[date] = { rate, morning: pct(m.done,m.total), midday: pct(d.done,d.total), evening: pct(ev.done,ev.total), rulesOk, rulesNg };
  localStorage.setItem('routine_history', JSON.stringify(history));
}

// ── 오늘 달성률 계산 & UI 업데이트 ──
function updateRoutineRate() {
  const m = countDone('checklist-morning'), d = countDone('checklist-midday'), ev = countDone('checklist-evening');
  const mDone = m.done, dDone = d.done, eDone = ev.done;
  const mTotal = m.total, dTotal = d.total, eTotal = ev.total;
  const mRate = Math.round(mDone / mTotal * 100);
  const dRate = Math.round(dDone / dTotal * 100);
  const eRate = Math.round(eDone / eTotal * 100);
  const total = Math.round((mDone + dDone + eDone) / (mTotal + dTotal + eTotal) * 100);

  // 숫자 업데이트
  const set = (id, val, barId, color) => {
    const el = document.getElementById(id); if(el) el.textContent = val + '%';
    const bar = document.getElementById(barId); if(bar) bar.style.width = val + '%';
  };
  set('total-rate',   total, 'total-bar');
  set('morning-rate', mRate, 'morning-bar');
  set('midday-rate',  dRate, 'midday-bar');
  set('evening-rate', eRate, 'evening-bar');

  // 색상 변경
  const totalEl = document.getElementById('total-rate');
  if (totalEl) totalEl.style.color = total >= 80 ? 'var(--accent)' : total >= 50 ? 'var(--gold)' : 'var(--red)';

  // 섹션별 진행 표시
  const rp = (id, done, total) => {
    const el = document.getElementById(id);
    if (el) el.textContent = done + '/' + total + ' 완료';
  };
  rp('r1-progress', mDone, mTotal);
  rp('r2-progress', dDone, dTotal);
  rp('r3-progress', eDone, eTotal);

  // 스트릭 계산
  updateStreak();
}

// ── 연속 달성 스트릭 ──
function updateStreak() {
  const history = JSON.parse(localStorage.getItem('routine_history') || '{}');
  const dates = Object.keys(history).sort().reverse();

  let streak = 0;
  let checkDate = new Date(TODAY);
  checkDate.setDate(checkDate.getDate() - 1); // 어제부터 체크

  for (let i = 0; i < 365; i++) {
    const ds = checkDate.toISOString().split('T')[0];
    if (history[ds] && history[ds].rate >= 50) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else break;
  }

  // 이번 주 (월~일)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  let weekCount = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const ds = ymd(d);
    if (history[ds] && history[ds].rate >= 50) weekCount++;
  }

  // 이번 달 평균
  const thisMonth = TODAY.slice(0, 7);
  const monthEntries = Object.entries(history).filter(([k]) => k.startsWith(thisMonth));
  const monthAvg = monthEntries.length
    ? Math.round(monthEntries.reduce((a,[,v]) => a + v.rate, 0) / monthEntries.length)
    : 0;

  const sc = document.getElementById('streak-count'); if(sc) sc.textContent = streak;
  const wc = document.getElementById('week-count');   if(wc) wc.textContent = weekCount;
  const ma = document.getElementById('month-avg');    if(ma) ma.textContent = monthAvg;
}

// ── 체크리스트 생성 (개선) ──
function makeChecklist(id, items) {
  const ul = document.getElementById(id);
  if (!ul) return;
  const saved = JSON.parse(localStorage.getItem(id) || '{}');

  items.forEach((item, i) => {
    const li  = document.createElement('li');
    const chk = document.createElement('input');
    chk.type    = 'checkbox';
    chk.checked = !!saved[item];
    if (chk.checked) li.classList.add('checked');

    chk.addEventListener('change', () => {
      li.classList.toggle('checked', chk.checked);
      const s = JSON.parse(localStorage.getItem(id) || '{}');
      s[item] = chk.checked;
      localStorage.setItem(id, JSON.stringify(s));
      updateRoutineRate(); // 체크할 때마다 달성률 업데이트
    });

    li.appendChild(chk);
    li.appendChild(document.createTextNode(' ' + item));
    ul.appendChild(li);
  });
}

// ── 오늘 수동 초기화 ──
function resetTodayChecklist() {
  if (!confirm('오늘 체크리스트를 초기화하시겠습니까?\n(기록은 히스토리에 저장됩니다)')) return;
  saveRoutineHistory(TODAY);
  ['checklist-morning','checklist-midday','checklist-evening','rules-today'].forEach(id => {
    localStorage.setItem(id, '{}');
  });
  // 화면 갱신
  ['checklist-morning','checklist-midday','checklist-evening'].forEach(id => {
    const ul = document.getElementById(id);
    if (ul) ul.innerHTML = '';
  });
  initChecklists();
  updateRoutineRate();
  showToast('✅ 오늘 루틴이 초기화됐습니다!');
}

// ── 루틴 기록 모달 ──
function showRoutineHistory() {
  const modal = document.getElementById('routine-history-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  const history = JSON.parse(localStorage.getItem('routine_history') || '{}');
  const container = document.getElementById('routine-history-content');

  const entries = Object.entries(history).sort((a,b) => b[0].localeCompare(a[0])).slice(0, 30);

  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><div>아직 루틴 기록이 없습니다.<br>매일 루틴을 완료하면 여기에 기록됩니다.</div></div>';
    return;
  }

  container.innerHTML = entries.map(([date, data]) => {
    const color = data.rate >= 80 ? 'var(--accent)' : data.rate >= 50 ? 'var(--gold)' : 'var(--red)';
    const emoji = data.rate >= 80 ? '🏆' : data.rate >= 50 ? '✅' : '⚠️';
    return `
      <div class="history-row">
        <span class="history-date">${date.slice(5).replace('-','/')}</span>
        <span>${emoji}</span>
        <div class="history-bar-wrap">
          <div class="history-bar" style="width:${data.rate}%; background:${color};"></div>
        </div>
        <span class="history-rate" style="color:${color};">${data.rate}%</span>
        <span style="font-size:11px; color:var(--text3); font-family:var(--mono);">
          🌅${data.morning||0}% 📈${data.midday||0}% 📝${data.evening||0}%${data.rulesNg ? ` <span style="color:var(--red); font-weight:700;">⛔위반 ${data.rulesNg}</span>` : ''}
        </span>
      </div>
    `;
  }).join('');
}

function closeRoutineHistory() {
  const modal = document.getElementById('routine-history-modal');
  if (modal) modal.style.display = 'none';
}

// ── 체크리스트 항목 정의 (상태는 항목 텍스트를 키로 저장 → 항목 추가/순서변경에 안전) ──
const ROUTINE_ITEMS = {
  'checklist-morning': [
    '코스피/코스닥 지수 20일선 위치 확인',
    '전일 시장 전체 거래대금 및 외인 현·선물 매매동향 파악',
    '당일 배팅 사이즈(비중) 결정 — 거래대금 가뭄 시 비중 축소',
    '미국 3대 지수 마감 확인 (DOW, S&P 500, NASDAQ)',
    '어제 미국 시장 섹터별 등락 확인 (FinViz 히트맵)',
    '오늘 경제지표 발표 일정 확인 (Investing.com 캘린더)',
    '원/달러 환율 현재 수준 확인',
    'VIX 지수 확인 (20 이상이면 변동성 주의)',
    '미국 10년물 국채금리 수준 확인',
    '나스닥 선물 / 코스피 선물 방향 확인',
    '오늘 국내 주요 뉴스 헤드라인 10개 훑기',
  ],
  'checklist-midday': [
    '장 시작 후 외국인 순매수/순매도 방향 확인 (KRX)',
    '기관 매수 상위 종목 확인',
    '관심 종목 가격 알림 도달 여부 확인',
    '장 초반 급등·급락 종목 이유 파악 (뉴스 확인)',
    '점심 후 환율·외국인 수급 재확인',
    '충동 매매 충동 느낄 경우 → 매수 이유 3가지 써보기',
  ],
  'checklist-evening': [
    '오늘 코스피/코스닥 지수 마감 수치와 원인 복기',
    '보유 종목 당일 등락 이유 파악 및 일지 기록',
    '오늘 발표된 경제지표 결과와 시장 반응 복기',
    '내일 발표 예정 경제지표 미리 확인',
    '경제 기사 3~5개 읽기 (한국경제 or 매일경제)',
    '학습 콘텐츠 20분 (유튜브·책) 소화',
    '투자 원칙 위반 여부 점검 후 일지 기록',
  ],
};

// ── 장 중 절대 금지 룰 (홍인기 룰) — 달성률과 별도로 준수/위반 기록 ──
const FORBIDDEN_RULES = [
  '09:30 이전 전일 종가 이탈 D+1 종목 미손절 시 즉시 컷',
  '지수 하락 폭 대비 상대 열위(더 크게 밀리는 종목) 추가 매수 금지',
  '1등주 조기 상한가 시 2등주 추격 매매(뇌동) 금지',
  '14시 이전 이유 없는 흔들림만으로 섣부른 손절(칼질) 금지 — 14시 이후 지수 -2% 이상 급락 등 명확한 투매 구간까지 인내',
  '단주 매매(1주 단위 반복 체결) 포착 시 즉시 시장가 청산',
];

function countDone(id) {
  const saved = JSON.parse(localStorage.getItem(id) || '{}');
  const items = ROUTINE_ITEMS[id] || [];
  return { done: items.filter(t => saved[t]).length, total: items.length };
}

function getRuleState() { return JSON.parse(localStorage.getItem('rules-today') || '{}'); }

function renderRules() {
  const ul = document.getElementById('rule-list');
  if (!ul) return;
  const st = getRuleState();
  ul.innerHTML = FORBIDDEN_RULES.map((r, i) => {
    const v = st[r] || '';
    return `<li class="rule-item ${v==='ok'?'rule-ok':v==='ng'?'rule-ng':''}">
      <span class="rule-text">⛔ ${r}</span>
      <span class="rule-btns">
        <button class="rule-btn ${v==='ok'?'on-ok':''}" onclick="setRule(${i},'ok')">✅ 준수</button>
        <button class="rule-btn ${v==='ng'?'on-ng':''}" onclick="setRule(${i},'ng')">❌ 위반</button>
      </span></li>`;
  }).join('');
  const ok = FORBIDDEN_RULES.filter(r => st[r]==='ok').length;
  const ng = FORBIDDEN_RULES.filter(r => st[r]==='ng').length;
  const p = document.getElementById('rules-progress');
  if (p) p.textContent = ng ? `위반 ${ng}건 · 준수 ${ok}/${FORBIDDEN_RULES.length}` : `준수 ${ok}/${FORBIDDEN_RULES.length}`;
}

function setRule(i, val) {
  const st = getRuleState();
  const key = FORBIDDEN_RULES[i];
  st[key] = st[key] === val ? '' : val;   // 같은 버튼 재클릭 시 해제
  localStorage.setItem('rules-today', JSON.stringify(st));
  renderRules();
}

// ── 체크리스트 초기화 함수 ──
function initChecklists() {
  Object.entries(ROUTINE_ITEMS).forEach(([id, items]) => makeChecklist(id, items));
  renderRules();
}

// 체크리스트 초기화 실행
checkDailyReset();
initChecklists();
updateRoutineRate();

// ── 글로벌 지표 ──
const globalData = [
  { name:'소비자물가지수', abbr:'CPI', org:'미국 노동통계국 (BLS)', cycle:'매월 (보통 둘째 주 화·수)', url:'https://www.bls.gov/cpi/', urlLabel:'bls.gov/cpi',
    def:'미국 소비자가 구매하는 상품·서비스의 평균 가격 변화를 측정',
    up:'CPI↑ → 연준 금리인상 압력 → 주식 하락 / 달러 강세',
    down:'CPI↓ → 금리인하 기대 → 주식 상승 / 달러 약세' },
  { name:'생산자물가지수', abbr:'PPI', org:'미국 노동통계국 (BLS)', cycle:'매월 (CPI 발표 전날)', url:'https://www.bls.gov/ppi/', urlLabel:'bls.gov/ppi',
    def:'생산자(기업) 입장에서 상품·서비스 가격 변화 측정. CPI의 선행 지표',
    up:'PPI↑ → 기업 비용 증가 → 마진 악화 우려 → 주식 부담',
    down:'PPI↓ → 물가 안정 신호 → 시장 긍정적' },
  { name:'FOMC 금리 결정', abbr:'FOMC', org:'미국 연방준비제도 (Fed)', cycle:'연 8회 (1·3·5·6·7·9·11·12월)', url:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', urlLabel:'federalreserve.gov',
    def:'연준의 기준금리(Federal Funds Rate) 결정. 점도표(Dot Plot)로 미래 금리 전망 제시',
    up:'금리↑ → 채권 수익률 상승 → 위험자산 매력 감소 → 주식 하락 압력',
    down:'금리↓ → 유동성 공급 → 주식·부동산 상승 압력' },
  { name:'비농업고용지수', abbr:'NFP', org:'미국 노동통계국 (BLS)', cycle:'매월 첫째 주 금요일', url:'https://www.bls.gov/news.release/empsit.toc.htm', urlLabel:'bls.gov (Employment)',
    def:'농업 제외 신규 취업자 수. 미국 경기 상태를 가장 빠르게 보여주는 지표 중 하나',
    up:'NFP↑(강한 고용) → 경제 호조 but 인플레 우려 → 금리인상 압력',
    down:'NFP↓(약한 고용) → 경기 침체 우려 → 금리인하 기대' },
  { name:'미국 실업률', abbr:'Unemployment', org:'미국 노동통계국 (BLS)', cycle:'매월 (NFP와 동시 발표)', url:'https://www.bls.gov/news.release/empsit.toc.htm', urlLabel:'bls.gov',
    def:'경제활동 가능 인구 중 실직자 비율. 완전고용 기준 약 4~5%',
    up:'실업률↑ → 경기 둔화 신호 → 연준 완화 압력',
    down:'실업률↓(너무 낮으면) → 임금 인상 → 인플레 압력' },
  { name:'GDP 성장률', abbr:'GDP', org:'미국 경제분석국 (BEA)', cycle:'분기별 (속보·잠정·확정)', url:'https://www.bea.gov/data/gdp/gross-domestic-product', urlLabel:'bea.gov',
    def:'일정 기간 생산된 재화·서비스의 총 시장 가치 성장률. 경제 규모 측정',
    up:'GDP↑ → 기업 실적 개선 기대 → 주식 긍정적',
    down:'GDP↓(2분기 연속 마이너스 = 기술적 경기침체) → 주식 하락 압력' },
  { name:'공포지수', abbr:'VIX', org:'CBOE (시카고옵션거래소)', cycle:'실시간 산출', url:'https://www.cboe.com/tradable_products/vix/', urlLabel:'cboe.com/vix',
    def:'S&P 500 옵션 가격을 기반으로 향후 30일 시장 변동성 예상치를 수치화',
    up:'VIX 20↑ → 시장 불안. 30↑ → 급격한 공포. 역사적 저점 매수 기회 될 수 있음',
    down:'VIX↓ → 시장 안정·낙관. 단, 너무 낮으면(10~12) 과도한 안도 경계' },
  { name:'미국 10년물 국채금리', abbr:'UST 10Y', org:'미국 재무부 (시장 결정)', cycle:'실시간 거래', url:'https://fred.stlouisfed.org/series/GS10', urlLabel:'FRED - GS10',
    def:'미국 정부가 발행한 10년 만기 국채의 수익률. 글로벌 금융시장의 기준 금리 역할',
    up:'금리↑ → 성장주·기술주 밸류에이션 압박 → 코스피 외국인 자금 유출',
    down:'금리↓ → 위험자산 선호 → 주식·신흥국 자금 유입' },
  { name:'달러인덱스', abbr:'DXY', org:'ICE (인터컨티넨탈 거래소)', cycle:'실시간', url:'https://www.investing.com/indices/usdollar', urlLabel:'investing.com - DXY',
    def:'유로·엔·파운드 등 주요 6개 통화 대비 달러 가치 지수. 100 기준',
    up:'DXY↑(달러 강세) → 원/달러 환율 상승 → 코스피 외국인 매도 압력',
    down:'DXY↓(달러 약세) → 신흥국 통화 강세 → 코스피 긍정적' },
  { name:'WTI 원유 가격', abbr:'WTI Crude', org:'NYMEX (뉴욕상업거래소)', cycle:'실시간', url:'https://www.investing.com/commodities/crude-oil', urlLabel:'investing.com - WTI',
    def:'서부 텍사스산 원유(WTI) 가격. 글로벌 경기 선행 지표이자 인플레 요인',
    up:'유가↑ → 인플레 압력 → 금리인상 우려. 에너지 섹터↑, 항공·화학↓',
    down:'유가↓ → 물가 안정 기대. 수입 의존 한국엔 긍정적' },
  { name:'금 가격', abbr:'Gold', org:'COMEX (상품거래소)', cycle:'실시간', url:'https://www.investing.com/commodities/gold', urlLabel:'investing.com - Gold',
    def:'안전자산 대표. 달러 약세·인플레·지정학적 위기 시 상승',
    up:'금↑ → 시장 불안 심리 반영. 주식과 역방향 경향',
    down:'금↓ → 위험자산 선호 신호. 주식 긍정적' },
];

const gc = document.getElementById('globalIndicators');
globalData.forEach(d => {
  const div = document.createElement('div');
  div.className = 'indicator-card';
  div.innerHTML = `
    <div class="indicator-name">${d.name}</div>
    <div class="indicator-abbr">${d.abbr} · ${d.org} · ${d.cycle}</div>
    <div class="indicator-body">${d.def}</div>
    <div class="impact-row">
      <span class="impact-down">↑ ${d.up}</span>
    </div>
    <div class="impact-row">
      <span class="impact-up">↓ ${d.down}</span>
    </div>
    <a class="indicator-url" href="${d.url}" target="_blank">🔗 ${d.urlLabel}</a>
  `;
  gc.appendChild(div);
});

// ── 국내 지표 ──
const koreaData = [
  { name:'한국은행 기준금리', body:'금융통화위원회(금통위)가 연 8회(1·2·4·5·7·8·10·11월) 결정. 기준금리 변경은 코스피 직접 영향 및 원화 환율 방향에 결정적. 인상 → 대출 부담↑, 주식 밸류에이션 하락 압력. 인하 → 유동성 공급, 주식 긍정적.', url:'https://www.bok.or.kr/portal/main/mainAction.do', urlLabel:'bok.or.kr (한국은행)' },
  { name:'원/달러 환율', body:'환율 상승(원화 약세) → 수출기업(삼성전자·현대차) 실적 긍정 but 외국인 투자자 원화 자산 매력 감소 → 주식 매도 압력. 환율 하락(원화 강세) → 수입 물가 안정, 외국인 유입 유리. 실시간 확인: 네이버금융 또는 한국은행 ECOS.', url:'https://finance.naver.com/marketindex/', urlLabel:'finance.naver.com/marketindex' },
  { name:'외국인 순매수/순매도', body:'외국인은 코스피 시가총액의 약 30% 보유. 순매수 확대 → 지수 상승 동력. 순매도 전환 → 하락 압력. 코스피200 선물 포지션과 함께 확인하면 유용. 확인처: KRX 정보데이터시스템 > 투자자별 거래실적.', url:'https://data.krx.co.kr/', urlLabel:'data.krx.co.kr' },
  { name:'국내 수출입 데이터', body:'산업통상자원부가 매월 1일 전월 실적 발표 (수출·수입·무역수지). 한국은 수출 의존도 높아 수출 증가 → 기업 실적 개선 → 주식 긍정적. 반도체·자동차·석유화학 품목 세부 수치가 특히 중요.', url:'https://www.motie.go.kr/', urlLabel:'motie.go.kr (산업통상자원부)' },
  { name:'코스피/코스닥 PER 밴드', body:'시장 전체 PER이 역사적 평균(코스피 약 10~13배) 대비 어느 위치인지 확인. PER 낮으면 저평가 구간, 높으면 고평가 구간 가능성. KRX 데이터에서 시장 전체 PER·PBR 확인 가능.', url:'https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201010107', urlLabel:'data.krx.co.kr - PER/PBR' },
  { name:'한국은행 경제통계시스템 (ECOS)', body:'국내 모든 거시경제 지표(기준금리 추이, 환율, 통화량, 물가, 수출 등)를 무료로 조회·다운로드 가능한 공식 데이터베이스. 시계열 차트 제공. 데이터 신뢰도 최고.', url:'https://ecos.bok.or.kr/', urlLabel:'ecos.bok.or.kr' },
];

const kc = document.getElementById('koreaIndicators');
koreaData.forEach(d => {
  const div = document.createElement('div');
  div.className = 'indicator-card';
  div.innerHTML = `
    <div class="indicator-name">${d.name}</div>
    <div class="indicator-body" style="margin-top:8px">${d.body}</div>
    <a class="indicator-url" href="${d.url}" target="_blank">🔗 ${d.urlLabel}</a>
  `;
  kc.appendChild(div);
});

// ── 뉴스·도구 ──
function makeLinkCards(id, items) {
  const el = document.getElementById(id);
  if(!el) return;
  items.forEach(item => {
    const a = document.createElement('a');
    a.className = 'link-card';
    a.href = item.url;
    a.target = '_blank';
    a.style.marginBottom = '8px';
    a.innerHTML = `
      <div class="link-favicon">${item.icon}</div>
      <div class="link-info">
        <div class="link-name">${item.name}</div>
        <div class="link-desc">${item.desc}</div>
      </div>
      <div class="link-tag">→</div>
    `;
    el.appendChild(a);
  });
}

makeLinkCards('krNews', [
  { icon:'📰', name:'한국경제신문', desc:'hankyung.com | 증시·기업·산업 전반', url:'https://www.hankyung.com/finance' },
  { icon:'📰', name:'매일경제', desc:'mk.co.kr | 국내외 경제·금융 뉴스', url:'https://www.mk.co.kr/' },
  { icon:'📡', name:'연합인포맥스', desc:'news.einfomax.co.kr | 실시간 금융 데이터', url:'https://news.einfomax.co.kr/' },
  { icon:'📰', name:'이데일리', desc:'edaily.co.kr | 증권·기업 전문', url:'https://www.edaily.co.kr/' },
]);
makeLinkCards('usNews', [
  { icon:'📊', name:'Bloomberg', desc:'bloomberg.com | 글로벌 금융 심층 분석', url:'https://www.bloomberg.com/' },
  { icon:'🌐', name:'Reuters', desc:'reuters.com | 글로벌 뉴스 빠른 속보', url:'https://www.reuters.com/' },
  { icon:'📺', name:'CNBC', desc:'cnbc.com | 미국 증시 실시간 중계', url:'https://www.cnbc.com/' },
]);
makeLinkCards('krTools', [
  { icon:'🟢', name:'네이버 금융', desc:'finance.naver.com | 종목검색·시세·재무정보', url:'https://finance.naver.com/' },
  { icon:'📂', name:'KRX 데이터시스템', desc:'data.krx.co.kr | 공식 시장통계·PER/PBR', url:'https://data.krx.co.kr/' },
  { icon:'🏛', name:'금감원 DART', desc:'dart.fss.or.kr | 기업 공시·사업보고서', url:'https://dart.fss.or.kr/' },
  { icon:'🏦', name:'한국은행 ECOS', desc:'ecos.bok.or.kr | 국내 거시경제 데이터', url:'https://ecos.bok.or.kr/' },
]);
makeLinkCards('globalTools', [
  { icon:'📅', name:'Investing.com', desc:'investing.com | 경제 캘린더·실시간 지표', url:'https://www.investing.com/economic-calendar/' },
  { icon:'🔴', name:'FRED', desc:'fred.stlouisfed.org | 미국 연준 거시 데이터', url:'https://fred.stlouisfed.org/' },
  { icon:'📈', name:'TradingView', desc:'tradingview.com | 차트 분석 (무료)', url:'https://www.tradingview.com/' },
  { icon:'📉', name:'Macrotrends', desc:'macrotrends.net | 장기 거시 데이터 시각화', url:'https://www.macrotrends.net/' },
  { icon:'💻', name:'Yahoo Finance', desc:'finance.yahoo.com | 미국 종목 재무 정보', url:'https://finance.yahoo.com/' },
  { icon:'🔍', name:'FinViz', desc:'finviz.com | 종목 스크리너·섹터 히트맵', url:'https://finviz.com/' },
]);

// ── 커리큘럼 단계 ──
const phasesData = [
  { num:'01', title:'기초 다지기', period:'1개월차', color:'var(--accent)', items:[
    '주식이란? 주주의 권리 이해',
    '코스피/코스닥/NYSE/NASDAQ 구조 파악',
    '주문 유형 5가지 완전히 익히기',
    'PER, PBR, ROE, EPS 계산식 암기 및 실제 종목 적용',
    '재무제표 3종 구조 이해 (DART에서 실제 열람)',
    '이동평균선(5·20·60일) 차트 읽기 연습',
    'HTS/MTS 모의투자 시작 (100만원 가상)',
    '투자 일지 작성 시작',
  ]},
  { num:'02', title:'분석력 키우기', period:'2~3개월차', color:'var(--gold)', items:[
    '기술적 분석: RSI, MACD, 볼린저밴드 실전 적용',
    '재무제표에서 성장성·안정성·수익성 종합 분석',
    '매일 경제 캘린더 확인 루틴 정착',
    '글로벌 지표(CPI/금리/VIX)와 주가 연관성 직접 관찰',
    '섹터 분석: 업종별 특성 파악 (반도체·바이오·금융 등)',
    '관심 종목 5개 심층 분석 리포트 작성',
    '포트폴리오 구성 원칙 수립 (분산 기준 설정)',
    '모의투자 결과 복기 및 패턴 파악',
  ]},
  { num:'03', title:'실전 훈련', period:'4~6개월차', color:'var(--blue)', items:[
    '소액 실전 투자 시작 (잃어도 되는 금액으로)',
    '매수·매도 원칙 문서화 후 준수 훈련',
    '손절 원칙 실제 적용 연습 (감정 통제)',
    'FOMO·공황매도 순간 인식 및 기록',
    '기업 공시(DART) 사업보고서 정기 읽기',
    '미국 종목 1개 분석 (10-K 기반)',
    '포트폴리오 월간 리밸런싱 실시',
    '6개월 전체 투자 결과 정리 및 다음 단계 계획 수립',
  ]},
];

const pc = document.getElementById('phases');
phasesData.forEach(p => {
  const div = document.createElement('div');
  div.className = 'phase-card';
  div.innerHTML = `
    <div class="phase-header">
      <div class="phase-num" style="color:${p.color}">${p.num}</div>
      <div class="phase-title-block">
        <div class="phase-title">${p.title}</div>
        <div class="phase-period">${p.period}</div>
      </div>
    </div>
    <div class="phase-body">
      <ul class="phase-items">${p.items.map(i=>`<li>${i}</li>`).join('')}</ul>
    </div>
  `;
  pc.appendChild(div);
});

// ── 실수 & 팁 ──
const mistakes = [
  { title:'몰빵 투자', body:'한 종목에 전체 자금의 50% 이상 투자. 종목 리스크가 포트폴리오 전체로 전이됨.' },
  { title:'FOMO 충동 매수', body:'급등 뉴스 직후 "이미 올랐는데 더 오를 것 같아" 심리로 고점 매수. 가장 흔한 손실 원인.' },
  { title:'손절 미루기', body:'-20% 됐을 때 "곧 오르겠지"로 버티다 -50%까지 가는 패턴. 손절선은 매수 시 설정.' },
  { title:'과도한 레버리지/신용', body:'신용 융자·레버리지 ETF는 손실이 증폭됨. 원금 이상 손실 가능성 존재.' },
  { title:'단타에 집착', body:'초보 투자자의 빈번한 단기 매매는 수수료+세금+심리 손실로 대부분 수익 마이너스.' },
  { title:'확증편향', body:'자신이 보유한 종목에 유리한 뉴스만 찾아 읽는 행동. 반대 의견도 반드시 찾아 읽어야 함.' },
  { title:'뇌동매매', body:'커뮤니티·SNS의 "오늘 이거 뜰 것 같은데요" 게시글 보고 근거 없이 따라 매수.' },
  { title:'실적 시즌 무지', body:'분기 실적 발표 전후 주가 변동성이 크다는 걸 모르고 대응 못하는 패턴.' },
  { title:'생존편향', body:'성공한 투자자 유튜브만 보고 쉽게 생각. 대다수 단타 투자자가 장기적으로 시장 수익률을 못 따라간다는 사실 인지 필요.' },
  { title:'수익률 조급증', body:'한 달에 10~30% 수익을 목표로 무리한 매매. 연 10~15% 복리 수익이 장기적으로 강력함을 이해해야 함.' },
];

const tips = [
  { title:'원칙 기반 매매', body:'매수 전 "왜 사는가, 목표가는, 손절가는"을 반드시 문서화. 감정이 아닌 규칙이 매매를 결정하게 만들기.' },
  { title:'24시간 대기 룰', body:'급등 뉴스를 보면 즉시 매수하지 않고 24시간 후 재검토. 충동의 90%는 식는다.' },
  { title:'투자 일지 매일 작성', body:'매매 이유, 결과, 반성을 기록하면 자신만의 실수 패턴을 발견하고 개선할 수 있음.' },
  { title:'공포탐욕지수 역이용', body:'극단적 공포(0~25) 구간에서 분할 매수, 극단적 탐욕(75~100)에서 차익 실현 고려. CNN Fear & Greed Index 활용.' },
  { title:'시장과 싸우지 않기', body:'트렌드에 역행하는 매매는 초보자에게 위험. 추세 방향에 편승하고 리스크를 관리하는 것이 먼저.' },
  { title:'소액으로 실전 감각 익히기', body:'모의투자와 실전은 심리가 다름. 잃어도 생활에 영향 없는 소액(10~50만원)으로 실전 경험을 쌓을 것.' },
];

const ml = document.getElementById('mistakesList');
mistakes.forEach((m, i) => {
  const div = document.createElement('div');
  div.className = 'psych-card';
  div.innerHTML = `<div class="psych-title">${i+1}. ${m.title}</div><div class="psych-body">${m.body}</div>`;
  ml.appendChild(div);
});

const tl = document.getElementById('tipsList');
tips.forEach(t => {
  const div = document.createElement('div');
  div.className = 'psych-card tip';
  div.innerHTML = `<div class="psych-title">✓ ${t.title}</div><div class="psych-body">${t.body}</div>`;
  tl.appendChild(div);
});


// ══════════════════════════════════════════
// ⭐ 관심종목
// ══════════════════════════════════════════
let watchFilter = 'ALL';
let leaderFilter = 'ALL';
let ddaySort = false;

// D-Day 계산 (오늘 기준, 로컬 날짜)
function calcDday(dateStr) {
  if (!dateStr) return null;
  const t = new Date(); t.setHours(0,0,0,0);
  const [y,m,d] = dateStr.split('-').map(Number);
  const ev = new Date(y, m-1, d);
  return Math.round((ev - t) / 86400000);
}
function ddayLabel(n) { return n === null ? '-' : n === 0 ? 'D-Day' : n > 0 ? 'D-' + n : 'D+' + (-n); }

function getWatchList() {
  return JSON.parse(localStorage.getItem('watchlist') || '[]');
}
function saveWatchList(arr) {
  localStorage.setItem('watchlist', JSON.stringify(arr));
}

function addWatchItem() {
  const ticker = document.getElementById('w-ticker').value.trim();
  const name   = document.getElementById('w-name').value.trim();
  const market = document.getElementById('w-market').value;
  const buy    = parseFloat(document.getElementById('w-buy').value) || null;
  const target = parseFloat(document.getElementById('w-target').value) || null;
  const stop   = parseFloat(document.getElementById('w-stop').value) || null;
  const memo   = document.getElementById('w-memo').value.trim();
  const event     = document.getElementById('w-event').value.trim();
  const eventDate = document.getElementById('w-event-date').value;
  const leader    = document.getElementById('w-leader').value;
  const tv        = parseFloat(document.getElementById('w-tv').value) || null;

  if (!ticker || !name) { alert('종목코드와 종목명은 필수입니다.'); return; }
  if (leader === '찐대장' && tv !== null && tv < 1000 &&
      !confirm(`확인 거래대금 ${tv}억 < 1,000억입니다.\n그래도 '찐대장'으로 등록할까요?`)) return;

  const item = {
    id: Date.now(),
    ticker, name, market, buy, target, stop, memo,
    event, eventDate, leader, tv,
    date: new Date().toLocaleDateString('ko-KR'),
    star: false
  };

  const list = getWatchList();
  list.unshift(item);
  saveWatchList(list);
  renderWatchList();

  ['w-ticker','w-name','w-buy','w-target','w-stop','w-memo','w-event','w-event-date','w-leader','w-tv'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

function deleteWatchItem(id) {
  if (!confirm('삭제하시겠습니까?')) return;
  saveWatchList(getWatchList().filter(i => i.id !== id));
  renderWatchList();
}

function toggleStar(id) {
  const list = getWatchList().map(i => i.id === id ? {...i, star: !i.star} : i);
  saveWatchList(list);
  renderWatchList();
}

function filterWatch(val, el) {
  watchFilter = val;
  document.querySelectorAll('#panel-watchlist .filter-chip[data-wf]').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  renderWatchList();
}
function filterLeader(val, el) {
  leaderFilter = val;
  document.querySelectorAll('#panel-watchlist .lf-chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  renderWatchList();
}
function toggleDdaySort(el) {
  ddaySort = !ddaySort;
  el.classList.toggle('on', ddaySort);
  renderWatchList();
}

function renderWatchList() {
  const list = getWatchList();
  const filtered = list
    .filter(i => watchFilter === 'ALL' || i.market === watchFilter)
    .filter(i => leaderFilter === 'ALL' || (i.leader || '') === leaderFilter);
  const tbody = document.getElementById('watch-tbody');
  const empty = document.getElementById('watch-empty');
  document.getElementById('watch-count').textContent = `${filtered.length}개 종목`;

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const dKey = i => { const n = calcDday(i.eventDate); return n === null || n < 0 ? 99999 : n; };
  filtered.sort((a,b) => ddaySort ? (dKey(a) - dKey(b)) || (b.star - a.star) : b.star - a.star).forEach(item => {
    const dd = calcDday(item.eventDate);
    const ddCls = dd === null ? '' : dd < 0 ? 'dday-past' : dd <= 3 ? 'dday-hot' : dd <= 7 ? 'dday-warn' : 'dday-far';
    const ddHtml = dd === null ? '-' :
      `<span class="dday-badge ${ddCls}" title="${item.eventDate}">${ddayLabel(dd)}</span>${item.event ? `<div style="font-size:10px; color:var(--text3); margin-top:2px;">${item.event}</div>` : ''}`;
    const ldHtml = item.leader === '찐대장' ? `<span class="leader-badge leader-1">👑 찐대장</span>`
      : item.leader === '2~3등주' ? `<span class="leader-badge leader-2">🥈 2~3등</span>`
      : `<span class="leader-badge leader-0">미검증</span>`;
    const tvHtml = item.tv ? `<div style="font-size:10px; font-family:var(--mono); color:${item.tv>=1000?'var(--accent)':'var(--text3)'}; margin-top:2px;">${item.tv.toLocaleString()}억</div>` : '';
    const gainPct = item.buy && item.target
      ? (((item.target - item.buy) / item.buy) * 100).toFixed(1)
      : '-';
    const gainColor = gainPct !== '-'
      ? (parseFloat(gainPct) >= 0 ? 'color:var(--accent)' : 'color:var(--red)')
      : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><button class="star-btn" onclick="toggleStar(${item.id})">${item.star ? '⭐' : '☆'}</button></td>
      <td>
        <div style="font-weight:700; color:var(--text)">${item.name}</div>
        <div style="font-family:var(--mono); font-size:11px; color:var(--text3)">${item.ticker}</div>
      </td>
      <td><span class="badge-text">${item.market === 'KR' ? '🇰🇷 국내' : '🇺🇸 미국'}</span></td>
      <td style="font-family:var(--mono)">${item.buy ? item.buy.toLocaleString() : '-'}</td>
      <td style="font-family:var(--mono)">${item.target ? item.target.toLocaleString() : '-'}</td>
      <td style="font-family:var(--mono)">${item.stop ? item.stop.toLocaleString() : '-'}</td>
      <td style="font-family:var(--mono); ${gainColor}">${gainPct !== '-' ? gainPct + '%' : '-'}</td>
      <td>${ddHtml}</td>
      <td>${ldHtml}${tvHtml}</td>
      <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${item.memo}">${item.memo || '-'}</td>
      <td style="font-family:var(--mono); font-size:11px; color:var(--text3)">${item.date}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteWatchItem(${item.id})">삭제</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ══════════════════════════════════════════
// 📓 투자일지 (엑셀 YS 동일 구조)
// ══════════════════════════════════════════
let journalFilter = 'ALL';
let journalMarketFilter = 'ALL';
let selectedMood = '';
let selectedActionTags = new Set();
let pendingChartBlob = null;

// ── 실전 대응 태그 (다중선택) ──
function toggleActionTag(btn) {
  const t = btn.dataset.tag;
  if (selectedActionTags.has(t)) selectedActionTags.delete(t); else selectedActionTags.add(t);
  btn.classList.toggle('tag-on', selectedActionTags.has(t));
}

// ── 차트 이미지: IndexedDB 저장 (localStorage 5MB 한도 회피) ──
const CHART_DB = 'investlearn_charts';
function chartDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(CHART_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('charts');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function chartPut(id, blob) {
  const db = await chartDb();
  return new Promise((res, rej) => { const tx = db.transaction('charts','readwrite'); tx.objectStore('charts').put(blob, String(id)); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
async function chartGet(id) {
  const db = await chartDb();
  return new Promise((res) => { const rq = db.transaction('charts').objectStore('charts').get(String(id)); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); });
}
async function chartDel(id) {
  try { const db = await chartDb(); db.transaction('charts','readwrite').objectStore('charts').delete(String(id)); } catch(e) {}
}
async function chartAll() {
  const db = await chartDb();
  return new Promise((res) => {
    const out = {}; const rq = db.transaction('charts').objectStore('charts').openCursor();
    rq.onsuccess = () => { const c = rq.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); };
    rq.onerror = () => res(out);
  });
}
// 업로드 이미지 축소 (긴 변 1600px, JPEG 0.82) — 영웅문 캡처 1장 ≈ 수백 KB 수준으로
function compressImage(file, maxSide = 1600, q = 0.82) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => { URL.revokeObjectURL(img.src); b ? res(b) : rej(new Error('압축 실패')); }, 'image/jpeg', q);
    };
    img.onerror = () => rej(new Error('이미지를 읽을 수 없습니다'));
    img.src = URL.createObjectURL(file);
  });
}
async function previewChartFile(ev) {
  const f = ev.target.files[0];
  const box = document.getElementById('j-chart-preview');
  if (!f) return;
  try {
    pendingChartBlob = await compressImage(f);
    const url = URL.createObjectURL(pendingChartBlob);
    box.innerHTML = `<img src="${url}" /><span>${Math.round(pendingChartBlob.size/1024)}KB</span><button class="btn btn-ghost btn-sm" onclick="clearChartFile()">✕</button>`;
    box.style.display = 'flex';
  } catch(e) { alert(e.message); }
}
function clearChartFile() {
  pendingChartBlob = null;
  const f = document.getElementById('j-chart-file'); if (f) f.value = '';
  const box = document.getElementById('j-chart-preview'); if (box) { box.innerHTML = ''; box.style.display = 'none'; }
}
function openChart(src) {
  const lb = document.getElementById('chart-lightbox');
  document.getElementById('chart-lightbox-img').src = src;
  lb.style.display = 'flex';
}
async function loadChartThumbs() {
  const els = document.querySelectorAll('[data-chart-id]');
  for (const el of els) {
    const b = await chartGet(el.dataset.chartId);
    if (b) { const u = URL.createObjectURL(b); el.innerHTML = `<img src="${u}" onclick="openChart('${u}')" />`; }
  }
}

function getJournal() { return JSON.parse(localStorage.getItem('journal') || '[]'); }
function saveJournal(arr) { localStorage.setItem('journal', JSON.stringify(arr)); }

// ── 매도 필드 토글 ──
function toggleSellFields() {
  const type = document.getElementById('j-type')?.value;
  const sellField  = document.getElementById('sell-price-field');
  const exitRow    = document.getElementById('exit-reason-row');
  if (sellField) sellField.style.opacity  = type === '매도' ? '1' : '0.4';
  if (exitRow)   exitRow.style.display    = type === '매도' ? '' : 'none';
  calcJournal();
}

// ── 자동 계산 ──
function calcJournal() {
  const type      = document.getElementById('j-type')?.value || '매수';
  const qty       = parseFloat(document.getElementById('j-qty')?.value) || 0;
  const buyPrice  = parseFloat(document.getElementById('j-buy-price')?.value) || 0;
  const sellPrice = parseFloat(document.getElementById('j-sell-price')?.value) || 0;

  const tradePrice = type === '매도' ? sellPrice : buyPrice;
  const amount     = qty * tradePrice;

  // 수수료 자동계산 (0.05%, 미입력 시)
  const feeEl = document.getElementById('j-fee');
  if (feeEl && !feeEl.value) {
    const autoFee = Math.round(amount * 0.0005);
    feeEl.placeholder = autoFee > 0 ? autoFee.toLocaleString() : '자동계산';
  }
  // 세금 자동계산 (매도 시 0.18%)
  const taxEl = document.getElementById('j-tax');
  if (taxEl && !taxEl.value) {
    const autoTax = type === '매도' ? Math.round(qty * sellPrice * 0.0018) : 0;
    taxEl.placeholder = autoTax > 0 ? autoTax.toLocaleString() : '자동계산';
  }

  const fee = parseFloat(document.getElementById('j-fee')?.value) || Math.round(amount * 0.0005);
  const tax = parseFloat(document.getElementById('j-tax')?.value) || (type === '매도' ? Math.round(qty * sellPrice * 0.0018) : 0);

  // 실현손익 = (매도단가-매수단가)×수량 - 수수료 - 세금
  let pnlWon = null, pnlPct = null;
  if (type === '매도' && qty > 0 && buyPrice > 0 && sellPrice > 0) {
    pnlWon = Math.round((sellPrice - buyPrice) * qty - fee - tax);
    pnlPct = ((sellPrice - buyPrice) / buyPrice * 100).toFixed(2);
  }

  const amountEl  = document.getElementById('calc-amount');
  const pnlWonEl  = document.getElementById('calc-pnl-won');
  const pnlPctEl  = document.getElementById('calc-pnl-pct');
  if (amountEl) amountEl.textContent  = amount > 0 ? amount.toLocaleString() + '원' : '-';
  if (pnlWonEl) {
    pnlWonEl.textContent = pnlWon !== null ? (pnlWon >= 0 ? '+' : '') + pnlWon.toLocaleString() + '원' : '-';
    pnlWonEl.style.color = pnlWon !== null ? (pnlWon >= 0 ? 'var(--accent)' : 'var(--red)') : 'var(--text3)';
  }
  if (pnlPctEl) {
    pnlPctEl.textContent = pnlPct !== null ? (parseFloat(pnlPct) >= 0 ? '+' : '') + pnlPct + '%' : '-';
    pnlPctEl.style.color = pnlPct !== null ? (parseFloat(pnlPct) >= 0 ? 'var(--accent)' : 'var(--red)') : 'var(--text3)';
  }
  jPosHint();
}

// ── 심리 선택 ──
function selectMood(btn) {
  document.querySelectorAll('.mood-btn').forEach(b => {
    b.style.background = ''; b.style.color = ''; b.style.borderColor = '';
  });
  selectedMood = btn.dataset.mood;
  btn.style.background = 'var(--accent)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--accent)';
  const el = document.getElementById('j-mood'); if(el) el.value = selectedMood;
}

// ── 폼 초기화 ──
function clearJournalForm() {
  ['j-date','j-ticker','j-name','j-qty','j-buy-price','j-sell-price',
   'j-fee','j-tax','j-entry-reason','j-exit-reason','j-memo','j-flow','j-volume','j-chart-url'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  const typeEl = document.getElementById('j-type'); if(typeEl) typeEl.value = '매수';
  const mktEl  = document.getElementById('j-market'); if(mktEl) mktEl.value = 'KOSPI';
  selectedMood = '';
  document.querySelectorAll('.mood-btn').forEach(b => {
    b.style.background = ''; b.style.color = ''; b.style.borderColor = '';
  });
  selectedActionTags.clear();
  document.querySelectorAll('.action-tag-btn').forEach(b => b.classList.remove('tag-on'));
  clearChartFile();
  ['calc-amount','calc-pnl-won','calc-pnl-pct'].forEach(id => {
    const el = document.getElementById(id); if(el) { el.textContent = '-'; el.style.color = ''; }
  });
  const bp = document.getElementById('j-buy-price'); if (bp) delete bp.dataset.auto;
  toggleSellFields();
}

// ── 거래 저장 ──
async function addJournalEntry() {
  const date     = document.getElementById('j-date')?.value;
  const name     = document.getElementById('j-name')?.value.trim();
  if (!date) { alert('거래일을 선택해주세요.'); return; }
  if (!name) { alert('종목명을 입력해주세요.'); return; }

  const type      = document.getElementById('j-type').value;
  const flow      = document.getElementById('j-flow')?.value || '';
  const volState  = document.getElementById('j-volume')?.value || '';
  // 매수는 진입 당시 시장 상황 기록 강제
  if (type === '매수' && (!flow || !volState)) {
    alert('매수 기록은 [외인 수급]과 [시장 거래대금] 선택이 필수입니다.');
    return;
  }
  if (type === '매도') {
    const pos = jPosAt(document.getElementById('j-ticker')?.value.trim() || name, date);
    const q = parseFloat(document.getElementById('j-qty')?.value) || 0;
    if (q > pos.qty && !confirm(`일지 기준 보유 수량(${pos.qty}주)보다 많이 매도합니다.\n일지 이전 보유분이 있다면 그대로 저장해도 됩니다. 저장할까요?`)) return;
  }
  const qty       = parseFloat(document.getElementById('j-qty')?.value) || 0;
  const buyPrice  = parseFloat(document.getElementById('j-buy-price')?.value) || 0;
  const sellPrice = parseFloat(document.getElementById('j-sell-price')?.value) || 0;
  const fee       = parseFloat(document.getElementById('j-fee')?.value) || Math.round((type==='매도'?qty*sellPrice:qty*buyPrice)*0.0005);
  const tax       = parseFloat(document.getElementById('j-tax')?.value) || (type==='매도' ? Math.round(qty*sellPrice*0.0018) : 0);
  const amount    = qty * (type === '매도' ? sellPrice : buyPrice);
  const pnlWon    = (type==='매도' && qty>0 && buyPrice>0 && sellPrice>0)
    ? Math.round((sellPrice-buyPrice)*qty - fee - tax) : null;
  const pnlPct    = (type==='매도' && buyPrice>0 && sellPrice>0)
    ? parseFloat(((sellPrice-buyPrice)/buyPrice*100).toFixed(2)) : null;

  const entry = {
    id: Date.now(),
    date,
    market:      document.getElementById('j-market').value,
    ticker:      document.getElementById('j-ticker')?.value.trim() || '',
    name,
    type,
    qty,
    buyPrice,
    sellPrice:   type==='매도' ? sellPrice : null,
    amount,
    fee,
    tax,
    pnlWon,
    pnl:         pnlPct,   // 손익률(%) - 기존 호환
    result:      type==='매도' ? (pnlWon>=0?'profit':'loss') : 'hold',
    strategy:    document.getElementById('j-strategy')?.value || '',
    sector:      document.getElementById('j-sector')?.value || '',
    entryReason: document.getElementById('j-entry-reason')?.value.trim() || '',
    exitReason:  document.getElementById('j-exit-reason')?.value.trim() || '',
    memo:        document.getElementById('j-memo')?.value.trim() || '',
    mood:        document.getElementById('j-mood')?.value || '',
    flow,
    volState,
    actionTags:  [...selectedActionTags],
    chartUrl:    document.getElementById('j-chart-url')?.value.trim() || '',
    hasChart:    !!pendingChartBlob,
    createdAt:   new Date().toLocaleString('ko-KR')
  };

  if (pendingChartBlob) {
    try { await chartPut(entry.id, pendingChartBlob); }
    catch(e) { entry.hasChart = false; alert('차트 이미지 저장 실패: ' + e.message); }
  }

  const list = getJournal();
  list.unshift(entry);
  saveJournal(list);
  renderJournal();
  clearJournalForm();
  updateJournalStats();
  showToast('✅ 거래 기록이 저장됐습니다!');
}

// ── 삭제 ──
function deleteJournalEntry(id) {
  if (!confirm('이 거래 기록을 삭제하시겠습니까?')) return;
  saveJournal(getJournal().filter(e => e.id !== id));
  chartDel(id);
  renderJournal();
  updateJournalStats();
}

// ── 필터 ──
function filterJournal(val, el) {
  journalFilter = val;
  document.querySelectorAll('#panel-journal .filter-chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  renderJournal();
}
function filterJournalMarket(val, el) {
  journalMarketFilter = val;
  // 시장 필터 칩만 토글
  const chips = document.querySelectorAll('#panel-journal .filter-chip');
  // market filter chips are after type filter chips
  renderJournal();
}

// ── 통계 탭 전환 ──
function switchJournalTab(id, btn) {
  ['stats','byticker','bymonth','positions'].forEach(t => {
    const el = document.getElementById('jt-' + t);
    if(el) el.style.display = 'none';
  });
  document.querySelectorAll('#panel-journal .kd-tab').forEach(b => b.classList.remove('active'));
  const target = document.getElementById('jt-' + id);
  if(target) target.style.display = 'block';
  btn.classList.add('active');
  if(id === 'byticker') renderTickerPnl();
  if(id === 'bymonth')  { renderMonthYearSelect(); renderMonthlyStats(); }
  if(id === 'positions') renderPositions();
}

// ── 거래 목록 렌더 ──
function renderJournal() {
  const list = getJournal();
  const posInfo = jPositions(list).perEntry;
  const filtered = list.filter(e => {
    const matchType   = journalFilter === 'ALL' || e.type === journalFilter;
    const matchMarket = journalMarketFilter === 'ALL' || e.market === journalMarketFilter;
    return matchType && matchMarket;
  });

  const container = document.getElementById('journal-list');
  const empty     = document.getElementById('journal-empty');
  if (!container) return;
  container.innerHTML = '';
  empty.style.display = filtered.length === 0 ? 'block' : 'none';

  filtered.forEach(e => {
    const isSell    = e.type === '매도';
    const pnlColor  = e.pnlWon != null ? (e.pnlWon >= 0 ? 'var(--accent)' : 'var(--red)') : 'var(--text3)';
    const typeColor = e.type === '매수' ? 'var(--accent)' : 'var(--red)';
    const div = document.createElement('div');
    div.className = 'journal-card';
    div.style.borderLeft = `3px solid ${typeColor}`;
    div.innerHTML = `
      <div class="journal-card-header" style="flex-wrap:wrap; gap:8px;">
        <span class="journal-ticker">${e.name}</span>
        ${e.ticker ? `<span class="journal-meta">${e.ticker}</span>` : ''}
        ${e.market ? `<span class="badge badge-blue" style="font-size:10px;">${e.market}</span>` : ''}
        <span class="badge" style="font-size:10px; background:${e.type==='매수'?'#00c9a715':'#d6305515'}; color:${typeColor}; border:1px solid ${typeColor}30;">${e.type}</span>
        ${jSeqBadge(posInfo.get(e.id), e.type)}
        ${e.strategy ? `<span class="memo-badge">${e.strategy}</span>` : ''}
        ${e.sector ? `<span class="memo-badge">${e.sector}</span>` : ''}
        ${e.mood ? `<span class="memo-badge">${e.mood}</span>` : ''}
        ${(e.actionTags||[]).map(t => `<span class="memo-badge action-badge">${t}</span>`).join('')}
        ${e.flow ? `<span class="memo-badge mkt-badge ${e.flow==='외인 양매도'?'mkt-bad':e.flow==='외인 양매수'?'mkt-good':''}">${e.flow}</span>` : ''}
        ${e.volState ? `<span class="memo-badge mkt-badge ${e.volState==='연중 최저치 붕괴'?'mkt-bad':e.volState==='활황'?'mkt-good':''}">💰 ${e.volState}</span>` : ''}
        <span class="journal-meta" style="margin-left:auto;">${e.date}</span>
        <button class="btn btn-danger btn-sm" onclick="deleteJournalEntry(${e.id})">🗑</button>
      </div>
      <div style="display:flex; gap:16px; flex-wrap:wrap; margin:8px 0; padding:10px 14px; background:var(--bg3); border-radius:8px; font-family:var(--mono); font-size:12px;">
        ${e.qty ? `<span><span style="color:var(--text3);">수량</span> <strong>${e.qty.toLocaleString()}주</strong></span>` : ''}
        ${e.buyPrice ? `<span><span style="color:var(--text3);">매수가</span> <strong>${e.buyPrice.toLocaleString()}원</strong></span>` : ''}
        ${isSell && e.sellPrice ? `<span><span style="color:var(--text3);">매도가</span> <strong>${e.sellPrice.toLocaleString()}원</strong></span>` : ''}
        ${e.amount ? `<span><span style="color:var(--text3);">거래금액</span> <strong>${e.amount.toLocaleString()}원</strong></span>` : ''}
        ${isSell && e.pnlWon != null ? `<span><span style="color:var(--text3);">실현손익</span> <strong style="color:${pnlColor};">${e.pnlWon>=0?'+':''}${e.pnlWon.toLocaleString()}원</strong></span>` : ''}
        ${isSell && e.pnl != null ? `<span><span style="color:var(--text3);">손익률</span> <strong style="color:${pnlColor};">${e.pnl>=0?'+':''}${e.pnl}%</strong></span>` : ''}
      </div>
      ${e.entryReason ? `<div style="font-size:12px; color:var(--text2); margin-bottom:4px;"><span style="color:var(--accent); font-weight:700;">▶ 진입근거</span> ${e.entryReason}</div>` : ''}
      ${e.exitReason  ? `<div style="font-size:12px; color:var(--text2); margin-bottom:4px;"><span style="color:var(--red); font-weight:700;">▶ 청산근거</span> ${e.exitReason}</div>` : ''}
      ${e.memo        ? `<div style="font-size:12px; color:var(--text3);"><span style="font-weight:700;">📝</span> ${e.memo}</div>` : ''}
      ${(e.hasChart || e.chartUrl) ? `<div class="journal-charts">
        ${e.hasChart ? `<div class="chart-thumb" data-chart-id="${e.id}">📷 로딩…</div>` : ''}
        ${e.chartUrl ? `<div class="chart-thumb"><img src="${e.chartUrl}" onclick="openChart(this.src)" onerror="this.outerHTML='<a href=&quot;${e.chartUrl}&quot; target=&quot;_blank&quot;>🔗 차트 링크</a>'" /></div>` : ''}
      </div>` : ''}
    `;
    container.appendChild(div);
  });
  loadChartThumbs();
  renderPositions();
}

// ══ 분할매수·분할매도: 종목별 포지션 추적 (날짜순 이동평균단가) ══
function jKey(e) { return (e.ticker || '').trim() || (e.name || '').trim(); }
function jSortChrono(a, b) { return (a.date || '').localeCompare(b.date || '') || (Number(a.id) - Number(b.id)); }

// 전체 일지 → 거래별 차수/보유수량/평단 + 현재 보유 포지션
function jPositions(list) {
  const perEntry = new Map(), holdings = [];
  const groups = {};
  list.forEach(e => { const k = jKey(e); if (k) (groups[k] = groups[k] || []).push(e); });
  Object.entries(groups).forEach(([k, arr]) => {
    arr.sort(jSortChrono);
    let qty = 0, avg = 0, nb = 0, ns = 0, cycleStart = '', last = null;
    arr.forEach(e => {
      const q = Number(e.qty) || 0;
      if (e.type === '매수') {
        if (qty === 0) { nb = 0; ns = 0; cycleStart = e.date; }
        const p = Number(e.buyPrice) || 0;
        avg = qty + q ? (avg * qty + p * q) / (qty + q) : avg;
        qty += q; nb++;
        perEntry.set(e.id, { seq: nb, qtyAfter: qty, avgAfter: avg, final: false });
      } else if (e.type === '매도') {
        ns++;
        const before = qty;
        qty = Math.max(0, qty - q);
        perEntry.set(e.id, { seq: ns, qtyAfter: qty, avgAfter: qty ? avg : 0, avgBefore: avg, final: qty === 0, over: q > before });
        if (qty === 0) avg = 0;
      }
      last = e;
    });
    if (qty > 0) holdings.push({ key: k, name: last.name, ticker: last.ticker, market: last.market, qty, avg, cost: qty * avg, nb, ns, firstDate: cycleStart, lastDate: last.date });
  });
  holdings.sort((a, b) => b.cost - a.cost);
  return { perEntry, holdings };
}

// 특정 날짜 기준 보유 포지션 (그날 기록분까지 포함)
function jPosAt(key, date) {
  key = (key || '').trim();
  const arr = getJournal().filter(e => jKey(e) === key || (e.name || '').trim() === key)
    .filter(e => !date || (e.date || '') <= date).sort(jSortChrono);
  let qty = 0, avg = 0, nb = 0, ns = 0;
  arr.forEach(e => {
    const q = Number(e.qty) || 0;
    if (e.type === '매수') { if (qty === 0) { nb = 0; ns = 0; } avg = (avg * qty + (Number(e.buyPrice) || 0) * q) / (qty + q || 1); qty += q; nb++; }
    else if (e.type === '매도') { ns++; qty = Math.max(0, qty - q); if (qty === 0) avg = 0; }
  });
  return { qty, avg, nb, ns, count: arr.length };
}

function jSeqText(info, type) {
  if (!info) return '';
  if (type === '매수') return info.seq === 1 ? '신규매수' : `추가매수 ${info.seq}차`;
  return info.final ? `매도 ${info.seq}차 · 전량청산` : `분할매도 ${info.seq}차`;
}
function jSeqBadge(info, type) {
  if (!info) return '';
  const t = jSeqText(info, type);
  const extra = type === '매수'
    ? ` · 평단 ${Math.round(info.avgAfter).toLocaleString()} · ${info.qtyAfter}주`
    : (info.final ? '' : ` · 잔여 ${info.qtyAfter}주`);
  const cls = type === '매수' ? 'seq-buy' : info.final ? 'seq-final' : 'seq-sell';
  return `<span class="memo-badge seq-badge ${cls}">${t}${extra}</span>`;
}

// 입력 중 종목의 현재 포지션 안내 + 매도 시 평단 자동 입력
function jPosHint() {
  const box = document.getElementById('j-pos-hint');
  if (!box) return;
  const key = document.getElementById('j-ticker')?.value.trim() || document.getElementById('j-name')?.value.trim();
  const type = document.getElementById('j-type')?.value;
  const date = document.getElementById('j-date')?.value;
  if (!key) { box.style.display = 'none'; return; }
  const pos = jPosAt(key, date);
  const bp = document.getElementById('j-buy-price');
  const q = parseFloat(document.getElementById('j-qty')?.value) || 0;
  let html = '';
  if (pos.qty > 0) {
    html = `📦 현재 보유 <b>${pos.qty}주</b> · 평단 <b>${Math.round(pos.avg).toLocaleString()}원</b> · 매수 ${pos.nb}회${pos.ns ? ` · 분할매도 ${pos.ns}회` : ''}`;
    if (type === '매수') html += ` → 이번 거래: <b class="seq-buy-t">추가매수 ${pos.nb + 1}차</b>` + (q ? ` (매수 후 ${pos.qty + q}주)` : '');
    else {
      const left = pos.qty - q;
      html += ` → 이번 거래: <b class="seq-sell-t">${q && left <= 0 ? `매도 ${pos.ns + 1}차 · 전량청산` : `분할매도 ${pos.ns + 1}차`}</b>` + (q && left > 0 ? ` (잔여 ${left}주)` : '');
      if (q > pos.qty) html += ` <span style="color:var(--red)">⚠️ 보유 수량 초과</span>`;
      // 매수단가가 비었거나 자동입력값이면 평단으로 채움
      if (bp && (!bp.value || bp.dataset.auto === '1')) {
        const v = String(Math.round(pos.avg));
        if (bp.value !== v) { bp.value = v; bp.dataset.auto = '1'; calcJournal(); return; }
      }
      html += ` <span style="color:var(--text3)">· 매수단가에 평단 자동 입력</span>`;
    }
  } else if (pos.count) {
    html = type === '매수' ? `🆕 일지 기준 보유 없음 → 이번 거래: <b class="seq-buy-t">신규매수 1차</b>` : `⚠️ 일지 기준 보유 수량 없음 (일지 이전 보유분이면 매수단가를 직접 입력)`;
  } else {
    html = type === '매수' ? `🆕 처음 기록하는 종목 → <b class="seq-buy-t">신규매수 1차</b>` : '';
  }
  box.innerHTML = html;
  box.style.display = html ? '' : 'none';
}
document.addEventListener('input', e => { if (e.target?.id === 'j-buy-price') delete e.target.dataset.auto; if (e.target?.id === 'j-date') jPosHint(); });

function renderPositions() {
  const body = document.getElementById('positions-body'); if (!body) return;
  const { holdings } = jPositions(getJournal());
  document.getElementById('positions-empty').style.display = holdings.length ? 'none' : 'block';
  body.innerHTML = holdings.map(h => `<tr>
    <td><div style="font-weight:700; color:var(--text)">${h.name || ''}</div><div style="font-family:var(--mono); font-size:11px; color:var(--text3)">${h.ticker || ''}</div></td>
    <td>${h.market || ''}</td>
    <td style="font-family:var(--mono)">${h.qty.toLocaleString()}주</td>
    <td style="font-family:var(--mono)">${Math.round(h.avg).toLocaleString()}원</td>
    <td style="font-family:var(--mono)">${Math.round(h.cost).toLocaleString()}원</td>
    <td style="font-family:var(--mono)">${h.nb}차</td>
    <td style="font-family:var(--mono)">${h.ns ? h.ns + '회' : '-'}</td>
    <td style="font-family:var(--mono); font-size:11px;">${h.firstDate || ''}</td>
    <td style="font-family:var(--mono); font-size:11px;">${h.lastDate || ''}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-sm" onclick="jQuickTrade('${encodeURIComponent(h.key)}','매수')">+매수</button>
      <button class="btn btn-ghost btn-sm" onclick="jQuickTrade('${encodeURIComponent(h.key)}','매도')">매도</button>
    </td></tr>`).join('');
}

// 포지션에서 바로 추가매수/분할매도 기록
function jQuickTrade(keyEnc, type) {
  const key = decodeURIComponent(keyEnc);
  const h = jPositions(getJournal()).holdings.find(x => x.key === key); if (!h) return;
  clearJournalForm();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  set('j-date', TODAY); set('j-ticker', h.ticker); set('j-name', h.name); set('j-market', h.market || 'KOSPI');
  set('j-type', type);
  if (type === '매도') set('j-qty', h.qty);
  toggleSellFields();
  const target = document.getElementById(type === '매도' ? 'j-sell-price' : 'j-buy-price');
  document.getElementById('j-date').closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => target?.focus(), 350);
}

// ── 종목별 손익 ──
function renderTickerPnl() {
  const list = getJournal();
  const map  = {};
  list.forEach(e => {
    const key = e.ticker || e.name;
    if (!map[key]) map[key] = { name:e.name, ticker:e.ticker||'', market:e.market||'', sector:e.sector||'', buyAmt:0, sellAmt:0, pnlWon:0, count:0 };
    if (e.type === '매수') map[key].buyAmt  += (e.amount||0);
    if (e.type === '매도') map[key].sellAmt += (e.amount||0);
    if (e.pnlWon != null) map[key].pnlWon  += e.pnlWon;
    map[key].count++;
  });

  const tbody = document.getElementById('ticker-pnl-body');
  const empty = document.getElementById('ticker-pnl-empty');
  if (!tbody) return;
  const items = Object.values(map);
  tbody.innerHTML = '';
  empty.style.display = items.length === 0 ? 'block' : 'none';

  items.sort((a,b) => b.pnlWon - a.pnlWon).forEach(item => {
    const pnlPct   = item.buyAmt > 0 ? (item.pnlWon/item.buyAmt*100).toFixed(2) : '-';
    const pnlColor = item.pnlWon >= 0 ? 'var(--accent)' : 'var(--red)';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.name}</strong></td>
      <td style="font-family:var(--mono); font-size:11px;">${item.ticker}</td>
      <td>${item.market}</td>
      <td>${item.sector}</td>
      <td style="font-family:var(--mono);">${item.buyAmt.toLocaleString()}</td>
      <td style="font-family:var(--mono);">${item.sellAmt.toLocaleString()}</td>
      <td style="font-family:var(--mono); color:${pnlColor}; font-weight:700;">${item.pnlWon>=0?'+':''}${item.pnlWon.toLocaleString()}</td>
      <td style="font-family:var(--mono); color:${pnlColor};">${pnlPct !== '-' ? (parseFloat(pnlPct)>=0?'+':'') + pnlPct + '%' : '-'}</td>
      <td style="font-family:var(--mono);">${item.count}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── 월별 성과 ──
function renderMonthYearSelect() {
  const list  = getJournal();
  const years = [...new Set(list.map(e => e.date?.slice(0,4)).filter(Boolean))].sort().reverse();
  const sel   = document.getElementById('month-year-select');
  if (!sel) return;
  const curYear = new Date().getFullYear().toString();
  sel.innerHTML = '';
  if (!years.includes(curYear)) years.unshift(curYear);
  years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y + '년';
    if (y === curYear) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderMonthlyStats() {
  const year = document.getElementById('month-year-select')?.value || new Date().getFullYear().toString();
  const list = getJournal().filter(e => e.date?.startsWith(year));
  const months = Array.from({length:12}, (_,i) => i+1);
  const tbody  = document.getElementById('monthly-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  months.forEach(m => {
    const mStr  = year + '-' + String(m).padStart(2,'0');
    const mList = list.filter(e => e.date?.startsWith(mStr));
    const buyAmt  = mList.filter(e=>e.type==='매수').reduce((a,e)=>a+(e.amount||0),0);
    const sellAmt = mList.filter(e=>e.type==='매도').reduce((a,e)=>a+(e.amount||0),0);
    const pnlWon  = mList.reduce((a,e)=>a+(e.pnlWon||0),0);
    const wins    = mList.filter(e=>e.result==='profit').length;
    const losses  = mList.filter(e=>e.result==='loss').length;
    const wr      = (wins+losses)>0 ? Math.round(wins/(wins+losses)*100) : '-';
    const pnlPct  = buyAmt>0 ? (pnlWon/buyAmt*100).toFixed(1) : '-';
    const pnlColor= pnlWon>0?'var(--accent)':pnlWon<0?'var(--red)':'var(--text3)';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${m}월</strong></td>
      <td style="font-family:var(--mono);">${mList.length}</td>
      <td style="font-family:var(--mono);">${buyAmt?buyAmt.toLocaleString():'-'}</td>
      <td style="font-family:var(--mono);">${sellAmt?sellAmt.toLocaleString():'-'}</td>
      <td style="font-family:var(--mono); color:${pnlColor}; font-weight:${pnlWon?'700':'400'};">${pnlWon?(pnlWon>0?'+':'')+pnlWon.toLocaleString():'-'}</td>
      <td style="font-family:var(--mono); color:${pnlColor};">${pnlPct!=='-'?(parseFloat(pnlPct)>=0?'+':'')+pnlPct+'%':'-'}</td>
      <td style="font-family:var(--mono); color:var(--accent);">${wins||'-'}</td>
      <td style="font-family:var(--mono); color:var(--red);">${losses||'-'}</td>
      <td style="font-family:var(--mono);">${wr!=='-'?wr+'%':'-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── 전체 통계 업데이트 ──
function updateJournalStats() {
  const list    = getJournal();
  const sells   = list.filter(e => e.type === '매도');
  const profits = list.filter(e => e.result === 'profit');
  const losses  = list.filter(e => e.result === 'loss');
  const totalPnlWon = list.reduce((a,e) => a+(e.pnlWon||0), 0);
  const pnlList     = sells.filter(e => e.pnl!=null).map(e=>e.pnl);
  const avg         = pnlList.length ? (pnlList.reduce((a,b)=>a+b,0)/pnlList.length).toFixed(1) : '-';
  const winrate     = (profits.length+losses.length) > 0
    ? Math.round(profits.length/(profits.length+losses.length)*100) : 0;

  const s = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  s('stat-total',  list.length);
  s('stat-profit', profits.length);
  s('stat-loss',   losses.length);
  s('stat-avgpnl', avg!=='-' ? avg+'%' : '-');

  const cumEl = document.getElementById('stat-cumulative');
  if(cumEl) {
    cumEl.textContent = totalPnlWon ? (totalPnlWon>0?'+':'')+totalPnlWon.toLocaleString()+'원' : '-';
    cumEl.style.color = totalPnlWon>0?'var(--accent)':totalPnlWon<0?'var(--red)':'var(--text3)';
    cumEl.style.fontSize = '20px';
  }
  const cwEl = document.getElementById('stat-cumulative-won');
  if(cwEl && pnlList.length) {
    const cumPct = pnlList.reduce((a,b)=>a+b,0).toFixed(1);
    cwEl.textContent = '손익률 합산: ' + (parseFloat(cumPct)>=0?'+':'') + cumPct + '%';
  }

  const wrEl  = document.getElementById('stat-winrate');
  const wrBar = document.getElementById('winrate-bar');
  if(wrEl)  wrEl.textContent  = (profits.length+losses.length)>0 ? winrate+'%' : '-';
  if(wrBar) wrBar.style.width = winrate+'%';

  // 진입 당시 시장 상황별 성과 (매도건 → 동일 종목 직전 매수건의 상황 매칭)
  const stateOf = (sell) => {
    if (sell.flow || sell.volState) return { flow: sell.flow, volState: sell.volState };
    const key = sell.ticker || sell.name;
    const buy = list.filter(b => b.type === '매수' && (b.ticker || b.name) === key && (b.date||'') <= (sell.date||''))
                    .sort((a,b) => (b.date||'').localeCompare(a.date||''))[0];
    return { flow: buy?.flow || '', volState: buy?.volState || '' };
  };
  const closed = sells.filter(e => e.result === 'profit' || e.result === 'loss').map(e => ({ e, st: stateOf(e) }));
  const groupTable = (field, labels, title) => {
    const rows = labels.map(lb => {
      const g = closed.filter(x => (x.st[field] || '미기록') === lb);
      const w = g.filter(x => x.e.result === 'profit').length;
      const pnl = g.reduce((a,x) => a + (x.e.pnlWon || 0), 0);
      if (!g.length) return '';
      return `<tr><td>${lb}</td><td style="font-family:var(--mono);">${g.length}</td>
        <td style="font-family:var(--mono);">${Math.round(w/g.length*100)}%</td>
        <td style="font-family:var(--mono); color:${pnl>=0?'var(--accent)':'var(--red)'};">${(pnl>0?'+':'')+pnl.toLocaleString()}</td></tr>`;
    }).join('');
    return `<div style="font-size:12px; font-weight:700; margin-bottom:6px;">${title}</div>` + (rows
      ? `<table class="watch-table mini-table"><thead><tr><th>상황</th><th>건수</th><th>승률</th><th>실현손익(원)</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<div style="font-size:12px; color:var(--text3);">데이터 없음</div>`);
  };
  const sf = document.getElementById('stat-by-flow');
  const sv = document.getElementById('stat-by-volume');
  if (sf) sf.innerHTML = groupTable('flow', ['외인 양매수','외인 양매도','중립','미기록'], '외인 수급');
  if (sv) sv.innerHTML = groupTable('volState', ['활황','보통','연중 최저치 붕괴','미기록'], '시장 거래대금');

  // 이번 주
  const now = new Date();
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate()-(dow===0?6:dow-1)); monday.setHours(0,0,0,0);
  const thisWeek  = list.filter(e => e.date && new Date(e.date)>=monday);
  const wPnlWon   = thisWeek.reduce((a,e)=>a+(e.pnlWon||0),0);
  const weekly = document.getElementById('stat-weekly');
  if(weekly) weekly.innerHTML = `
    <div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:var(--text2);">거래</span><span style="font-family:var(--mono); font-weight:700;">${thisWeek.length}건</span></div>
    <div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:var(--text2);">수익/손실</span><span style="font-family:var(--mono);">${thisWeek.filter(e=>e.result==='profit').length}✅ / ${thisWeek.filter(e=>e.result==='loss').length}❌</span></div>
    <div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:var(--text2);">실현손익</span><span style="font-family:var(--mono); font-weight:700; color:${wPnlWon>=0?'var(--accent)':'var(--red)'};">${wPnlWon?(wPnlWon>0?'+':'')+wPnlWon.toLocaleString()+'원':'-'}</span></div>
  `;

  // 이번 달
  const thisMonthStr = now.toISOString().slice(0,7);
  const thisMonth    = list.filter(e => e.date?.startsWith(thisMonthStr));
  const mPnlWon      = thisMonth.reduce((a,e)=>a+(e.pnlWon||0),0);
  const monthly = document.getElementById('stat-monthly');
  if(monthly) monthly.innerHTML = `
    <div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:var(--text2);">거래</span><span style="font-family:var(--mono); font-weight:700;">${thisMonth.length}건</span></div>
    <div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:var(--text2);">수익/손실</span><span style="font-family:var(--mono);">${thisMonth.filter(e=>e.result==='profit').length}✅ / ${thisMonth.filter(e=>e.result==='loss').length}❌</span></div>
    <div style="display:flex; justify-content:space-between; font-size:13px;"><span style="color:var(--text2);">실현손익</span><span style="font-family:var(--mono); font-weight:700; color:${mPnlWon>=0?'var(--accent)':'var(--red)'};">${mPnlWon?(mPnlWon>0?'+':'')+mPnlWon.toLocaleString()+'원':'-'}</span></div>
  `;
}

// ── CSV 내보내기 (엑셀 거래기록 시트와 동일 컬럼) ──
function exportJournalCSV() {
  const list = getJournal();
  if (!list.length) { alert('저장된 거래 기록이 없습니다.'); return; }
  const headers = ['거래일','시장','종목코드','종목명','거래유형','수량(주)',
    '매수단가(원)','매도단가(원)','거래금액(원)','수수료(원)','세금(원)',
    '실현손익(원)','손익률(%)','전략/테마','섹터','진입근거','청산근거','메모','투자심리',
    '외인수급','시장거래대금','실전대응태그','차트URL','차수','거래후 보유수량','거래후 평단'];
  const posInfo = jPositions(list).perEntry;
  const rows = list.map(e => [
    e.date||'', e.market||'', e.ticker||'', e.name||'', e.type||'',
    e.qty||'', e.buyPrice||'', e.sellPrice||'', e.amount||'',
    e.fee||'', e.tax||'', e.pnlWon!=null?e.pnlWon:'', e.pnl!=null?e.pnl:'',
    e.strategy||'', e.sector||'', e.entryReason||'', e.exitReason||'', e.memo||'', e.mood||'',
    e.flow||'', e.volState||'', (e.actionTags||[]).join(' | '), e.chartUrl||'',
    jSeqText(posInfo.get(e.id), e.type), posInfo.get(e.id)?.qtyAfter ?? '', posInfo.get(e.id)?.avgAfter ? Math.round(posInfo.get(e.id).avgAfter) : ''
  ].map(v => `"${String(v).replace(/"/g,'""')}"`));
  const bom = '\uFEFF';
  const csv = bom + [headers.map(h=>'"'+h+'"').join(','), ...rows.map(r=>r.join(','))].join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = '투자일지_YS_' + getDateStr() + '.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('📥 CSV 내보내기 완료!');
}

// ── CSV 가져오기 (엑셀에서 내보낸 CSV 호환) ──
function importJournalCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const text  = e.target.result.replace(/^\uFEFF/,'');
      const lines = text.split(/\r?\n/).filter(Boolean);
      const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim());
      let imported = 0;
      const list = getJournal();
      const existDates = new Set(list.map(e => e.date+'_'+e.ticker+'_'+e.type));

      lines.slice(1).forEach(line => {
        const vals = line.match(/(".*?"|[^,]+)(?=,|$)/g) || [];
        const v    = vals.map(s => s.replace(/^"|"$/g,'').replace(/""/g,'"').trim());
        const key  = (v[0]||'') + '_' + (v[2]||'') + '_' + (v[4]||'');
        if (existDates.has(key)) return; // 중복 방지
        const entry = {
          id:          Date.now() + Math.random(),
          date:        v[0]||'', market: v[1]||'KOSPI', ticker: v[2]||'', name: v[3]||'',
          type:        v[4]||'매수', qty: parseFloat(v[5])||0,
          buyPrice:    parseFloat(v[6])||0, sellPrice: parseFloat(v[7])||null,
          amount:      parseFloat(v[8])||0, fee: parseFloat(v[9])||0, tax: parseFloat(v[10])||0,
          pnlWon:      v[11]!==''?parseFloat(v[11]):null, pnl: v[12]!==''?parseFloat(v[12]):null,
          result:      v[11]!==''?(parseFloat(v[11])>=0?'profit':'loss'):'hold',
          strategy:    v[13]||'', sector: v[14]||'',
          entryReason: v[15]||'', exitReason: v[16]||'', memo: v[17]||'', mood: v[18]||'',
          flow: v[19]||'', volState: v[20]||'',
          actionTags: (v[21]||'').split('|').map(t=>t.trim()).filter(Boolean), chartUrl: v[22]||'',
          createdAt:   new Date().toLocaleString('ko-KR')
        };
        list.push(entry);
        existDates.add(key);
        imported++;
      });
      list.sort((a,b) => (b.date||'').localeCompare(a.date||''));
      saveJournal(list);
      renderJournal();
      updateJournalStats();
      showToast(`✅ ${imported}건 가져오기 완료!`);
    } catch(err) { alert('CSV 파싱 오류: ' + err.message); }
    event.target.value = '';
  };
  reader.readAsText(file, 'UTF-8');
}

// ══════════════════════════════════════════
// 🌐 글로벌 리서치
// ══════════════════════════════════════════
const researchData = [
  // ── 글로벌 IB ──
  { cat:'IB', icon:'💼', name:'Goldman Sachs', org:'Goldman Sachs', free:'partial', freeLabel:'일부 무료',
    desc:'Top of Mind 시리즈, Exchanges at GS 팟캐스트. 월스트리트 컨센서스 파악에 최적.',
    tags:['매크로','섹터','팟캐스트'], cycle:'주간', url:'https://www.goldmansachs.com/insights' },
  { cat:'IB', icon:'💼', name:'Morgan Stanley', org:'Morgan Stanley', free:'partial', freeLabel:'일부 무료',
    desc:'"Thoughts on the Market" 일일 팟캐스트, 메가트렌드 테마. 테마 투자 관점 최고 수준.',
    tags:['테마투자','팟캐스트','메가트렌드'], cycle:'일간(팟캐스트)', url:'https://www.morganstanley.com/ideas' },
  { cat:'IB', icon:'💼', name:'JP Morgan', org:'JPMorgan Chase', free:'partial', freeLabel:'일부 무료',
    desc:'"Guide to the Markets" 분기 차트북(60p+) 완전 무료. 글로벌 밸류에이션 파악 필독서.',
    tags:['자산배분','밸류에이션','분기차트북'], cycle:'분기', url:'https://am.jpmorgan.com/kr/ko/asset-management/institutional/insights/market-insights/guide-to-the-markets/' },
  { cat:'IB', icon:'🖤', name:'BlackRock BII', org:'BlackRock Investment Institute', free:'yes', freeLabel:'완전 무료',
    desc:'매주 월요일 시장 코멘터리, 연간 Global Outlook. $10조+ 운용사의 시각을 무료 제공.',
    tags:['주간코멘터리','자산배분','Global Outlook'], cycle:'매주 월요일', url:'https://www.blackrock.com/us/individual/insights' },
  { cat:'IB', icon:'🟢', name:'Fidelity', org:'Fidelity Investments', free:'yes', freeLabel:'완전 무료',
    desc:'투자 교육(초~고급), Fidelity Viewpoints 시장 인사이트, 무료 웨비나. 중급 스킬업 최적.',
    tags:['교육','시장인사이트','웨비나'], cycle:'수시', url:'https://www.fidelity.com/learning-center/overview' },
  { cat:'IB', icon:'🚢', name:'Vanguard', org:'Vanguard Group', free:'yes', freeLabel:'완전 무료',
    desc:'장기·패시브 투자 철학의 본산. 자산배분·은퇴 설계 콘텐츠, 분기 경제 전망 웨비나.',
    tags:['자산배분','패시브투자','ETF'], cycle:'월간·분기', url:'https://investor.vanguard.com/investor-resources-education' },
  { cat:'IB', icon:'🔵', name:'PIMCO', org:'PIMCO', free:'partial', freeLabel:'대부분 무료',
    desc:'Secular Outlook(5년 전망), Cyclical Outlook(분기). 채권·금리 분야 세계 최고.',
    tags:['채권','금리','5년전망'], cycle:'분기·연간', url:'https://www.pimco.com/us/en/insights' },
  { cat:'IB', icon:'🔴', name:'UBS CIO', org:'UBS Global Wealth Management', free:'partial', freeLabel:'일부 무료',
    desc:'Paul Donovan 일일 경제 해설 "Economics without Jargon". Year Ahead 연간 전망.',
    tags:['일일코멘터리','연간전망','매크로'], cycle:'일간·연간', url:'https://www.ubs.com/global/en/wealthmanagement/insights.html' },

  // ── 국제기구 ──
  { cat:'INTL', icon:'🌍', name:'IMF WEO', org:'국제통화기금 (IMF)', free:'yes', freeLabel:'완전 무료',
    desc:'190개국 GDP·인플레·실업률 전망. DB 직접 다운로드 가능. 글로벌 경제 전망의 골드스탠더드.',
    tags:['거시경제','GDP전망','DB제공'], cycle:'반기(4·10월)', url:'https://www.imf.org/en/publications/weo' },
  { cat:'INTL', icon:'🌏', name:'World Bank GEP', org:'세계은행 (World Bank)', free:'yes', freeLabel:'완전 무료',
    desc:'글로벌·신흥국 경제 전망. 베트남·인도 등 EM 투자 판단에 필수.',
    tags:['신흥국','EM투자','원자재전망'], cycle:'반기(1·6월)', url:'https://www.worldbank.org/en/publication/global-economic-prospects' },
  { cat:'INTL', icon:'🏛', name:'OECD Economic Outlook', org:'OECD', free:'yes', freeLabel:'대부분 무료',
    desc:'38개 회원국 분석 + 한국 전용 Economic Survey. 정책 방향성 예측에 유용.',
    tags:['한국경제','정책분석','OECD회원국'], cycle:'연 4회', url:'https://www.oecd.org/en/topics/sub-issues/economic-outlook.html' },
  { cat:'INTL', icon:'🏦', name:'BIS', org:'국제결제은행 (BIS)', free:'yes', freeLabel:'완전 무료',
    desc:'"중앙은행의 중앙은행". 국제 자본흐름·환율·크레딧 구조 이해의 유일한 소스.',
    tags:['금융안정','환율','자본흐름'], cycle:'분기·연간', url:'https://www.bis.org/' },

  // ── 미국 리서치 ──
  { cat:'US', icon:'🏛', name:'Federal Reserve', org:'미국 연방준비제도', free:'yes', freeLabel:'100% 무료',
    desc:'금리 통계(H.15), 산업생산(G.17), FEDS Notes, 워킹페이퍼. 통화정책의 1차 소스.',
    tags:['금리','통화정책','공식데이터'], cycle:'수시·정기', url:'https://www.federalreserve.gov/data.htm' },
  { cat:'US', icon:'📊', name:'FRED', org:'세인트루이스 연방준비은행', free:'yes', freeLabel:'100% 무료',
    desc:'80만+ 경제 데이터 시리즈. CPI·GDP·실업률 등 미국 전 경제 지표 차트화. API 무료 제공.',
    tags:['데이터DB','차트생성','API무료'], cycle:'실시간·정기', url:'https://fred.stlouisfed.org/' },
  { cat:'US', icon:'📈', name:'Yardeni QuickTakes', org:'Yardeni Research', free:'partial', freeLabel:'일부 무료',
    desc:'S&P500 P/E·EPS 차트 최고 전문가. 주 1~3회 무료 + $29/월 구독. 아카이브 차트 무료.',
    tags:['밸류에이션','어닝스','S&P500'], cycle:'일간', url:'https://www.yardeniquicktakes.com/' },
  { cat:'US', icon:'📉', name:'Bespoke Investment', org:'Bespoke Investment Group', free:'paid', freeLabel:'유료(14일무료)',
    desc:'섹터 로테이션·기술적 분석 도구 최강. 14일 무료 체험 가능.',
    tags:['섹터분석','기술적분석','어닝스DB'], cycle:'일간', url:'https://www.bespokepremium.com/' },
  { cat:'US', icon:'🗞', name:'The Daily Shot', org:'The Daily Shot', free:'paid', freeLabel:'유료(일부무료)',
    desc:'100% 시각화 기반 글로벌 매크로 일일 브리핑. X/Twitter @SoberLook 에서 일부 차트 무료.',
    tags:['시각화','글로벌매크로','헤지펀드급'], cycle:'일간', url:'https://thedailyshot.com/' },

  // ── 한국 리서치 ──
  { cat:'KR', icon:'🇰🇷', name:'미래에셋 리서치', org:'미래에셋증권', free:'yes', freeLabel:'비로그인 무료',
    desc:'비로그인 PDF 열람 가능(접근성 최고). 해외·미국 리서치 최강. 유튜브 174만 구독.',
    tags:['기업분석','미국주식','무료열람'], cycle:'수시', url:'https://securities.miraeasset.com/bbs/board/message/list.do?categoryId=1521' },
  { cat:'KR', icon:'🇰🇷', name:'KB증권 리서치', org:'KB증권', free:'partial', freeLabel:'회원가입 무료',
    desc:'KB Core View 자산배분전략. 전용 리서치 사이트(rc.kbsec.com)로 사용 편의성 높음.',
    tags:['자산배분','전용사이트','글로벌전략'], cycle:'수시', url:'https://rc.kbsec.com/main.able' },
  { cat:'KR', icon:'🇰🇷', name:'삼성증권 리서치', org:'삼성증권', free:'partial', freeLabel:'회원가입 무료',
    desc:'보고서 영향력 1위. SPOT코멘트, 33,500+건 리포트 DB. 유튜브 215만 구독.',
    tags:['기업분석','SPOT코멘트','영향력1위'], cycle:'수시', url:'https://www.samsungpop.com/' },
  { cat:'KR', icon:'🇰🇷', name:'KDI 경제동향', org:'한국개발연구원', free:'yes', freeLabel:'완전 무료',
    desc:'아시아 1위 싱크탱크. 월간 경제동향, KDI FOCUS. 정부 GDP·금리 전망 권위 기관.',
    tags:['거시경제','월간동향','정책전망'], cycle:'월간·수시', url:'https://www.kdi.re.kr/research/reportList' },
  { cat:'KR', icon:'🇰🇷', name:'자본시장연구원 KCMI', org:'KCMI', free:'yes', freeLabel:'완전 무료',
    desc:'국내 유일 자본시장 전문 싱크탱크. 공매도·밸류업·ETF 규제 등 제도 변화 1차 소스.',
    tags:['자본시장','제도분석','규제동향'], cycle:'수시', url:'https://www.kcmi.re.kr/report/report_list' },
  { cat:'KR', icon:'🏭', name:'KDB 미래전략연구소', org:'KDB산업은행', free:'yes', freeLabel:'완전 무료',
    desc:'산업정책 관점 심층 분석. 반도체·에너지·첨단산업 보고서. 국책은행 싱크탱크.',
    tags:['산업분석','반도체','에너지'], cycle:'월간·분기', url:'https://www.kdb.co.kr/' },

  // ── 전문가 ──
  { cat:'EXPERT', icon:'👤', name:'Howard Marks 메모', org:'Oaktree Capital', free:'yes', freeLabel:'완전 무료',
    desc:'시장 사이클·리스크·투자 심리의 대가. 1~3개월 간격 장문 메모(10~20p). 워런 버핏이 읽는 메모.',
    tags:['투자철학','사이클','리스크관리'], cycle:'비정기(1~3개월)', url:'https://www.oaktreecapital.com/insights/memos' },
  { cat:'EXPERT', icon:'👤', name:'Ray Dalio', org:'Bridgewater Associates', free:'yes', freeLabel:'무료(LinkedIn)',
    desc:'거시경제 프레임워크·부채 사이클. LinkedIn 주 1~2회 에세이. 올웨더 포트폴리오 창시자.',
    tags:['매크로프레임워크','부채사이클','올웨더'], cycle:'주 1~2회', url:'https://www.linkedin.com/in/raydalio/' },
  { cat:'EXPERT', icon:'👤', name:'Mohamed El-Erian', org:'Allianz (前 PIMCO CEO)', free:'partial', freeLabel:'일부 무료',
    desc:'Fed 정책 분석·채권 전문. Project Syndicate 월 2~4회 칼럼. "뉴 노멀" 개념 창시자.',
    tags:['Fed정책','채권','글로벌매크로'], cycle:'월 2~4회', url:'https://www.project-syndicate.org/columnist/mohamed-a-el-erian' },
  { cat:'EXPERT', icon:'👤', name:'Nouriel Roubini', org:'Roubini Macro Associates', free:'partial', freeLabel:'일부 무료',
    desc:'"닥터 둠" — 위기 시나리오·테일 리스크 전문. 낙관론에 대한 필수 균형추.',
    tags:['테일리스크','위기분석','비관론'], cycle:'월 1~2회', url:'https://www.project-syndicate.org/columnist/nouriel-roubini' },
  { cat:'EXPERT', icon:'🇰🇷', name:'홍춘욱', org:'프리즘투자자문', free:'yes', freeLabel:'무료(YouTube)',
    desc:'26년+ 이코노미스트. YouTube "홍춘욱의 경제강의노트". 데이터 기반 체계적 매크로 분석.',
    tags:['매크로교육','금리·환율','데이터분석'], cycle:'주 2~3회', url:'https://www.youtube.com/@chunwookhong' },
  { cat:'EXPERT', icon:'🇰🇷', name:'오건영', org:'신한은행 WM', free:'yes', freeLabel:'무료(YouTube·FB)',
    desc:'"금융 1타 강사". 매일 아침 페이스북 매크로 에세이 18년+ 연재. Fed·채권·환율 해설 최고.',
    tags:['매크로에세이','Fed해설','채권'], cycle:'매일(에세이)', url:'https://www.youtube.com/@seojaesul' },
  { cat:'EXPERT', icon:'🇰🇷', name:'삼프로TV', org:'삼프로TV', free:'yes', freeLabel:'무료(YouTube)',
    desc:'한국 최대 경제 유튜브(200만+). 매일 아침·오후·저녁 라이브. 전문가 인터뷰.',
    tags:['국내시황','전문가인터뷰','라이브'], cycle:'매일 라이브', url:'https://www.youtube.com/@3protv' },
  { cat:'EXPERT', icon:'🇰🇷', name:'슈카월드', org:'슈카월드', free:'yes', freeLabel:'무료(YouTube)',
    desc:'350만+ 구독. 글로벌 경제·금융 시사 교양. 건전한 투자관. 매주 일요일 라이브.',
    tags:['경제교양','글로벌트렌드','투자관'], cycle:'주 2~3회', url:'https://www.youtube.com/@shukaworld' },

  // ── 뉴스레터 ──
  { cat:'NEWS', icon:'☕', name:'Brew Markets', org:'Morning Brew', free:'yes', freeLabel:'완전 무료',
    desc:'매일 미국 시장 요약. 위트 있는 스타일. 한국 투자자의 미국 시장 파악에 가장 추천.',
    tags:['일간','미국시장','영문'], cycle:'매일(평일)', url:'https://www.brewmarkets.com/subscribe' },
  { cat:'NEWS', icon:'⚡', name:'Axios Markets', org:'Axios', free:'yes', freeLabel:'완전 무료',
    desc:'"Smart Brevity" — 5분 읽기. "Why it matters" 섹션. 가장 간결한 시장·경제 시그널.',
    tags:['일간','간결요약','영문'], cycle:'매일(평일)', url:'https://link.axios.com/join/markets-signup' },
  { cat:'NEWS', icon:'📱', name:'Finimize', org:'Finimize', free:'partial', freeLabel:'기본 무료',
    desc:'매일 2개 핵심 뉴스를 3분 읽기로 요약. 앱(iOS/Android) 지원. 영어 금융 리터러시 향상.',
    tags:['일간','3분읽기','앱지원'], cycle:'매일(평일)', url:'https://finimize.com/newsletter' },
  { cat:'NEWS', icon:'📊', name:'Sherwood News', org:'Robinhood Sherwood', free:'yes', freeLabel:'완전 무료',
    desc:'데이터 시각화 특화 뉴스레터. 차트·인포그래픽으로 복잡한 트렌드 직관적 전달.',
    tags:['시각화','데이터스토리','일간'], cycle:'매일', url:'https://sherwood.news/' },
  { cat:'NEWS', icon:'📰', name:'The Daily Upside', org:'The Daily Upside', free:'yes', freeLabel:'완전 무료',
    desc:'헤지펀드·PE·M&A·금융업계 심층 뉴스. 월스트리트 내부 시각 제공.',
    tags:['금융업계','M&A','헤지펀드'], cycle:'매일(평일)', url:'https://www.thedailyupside.com/' },
];

let researchFilter = 'ALL';

function filterResearch(val, el) {
  researchFilter = val;
  document.querySelectorAll('#panel-research .filter-chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  renderResearch();
}

function renderResearch() {
  const grid = document.getElementById('research-grid');
  if (!grid) return;
  const list = researchFilter === 'ALL' ? researchData : researchData.filter(d => d.cat === researchFilter);
  grid.innerHTML = '';
  list.forEach(d => {
    const freeClass = d.free === 'yes' ? 'rc-free-yes' : d.free === 'partial' ? 'rc-free-partial' : 'rc-free-paid';
    const div = document.createElement('div');
    div.className = 'research-card';
    div.innerHTML = `
      <div class="rc-header">
        <div class="rc-icon">${d.icon}</div>
        <div class="rc-title-block">
          <div class="rc-name">${d.name}</div>
          <div class="rc-org">${d.org}</div>
        </div>
        <span class="rc-free ${freeClass}">${d.freeLabel}</span>
      </div>
      <div class="rc-desc">${d.desc}</div>
      <div class="rc-tags">${d.tags.map(t => `<span class="rc-tag">${t}</span>`).join('')}</div>
      <div class="rc-footer">
        <a class="rc-link" href="${d.url}" target="_blank">🔗 바로가기</a>
        <span class="rc-cycle">${d.cycle}</span>
      </div>
    `;
    grid.appendChild(div);
  });
}

renderResearch();


// ══════════════════════════════════════════
// 🤖 AI 뉴스 필터
// ══════════════════════════════════════════

const NEWS_SOURCES = [
  { id:'gs',        label:'Goldman Sachs',    icon:'💼', url:'https://www.goldmansachs.com/insights/' },
  { id:'ms',        label:'Morgan Stanley',   icon:'💼', url:'https://www.morganstanley.com/ideas' },
  { id:'blackrock', label:'BlackRock BII',    icon:'🖤', url:'https://www.blackrock.com/us/individual/insights' },
  { id:'pimco',     label:'PIMCO',            icon:'🔵', url:'https://www.pimco.com/us/en/insights' },
  { id:'vanguard',  label:'Vanguard',         icon:'🚢', url:'https://investor.vanguard.com/investor-resources-education' },
  { id:'reuters',   label:'Reuters Markets',  icon:'📡', url:'https://www.reuters.com/markets/' },
  { id:'marketwatch',label:'MarketWatch',     icon:'📰', url:'https://www.marketwatch.com/markets' },
  { id:'fred',      label:'FRED Blog',        icon:'📊', url:'https://fredblog.stlouisfed.org/' },
  { id:'imf',       label:'IMF Blog',         icon:'🌍', url:'https://www.imf.org/en/Blogs' },
  { id:'kdi',       label:'KDI 동향',         icon:'🇰🇷', url:'https://www.kdi.re.kr/research/reportList' },
  { id:'miraeasset',label:'미래에셋 리서치',  icon:'🇰🇷', url:'https://securities.miraeasset.com/bbs/board/message/list.do?categoryId=1521' },
  { id:'kcmi',      label:'자본시장연구원',   icon:'🇰🇷', url:'https://www.kcmi.re.kr/report/report_list' },
];

const TOPICS = [
  { id:'equity',   label:'📈 주식/증시' },
  { id:'macro',    label:'🌐 매크로/금리' },
  { id:'sector',   label:'🏭 섹터/산업' },
  { id:'earnings', label:'💰 실적/어닝스' },
  { id:'korea',    label:'🇰🇷 한국시장' },
  { id:'us',       label:'🇺🇸 미국시장' },
  { id:'em',       label:'🌏 신흥국/글로벌' },
  { id:'risk',     label:'⚠️ 리스크/위기' },
  { id:'esg',      label:'🌱 ESG/테마' },
  { id:'fx',       label:'💱 환율/원자재' },
];

let selectedSources = new Set(['blackrock','reuters','marketwatch','gs']);
let selectedTopics  = new Set(['equity','macro','korea','us']);
let aiTimerInterval = null;
let lastRawResult   = '';

// ── 소스 그리드 렌더 ──
function renderSourceGrid() {
  const grid = document.getElementById('sourceGrid');
  if (!grid) return;
  NEWS_SOURCES.forEach(s => {
    const div = document.createElement('div');
    div.className = 'source-chip' + (selectedSources.has(s.id) ? ' selected' : '');
    div.innerHTML = `<input type="checkbox" ${selectedSources.has(s.id) ? 'checked' : ''}> ${s.icon} ${s.label}`;
    div.onclick = () => {
      if (selectedSources.has(s.id)) selectedSources.delete(s.id);
      else selectedSources.add(s.id);
      div.classList.toggle('selected');
      div.querySelector('input').checked = selectedSources.has(s.id);
    };
    grid.appendChild(div);
  });
}

// ── 토픽 칩 렌더 ──
function renderTopicChips() {
  const container = document.getElementById('topicChips');
  if (!container) return;
  TOPICS.forEach(t => {
    const span = document.createElement('span');
    span.className = 'topic-chip' + (selectedTopics.has(t.id) ? ' selected' : '');
    span.textContent = t.label;
    span.onclick = () => {
      if (selectedTopics.has(t.id)) selectedTopics.delete(t.id);
      else selectedTopics.add(t.id);
      span.classList.toggle('selected');
    };
    container.appendChild(span);
  });
}

// ── AI 필터 실행 ──
async function runAIFilter() {
  if (selectedSources.size === 0) { alert('소스를 1개 이상 선택해주세요.'); return; }
  if (selectedTopics.size === 0)  { alert('토픽을 1개 이상 선택해주세요.'); return; }

  const srcs = NEWS_SOURCES.filter(s => selectedSources.has(s.id));
  const topicLabels = TOPICS.filter(t => selectedTopics.has(t.id)).map(t => t.label.replace(/^[^\s]+ /, ''));
  const extraKw = document.getElementById('extraKeywords').value.trim();
  const lang = document.querySelector('input[name="lang"]:checked').value;

  // UI 상태
  document.getElementById('runBtn').disabled = true;
  document.getElementById('aiStatusBar').style.display = 'flex';
  document.getElementById('aiResultHeader').style.display = 'none';
  document.getElementById('aiNewsResults').innerHTML = '';
  setStatus('running', 'AI 분석 중... 선택한 소스의 최신 뉴스를 검색하고 있습니다');

  let elapsed = 0;
  aiTimerInterval = setInterval(() => {
    elapsed++;
    const el = document.getElementById('aiTimer');
    if (el) el.textContent = elapsed + '초 경과';
  }, 1000);

  const srcDesc = srcs.map(s => `${s.icon} ${s.label} (${s.url})`).join('\n');
  const topicDesc = topicLabels.join(', ');
  const prompt = `당신은 글로벌 주식 투자 전문 뉴스 큐레이터입니다.

다음 소스들의 최신 뉴스/인사이트를 검색하여, 주식 투자에 직접적으로 관련된 정보만 선별하고 한국 투자자 관점에서 요약해주세요.

[검색 소스]
${srcDesc}

[관심 토픽]
${topicDesc}${extraKw ? '\n[추가 키워드]\n' + extraKw : ''}

[출력 형식 - 반드시 아래 JSON 배열만 출력, 다른 텍스트 없이]
[
  {
    "title": "뉴스 제목 (${lang === 'ko' ? '한국어로' : 'in English'})",
    "source": "출처명",
    "summary": "${lang === 'ko' ? '한국어 3~4문장 요약. 한국 투자자에게 왜 중요한지 포함.' : '3-4 sentence summary in English. Include why it matters for investors.'}",
    "tags": ["관련태그1", "관련태그2"],
    "importance": "HIGH 또는 MEDIUM",
    "url": "원문 URL (알고 있는 경우)"
  }
]

반드시 주식 투자와 직접 관련된 내용(시장 전망, 금리·환율의 주가 영향, 섹터 분석, 기업 실적, 매크로 지표의 투자 시사점 등)만 포함하세요. 관련 없는 일반 뉴스는 제외하세요.
최소 5개, 최대 12개의 항목을 반환하세요.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    clearInterval(aiTimerInterval);
    const data = await response.json();

    if (data.error) {
      setStatus('error', 'API 오류: ' + (data.error.message || JSON.stringify(data.error)));
      document.getElementById('runBtn').disabled = false;
      return;
    }

    // 텍스트 블록 추출
    const allText = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    lastRawResult = allText;

    // JSON 파싱 시도
    const jsonMatch = allText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      try {
        const items = JSON.parse(jsonMatch[0]);
        renderAIResults(items, srcs, topicLabels);
        setStatus('done', `✅ 완료 — ${items.length}개 관련 뉴스 발견`);
      } catch(e) {
        renderRawResult(allText);
        setStatus('done', '✅ 분석 완료 (텍스트 형태로 표시)');
      }
    } else {
      renderRawResult(allText);
      setStatus('done', '✅ 분석 완료');
    }

    const hdr = document.getElementById('aiResultHeader');
    hdr.style.display = 'block';
    const srcNames = srcs.map(s => s.label).join(', ');
    document.getElementById('aiResultTitle').textContent =
      `📰 ${new Date().toLocaleString('ko-KR')} 기준 — ${srcNames} 주식 관련 뉴스`;

  } catch(err) {
    clearInterval(aiTimerInterval);
    setStatus('error', '오류 발생: ' + err.message);
    console.error(err);
  }

  document.getElementById('runBtn').disabled = false;
}

function setStatus(type, msg) {
  const dot  = document.getElementById('aiDot');
  const text = document.getElementById('aiStatusText');
  if (!dot || !text) return;
  dot.className = 'ai-dot ' + type;
  text.textContent = msg;
}

function renderAIResults(items, srcs, topics) {
  const container = document.getElementById('aiNewsResults');
  container.innerHTML = '';

  const highItems = items.filter(i => i.importance === 'HIGH');
  const medItems  = items.filter(i => i.importance !== 'HIGH');

  const renderGroup = (groupItems, label, color) => {
    if (groupItems.length === 0) return;
    const hdr = document.createElement('div');
    hdr.style.cssText = `font-family:var(--display); font-size:13px; font-weight:700; color:${color}; margin:16px 0 8px; text-transform:uppercase; letter-spacing:0.5px;`;
    hdr.textContent = label + ` (${groupItems.length})`;
    container.appendChild(hdr);

    groupItems.forEach(item => {
      const div = document.createElement('div');
      div.className = 'ai-news-card';
      const tagsHtml = (item.tags || []).map(t => `<span class="ai-news-tag">${t}</span>`).join('');
      const urlHtml = item.url && item.url.startsWith('http')
        ? `<a href="${item.url}" target="_blank" class="rc-link" style="margin-top:8px;">🔗 원문 보기</a>` : '';
      div.innerHTML = `
        <div class="ai-news-header">
          <span class="ai-news-source">${item.source || '알 수 없음'}</span>
          ${item.importance === 'HIGH' ? '<span class="badge badge-red" style="font-size:10px;">HIGH</span>' : '<span class="badge badge-blue" style="font-size:10px;">MEDIUM</span>'}
        </div>
        <div class="ai-news-title">${item.title || ''}</div>
        <div class="ai-news-summary">${item.summary || ''}</div>
        <div class="ai-news-tags">${tagsHtml}</div>
        ${urlHtml}
      `;
      container.appendChild(div);
    });
  };

  renderGroup(highItems, '⚡ 높은 중요도', 'var(--red)');
  renderGroup(medItems,  '📌 참고 정보', 'var(--text2)');
}

function renderRawResult(text) {
  const container = document.getElementById('aiNewsResults');
  const div = document.createElement('div');
  div.className = 'card';
  div.style.whiteSpace = 'pre-wrap';
  div.style.fontFamily = 'var(--mono)';
  div.style.fontSize = '12px';
  div.style.color = 'var(--text2)';
  div.style.lineHeight = '1.7';
  div.textContent = text;
  container.appendChild(div);
}

function copyResults() {
  const text = document.getElementById('aiNewsResults').innerText;
  navigator.clipboard.writeText(text).then(() => alert('결과가 클립보드에 복사됐습니다!'));
}
function clearResults() {
  document.getElementById('aiNewsResults').innerHTML = '';
  document.getElementById('aiResultHeader').style.display = 'none';
  document.getElementById('aiStatusBar').style.display = 'none';
}

// ── 초기화 ──
renderSourceGrid();
renderTopicChips();


// ══════════════════════════════════════════
// 📚 지식 창고
// ══════════════════════════════════════════

// ── 탭 전환 ──
function switchKdTab(id, btn) {
  // panel-knowledge 내부로 스코프 한정
  const panel = document.getElementById('panel-knowledge');
  if (!panel) return;

  panel.querySelectorAll('.kd-tab').forEach(b => b.classList.remove('active'));
  panel.querySelectorAll('.kd-section').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });

  btn.classList.add('active');

  const target = document.getElementById('kd-' + id);
  if (target) {
    target.classList.add('active');
    target.style.display = 'block';
  }

  // 탭 전환 시 해당 섹션 재렌더링
  const renderMap = {
    books:    () => { renderBooks(); },
    notes:    () => { renderNotes(); },
    terms:    () => { renderTerms(); },
    insights: () => { renderInsights(); }
  };
  if (renderMap[id]) renderMap[id]();
  updateKdStats();
}

// ── localStorage 헬퍼 ──
function kdGet(key)      { return JSON.parse(localStorage.getItem('kd_'+key) || '[]'); }
function kdSet(key, arr) { localStorage.setItem('kd_'+key, JSON.stringify(arr)); }

// ── 태그 파싱 ──
function parseTags(str) {
  return str.split(',').map(t=>t.trim()).filter(Boolean);
}

// ── 태그 클라우드 렌더 ──
function renderTagCloud(containerId, tags, activeTag, onClickFn) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  const all = document.createElement('span');
  all.className = 'cloud-tag' + (activeTag === 'ALL' ? ' active' : '');
  all.textContent = '전체';
  all.onclick = () => onClickFn('ALL');
  el.appendChild(all);
  [...new Set(tags)].sort().forEach(tag => {
    const span = document.createElement('span');
    span.className = 'cloud-tag' + (activeTag === tag ? ' active' : '');
    span.textContent = tag;
    span.onclick = () => onClickFn(tag);
    el.appendChild(span);
  });
}

// ── 삭제 공통 ──
function kdDelete(key, id, renderFn) {
  if (!confirm('삭제하시겠습니까?')) return;
  kdSet(key, kdGet(key).filter(i => i.id !== id));
  renderFn();
  updateKdStats();
}

// ─────────────────────────────────────────
// 📖 독서 기록
// ─────────────────────────────────────────
let bkActiveTag = 'ALL';

function addBook() {
  const title  = document.getElementById('bk-title').value.trim();
  const author = document.getElementById('bk-author').value.trim();
  if (!title) { alert('책 제목을 입력해주세요.'); return; }
  const item = {
    id:     Date.now(),
    title, author,
    status: document.getElementById('bk-status').value,
    star:   parseInt(document.getElementById('bk-star').value),
    icon:   document.getElementById('bk-icon').value.trim() || '📗',
    memo:   document.getElementById('bk-memo').value.trim(),
    tags:   parseTags(document.getElementById('bk-tags').value),
    date:   new Date().toLocaleDateString('ko-KR')
  };
  const list = kdGet('books');
  list.unshift(item);
  kdSet('books', list);
  ['bk-title','bk-author','bk-memo','bk-tags','bk-icon'].forEach(id => document.getElementById(id).value = '');
  renderBooks();
  updateKdStats();
}

function renderBooks() {
  const list    = kdGet('books');
  const q       = (document.getElementById('bk-search')?.value || '').toLowerCase();
  const stFil   = document.getElementById('bk-filter-status')?.value || 'ALL';
  const allTags = list.flatMap(b => b.tags);

  renderTagCloud('bk-tag-cloud', allTags, bkActiveTag, tag => { bkActiveTag = tag; renderBooks(); });

  const filtered = list.filter(b => {
    const matchQ   = !q || (b.title+b.author+b.memo).toLowerCase().includes(q);
    const matchSt  = stFil === 'ALL' || b.status === stFil;
    const matchTag = bkActiveTag === 'ALL' || b.tags.includes(bkActiveTag);
    return matchQ && matchSt && matchTag;
  });

  const container = document.getElementById('bk-list');
  const empty     = document.getElementById('bk-empty');
  container.innerHTML = '';
  empty.style.display = filtered.length === 0 ? 'block' : 'none';

  filtered.forEach(b => {
    const stMap = { done:['status-done','✅ 완독'], reading:['status-reading','📖 읽는중'], todo:['status-todo','📌 예정'] };
    const [stCls, stLbl] = stMap[b.status] || stMap.todo;
    const stars = '⭐'.repeat(b.star || 0);
    const tagsHtml = (b.tags||[]).map(t=>`<span class="rc-tag">${t}</span>`).join('');
    const div = document.createElement('div');
    div.className = 'book-card';
    div.innerHTML = `
      <div class="book-spine">${b.icon || '📗'}</div>
      <div class="book-info" id="book-view-${b.id}">
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:4px;">
          <div class="book-title">${b.title}</div>
          <span class="book-status ${stCls}">${stLbl}</span>
        </div>
        ${b.author ? `<div class="book-author">by ${b.author} · ${b.date}</div>` : ''}
        ${stars ? `<div class="book-stars">${stars}</div>` : ''}
        ${b.memo ? `<div class="book-memo">${b.memo}</div>` : ''}
        ${tagsHtml ? `<div class="book-tags">${tagsHtml}</div>` : ''}
      </div>
      <div id="book-edit-${b.id}" style="display:none; flex:1; flex-direction:column; gap:8px;">
        <div class="input-row" style="flex-wrap:wrap;">
          <div><label class="form-label">제목</label><input class="inp inp-md" id="be-title-${b.id}" value="${b.title.replace(/"/g,'&quot;')}" /></div>
          <div><label class="form-label">저자</label><input class="inp inp-sm" id="be-author-${b.id}" value="${(b.author||'').replace(/"/g,'&quot;')}" /></div>
          <div><label class="form-label">상태</label>
            <select class="inp inp-sm" id="be-status-${b.id}">
              <option value="done" ${b.status==='done'?'selected':''}>✅ 완독</option>
              <option value="reading" ${b.status==='reading'?'selected':''}>📖 읽는중</option>
              <option value="todo" ${b.status==='todo'?'selected':''}>📌 예정</option>
            </select>
          </div>
          <div><label class="form-label">별점</label>
            <select class="inp inp-sm" id="be-star-${b.id}">
              ${[5,4,3,2,1].map(n=>`<option value="${n}" ${b.star===n?'selected':''}>${'⭐'.repeat(n)}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">아이콘</label><input class="inp" style="width:56px;text-align:center;font-size:18px;" id="be-icon-${b.id}" value="${b.icon||'📗'}" maxlength="2" /></div>
        </div>
        <div><label class="form-label">핵심 메모</label>
          <textarea class="inp inp-xl" id="be-memo-${b.id}" rows="4">${b.memo||''}</textarea>
        </div>
        <div><label class="form-label">태그 (쉼표로 구분)</label>
          <input class="inp inp-xl" id="be-tags-${b.id}" value="${(b.tags||[]).join(', ')}" />
        </div>
        <div style="display:flex; gap:8px; margin-top:4px;">
          <button class="btn btn-primary btn-sm" onclick="saveBook(${b.id})">💾 저장</button>
          <button class="btn btn-ghost btn-sm" onclick="cancelEditBook(${b.id})">취소</button>
        </div>
      </div>
      <div style="flex-shrink:0; display:flex; flex-direction:column; gap:6px;">
        <button class="btn btn-ghost btn-sm" id="book-edit-btn-${b.id}" onclick="editBook(${b.id})">✏️ 수정</button>
        <button class="btn btn-danger btn-sm" onclick="kdDelete('books',${b.id},renderBooks)">🗑 삭제</button>
      </div>
    `;
    container.appendChild(div);
  });
}

// ─────────────────────────────────────────
// ✏️ 학습 노트
// ─────────────────────────────────────────
let ntActiveTag = 'ALL';

function addNote() {
  const title = document.getElementById('nt-title').value.trim();
  const body  = document.getElementById('nt-body').value.trim();
  if (!title || !body) { alert('제목과 내용을 입력해주세요.'); return; }
  const item = {
    id:   Date.now(),
    title, body,
    cat:  document.getElementById('nt-cat').value,
    tags: parseTags(document.getElementById('nt-tags').value),
    date: new Date().toLocaleDateString('ko-KR')
  };
  const list = kdGet('notes');
  list.unshift(item);
  kdSet('notes', list);
  ['nt-title','nt-body','nt-tags'].forEach(id => document.getElementById(id).value = '');
  renderNotes();
  updateKdStats();
}

function renderNotes() {
  const list  = kdGet('notes');
  const q     = (document.getElementById('nt-search')?.value || '').toLowerCase();
  const catFil = document.getElementById('nt-filter-cat')?.value || 'ALL';
  const allTags = list.flatMap(n => n.tags);

  renderTagCloud('nt-tag-cloud', allTags, ntActiveTag, tag => { ntActiveTag = tag; renderNotes(); });

  const filtered = list.filter(n => {
    const matchQ   = !q || (n.title+n.body).toLowerCase().includes(q);
    const matchCat = catFil === 'ALL' || n.cat === catFil;
    const matchTag = ntActiveTag === 'ALL' || n.tags.includes(ntActiveTag);
    return matchQ && matchCat && matchTag;
  });

  const container = document.getElementById('nt-list');
  const empty     = document.getElementById('nt-empty');
  container.innerHTML = '';
  empty.style.display = filtered.length === 0 ? 'block' : 'none';

  filtered.forEach(n => {
    const tagsHtml = (n.tags||[]).map(t=>`<span class="rc-tag">${t}</span>`).join('');
    const div = document.createElement('div');
    div.className = 'note-card';
    div.innerHTML = `
      <div id="note-view-${n.id}">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; flex-wrap:wrap; gap:8px;">
          <div>
            <div class="note-title">${n.title}</div>
            <span class="badge badge-purple" style="font-size:10px;">${n.cat}</span>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-ghost btn-sm" onclick="editNote(${n.id})">✏️ 수정</button>
            <button class="btn btn-danger btn-sm" onclick="kdDelete('notes',${n.id},renderNotes)">🗑 삭제</button>
          </div>
        </div>
        <div class="note-body">${n.body}</div>
        ${tagsHtml ? `<div class="book-tags" style="margin-top:8px;">${tagsHtml}</div>` : ''}
        <div class="note-meta">${n.date}</div>
      </div>
      <div id="note-edit-${n.id}" style="display:none;">
        <div class="input-row">
          <div style="flex:2;"><label class="form-label">제목</label>
            <input class="inp inp-xl" id="ne-title-${n.id}" value="${n.title.replace(/"/g,'&quot;')}" /></div>
          <div style="flex:1;"><label class="form-label">카테고리</label>
            <select class="inp" id="ne-cat-${n.id}">
              ${['기본적 분석','기술적 분석','거시경제','리스크 관리','투자 심리','포트폴리오','미국시장','한국시장','기타'].map(c=>`<option ${n.cat===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <textarea class="inp inp-xl" id="ne-body-${n.id}" rows="5" style="margin:8px 0;">${n.body}</textarea>
        <input class="inp inp-xl" id="ne-tags-${n.id}" value="${(n.tags||[]).join(', ')}" placeholder="태그 (쉼표로 구분)" />
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="btn btn-primary btn-sm" onclick="saveNote(${n.id})">💾 저장</button>
          <button class="btn btn-ghost btn-sm" onclick="cancelEditNote(${n.id})">취소</button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

// ─────────────────────────────────────────
// 🗂 용어 사전
// ─────────────────────────────────────────
function addTerm() {
  const word = document.getElementById('tm-word').value.trim();
  const def  = document.getElementById('tm-def').value.trim();
  if (!word || !def) { alert('용어와 정의를 입력해주세요.'); return; }
  const item = {
    id: Date.now(),
    word, def,
    eng:     document.getElementById('tm-eng').value.trim(),
    cat:     document.getElementById('tm-cat').value,
    example: document.getElementById('tm-example').value.trim(),
    date:    new Date().toLocaleDateString('ko-KR')
  };
  const list = kdGet('terms');
  list.push(item);
  list.sort((a,b) => a.word.localeCompare(b.word, 'ko'));
  kdSet('terms', list);
  ['tm-word','tm-eng','tm-def','tm-example'].forEach(id => document.getElementById(id).value = '');
  renderTerms();
  updateKdStats();
}

function renderTerms() {
  const list   = kdGet('terms');
  const q      = (document.getElementById('tm-search')?.value || '').toLowerCase();
  const catFil = document.getElementById('tm-filter-cat')?.value || 'ALL';

  // 초성 인덱스 생성
  const firstChars = [...new Set(list.map(t => t.word[0]))].sort((a,b) => a.localeCompare(b,'ko'));
  const alphaEl = document.getElementById('tm-alpha-index');
  if (alphaEl) {
    alphaEl.innerHTML = '';
    firstChars.forEach(ch => {
      const span = document.createElement('span');
      span.className = 'cloud-tag';
      span.textContent = ch;
      span.onclick = () => { document.getElementById('tm-search').value = ch; renderTerms(); };
      alphaEl.appendChild(span);
    });
  }

  const filtered = list.filter(t => {
    const matchQ   = !q || (t.word+t.eng+t.def+t.example).toLowerCase().includes(q);
    const matchCat = catFil === 'ALL' || t.cat === catFil;
    return matchQ && matchCat;
  });

  const container = document.getElementById('tm-list');
  const empty     = document.getElementById('tm-empty');
  container.innerHTML = '';
  empty.style.display = filtered.length === 0 ? 'block' : 'none';

  filtered.forEach(t => {
    const div = document.createElement('div');
    div.className = 'term-card';
    div.innerHTML = `
      <div id="term-view-${t.id}">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:6px;">
          <div>
            <span class="term-word">${t.word}</span>
            ${t.eng ? `<span class="term-eng">${t.eng}</span>` : ''}
            <span class="badge badge-purple" style="font-size:10px; margin-left:8px;">${t.cat}</span>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-ghost btn-sm" onclick="editTerm(${t.id})">✏️ 수정</button>
            <button class="btn btn-danger btn-sm" onclick="kdDelete('terms',${t.id},renderTerms)">🗑 삭제</button>
          </div>
        </div>
        <div class="term-def">${t.def}</div>
        ${t.example ? `<div class="term-example">📌 ${t.example}</div>` : ''}
      </div>
      <div id="term-edit-${t.id}" style="display:none;">
        <div class="input-row">
          <div><label class="form-label">용어</label><input class="inp inp-md" id="te-word-${t.id}" value="${t.word.replace(/"/g,'&quot;')}" /></div>
          <div><label class="form-label">영어</label><input class="inp inp-sm" id="te-eng-${t.id}" value="${(t.eng||'').replace(/"/g,'&quot;')}" /></div>
          <div><label class="form-label">카테고리</label>
            <select class="inp inp-sm" id="te-cat-${t.id}">
              ${['재무지표','기술적분석','거시경제','시장구조','투자전략','기타'].map(c=>`<option ${t.cat===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <textarea class="inp inp-xl" id="te-def-${t.id}" rows="3" style="margin:8px 0;">${t.def}</textarea>
        <input class="inp inp-xl" id="te-example-${t.id}" value="${(t.example||'').replace(/"/g,'&quot;')}" placeholder="실전 예시" />
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="btn btn-primary btn-sm" onclick="saveTerm(${t.id})">💾 저장</button>
          <button class="btn btn-ghost btn-sm" onclick="cancelEditTerm(${t.id})">취소</button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

// ─────────────────────────────────────────
// 💡 인사이트
// ─────────────────────────────────────────
let isActiveTag = 'ALL';

function addInsight() {
  const body = document.getElementById('is-body').value.trim();
  if (!body) { alert('핵심 내용을 입력해주세요.'); return; }
  const item = {
    id:     Date.now(),
    body,
    source: document.getElementById('is-source').value.trim(),
    apply:  document.getElementById('is-apply').value.trim(),
    cat:    document.getElementById('is-cat').value,
    tags:   parseTags(document.getElementById('is-tags').value),
    date:   document.getElementById('is-date').value || new Date().toISOString().split('T')[0]
  };
  const list = kdGet('insights');
  list.unshift(item);
  kdSet('insights', list);
  ['is-source','is-body','is-apply','is-tags'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('is-date').value = new Date().toISOString().split('T')[0];
  renderInsights();
  updateKdStats();
}

function renderInsights() {
  const list   = kdGet('insights');
  const q      = (document.getElementById('is-search')?.value || '').toLowerCase();
  const catFil = document.getElementById('is-filter-cat')?.value || 'ALL';
  const allTags = list.flatMap(i => i.tags);

  renderTagCloud('is-tag-cloud', allTags, isActiveTag, tag => { isActiveTag = tag; renderInsights(); });

  const filtered = list.filter(i => {
    const matchQ   = !q || (i.body+i.source+i.apply+(i.tags||[]).join(' ')).toLowerCase().includes(q);
    const matchCat = catFil === 'ALL' || i.cat === catFil;
    const matchTag = isActiveTag === 'ALL' || (i.tags||[]).includes(isActiveTag);
    return matchQ && matchCat && matchTag;
  });

  const container = document.getElementById('is-list');
  const empty     = document.getElementById('is-empty');
  container.innerHTML = '';
  empty.style.display = filtered.length === 0 ? 'block' : 'none';

  filtered.forEach(i => {
    const tagsHtml = (i.tags||[]).map(t=>`<span class="rc-tag">${t}</span>`).join('');
    const div = document.createElement('div');
    div.className = 'insight-card';
    div.id = 'insight-card-' + i.id;
    div.innerHTML = `
      <div id="insight-view-${i.id}" style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px;">
        <div style="flex:1;">
          <div class="insight-source">
            📌 ${i.source || '출처 미기재'} &nbsp;·&nbsp; ${i.date} &nbsp;·&nbsp;
            <span class="badge badge-gold" style="font-size:10px;">${i.cat}</span>
          </div>
          <div class="insight-body">${i.body}</div>
          ${i.apply ? `<div class="insight-apply">→ 적용: ${i.apply}</div>` : ''}
          ${tagsHtml ? `<div class="book-tags" style="margin-top:8px;">${tagsHtml}</div>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; flex-shrink:0;">
          <button class="btn btn-ghost btn-sm" onclick="editInsight(${i.id})">✏️ 수정</button>
          <button class="btn btn-danger btn-sm" onclick="kdDelete('insights',${i.id},renderInsights)">🗑 삭제</button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

// ── 통계 업데이트 ──
function updateKdStats() {
  const el = document.getElementById('kdStats');
  if (!el) return;
  const books    = kdGet('books');
  const notes    = kdGet('notes');
  const terms    = kdGet('terms');
  const insights = kdGet('insights');
  const done     = books.filter(b => b.status === 'done').length;
  el.innerHTML = `
    <span class="kd-stat">📖 독서 <strong>${books.length}</strong>권 (완독 ${done})</span>
    <span class="kd-stat">✏️ 학습 노트 <strong>${notes.length}</strong>개</span>
    <span class="kd-stat">🗂 용어 <strong>${terms.length}</strong>개</span>
    <span class="kd-stat">💡 인사이트 <strong>${insights.length}</strong>개</span>
  `;
}

// ── 날짜 기본값 ──
(function() {
  const isDate = document.getElementById('is-date');
  if (isDate) isDate.value = new Date().toISOString().split('T')[0];
  const jDate = document.getElementById('j-date');
  if (jDate) jDate.value = new Date().toISOString().split('T')[0];
  // 투자일지 초기 상태 설정
  setTimeout(() => {
    if (typeof toggleSellFields === 'function') toggleSellFields();
  }, 100);
})();

// ── 초기 렌더 ──
// ── 페이지 로드 후 안전하게 초기 렌더링 ──
function initKnowledge() {
  // 첫 번째 탭(books) 강제 활성화
  const panel = document.getElementById('panel-knowledge');
  if (panel) {
    panel.querySelectorAll('.kd-section').forEach(s => {
      s.classList.remove('active');
      s.style.display = 'none';
    });
    const booksSection = document.getElementById('kd-books');
    if (booksSection) {
      booksSection.classList.add('active');
      booksSection.style.display = 'block';
    }
    panel.querySelectorAll('.kd-tab').forEach(b => b.classList.remove('active'));
    const firstTab = panel.querySelector('.kd-tab');
    if (firstTab) firstTab.classList.add('active');
  }
  try { renderBooks(); } catch(e) { console.warn('renderBooks:', e); }
  try { renderNotes(); } catch(e) { console.warn('renderNotes:', e); }
  try { renderTerms(); } catch(e) { console.warn('renderTerms:', e); }
  try { renderInsights(); } catch(e) { console.warn('renderInsights:', e); }
  try { updateKdStats(); } catch(e) { console.warn('updateKdStats:', e); }
}

// DOM 완전 로딩 후 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initKnowledge);
} else {
  initKnowledge();
}


// ── 책 수정 ──
function editBook(id) {
  document.getElementById('book-view-' + id).style.display = 'none';
  document.getElementById('book-edit-' + id).style.display = 'flex';
  document.getElementById('book-edit-btn-' + id).style.display = 'none';
}
function cancelEditBook(id) {
  document.getElementById('book-view-' + id).style.display = '';
  document.getElementById('book-edit-' + id).style.display = 'none';
  document.getElementById('book-edit-btn-' + id).style.display = '';
}
function saveBook(id) {
  const list = kdGet('books');
  const idx  = list.findIndex(b => b.id === id);
  if (idx === -1) return;
  list[idx].title  = document.getElementById('be-title-'  + id).value.trim();
  list[idx].author = document.getElementById('be-author-' + id).value.trim();
  list[idx].status = document.getElementById('be-status-' + id).value;
  list[idx].star   = parseInt(document.getElementById('be-star-'   + id).value);
  list[idx].icon   = document.getElementById('be-icon-'   + id).value.trim() || '📗';
  list[idx].memo   = document.getElementById('be-memo-'   + id).value.trim();
  list[idx].tags   = parseTags(document.getElementById('be-tags-'  + id).value);
  kdSet('books', list);
  renderBooks();
  updateKdStats();
}

// ── 노트 수정 ──
function editNote(id) {
  document.getElementById('note-view-' + id).style.display = 'none';
  document.getElementById('note-edit-' + id).style.display = 'block';
}
function cancelEditNote(id) {
  document.getElementById('note-view-' + id).style.display = 'block';
  document.getElementById('note-edit-' + id).style.display = 'none';
}
function saveNote(id) {
  const list = kdGet('notes');
  const idx  = list.findIndex(n => n.id === id);
  if (idx === -1) return;
  list[idx].title = document.getElementById('ne-title-' + id).value.trim();
  list[idx].cat   = document.getElementById('ne-cat-'   + id).value;
  list[idx].body  = document.getElementById('ne-body-'  + id).value.trim();
  list[idx].tags  = parseTags(document.getElementById('ne-tags-' + id).value);
  kdSet('notes', list);
  renderNotes();
}

// ── 용어 수정 ──
function editTerm(id) {
  document.getElementById('term-view-' + id).style.display = 'none';
  document.getElementById('term-edit-' + id).style.display = 'block';
}
function cancelEditTerm(id) {
  document.getElementById('term-view-' + id).style.display = 'block';
  document.getElementById('term-edit-' + id).style.display = 'none';
}
function saveTerm(id) {
  const list = kdGet('terms');
  const idx  = list.findIndex(t => t.id === id);
  if (idx === -1) return;
  list[idx].word    = document.getElementById('te-word-'    + id).value.trim();
  list[idx].eng     = document.getElementById('te-eng-'     + id).value.trim();
  list[idx].cat     = document.getElementById('te-cat-'     + id).value;
  list[idx].def     = document.getElementById('te-def-'     + id).value.trim();
  list[idx].example = document.getElementById('te-example-' + id).value.trim();
  list.sort((a,b) => a.word.localeCompare(b.word, 'ko'));
  kdSet('terms', list);
  renderTerms();
}

// ── 인사이트 수정 ──
function editInsight(id) {
  const list = kdGet('insights');
  const item = list.find(i => i.id === id);
  if (!item) return;
  const card = document.getElementById('insight-card-' + id);
  const view = document.getElementById('insight-view-' + id);
  view.style.display = 'none';
  const editDiv = document.createElement('div');
  editDiv.id = 'insight-edit-' + id;
  editDiv.innerHTML = `
    <div class="input-row">
      <div style="flex:2;"><label class="form-label">출처</label>
        <input class="inp inp-xl" id="ie-source-${id}" value="${(item.source||'').replace(/"/g,'&quot;')}" /></div>
      <div><label class="form-label">날짜</label>
        <input class="inp inp-sm" type="date" id="ie-date-${id}" value="${item.date||''}" /></div>
      <div><label class="form-label">카테고리</label>
        <select class="inp inp-sm" id="ie-cat-${id}">
          ${['투자 철학','시장 분析','섹터/종목','매크로','리스크','심리','기타'].map(c=>`<option ${item.cat===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <textarea class="inp inp-xl" id="ie-body-${id}" rows="4" style="margin:8px 0;">${item.body||''}</textarea>
    <input class="inp inp-xl" id="ie-apply-${id}" value="${(item.apply||'').replace(/"/g,'&quot;')}" placeholder="→ 적용 방안" style="margin-bottom:8px;" />
    <input class="inp inp-xl" id="ie-tags-${id}" value="${(item.tags||[]).join(', ')}" placeholder="태그" />
    <div style="display:flex; gap:8px; margin-top:8px;">
      <button class="btn btn-primary btn-sm" onclick="saveInsight(${id})">💾 저장</button>
      <button class="btn btn-ghost btn-sm" onclick="cancelEditInsight(${id})">취소</button>
    </div>
  `;
  card.appendChild(editDiv);
}
function cancelEditInsight(id) {
  document.getElementById('insight-view-' + id).style.display = 'flex';
  const editDiv = document.getElementById('insight-edit-' + id);
  if (editDiv) editDiv.remove();
}
function saveInsight(id) {
  const list = kdGet('insights');
  const idx  = list.findIndex(i => i.id === id);
  if (idx === -1) return;
  list[idx].source = document.getElementById('ie-source-' + id).value.trim();
  list[idx].date   = document.getElementById('ie-date-'   + id).value;
  list[idx].cat    = document.getElementById('ie-cat-'    + id).value;
  list[idx].body   = document.getElementById('ie-body-'   + id).value.trim();
  list[idx].apply  = document.getElementById('ie-apply-'  + id).value.trim();
  list[idx].tags   = parseTags(document.getElementById('ie-tags-'   + id).value);
  kdSet('insights', list);
  renderInsights();
}


// ══════════════════════════════════════════
// 💾 데이터 백업 & 복원
// ══════════════════════════════════════════

// ── 지식창고만 내보내기 ──
function exportKnowledge() {
  const data = {
    type: 'knowledge',
    exportedAt: new Date().toLocaleString('ko-KR'),
    books:    kdGet('books'),
    notes:    kdGet('notes'),
    terms:    kdGet('terms'),
    insights: kdGet('insights'),
  };
  downloadJSON(data, 'knowledge_backup_' + getDateStr() + '.json');
  showToast('📚 지식창고 데이터를 내보냈습니다!');
}

// ── 지식창고만 가져오기 ──
function importKnowledge(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.type !== 'knowledge') {
        alert('지식창고 백업 파일이 아닙니다.\n전체 복원은 헤더의 📂 복원 버튼을 사용하세요.');
        return;
      }
      if (!confirm(`백업 파일을 가져오면 현재 데이터에 추가됩니다.\n(내보낸 날짜: ${data.exportedAt})\n\n계속하시겠습니까?`)) return;

      // 기존 데이터에 병합 (id 중복 제거)
      const merge = (key, incoming) => {
        const existing = kdGet(key);
        const existIds = new Set(existing.map(i => i.id));
        const merged = [...existing, ...incoming.filter(i => !existIds.has(i.id))];
        kdSet(key, merged);
      };
      merge('books',    data.books    || []);
      merge('notes',    data.notes    || []);
      merge('terms',    data.terms    || []);
      merge('insights', data.insights || []);

      renderBooks(); renderNotes(); renderTerms(); renderInsights(); updateKdStats();
      showToast('✅ 지식창고 데이터를 가져왔습니다!');
    } catch(err) {
      alert('파일을 읽는 중 오류가 발생했습니다: ' + err.message);
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ── 전체 데이터 내보내기 ──
async function exportAll() {
  // 차트 이미지(IndexedDB) → dataURL로 백업에 포함
  const blobs = await chartAll().catch(() => ({}));
  const charts = {};
  for (const [k, b] of Object.entries(blobs)) {
    charts[k] = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
  }
  const data = {
    charts,
    type: 'full',
    exportedAt: new Date().toLocaleString('ko-KR'),
    version: '1.0',
    // 지식창고
    books:    kdGet('books'),
    notes:    kdGet('notes'),
    terms:    kdGet('terms'),
    insights: kdGet('insights'),
    // 관심종목 & 투자일지
    watchlist: JSON.parse(localStorage.getItem('watchlist') || '[]'),
    journal:   JSON.parse(localStorage.getItem('journal')   || '[]'),
    swing:     JSON.parse(localStorage.getItem('swing_journal') || '[]'),
    // 체크리스트
    checklist_morning: JSON.parse(localStorage.getItem('checklist-morning') || '{}'),
    checklist_midday:  JSON.parse(localStorage.getItem('checklist-midday')  || '{}'),
    checklist_evening: JSON.parse(localStorage.getItem('checklist-evening') || '{}'),
  };
  downloadJSON(data, 'investlearn_backup_' + getDateStr() + '.json');
  showToast('💾 전체 데이터를 백업했습니다!');
}

// ── 전체 데이터 복원 ──
function importAll(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!confirm(
        `전체 백업 파일을 복원합니다.\n내보낸 날짜: ${data.exportedAt}\n\n⚠️ 현재 저장된 데이터에 병합됩니다.\n계속하시겠습니까?`
      )) return;

      // 지식창고 병합
      const mergeKd = (key, incoming) => {
        const existing = kdGet(key);
        const existIds = new Set(existing.map(i => i.id));
        kdSet(key, [...existing, ...(incoming||[]).filter(i => !existIds.has(i.id))]);
      };
      mergeKd('books',    data.books);
      mergeKd('notes',    data.notes);
      mergeKd('terms',    data.terms);
      mergeKd('insights', data.insights);

      // 관심종목 병합
      if (data.watchlist) {
        const existing = JSON.parse(localStorage.getItem('watchlist') || '[]');
        const existIds = new Set(existing.map(i => i.id));
        localStorage.setItem('watchlist', JSON.stringify([
          ...existing,
          ...(data.watchlist||[]).filter(i => !existIds.has(i.id))
        ]));
      }

      // 투자일지 병합
      if (data.journal) {
        const existing = JSON.parse(localStorage.getItem('journal') || '[]');
        const existIds = new Set(existing.map(i => i.id));
        localStorage.setItem('journal', JSON.stringify([
          ...existing,
          ...(data.journal||[]).filter(i => !existIds.has(i.id))
        ]));
      }

      // 스윙일지 병합
      if (data.swing) {
        const existing = JSON.parse(localStorage.getItem('swing_journal') || '[]');
        const existIds = new Set(existing.map(i => i.id));
        localStorage.setItem('swing_journal', JSON.stringify([...existing, ...data.swing.filter(i => !existIds.has(i.id))]));
      }

      // 차트 이미지 복원
      if (data.charts) {
        for (const [k, du] of Object.entries(data.charts)) {
          try { const b = await (await fetch(du)).blob(); await chartPut(k, b); } catch(_) {}
        }
      }

      // 전체 재렌더링
      renderBooks(); renderNotes(); renderTerms(); renderInsights(); updateKdStats();
      renderWatchList();
      renderJournal(); updateJournalStats();
      swRender();
      showToast('✅ 전체 데이터를 복원했습니다!');
    } catch(err) {
      alert('파일을 읽는 중 오류가 발생했습니다: ' + err.message);
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ── 공통 유틸 ──
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getDateStr() {
  const d = new Date();
  return d.getFullYear() + ('0'+(d.getMonth()+1)).slice(-2) + ('0'+d.getDate()).slice(-2);
}

// ── 토스트 알림 ──
function showToast(msg) {
  let toast = document.getElementById('toast-msg');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-msg';
    toast.style.cssText = `
      position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
      background:var(--text); color:var(--bg); padding:12px 24px;
      border-radius:24px; font-size:13px; font-weight:600;
      z-index:9999; opacity:0; transition:opacity 0.3s;
      white-space:nowrap; box-shadow:0 4px 20px #00000030;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}
// ══════════════════════════════════════════
// 🌊 단기 스윙 매매일지 (분할매수·분할매도 지원)
// ══════════════════════════════════════════
const SW_KEY = 'swing_journal';
const SW_FEE = 0.0005, SW_TAX = 0.0018; // 투자일지와 동일 요율 (매수·매도 수수료 + 매도 세금)
const SW_TYPES = ['65기법', '종가 스윙', '7일매매기법', '상승추세절반', '세력힘포착', '기타'];
const SW_REASONS = ['목표가 달성', '거래대금 부진 청산', '손절선 이탈'];
let swFilters = { st: 'ALL', tp: 'ALL' };
let swSignals = new Set();

function swEsc(t) { return String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function swBr(t) { return swEsc(t).replace(/\n/g, '<br>'); }
function swWon(n) { return n == null || isNaN(n) ? '-' : Math.round(n).toLocaleString() + '원'; }
function swSigned(n, unit) { return n == null || isNaN(n) ? '-' : (n > 0 ? '+' : '') + (unit === '%' ? n.toFixed(2) + '%' : Math.round(n).toLocaleString() + '원'); }
function swNum(id) { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? null : v; }
function swVal(id) { return (document.getElementById(id)?.value || '').trim(); }
function swColor(n) { return n == null ? 'var(--text3)' : n >= 0 ? 'var(--accent)' : 'var(--red)'; }

// 기준가 대비 등락률(%) 문자열
function swPct(price, base) {
  if (!price || !base) return null;
  const v = (price - base) / base * 100;
  return (v > 0 ? '+' : '') + v.toFixed(2) + '%';
}
function swPriceWithPct(price, base) {
  if (!price) return '-';
  const p = swPct(price, base);
  return swWon(price) + (p ? ` (${p})` : '');
}

// 저장소 + 구버전(단일 진입/청산) 레코드 자동 변환
function swNorm(r) {
  if (Array.isArray(r.buys)) return r;
  const n = { ...r, buys: [], sells: [] };
  if (r.entryDate || r.entryPrice || r.qty) n.buys.push({ date: r.entryDate || '', price: r.entryPrice || null, qty: r.qty || null, memo: '' });
  if (r.exitDate && r.exitPrice) n.sells.push({ date: r.exitDate, price: r.exitPrice, qty: r.qty || null, reason: r.exitReason || '', memo: '' });
  return n;
}
function swGet() { try { return JSON.parse(localStorage.getItem(SW_KEY) || '[]').map(swNorm); } catch(e) { return []; } }
function swPut(a) { localStorage.setItem(SW_KEY, JSON.stringify(a)); }

// 시가총액(억원) → 원칙 한도(원). 1천억 미만은 원칙에 정의 없음 → null
function swLimit(capEok) {
  if (capEok == null) return undefined;
  if (capEok >= 100000) return 10000000;
  if (capEok >= 10000)  return 5000000;
  if (capEok >= 1000)   return 1000000;
  return null;
}
function swCapLabel(capEok) {
  if (capEok == null) return '-';
  return capEok >= 10000 ? (capEok / 10000).toFixed(capEok >= 100000 ? 0 : 1).replace(/\.0$/, '') + '조' : capEok.toLocaleString() + '억';
}
// 보유 거래일 (주말 제외, 공휴일 미반영): 시작일 다음 날부터 종료일까지
function swHoldDays(from, to) {
  if (!from) return null;
  const a = new Date(from + 'T00:00:00'), b = to ? new Date(to + 'T00:00:00') : new Date(TODAY + 'T00:00:00');
  let n = 0; const c = new Date(a);
  while (c < b) { c.setDate(c.getDate() + 1); const w = c.getDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}
function swDaysBetween(from, to) {
  if (!from || !to) return null;
  return Math.round((new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000);
}

// ── 파생값 계산: 날짜순 이동평균단가 방식 (증권사 평균단가와 동일 개념) ──
function swDerive(r0) {
  const r = swNorm(r0);
  const valid = l => l.date && l.price > 0 && l.qty > 0;
  const buys  = r.buys.filter(valid).map(l => ({ ...l, k: 'b' }));
  const sells = r.sells.filter(valid).map(l => ({ ...l, k: 's' }));
  const ev = [...buys, ...sells].sort((a, b) => a.date.localeCompare(b.date) || (a.k === 'b' ? -1 : 1));

  let qty = 0, avg = 0, peak = 0, gross = 0, basisSold = 0, oversell = false;
  const buyLegs = [], sellLegs = [];
  for (const e of ev) {
    if (e.k === 'b') {
      avg = (avg * qty + e.price * e.qty) / (qty + e.qty);
      qty += e.qty;
      peak = Math.max(peak, qty * avg);
      buyLegs.push({ ...e, n: buyLegs.length + 1, avgAfter: avg, qtyAfter: qty });
    } else {
      if (e.qty > qty) oversell = true;
      const q = Math.min(e.qty, qty);
      const g = (e.price - avg) * q;
      gross += g; basisSold += avg * q;
      sellLegs.push({ ...e, n: sellLegs.length + 1, avgAt: avg, gain: g, pct: avg ? (e.price - avg) / avg * 100 : null, qtyAfter: qty - q });
      qty -= q;
      if (qty === 0) avg = 0;
    }
  }
  const bought = buys.reduce((a, l) => a + l.qty, 0);
  const sold   = sells.reduce((a, l) => a + l.qty, 0);
  const buyAmt  = buys.reduce((a, l) => a + l.price * l.qty, 0);
  const sellAmt = sells.reduce((a, l) => a + l.price * l.qty, 0);
  const status = !sellLegs.length ? 'open' : qty > 0 ? 'partial' : 'closed';

  // 비용: 매도분 수수료·세금 전액 + 매수 수수료는 매도된 원가 비율만큼 배분
  const buyFee = buyAmt * SW_FEE;
  const autoCost = Math.round(sellAmt * (SW_FEE + SW_TAX) + (buyAmt ? buyFee * Math.min(1, basisSold / buyAmt) : 0));
  const cost = r.cost != null ? r.cost : autoCost;
  const pnl = sellLegs.length ? Math.round(gross - cost) : null;
  const pnlPct = basisSold ? +(pnl / basisSold * 100).toFixed(2) : null;

  const firstBuy = buyLegs[0]?.date || '';
  const lastSell = sellLegs[sellLegs.length - 1];
  const avgBuy = bought ? buyAmt / bought : null;
  const limit = swLimit(r.cap);
  return {
    r, buyLegs, sellLegs, bought, sold, remain: qty, avgBuy, avgNow: qty ? avg : null,
    avgSell: sold ? sellAmt / sold : null, buyAmt, sellAmt, peak, status, closed: status === 'closed',
    oversell, cost, autoCost, pnl, pnlPct, basisSold, firstBuy,
    lastSellDate: lastSell?.date || '', exitReason: status === 'closed' ? (lastSell?.reason || '') : '',
    limit, limitOk: limit ? peak <= limit : null,
    hold: swHoldDays(firstBuy, status === 'closed' ? lastSell.date : null),
    watchDays: swDaysBetween(r.watchDate, firstBuy),
  };
}

// ── 매수/매도 행 UI ──
function swLegRow(kind, l = {}) {
  const row = document.createElement('div');
  row.className = 'sw-leg ' + kind;
  row.innerHTML = `
    <span class="sw-leg-n"></span>
    <input class="inp sw-l-date" type="date" value="${l.date || ''}" oninput="swCalc()" />
    <input class="inp sw-l-price" type="number" placeholder="${kind === 'buy' ? '매수가' : '매도가'}(원)" value="${l.price ?? ''}" oninput="swCalc()" />
    <input class="inp sw-l-qty" type="number" placeholder="수량(주)" value="${l.qty ?? ''}" oninput="swCalc()" />
    ${kind === 'sell' ? `<select class="inp sw-l-reason"><option value="">사유</option>${SW_REASONS.map(o => `<option${l.reason === o ? ' selected' : ''}>${o}</option>`).join('')}</select>` : ''}
    <input class="inp sw-l-memo" placeholder="${kind === 'buy' ? '근거 (예: 20일선 지지 확인 후 2차)' : '메모 (예: 절반 익절)'}" value="${swEsc(l.memo || '')}" />
    <span class="sw-leg-info"></span>
    <button type="button" class="sw-leg-del" title="삭제" onclick="this.parentElement.remove(); swCalc();">✕</button>`;
  return row;
}
function swAddLeg(kind, l) {
  const box = document.getElementById(kind === 'buy' ? 'sw-buys' : 'sw-sells');
  const row = swLegRow(kind, l || { date: TODAY });
  box.appendChild(row);
  swCalc();
  return row;
}
function swReadLegs(kind) {
  return [...document.querySelectorAll(`#${kind === 'buy' ? 'sw-buys' : 'sw-sells'} .sw-leg`)].map(row => {
    const num = c => { const v = parseFloat(row.querySelector(c)?.value); return isNaN(v) ? null : v; };
    const o = { date: row.querySelector('.sw-l-date').value, price: num('.sw-l-price'), qty: num('.sw-l-qty'), memo: row.querySelector('.sw-l-memo').value.trim() };
    if (kind === 'sell') o.reason = row.querySelector('.sw-l-reason').value;
    return o;
  }).filter(l => l.date || l.price || l.qty || l.memo);
}

function swReadForm() {
  return {
    id: document.getElementById('sw-id').value ? Number(document.getElementById('sw-id').value) : null,
    name: swVal('sw-name'), ticker: swVal('sw-ticker'), type: swVal('sw-type'),
    buys: swReadLegs('buy'), sells: swReadLegs('sell'),
    target: swNum('sw-target'), stop: swNum('sw-stop'),
    watchDate: swVal('sw-watch-date'), q1: swVal('sw-q1'), q2: swVal('sw-q2'),
    signals: [...swSignals], cap: swNum('sw-cap'),
    right: swVal('sw-right'), q4: swVal('sw-q4'), cost: swNum('sw-cost'),
    good: swVal('sw-good'), fix: swVal('sw-fix'), rule: swVal('sw-rule'),
  };
}

function swSeg(field, btn) {
  const h = document.getElementById(field);
  const same = h.value === btn.dataset.v;
  btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('on'));
  h.value = same ? '' : btn.dataset.v;
  if (!same) btn.classList.add('on');
}
function swSetSeg(field, v) {
  document.getElementById(field).value = v || '';
  document.querySelectorAll('#' + field + '-seg button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
}
function swSig(btn) {
  const v = btn.dataset.v;
  swSignals.has(v) ? swSignals.delete(v) : swSignals.add(v);
  btn.classList.toggle('tag-on', swSignals.has(v));
  swSigCount();
}
function swSigCount() {
  const n = swSignals.size, el = document.getElementById('sw-sig-count');
  if (el) { el.textContent = n ? `${n}/5` : ''; el.style.color = n >= 3 ? 'var(--accent)' : 'var(--text3)'; }
}

// ── 실시간 자동 계산 ──
function swCalc() {
  const r = swReadForm(), x = swDerive(r);

  // 행 번호 + 행별 정보 (날짜순 차수)
  const fillRows = (kind, legs) => {
    const rows = [...document.querySelectorAll(`#${kind === 'buy' ? 'sw-buys' : 'sw-sells'} .sw-leg`)];
    rows.forEach(row => {
      const d = row.querySelector('.sw-l-date').value, p = parseFloat(row.querySelector('.sw-l-price').value), q = parseFloat(row.querySelector('.sw-l-qty').value);
      const leg = legs.find(l => l.date === d && l.price === p && l.qty === q && !l._used);
      const nEl = row.querySelector('.sw-leg-n'), info = row.querySelector('.sw-leg-info');
      if (leg) {
        leg._used = true;
        nEl.textContent = leg.n + '차';
        info.innerHTML = kind === 'buy'
          ? `평단 ${Math.round(leg.avgAfter).toLocaleString()} · 보유 ${leg.qtyAfter}주`
          : `<b style="color:${swColor(leg.gain)}">${swSigned(leg.pct, '%')}</b> · 잔여 ${leg.qtyAfter}주`;
      } else { nEl.textContent = '–'; info.textContent = ''; }
    });
  };
  fillRows('buy', x.buyLegs); fillRows('sell', x.sellLegs);

  // 목표가·손절가: 평균 매수단가 대비
  const base = x.avgBuy;
  [['sw-target-pct', r.target], ['sw-stop-pct', r.stop]].forEach(([id, v]) => {
    const el = document.getElementById(id); if (!el) return;
    const p = swPct(v, base);
    el.textContent = p ? '평단 대비 ' + p : '';
    el.style.color = p ? (p.startsWith('-') ? 'var(--red)' : 'var(--accent)') : '';
  });

  // Q3 한도 판정 (최대 보유 원가 기준)
  const lb = document.getElementById('sw-limit-box');
  if (lb) {
    if (r.cap == null) { lb.className = 'sw-limit-box'; lb.textContent = '시가총액을 입력하면 원칙 한도와 준수 여부가 자동 판정됩니다.'; }
    else if (x.limit === null) { lb.className = 'sw-limit-box warn'; lb.innerHTML = `시총 <b>${swCapLabel(r.cap)}</b> — 1천억 미만: 원칙에 한도 정의 없음`; }
    else {
      lb.className = 'sw-limit-box ' + (x.peak ? (x.limitOk ? 'ok' : 'ng') : '');
      lb.innerHTML = `시총 <b>${swCapLabel(r.cap)}</b> → 원칙 한도 <b>${swWon(x.limit)}</b>` +
        (x.peak ? ` · 최대 투입 <b>${swWon(x.peak)}</b> (${(x.peak / x.limit * 100).toFixed(0)}%) ${x.limitOk ? '✅ 준수' : '❌ 한도 초과'}` : '') +
        (x.buyLegs.length > 1 ? '<span style="color:var(--text3)"> · 분할매수 합산</span>' : '');
    }
  }

  const c = document.getElementById('sw-calc');
  if (!c) return;
  const stTxt = { open: '🟡 보유중', partial: '🟠 부분청산', closed: '✅ 청산완료' }[x.status];
  const items = [
    ['상태', x.bought ? stTxt : '-'],
    ['총 매수', x.bought ? `${x.bought}주 · ${swWon(x.buyAmt)}` : '-'],
    ['평균 매수단가', x.avgBuy ? swWon(x.avgBuy) : '-'],
    x.sold ? ['총 매도', `${x.sold}주 · 평균 ${swWon(x.avgSell)}`] : null,
    ['잔여', x.bought ? `${x.remain}주` + (x.avgNow ? ` (평단 ${swWon(x.avgNow)})` : '') : '-'],
    ['관찰 기간', x.watchDays != null ? x.watchDays + '일' : '-'],
    ['보유', x.hold != null ? x.hold + '거래일' + (x.hold > 5 ? ' ⚠️' : '') : '-'],
    x.sold ? [x.closed ? '최종 손익' : '실현 손익', `<span style="color:${swColor(x.pnl)}">${swSigned(x.pnl)} (${swSigned(x.pnlPct, '%')})</span>`] : null,
  ].filter(Boolean);
  c.innerHTML = (x.oversell ? '<span style="color:var(--red); font-weight:700;">⚠️ 매도 수량이 보유 수량보다 많습니다</span>' : '') +
    items.map(([k, v]) => `<span><span style="color:var(--text3);">${k}</span> <strong>${v}</strong></span>`).join('');
  const costEl = document.getElementById('sw-cost');
  if (costEl) costEl.placeholder = x.sold ? x.autoCost.toLocaleString() : '자동계산';
}

function swClear() {
  ['sw-id','sw-name','sw-ticker','sw-target','sw-stop','sw-watch-date',
   'sw-q1','sw-q2','sw-cap','sw-q4','sw-cost','sw-good','sw-fix','sw-rule']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('sw-buys').innerHTML = '';
  document.getElementById('sw-sells').innerHTML = '';
  swAddLeg('buy', { date: '' });
  swSetSeg('sw-type', ''); swSetSeg('sw-right', '');
  swSignals.clear(); document.querySelectorAll('.sw-sig').forEach(b => b.classList.remove('tag-on')); swSigCount();
  document.getElementById('sw-form-title').textContent = '새 스윙 매매 기록';
  document.getElementById('sw-edit-badge').style.display = 'none';
  document.getElementById('sw-save-btn').textContent = '💾 기록 저장';
  swCalc();
}

function swSave() {
  const r = swReadForm();
  if (!r.name) { alert('종목명을 입력해주세요.'); return; }
  if (!r.type) { alert('매매 구분을 선택해주세요.'); return; }
  const bad = (legs, label) => legs.find(l => !l.date || !(l.price > 0) || !(l.qty > 0)) && `${label} 내역에 날짜·가격·수량이 빠진 행이 있습니다.`;
  const err = bad(r.buys, '매수') || bad(r.sells, '매도');
  if (err) { alert(err); return; }
  if (!r.buys.length) { alert('매수 내역을 1건 이상 입력해주세요.'); return; }
  const x = swDerive(r);
  if (x.oversell) { alert('매도 수량이 그 시점 보유 수량보다 많습니다. 날짜와 수량을 확인해주세요.'); return; }
  if (x.limitOk === false &&
      !confirm(`원칙 한도 ${swWon(x.limit)}를 초과했습니다 (최대 투입 ${swWon(x.peak)}).\n초과 상태로 기록할까요?`)) return;

  // 날짜순 정렬해서 저장
  const byDate = (a, b) => a.date.localeCompare(b.date);
  r.buys.sort(byDate); r.sells.sort(byDate);
  r.entryDate = x.firstBuy; // 정렬·호환용

  const list = swGet();
  const now = new Date().toLocaleString('ko-KR');
  if (r.id) {
    const i = list.findIndex(e => e.id === r.id);
    if (i >= 0) {
      const { entryPrice, qty, exitDate, exitPrice, exitReason, ...rest } = list[i]; // 구버전 필드 제거
      list[i] = { ...rest, ...r, updatedAt: now };
    }
  } else {
    list.unshift({ ...r, id: Date.now(), createdAt: now });
  }
  swPut(list);
  swClear(); swRender();
  showToast(r.id ? '✅ 스윙 기록이 수정됐습니다!' : '✅ 스윙 기록이 저장됐습니다!');
}

// mode: undefined(수정) / 'buy'(추가매수) / 'sell'(분할매도)
function swEdit(id, mode) {
  const r = swGet().find(e => e.id === id); if (!r) return;
  swClear();
  const set = (k, v) => { const el = document.getElementById(k); if (el) el.value = v ?? ''; };
  set('sw-id', r.id); set('sw-name', r.name); set('sw-ticker', r.ticker);
  set('sw-target', r.target); set('sw-stop', r.stop);
  set('sw-watch-date', r.watchDate); set('sw-q1', r.q1); set('sw-q2', r.q2); set('sw-cap', r.cap);
  set('sw-q4', r.q4); set('sw-cost', r.cost);
  set('sw-good', r.good); set('sw-fix', r.fix); set('sw-rule', r.rule);
  document.getElementById('sw-buys').innerHTML = '';
  r.buys.forEach(l => swAddLeg('buy', l));
  r.sells.forEach(l => swAddLeg('sell', l));
  swSetSeg('sw-type', r.type); swSetSeg('sw-right', r.right);
  (r.signals || []).forEach(v => swSignals.add(v));
  document.querySelectorAll('.sw-sig').forEach(b => b.classList.toggle('tag-on', swSignals.has(b.dataset.v))); swSigCount();

  let focusRow = null;
  if (mode === 'buy') focusRow = swAddLeg('buy');
  if (mode === 'sell') {
    const x0 = swDerive(r);
    focusRow = swAddLeg('sell', { date: TODAY, qty: x0.remain || null });
  }
  const label = { buy: '— 추가 매수', sell: '— 분할 매도' }[mode] || '기록 수정';
  document.getElementById('sw-form-title').textContent = `${r.name} ${label}`;
  document.getElementById('sw-edit-badge').style.display = '';
  document.getElementById('sw-save-btn').textContent = '💾 수정 저장';
  swCalc();
  (focusRow || document.querySelector('#panel-swing .swing-form')).scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (focusRow) setTimeout(() => focusRow.querySelector('.sw-l-price').focus(), 300);
}

function swDelete(id) {
  if (!confirm('이 스윙 기록을 삭제하시겠습니까?')) return;
  swPut(swGet().filter(e => e.id !== id)); swRender();
}

function swFilter(key, val, el) {
  swFilters[key] = val;
  document.querySelectorAll('#panel-swing .sw-' + key).forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  swRenderList();
}

// 사용자 템플릿 형식의 마크다운 (Claude 스윙 프로젝트 등에 붙여넣기용)
function swMarkdown(r0) {
  const x = swDerive(r0), r = x.r, fmt = n => n == null ? '' : Math.round(Number(n)).toLocaleString();
  const lim = x.limit === undefined ? '' : x.limit === null ? '1천억 미만 (원칙 한도 정의 없음)' : swWon(x.limit);
  const comply = x.limit ? `최대 투입 ${swWon(x.peak)} / ${x.limitOk ? '준수' : '초과'} (한도 대비 ${(x.peak / x.limit * 100).toFixed(0)}%)` : swWon(x.peak);
  const ml = t => (t || '').replace(/\n/g, '\n  ');
  return [
    `### [단기 스윙 매매일지] ${r.name}${r.ticker ? ` (${r.ticker})` : ''}`, '',
    `1. 기본 정보`,
    `- 매매 구분: ${r.type || ''}`,
    ...(x.buyLegs.length > 1
      ? [`- 분할매수 ${x.buyLegs.length}회:`, ...x.buyLegs.map(l => `  - ${l.n}차 ${l.date} / ${fmt(l.price)}원 × ${fmt(l.qty)}주${l.memo ? ` — ${l.memo}` : ''}`),
         `- 평균 매수단가 / 총 수량 / 총 매수금액: ${fmt(x.avgBuy)}원 / ${fmt(x.bought)}주 / ${fmt(x.buyAmt)}원`]
      : [`- 진입 일자 / 단가: ${x.firstBuy} / ${fmt(x.avgBuy)}원`, `- 체결 수량 / 진입 금액: ${fmt(x.bought)}주 / ${fmt(x.buyAmt)}원`]),
    (r.target || r.stop) ? `- 목표가 / 손절가 (평단 대비): ${swPriceWithPct(r.target, x.avgBuy)} / ${swPriceWithPct(r.stop, x.avgBuy)}` : null, '',
    `2. 핵심 5대 점검 항목`,
    `Q1. 언제부터 관찰했는지?`,
    `- ${r.watchDate ? r.watchDate + (x.watchDays != null ? ` (첫 진입까지 ${x.watchDays}일)` : '') + (r.q1 ? ' — ' : '') : ''}${r.q1 || ''}`, '',
    `Q2. 지금 매수하는 이유는 무엇인지?`,
    `- ${ml(r.q2)}`,
    (r.signals || []).length ? `- 세력 개입 신호 ${r.signals.length}/5: ${r.signals.join(', ')}` : null, '',
    `Q3. 종목에 따른 매수 한도는 얼마인지?`,
    `- 종목 시가총액: ${r.cap != null ? swCapLabel(r.cap) : ''}`,
    `- 원칙상 최대 한도: ${lim}`,
    `- 실제 집행 금액 / 비중 준수 여부: ${comply}`, '',
    `Q4. 매수가 옳았는지? (O / X) ${r.right || ''}`,
    `- 상세 복기: ${ml(r.q4)}`, '',
    `Q5. 결과는?`,
    ...(x.sellLegs.length
      ? [`- 매도 일자 / 단가${x.sellLegs.length > 1 ? ` (분할매도 ${x.sellLegs.length}회)` : ''}:`,
         ...x.sellLegs.map(l => `  - ${l.n}차 ${l.date} / ${fmt(l.price)}원 × ${fmt(l.qty)}주 (${swSigned(l.pct, '%')})${l.reason ? ` · ${l.reason}` : ''}${l.memo ? ` — ${l.memo}` : ''}`)]
      : [`- 매도 일자 / 단가: `]),
    `- 최종 손익률 / 손익금: ${x.sold ? `${swSigned(x.pnlPct, '%')} / ${swSigned(x.pnl)}${x.closed ? ` (보유 ${x.hold}거래일)` : ` (부분청산 · 잔여 ${x.remain}주)`}` : ''}`,
    `- 청산 사유: ${x.exitReason}`, '',
    `3. 피드백 및 다음 행동 원칙`,
    `- 잘한 점: ${ml(r.good)}`,
    `- 고쳐야 할 점: ${ml(r.fix)}`,
    `- 새롭게 추가할 행동 룰: ${ml(r.rule)}`,
  ].filter(l => l !== null).join('\n');
}
function swCopy(id) {
  const r = swGet().find(e => e.id === id); if (!r) return;
  const md = swMarkdown(r);
  const done = () => showToast('📋 마크다운으로 복사했습니다!');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(md).then(done).catch(() => swCopyFallback(md, done));
  else swCopyFallback(md, done);
}
function swCopyFallback(t, done) {
  const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch(e) { alert('복사에 실패했습니다.'); }
  ta.remove();
}

function swLegTable(x) {
  const rows = [
    ...x.buyLegs.map(l => ({ ...l, side: 'buy' })),
    ...x.sellLegs.map(l => ({ ...l, side: 'sell' })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.side === 'buy' ? -1 : 1));
  return `<table class="watch-table mini-table sw-leg-table"><thead><tr><th>구분</th><th>날짜</th><th>가격</th><th>수량</th><th>결과</th><th>메모</th></tr></thead><tbody>${
    rows.map(l => l.side === 'buy'
      ? `<tr><td><span class="sw-side buy">매수 ${l.n}차</span></td><td>${l.date}</td><td>${swWon(l.price)}</td><td>${l.qty.toLocaleString()}주</td>
           <td style="color:var(--text3);">평단 ${swWon(l.avgAfter)} · 보유 ${l.qtyAfter}주</td><td>${swEsc(l.memo)}</td></tr>`
      : `<tr><td><span class="sw-side sell">매도 ${l.n}차</span></td><td>${l.date}</td><td>${swWon(l.price)}</td><td>${l.qty.toLocaleString()}주</td>
           <td><b style="color:${swColor(l.gain)}">${swSigned(l.pct, '%')}</b> <span style="color:var(--text3);">· 잔여 ${l.qtyAfter}주${l.reason ? ' · ' + swEsc(l.reason) : ''}</span></td><td>${swEsc(l.memo)}</td></tr>`
    ).join('')}</tbody></table>`;
}

function swRenderList() {
  const list = swGet().map(swDerive).filter(x =>
    (swFilters.st === 'ALL' || x.status === swFilters.st || (swFilters.st === 'holding' && x.status !== 'closed')) &&
    (swFilters.tp === 'ALL' || x.r.type === swFilters.tp)
  ).sort((a, b) => (b.firstBuy || '').localeCompare(a.firstBuy || '') || b.r.id - a.r.id);
  const box = document.getElementById('sw-list'), empty = document.getElementById('sw-empty');
  if (!box) return;
  document.getElementById('sw-count').textContent = `${list.length}건`;
  empty.style.display = list.length ? 'none' : 'block';
  box.innerHTML = list.map(x => {
    const r = x.r, pc = swColor(x.pnl);
    const pnlBadge = x.sold ? `<span class="badge" style="font-size:10px; color:${pc}; border:1px solid ${pc}50;">${x.closed ? '' : '실현 '}${swSigned(x.pnlPct, '%')} · ${swSigned(x.pnl)}</span>` : '';
    const status = x.status === 'closed' ? pnlBadge
      : `<span class="badge sw-open-badge" style="font-size:10px;">${x.status === 'partial' ? '🟠 부분청산' : '🟡 보유중'} · 잔여 ${x.remain}주 · ${x.hold}거래일${x.hold > 5 ? ' ⚠️가이드 초과' : ''}</span>${x.status === 'partial' ? pnlBadge : ''}`;
    const legBadge = (x.buyLegs.length > 1 || x.sellLegs.length > 1)
      ? `<span class="memo-badge">매수 ${x.buyLegs.length}회 · 매도 ${x.sellLegs.length}회</span>` : '';
    const row = (k, v) => v ? `<div class="sw-row"><span class="sw-k">${k}</span><span class="sw-v">${v}</span></div>` : '';
    const limHtml = x.limit === undefined ? '' : x.limit === null
      ? `${swCapLabel(r.cap)} · <span style="color:var(--gold)">원칙 한도 정의 없음 (1천억 미만)</span>`
      : `${swCapLabel(r.cap)} → 한도 ${swWon(x.limit)} · 최대 투입 ${swWon(x.peak)} (${(x.peak / x.limit * 100).toFixed(0)}%) ${x.limitOk ? '<span style="color:var(--accent)">✅ 준수</span>' : '<span style="color:var(--red); font-weight:700;">❌ 한도 초과</span>'}`;
    return `<details class="journal-card sw-card" style="border-left:3px solid ${x.closed ? pc : 'var(--gold)'};">
      <summary class="journal-card-header" style="flex-wrap:wrap; gap:8px;">
        <span class="journal-ticker">${swEsc(r.name)}</span>
        ${r.ticker ? `<span class="journal-meta">${swEsc(r.ticker)}</span>` : ''}
        <span class="memo-badge">${swEsc(r.type)}</span>
        ${legBadge}
        ${r.right ? `<span class="memo-badge" style="${r.right === 'O' ? 'color:var(--accent); border-color:var(--accent);' : 'color:var(--red); border-color:var(--red);'}">Q4 ${r.right}</span>` : ''}
        ${x.limitOk === false ? `<span class="memo-badge mkt-bad">한도 초과</span>` : ''}
        ${status}
        <span class="journal-meta" style="margin-left:auto;">${x.firstBuy}${x.closed ? ' → ' + x.lastSellDate : ''}</span>
      </summary>
      <div class="sw-body">
        <div class="sw-doc-title">[단기 스윙 매매일지] ${swEsc(r.name)}${r.ticker ? ` (${swEsc(r.ticker)})` : ''}</div>
        <div class="sw-sec-title">1. 기본 정보</div>
        ${row('매매 구분', swEsc(r.type))}
        ${row('평균 매수단가', `${swWon(x.avgBuy)} · 총 ${x.bought.toLocaleString()}주 · ${swWon(x.buyAmt)}`)}
        ${x.sold ? row('평균 매도단가', `${swWon(x.avgSell)} · 총 ${x.sold.toLocaleString()}주 · 잔여 ${x.remain}주`) : ''}
        ${(r.target || r.stop) ? row('목표가 / 손절가', `${r.target ? `${swWon(r.target)} <b style="color:var(--accent)">(${swPct(r.target, x.avgBuy)})</b>` : '-'} / ${r.stop ? `${swWon(r.stop)} <b style="color:var(--red)">(${swPct(r.stop, x.avgBuy)})</b>` : '-'} <span style="color:var(--text3); font-size:11px;">평단 대비</span>`) : ''}
        <div style="margin:8px 0 4px;">${swLegTable(x)}</div>
        <div class="sw-sec-title">2. 핵심 5대 점검 항목</div>
        ${row('Q1. 관찰 시작', (r.watchDate ? `${r.watchDate}${x.watchDays != null ? ` (첫 진입까지 ${x.watchDays}일)` : ''}` : '') + (r.q1 ? (r.watchDate ? ' — ' : '') + swBr(r.q1) : ''))}
        ${row('Q2. 매수 이유', swBr(r.q2) + ((r.signals || []).length ? `<div style="margin-top:4px; font-size:11px; color:var(--text3);">세력 개입 신호 <b style="color:${r.signals.length >= 3 ? 'var(--accent)' : 'var(--text2)'}">${r.signals.length}/5</b>: ${r.signals.join(', ')}</div>` : ''))}
        ${row('Q3. 매수 한도', limHtml)}
        ${row('Q4. 매수 옳았나', (r.right ? `<b>${r.right}</b> ` : '') + swBr(r.q4))}
        ${row('Q5. 결과', x.sold
          ? `<b style="color:${pc}">${swSigned(x.pnlPct, '%')} / ${swSigned(x.pnl)}</b> · ${x.closed ? `보유 ${x.hold}거래일` : `부분청산 (잔여 ${x.remain}주)`} · 비용 ${swWon(x.cost)}${x.exitReason ? ` · <b>${swEsc(x.exitReason)}</b>` : ''}`
          : '<span style="color:var(--text3)">보유중 — 매도 후 입력</span>')}
        ${(r.good || r.fix || r.rule) ? '<div class="sw-sec-title">3. 피드백 및 다음 행동 원칙</div>' : ''}
        ${row('잘한 점', swBr(r.good))}
        ${row('고쳐야 할 점', swBr(r.fix))}
        ${row('새 행동 룰', swBr(r.rule))}
        <div style="display:flex; gap:6px; justify-content:flex-end; margin-top:10px; flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="swCopy(${r.id})">📋 마크다운 복사</button>
          ${!x.closed ? `<button class="btn btn-ghost btn-sm" onclick="swEdit(${r.id},'buy')">📥 추가 매수</button>
          <button class="btn btn-ghost btn-sm" onclick="swEdit(${r.id},'sell')">📤 분할 매도</button>` : ''}
          <button class="btn btn-primary btn-sm" onclick="swEdit(${r.id})">✏ 수정·복기</button>
          <button class="btn btn-danger btn-sm" onclick="swDelete(${r.id})">🗑</button>
        </div>
      </div>
    </details>`;
  }).join('');
}

function swRenderStats() {
  const all = swGet().map(swDerive);
  const closed = all.filter(x => x.closed);
  const partial = all.filter(x => x.status === 'partial').length;
  const wins = closed.filter(x => x.pnl > 0);
  const sumPnl = closed.reduce((a, x) => a + x.pnl, 0);
  const avgPct = closed.length ? closed.reduce((a, x) => a + x.pnlPct, 0) / closed.length : null;
  const avgHold = closed.length ? (closed.reduce((a, x) => a + x.hold, 0) / closed.length).toFixed(1) : null;
  const rated = all.filter(x => x.r.right);
  const limRated = all.filter(x => x.limitOk !== null);
  const splitBuy = all.filter(x => x.buyLegs.length > 1).length, splitSell = all.filter(x => x.sellLegs.length > 1).length;
  const card = (v, label, color) => `<div class="card" style="text-align:center; padding:14px; ${color ? `border-left:3px solid ${color};` : ''}">
      <div style="font-family:var(--mono); font-size:22px; font-weight:800; color:${color || 'var(--text)'};">${v}</div>
      <div style="font-size:12px; color:var(--text3); margin-top:4px;">${label}</div></div>`;
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '-';
  document.getElementById('sw-stat-cards').innerHTML = [
    card(`${closed.length}<span style="font-size:13px; color:var(--text3);"> / 보유 ${all.length - closed.length}${partial ? ` (부분 ${partial})` : ''}</span>`, '청산 완료 건'),
    card(pct(wins.length, closed.length), `승률 (${wins.length}승 ${closed.length - wins.length}패)`, 'var(--accent)'),
    card(closed.length ? swSigned(sumPnl).replace('원', '') : '-', `누적 손익금(원) · 평균 ${avgPct != null ? swSigned(avgPct, '%') : '-'}`, sumPnl >= 0 ? 'var(--accent)' : 'var(--red)'),
    card(avgHold != null ? avgHold + '일' : '-', '평균 보유(거래일) · 가이드 3~5', 'var(--blue)'),
    card(pct(rated.filter(x => x.r.right === 'O').length, rated.length), `Q4 '매수 옳았다(O)' 비율 (${rated.length}건)`, 'var(--purple)'),
    card(pct(limRated.filter(x => x.limitOk).length, limRated.length), `Q3 매수 한도 준수율 (${limRated.length}건)`, 'var(--gold)'),
    card(pct(closed.filter(x => x.hold >= 3 && x.hold <= 5).length, closed.length), '보유 3~5거래일 준수율'),
    card(`${splitBuy} / ${splitSell}`, `분할매수 / 분할매도 건수 (전체 ${all.length})`),
  ].join('');

  const table = (title, keys, keyFn) => {
    const rows = keys.map(k => {
      const g = closed.filter(x => keyFn(x) === k); if (!g.length) return '';
      const w = g.filter(x => x.pnl > 0).length, p = g.reduce((a, x) => a + x.pnl, 0);
      const ap = g.reduce((a, x) => a + x.pnlPct, 0) / g.length;
      return `<tr><td>${k}</td><td style="font-family:var(--mono);">${g.length}</td><td style="font-family:var(--mono);">${Math.round(w / g.length * 100)}%</td>
        <td style="font-family:var(--mono); color:${swColor(ap)};">${swSigned(ap, '%')}</td>
        <td style="font-family:var(--mono); color:${swColor(p)};">${swSigned(p).replace('원', '')}</td></tr>`;
    }).join('');
    return `<div style="font-size:12px; font-weight:700; margin-bottom:6px;">${title}</div>` + (rows
      ? `<table class="watch-table mini-table"><thead><tr><th>구분</th><th>건수</th><th>승률</th><th>평균</th><th>손익금(원)</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<div style="font-size:12px; color:var(--text3);">청산 완료 데이터 없음</div>`);
  };
  const legacy = [...new Set(closed.map(x => x.r.type).filter(t => t && !SW_TYPES.includes(t)))];
  document.getElementById('sw-by-type').innerHTML = table('📂 매매 구분별 성과', [...SW_TYPES, ...legacy], x => x.r.type);
  document.getElementById('sw-by-reason').innerHTML = table('🚪 최종 청산 사유별 성과 (마지막 매도 기준)', [...SW_REASONS, '미기록'], x => x.exitReason || '미기록');

  const rules = all.filter(x => x.r.rule).sort((a, b) => (b.lastSellDate || b.firstBuy).localeCompare(a.lastSellDate || a.firstBuy));
  document.getElementById('sw-rules-all').innerHTML = rules.length
    ? rules.map(x => x.r.rule.split('\n').filter(l => l.trim()).map(l =>
        `<div class="sw-rule-line"><span>➕ ${swEsc(l.replace(/^[-•·]\s*/, ''))}</span><span class="journal-meta">${swEsc(x.r.name)} · ${x.lastSellDate || x.firstBuy}</span></div>`).join('')).join('')
    : '<div style="font-size:12px; color:var(--text3);">아직 기록된 행동 룰이 없습니다.</div>';
}

function swRender() {
  if (!document.querySelector('#sw-buys .sw-leg') && !document.getElementById('sw-id').value) swAddLeg('buy', { date: '' });
  swRenderStats(); swRenderList(); swCalc();
}

function exportSwingCSV() {
  const list = swGet();
  if (!list.length) { alert('저장된 스윙 기록이 없습니다.'); return; }
  const legStr = (legs, sell) => legs.map(l => `${l.n}차 ${l.date} ${l.price}x${l.qty}${sell && l.reason ? ' ' + l.reason : ''}`).join(' | ');
  const H = ['종목명','종목코드','매매구분','상태','첫 매수일','마지막 매도일','매수내역','매수횟수','총매수수량','평균매수단가','총매수금액','최대투입금액',
    '매도내역','매도횟수','총매도수량','평균매도단가','잔여수량','목표가','목표(평단대비%)','손절가','손절(평단대비%)','관찰시작일','관찰기간(일)','Q1 관찰','Q2 매수이유','세력신호',
    '시가총액(억)','원칙한도','한도준수','Q4 O/X','Q4 복기','수수료+세금','손익금','손익률(%)','보유거래일','최종청산사유','잘한점','고칠점','새 행동룰'];
  const st = { open: '보유중', partial: '부분청산', closed: '청산완료' };
  const rows = list.map(r0 => { const x = swDerive(r0), r = x.r; return [r.name, r.ticker, r.type, st[x.status], x.firstBuy, x.lastSellDate,
    legStr(x.buyLegs), x.buyLegs.length, x.bought, x.avgBuy && Math.round(x.avgBuy), x.buyAmt, Math.round(x.peak),
    legStr(x.sellLegs, true), x.sellLegs.length, x.sold, x.avgSell && Math.round(x.avgSell), x.remain,
    r.target, swPct(r.target, x.avgBuy), r.stop, swPct(r.stop, x.avgBuy),
    r.watchDate, x.watchDays, r.q1, r.q2, (r.signals || []).join(' | '), r.cap, x.limit, x.limitOk == null ? '' : x.limitOk ? '준수' : '초과',
    r.right, r.q4, x.sold ? x.cost : '', x.pnl, x.pnlPct, x.closed ? x.hold : '', x.exitReason, r.good, r.fix, r.rule]
    .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','); });
  const csv = '﻿' + [H.map(h => `"${h}"`).join(','), ...rows].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = '스윙일지_' + getDateStr() + '.csv'; a.click();
  showToast('📥 스윙일지 CSV 내보내기 완료!');
}
