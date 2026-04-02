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
}

// ── 루틴 토글 ──
function toggleRoutine(id) {
  document.getElementById(id).classList.toggle('open');
}

// ══════════════════════════════════════════
// ✅ 체크리스트 - 날짜별 자동 초기화 + 달성률
// ══════════════════════════════════════════

const TODAY = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

// ── 날짜 체크 → 새 날이면 어제 기록 저장 후 초기화 ──
function checkDailyReset() {
  const lastDate = localStorage.getItem('routine_last_date');
  if (lastDate && lastDate !== TODAY) {
    // 어제 기록 히스토리에 저장
    saveRoutineHistory(lastDate);
    // 체크리스트 초기화
    ['checklist-morning','checklist-midday','checklist-evening'].forEach(id => {
      localStorage.setItem(id, '{}');
    });
  }
  localStorage.setItem('routine_last_date', TODAY);
}

// ── 루틴 히스토리 저장 ──
function saveRoutineHistory(date) {
  const history = JSON.parse(localStorage.getItem('routine_history') || '{}');
  const morningData = JSON.parse(localStorage.getItem('checklist-morning') || '{}');
  const middayData  = JSON.parse(localStorage.getItem('checklist-midday')  || '{}');
  const eveningData = JSON.parse(localStorage.getItem('checklist-evening') || '{}');

  const mTotal = 8, dTotal = 6, eTotal = 7; // 항목 수
  const mDone  = Object.values(morningData).filter(Boolean).length;
  const dDone  = Object.values(middayData).filter(Boolean).length;
  const eDone  = Object.values(eveningData).filter(Boolean).length;
  const total  = mTotal + dTotal + eTotal;
  const done   = mDone + dDone + eDone;
  const rate   = Math.round((done / total) * 100);

  history[date] = { rate, morning: Math.round(mDone/mTotal*100), midday: Math.round(dDone/dTotal*100), evening: Math.round(eDone/eTotal*100) };
  localStorage.setItem('routine_history', JSON.stringify(history));
}

// ── 오늘 달성률 계산 & UI 업데이트 ──
function updateRoutineRate() {
  const mData = JSON.parse(localStorage.getItem('checklist-morning') || '{}');
  const dData = JSON.parse(localStorage.getItem('checklist-midday')  || '{}');
  const eData = JSON.parse(localStorage.getItem('checklist-evening') || '{}');

  const mTotal = 8, dTotal = 6, eTotal = 7;
  const mDone  = Object.values(mData).filter(Boolean).length;
  const dDone  = Object.values(dData).filter(Boolean).length;
  const eDone  = Object.values(eData).filter(Boolean).length;

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
    const ds = d.toISOString().split('T')[0];
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
    chk.checked = !!saved[i];
    if (chk.checked) li.classList.add('checked');

    chk.addEventListener('change', () => {
      li.classList.toggle('checked', chk.checked);
      const s = JSON.parse(localStorage.getItem(id) || '{}');
      s[i] = chk.checked;
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
  ['checklist-morning','checklist-midday','checklist-evening'].forEach(id => {
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
          🌅${data.morning||0}% 📈${data.midday||0}% 📝${data.evening||0}%
        </span>
      </div>
    `;
  }).join('');
}

function closeRoutineHistory() {
  const modal = document.getElementById('routine-history-modal');
  if (modal) modal.style.display = 'none';
}

// ── 체크리스트 초기화 함수 ──
function initChecklists() {
  makeChecklist('checklist-morning', [
    '미국 3대 지수 마감 확인 (DOW, S&P 500, NASDAQ)',
    '어제 미국 시장 섹터별 등락 확인 (FinViz 히트맵)',
    '오늘 경제지표 발표 일정 확인 (Investing.com 캘린더)',
    '원/달러 환율 현재 수준 확인',
    'VIX 지수 확인 (20 이상이면 변동성 주의)',
    '미국 10년물 국채금리 수준 확인',
    '나스닥 선물 / 코스피 선물 방향 확인',
    '오늘 국내 주요 뉴스 헤드라인 10개 훑기',
  ]);
  makeChecklist('checklist-midday', [
    '장 시작 후 외국인 순매수/순매도 방향 확인 (KRX)',
    '기관 매수 상위 종목 확인',
    '관심 종목 가격 알림 도달 여부 확인',
    '장 초반 급등·급락 종목 이유 파악 (뉴스 확인)',
    '점심 후 환율·외국인 수급 재확인',
    '충동 매매 충동 느낄 경우 → 매수 이유 3가지 써보기',
  ]);
  makeChecklist('checklist-evening', [
    '오늘 코스피/코스닥 지수 마감 수치와 원인 복기',
    '보유 종목 당일 등락 이유 파악 및 일지 기록',
    '오늘 발표된 경제지표 결과와 시장 반응 복기',
    '내일 발표 예정 경제지표 미리 확인',
    '경제 기사 3~5개 읽기 (한국경제 or 매일경제)',
    '학습 콘텐츠 20분 (유튜브·책) 소화',
    '투자 원칙 위반 여부 점검 후 일지 기록',
  ]);
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

  if (!ticker || !name) { alert('종목코드와 종목명은 필수입니다.'); return; }

  const item = {
    id: Date.now(),
    ticker, name, market, buy, target, stop, memo,
    date: new Date().toLocaleDateString('ko-KR'),
    star: false
  };

  const list = getWatchList();
  list.unshift(item);
  saveWatchList(list);
  renderWatchList();

  ['w-ticker','w-name','w-buy','w-target','w-stop','w-memo'].forEach(id => {
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
  document.querySelectorAll('#panel-watchlist .filter-chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  renderWatchList();
}

function renderWatchList() {
  const list = getWatchList();
  const filtered = watchFilter === 'ALL' ? list : list.filter(i => i.market === watchFilter);
  const tbody = document.getElementById('watch-tbody');
  const empty = document.getElementById('watch-empty');
  document.getElementById('watch-count').textContent = `${filtered.length}개 종목`;

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  filtered.sort((a,b) => b.star - a.star).forEach(item => {
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
// 📓 투자일지
// ══════════════════════════════════════════
let journalFilter = 'ALL';
let selectedMood = '';

function getJournal() {
  return JSON.parse(localStorage.getItem('journal') || '[]');
}
function saveJournal(arr) {
  localStorage.setItem('journal', JSON.stringify(arr));
}

function selectMood(btn) {
  document.querySelectorAll('.mood-btn').forEach(b => {
    b.style.background = '';
    b.style.color = '';
    b.style.borderColor = '';
  });
  selectedMood = btn.dataset.mood;
  btn.style.background = 'var(--accent)';
  btn.style.color = '#fff';
  btn.style.borderColor = 'var(--accent)';
  document.getElementById('j-mood').value = selectedMood;
}

function clearJournalForm() {
  ['j-date','j-ticker','j-name','j-reason','j-context','j-review'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('j-type').value = '매수';
  document.getElementById('j-result').value = 'hold';
  document.getElementById('j-pnl').value = '';
  selectedMood = '';
  document.querySelectorAll('.mood-btn').forEach(b => {
    b.style.background = '';
    b.style.color = '';
    b.style.borderColor = '';
  });
}

function addJournalEntry() {
  const date    = document.getElementById('j-date').value;
  const ticker  = document.getElementById('j-ticker').value.trim();
  const name    = document.getElementById('j-name').value.trim();
  const type    = document.getElementById('j-type').value;
  const result  = document.getElementById('j-result').value;
  const pnl     = document.getElementById('j-pnl').value;
  const reason  = document.getElementById('j-reason').value.trim();
  const context = document.getElementById('j-context').value.trim();
  const review  = document.getElementById('j-review').value.trim();
  const mood    = document.getElementById('j-mood').value;

  if (!date) { alert('날짜를 선택해주세요.'); return; }
  if (!name)  { alert('종목명을 입력해주세요.'); return; }

  const entry = {
    id: Date.now(),
    date, ticker, name, type, result,
    pnl: pnl !== '' ? parseFloat(pnl) : null,
    reason, context, review, mood,
    createdAt: new Date().toLocaleString('ko-KR')
  };

  const list = getJournal();
  list.unshift(entry);
  saveJournal(list);
  renderJournal();
  clearJournalForm();
  updateJournalStats();
}

function deleteJournalEntry(id) {
  if (!confirm('이 일지를 삭제하시겠습니까?')) return;
  saveJournal(getJournal().filter(e => e.id !== id));
  renderJournal();
  updateJournalStats();
}

function filterJournal(val, el) {
  journalFilter = val;
  document.querySelectorAll('#panel-journal .filter-chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  renderJournal();
}

function resultLabel(r) {
  const map = {
    profit: ['result-profit','✅ 수익'],
    loss:   ['result-loss',  '❌ 손실'],
    hold:   ['result-hold',  '🔵 보유중'],
    watch:  ['result-watch', '👁 관찰'],
  };
  return map[r] || ['result-hold', r];
}

function renderJournal() {
  const list = getJournal();
  const filtered = journalFilter === 'ALL' ? list : list.filter(e => e.type === journalFilter);
  const container = document.getElementById('journal-list');
  const empty     = document.getElementById('journal-empty');

  container.innerHTML = '';
  if (filtered.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  filtered.forEach(e => {
    const [cls, label] = resultLabel(e.result);
    const pnlStr = e.pnl !== null
      ? `<span style="font-family:var(--mono); font-size:13px; font-weight:700; color:${e.pnl >= 0 ? 'var(--accent)' : 'var(--red)'}">${e.pnl >= 0 ? '+' : ''}${e.pnl}%</span>`
      : '';

    const div = document.createElement('div');
    div.className = 'journal-card';
    div.innerHTML = `
      <div class="journal-card-header">
        <span class="journal-ticker">${e.name}</span>
        ${e.ticker ? `<span class="journal-meta">${e.ticker}</span>` : ''}
        <span class="badge badge-blue">${e.type}</span>
        <span class="journal-result ${cls}">${label}</span>
        ${pnlStr}
        ${e.mood ? `<span class="memo-badge">${e.mood}</span>` : ''}
        <span class="journal-meta" style="margin-left:auto">${e.date}</span>
        <button class="btn btn-danger btn-sm" onclick="deleteJournalEntry(${e.id})">삭제</button>
      </div>
      ${e.reason  ? `<div style="margin-bottom:6px;"><span style="font-size:11px; font-weight:700; color:var(--text3); text-transform:uppercase; letter-spacing:0.5px;">매매 이유</span><div class="journal-body">${e.reason}</div></div>` : ''}
      ${e.context ? `<div style="margin-bottom:6px;"><span style="font-size:11px; font-weight:700; color:var(--text3); text-transform:uppercase; letter-spacing:0.5px;">시장 맥락</span><div class="journal-body">${e.context}</div></div>` : ''}
      ${e.review  ? `<div><span style="font-size:11px; font-weight:700; color:var(--red); text-transform:uppercase; letter-spacing:0.5px;">복기 & 반성</span><div class="journal-body">${e.review}</div></div>` : ''}
    `;
    container.appendChild(div);
  });
}

function updateJournalStats() {
  const list    = getJournal();
  const profits = list.filter(e => e.result === 'profit');
  const losses  = list.filter(e => e.result === 'loss');
  const pnlList = list.filter(e => e.pnl !== null).map(e => e.pnl);
  const avg     = pnlList.length ? (pnlList.reduce((a,b)=>a+b,0)/pnlList.length).toFixed(1) : '-';
  const cumulative = pnlList.length ? pnlList.reduce((a,b)=>a+b,0).toFixed(1) : '-';
  const winrate = (profits.length + losses.length) > 0
    ? Math.round(profits.length / (profits.length + losses.length) * 100) : 0;

  // 기본 통계
  document.getElementById('stat-total').textContent  = list.length;
  document.getElementById('stat-profit').textContent = profits.length;
  document.getElementById('stat-loss').textContent   = losses.length;
  document.getElementById('stat-avgpnl').textContent = avg !== '-' ? avg + '%' : '-';

  // 누적 수익률
  const cumEl = document.getElementById('stat-cumulative');
  if (cumEl) {
    cumEl.textContent = cumulative !== '-' ? (parseFloat(cumulative) >= 0 ? '+' : '') + cumulative + '%' : '-';
    cumEl.style.color = cumulative !== '-' ? (parseFloat(cumulative) >= 0 ? 'var(--accent)' : 'var(--red)') : 'var(--text3)';
  }

  // 승률 바
  const wrEl = document.getElementById('stat-winrate');
  const wrBar = document.getElementById('winrate-bar');
  if (wrEl) wrEl.textContent = (profits.length + losses.length) > 0 ? winrate + '%' : '-';
  if (wrBar) wrBar.style.width = winrate + '%';

  // 이번 주 통계
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0,0,0,0);

  const thisWeek = list.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d >= monday;
  });
  const wPnl = thisWeek.filter(e => e.pnl !== null).map(e => e.pnl);
  const wCum = wPnl.length ? wPnl.reduce((a,b)=>a+b,0).toFixed(1) : '-';
  const weekly = document.getElementById('stat-weekly');
  if (weekly) weekly.innerHTML = `
    <div style="display:flex; justify-content:space-between; font-size:13px;">
      <span style="color:var(--text2);">매매 기록</span>
      <span style="font-family:var(--mono); font-weight:700;">${thisWeek.length}건</span>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:13px;">
      <span style="color:var(--text2);">수익 / 손실</span>
      <span style="font-family:var(--mono);">${thisWeek.filter(e=>e.result==='profit').length}✅ / ${thisWeek.filter(e=>e.result==='loss').length}❌</span>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:13px;">
      <span style="color:var(--text2);">합산 수익률</span>
      <span style="font-family:var(--mono); font-weight:700; color:${wCum!=='-'?(parseFloat(wCum)>=0?'var(--accent)':'var(--red)'):'var(--text3)'};">${wCum!=='-'?(parseFloat(wCum)>=0?'+':'')+wCum+'%':'-'}</span>
    </div>
  `;

  // 이번 달 통계
  const thisMonthStr = now.toISOString().slice(0,7);
  const thisMonth = list.filter(e => e.date && e.date.startsWith(thisMonthStr));
  const mPnl = thisMonth.filter(e => e.pnl !== null).map(e => e.pnl);
  const mCum = mPnl.length ? mPnl.reduce((a,b)=>a+b,0).toFixed(1) : '-';
  const monthly = document.getElementById('stat-monthly');
  if (monthly) monthly.innerHTML = `
    <div style="display:flex; justify-content:space-between; font-size:13px;">
      <span style="color:var(--text2);">매매 기록</span>
      <span style="font-family:var(--mono); font-weight:700;">${thisMonth.length}건</span>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:13px;">
      <span style="color:var(--text2);">수익 / 손실</span>
      <span style="font-family:var(--mono);">${thisMonth.filter(e=>e.result==='profit').length}✅ / ${thisMonth.filter(e=>e.result==='loss').length}❌</span>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:13px;">
      <span style="color:var(--text2);">합산 수익률</span>
      <span style="font-family:var(--mono); font-weight:700; color:${mCum!=='-'?(parseFloat(mCum)>=0?'var(--accent)':'var(--red)'):'var(--text3)'};">${mCum!=='-'?(parseFloat(mCum)>=0?'+':'')+mCum+'%':'-'}</span>
    </div>
  `;
}

// ── 오늘 날짜 기본 세팅 ──
(function() {
  const today = new Date().toISOString().split('T')[0];
  const jDate = document.getElementById('j-date');
  if (jDate) jDate.value = today;
})();

// ── 초기 렌더 ──
renderWatchList();
renderJournal();
updateJournalStats();


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
  const el = document.getElementById('is-date');
  if (el) el.value = new Date().toISOString().split('T')[0];
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
function exportAll() {
  const data = {
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
  reader.onload = (e) => {
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

      // 전체 재렌더링
      renderBooks(); renderNotes(); renderTerms(); renderInsights(); updateKdStats();
      renderWatchList();
      renderJournal(); updateJournalStats();
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