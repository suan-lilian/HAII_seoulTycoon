/* ============================================================
   서울대 생존백서 — Hamburger Tycoon Edition
   Game Logic
   ============================================================ */

// ============================================================
// 활동 카드 데이터
// ============================================================
// cost: 어떤 스탯을 얼마나 소모해야 이 활동을 사용할 수 있는지
// 교차 소모 원칙: 학업활동 → 연애 소모 / 연애활동 → 학업 소모 / 동아리활동 → 학업 소모
const ACTIVITY_DB = [
  { id: 'library',  type: 'academic', emoji: '📚', label: '도서관',    cost: { romance: 4 } },
  { id: 'homework', type: 'academic', emoji: '📖', label: '과제',      cost: { romance: 3 } },
  { id: 'cafe_s',   type: 'academic', emoji: '☕', label: '카페공부',  cost: { romance: 2 } },
  { id: 'gibo',     type: 'academic', emoji: '📋', label: '족보',      cost: { club: 3 } },
  { id: 'kakao',    type: 'romance',  emoji: '💬', label: '카톡',      cost: { academic: 2 } },
  { id: 'date',     type: 'romance',  emoji: '🧋', label: '데이트',    cost: { academic: 5 } },
  { id: 'selca',    type: 'romance',  emoji: '🤳', label: '셀카데이트', cost: { academic: 3 } },
  { id: 'club_act', type: 'club',     emoji: '🎯', label: '동아리',    cost: { academic: 3 } },
  { id: 'hoesik',   type: 'club',     emoji: '🍻', label: '회식',      cost: { academic: 4 } },
  { id: 'mt_prep',  type: 'club',     emoji: '⛺', label: 'MT준비',    cost: { romance: 3 } },
  { id: 'rest',     type: 'wild',     emoji: '⭐', label: '자유시간',  cost: { romance: 2 } },
];

// 슬롯 타입별 허용 활동 타입
const SLOT_COMPAT = {
  academic: ['academic', 'wild'],
  romance:  ['romance',  'wild'],
  club:     ['club',     'wild'],
  any:      ['academic', 'romance', 'club', 'wild'],
};

// ============================================================
// 미션 데이터베이스
// ============================================================
const MISSION_DB = [
  // ── 학업 미션
  {
    id: 'library_session',
    title: '도서관 올박',
    icon: '📚', category: 'academic',
    desc: '관정도서관에서 하루 종일 공부. 자리 선점이 실력이다.',
    required: ['academic', 'academic', 'academic'],
    reward: { academic: +18 },
    penalty: {},
    weight: 3,
  },
  {
    id: 'midterm',
    title: '중간고사 준비',
    icon: '📝', category: 'academic',
    desc: '시험 범위를 정리하고 문제풀이에 집중한다.',
    required: ['academic', 'academic', 'any'],
    reward: { academic: +14 },
    penalty: { academic: -8 },
    minWeek: 5, maxWeek: 9,
    weight: 4,
  },
  {
    id: 'final_exam',
    title: '기말고사',
    icon: '✏️', category: 'academic',
    desc: '학기 마지막 시험. 모든 것을 쏟아붓자.',
    required: ['academic', 'academic', 'academic', 'academic'],
    reward: { academic: +22 },
    penalty: { academic: -15 },
    minWeek: 14, maxWeek: 16,
    weight: 5, specialWeek: 16,
  },
  {
    id: 'gibo_hunt',
    title: '족보 구하기',
    icon: '📋', category: 'academic',
    desc: '선배에게 족보를 받아 시험을 준비한다. 인맥이 성적이다.',
    required: ['club', 'academic', 'academic'],
    reward: { academic: +12, club: +5 },
    penalty: {},
    weight: 2,
  },
  {
    id: 'proxy',
    title: '대리 출석 수락',
    icon: '📝', category: 'academic',
    desc: '선배가 대리 출석을 부탁했다. 걸리면 큰일이지만...',
    required: ['club', 'any'],
    reward: { academic: -8, club: +10, romance: +5 },
    penalty: { academic: -20 },
    riskChance: 0.3,
    riskPenalty: { academic: -20 },
    riskMsg: '⚠️ 적발! 학업 추가 -20',
    weight: 2,
  },

  // ── 연애 미션
  {
    id: 'blind_date',
    title: '소개팅',
    icon: '💌', category: 'romance',
    desc: '선배가 잡아준 소개팅. 준비부터 실전까지 신경 써야 한다.',
    required: ['romance', 'romance', 'any'],
    reward: { romance: +18 },
    penalty: { romance: -5 },
    weight: 3,
  },
  {
    id: 'text_convo',
    title: '연인에게 연락',
    icon: '💬', category: 'romance',
    desc: '"오늘 뭐해?" 한 통의 메시지가 관계를 유지시킨다.',
    required: ['romance', 'romance'],
    reward: { romance: +10 },
    penalty: { romance: -8 },
    weight: 3,
  },
  {
    id: 'cafe_date',
    title: '카페 데이트',
    icon: '🧋', category: 'romance',
    desc: '샤로수길 카페에서 여유로운 오후. 공부는... 나중에.',
    required: ['romance', 'romance', 'academic'],
    reward: { romance: +14, academic: -5 },
    penalty: { romance: -3 },
    weight: 2,
  },
  {
    id: 'exam_date',
    title: '시험기간 데이트',
    icon: '😅', category: 'romance',
    desc: '"나 보고 싶지 않아?" 수락하면 학업이 흔들린다.',
    required: ['romance', 'romance', 'romance'],
    reward: { romance: +16, academic: -18 },
    penalty: { romance: -12 },
    minWeek: 7, maxWeek: 9,
    weight: 3,
  },
  {
    id: 'confession',
    title: '고백 이벤트',
    icon: '💝', category: 'romance',
    desc: '썸을 정리할 타이밍. 성공하면 대박, 실패하면 연애 0.',
    required: ['romance', 'romance', 'romance', 'any'],
    reward: { romance: +25 },
    penalty: { romance: -99 },
    riskChance: 0.4,
    riskMsg: '💔 고백 실패! 연애 → 0',
    isConfession: true,
    minStat: { romance: 50 },
    weight: 2,
  },

  // ── 동아리 미션
  {
    id: 'mt',
    title: 'MT 참석',
    icon: '⛺', category: 'club',
    desc: '선배들과 MT. 불참하면 동아리 내 이미지가 급락한다.',
    required: ['club', 'club', 'romance'],
    reward: { club: +20, romance: +5 },
    penalty: { club: -20 },
    specialWeek: 3, weight: 5,
  },
  {
    id: 'hoesik',
    title: '동아리 회식',
    icon: '🍻', category: 'club',
    desc: '회식 참석. 분위기가 좋으면 연애 플래그도 생긴다.',
    required: ['club', 'club', 'any'],
    reward: { club: +12, romance: +3 },
    penalty: { club: -8 },
    weight: 3,
  },
  {
    id: 'club_event',
    title: '동아리 행사 기획',
    icon: '🎉', category: 'club',
    desc: '다가오는 행사를 위해 준비에 매달린다.',
    required: ['club', 'club', 'club'],
    reward: { club: +18 },
    penalty: { club: -5 },
    weight: 3,
  },
  {
    id: 'seminar',
    title: '학회 세미나 준비',
    icon: '🎤', category: 'club',
    desc: '학업과 동아리를 동시에 챙길 수 있는 흔치 않은 기회.',
    required: ['academic', 'academic', 'club', 'club'],
    reward: { academic: +10, club: +12 },
    penalty: { club: -8 },
    weight: 2,
  },

  // ── 특수 미션
  {
    id: 'festival',
    title: '대학 축제',
    icon: '🎆', category: 'special',
    desc: '축제에서 공연도 보고 부스도 운영한다.',
    required: ['club', 'romance', 'any'],
    reward: { club: +10, romance: +8 },
    penalty: {},
    specialWeek: 6, weight: 4,
  },
  {
    id: 'presentation',
    title: '학회 발표',
    icon: '📊', category: 'special',
    desc: '학회에서 발표. 잘 준비했다면 모두가 주목한다.',
    required: ['academic', 'academic', 'club', 'club'],
    reward: { academic: +10, club: +15 },
    penalty: { club: -10 },
    specialWeek: 12, weight: 4,
  },
  {
    id: 'balance_week',
    title: '균형 잡기',
    icon: '⚖️', category: 'special',
    desc: '학업도, 연애도, 동아리도 조금씩 챙기는 여유로운 한 주.',
    required: ['academic', 'romance', 'club'],
    reward: { academic: +6, romance: +6, club: +6 },
    penalty: {},
    weight: 2,
  },
];

// ============================================================
// 엔딩 데이터
// ============================================================
const ENDINGS = [
  {
    id: 'snu_legend', grade: 'S',
    title: '서울대의 전설',
    desc: '학업도 연애도 동아리도 완벽. "당신은 실존 인물입니까?"',
    check: (s, _r) => s.academic >= 75 && s.romance >= 65 && s.club >= 65,
  },
  {
    id: 'academic_crisis', grade: 'D',
    title: '유급 위기',
    desc: '재수강 신청 화면으로 이동합니다. 다음 학기는 더 힘들어요.',
    check: (s) => s.academic <= 15,
  },
  {
    id: 'eternal_solo', grade: 'D',
    title: '전설의 솔로',
    desc: '연애 리셋 2회 이상. 이번 생은 공부만 합시다.',
    check: (_s, r) => r >= 2,
  },
  {
    id: 'lonely_top', grade: 'A',
    title: '수석의 고독',
    desc: 'GPA 4.3, 하지만 연락처에 저장된 번호가 없다. 도서관과 결혼한 4년이 시작된다.',
    check: (s) => s.academic >= 80 && s.romance < 25 && s.club < 25,
  },
  {
    id: 'studying_couple', grade: 'A',
    title: '공부하는 연인',
    desc: '커플이지만 동아리에선 유령 회원. 그래도 둘이 함께라면 뭐든 할 수 있을 것 같다.',
    check: (s) => s.academic >= 65 && s.romance >= 55 && s.club < 45,
  },
  {
    id: 'social_king', grade: 'A',
    title: '동아리의 핵인싸',
    desc: '인맥은 탄탄하지만 성적표가 문제다. 취업은 인맥으로 하면 된다고 믿는다.',
    check: (s) => s.club >= 70 && s.romance >= 50 && s.academic < 45,
  },
  {
    id: 'club_slave', grade: 'C',
    title: '동아리 노예',
    desc: '선배 심부름만 하다 끝난 학기. 그래도 동아리방이 내 집이다.',
    check: (s) => s.club >= 75 && s.academic <= 25 && s.romance <= 20,
  },
  {
    id: 'unrequited', grade: 'C',
    title: '짝사랑의 계절',
    desc: '연애가 55를 넘었지만 고백을 못 했다. 다음 학기엔 꼭...',
    check: (s) => s.romance >= 55 && !G.flags.has('confession_done'),
  },
  {
    id: 'just_student', grade: 'B',
    title: '그냥 대학생',
    desc: '크게 잘한 것도, 크게 망한 것도 없다. 평범하게 살아남았다.',
    check: (s) => s.academic >= 30 && s.romance >= 25 && s.club >= 25,
  },
  {
    id: 'survivor', grade: 'B',
    title: '1학기 생존자',
    desc: '어떻게든 살아남았다. 그것만으로도 충분하다.',
    check: () => true,
  },
];

const EXAM_WEEKS    = [8, 16];
const SPECIAL_WEEKS = { 3: 'mt', 6: 'festival', 12: 'presentation_week' };
const TIMER_SEC     = 120; // 2분 (미션이 무한히 나오므로 시간 여유)

// ============================================================
// 게임 상태
// ============================================================
let G = {};

function makeState() {
  return {
    week:             1,
    stats:            { academic: 30, romance: 20, club: 20 },
    flags:            new Set(),
    romanceResets:    0,
    missions:         [],   // active missions (최대 3개 보임)
    activeMissionIdx: -1,
    timeLeft:         TIMER_SEC,
    timerHandle:      null,
    weekDelta:        { academic: 0, romance: 0, club: 0 },
    summaryMissions:  [],
    missionsCompleted: 0,   // 이번 주 완수한 미션 수
  };
}

// ============================================================
// 시작 / 리셋
// ============================================================
function startGame() {
  G = makeState();
  showScreen('screen-game');
  startWeek();
}

function resetGame() {
  clearInterval(G.timerHandle);
  G = makeState();
  showScreen('screen-title');
}

// ============================================================
// 주차 시작
// ============================================================
function startWeek() {
  G.activeMissionIdx  = -1;
  G.weekDelta         = { academic: 0, romance: 0, club: 0 };
  G.summaryMissions   = [];
  G.missionsCompleted = 0;
  G.missions          = [];

  // 특수 주차 강제 미션 먼저 넣기
  const specialId = SPECIAL_WEEKS[G.week];
  if (specialId === 'mt')  G.missions.push(cloneMission(MISSION_DB.find(m => m.id === 'mt')));
  if (G.week === 6)        G.missions.push(cloneMission(MISSION_DB.find(m => m.id === 'festival')));
  if (G.week === 12)       G.missions.push(cloneMission(MISSION_DB.find(m => m.id === 'presentation')));
  if (G.week === 16)       G.missions.push(cloneMission(MISSION_DB.find(m => m.id === 'final_exam')));

  refillQueue(); // 큐를 3개로 채우기

  renderHUD();
  renderQueue();
  renderStationEmpty();
  renderShop();
  startTimer();
}

// ── 미션 생성
function buildMissions(week) {
  const isExam    = EXAM_WEEKS.includes(week);
  const specialId = SPECIAL_WEEKS[week];

  const forced = [];
  if (specialId === 'mt')         forced.push(cloneMission(MISSION_DB.find(m => m.id === 'mt')));
  if (week === 6)                 forced.push(cloneMission(MISSION_DB.find(m => m.id === 'festival')));
  if (week === 12)                forced.push(cloneMission(MISSION_DB.find(m => m.id === 'presentation')));
  if (week === 16)                forced.push(cloneMission(MISSION_DB.find(m => m.id === 'final_exam')));

  const usedIds = new Set(forced.map(m => m.id));
  const pool = MISSION_DB.filter(m => {
    if (usedIds.has(m.id)) return false;
    if (m.specialWeek) return false;
    if (m.minWeek && week < m.minWeek) return false;
    if (m.maxWeek && week > m.maxWeek) return false;
    if (m.minStat) {
      for (const [s, v] of Object.entries(m.minStat)) {
        if (G.stats[s] < v) return false;
      }
    }
    if (m.isConfession && G.flags.has('confession_done')) return false;
    return true;
  });

  const shuffled = weightedShuffle(pool, isExam);
  const target   = Math.max(0, 3 - forced.length);
  for (let i = 0; i < target && i < shuffled.length; i++) {
    forced.push(cloneMission(shuffled[i]));
  }
  return forced.slice(0, 3);
}

function cloneMission(template) {
  return {
    ...template,
    slots: template.required.map(slotType => ({ type: slotType, filled: null })),
    complete: false,
    failed: false,
  };
}

function weightedShuffle(pool, isExam) {
  const weighted = [];
  for (const m of pool) {
    let w = m.weight || 1;
    if (isExam && m.category === 'academic') w *= 2;
    for (let i = 0; i < w; i++) weighted.push(m);
  }
  for (let i = weighted.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
  }
  const seen = new Set();
  return weighted.filter(m => seen.has(m.id) ? false : (seen.add(m.id), true));
}

// ── 큐 자동 보충 (항상 미션 3개 유지)
function refillQueue() {
  const active = G.missions.filter(m => !m.complete);
  for (let i = active.length; i < 3; i++) {
    const next = generateMission();
    if (next) G.missions.push(next);
  }
}

// ── 미션 1개 랜덤 생성
function generateMission() {
  const week   = G.week;
  const isExam = EXAM_WEEKS.includes(week);
  const activeIds = new Set(G.missions.filter(m => !m.complete).map(m => m.id));

  const pool = MISSION_DB.filter(m => {
    if (m.specialWeek) return false;
    if (activeIds.has(m.id)) return false; // 이미 큐에 있는 미션 중복 방지
    if (m.minWeek && week < m.minWeek) return false;
    if (m.maxWeek && week > m.maxWeek) return false;
    if (m.minStat) {
      for (const [s, v] of Object.entries(m.minStat)) {
        if (G.stats[s] < v) return false;
      }
    }
    if (m.isConfession && G.flags.has('confession_done')) return false;
    return true;
  });

  if (pool.length === 0) return null;
  const shuffled = weightedShuffle(pool, isExam);
  return cloneMission(shuffled[0]);
}

// ============================================================
// 타이머
// ============================================================
function startTimer() {
  G.timeLeft = TIMER_SEC;
  updateTimerUI();
  clearInterval(G.timerHandle);
  G.timerHandle = setInterval(() => {
    G.timeLeft--;
    updateTimerUI();
    if (G.timeLeft <= 0) {
      clearInterval(G.timerHandle);
      finishWeek();
    }
  }, 1000);
}

function updateTimerUI() {
  const ratio   = G.timeLeft / TIMER_SEC;
  const fill    = document.getElementById('timer-fill');
  const numEl   = document.getElementById('timer-num');
  const iconEl  = document.getElementById('timer-icon-el');

  fill.style.width = `${ratio * 100}%`;
  numEl.textContent = G.timeLeft;

  fill.className = '';
  if (ratio <= 0.2) {
    fill.classList.add('danger');
    if (iconEl) iconEl.textContent = '🔥';
  } else if (ratio <= 0.5) {
    fill.classList.add('warn');
    if (iconEl) iconEl.textContent = '⏳';
  } else {
    if (iconEl) iconEl.textContent = '⏱';
  }
}

// ============================================================
// 상호작용 — 미션 선택 (hamburger tycoon: 메뉴 선택)
// ============================================================
function selectMission(idx) {
  const mission = G.missions[idx];
  if (!mission || mission.complete) return;

  G.activeMissionIdx = idx;
  renderQueue();       // 선택된 카드 강조
  renderStationCard(); // 어셈블리 스테이션 업데이트
  renderShop();        // 활동 카드 호환성 + 비용 표시 업데이트
}

// ============================================================
// 상호작용 — 활동 카드 클릭 (hamburger tycoon: 재료 넣기)
// ============================================================
function useActivity(actIdx) {
  // 활동 카드 샵 — ACTIVITY_DB 직접 참조
  const act = ACTIVITY_DB[actIdx];
  if (!act) return;

  // 미션 먼저 선택해야 함
  if (G.activeMissionIdx < 0) {
    showToast('위의 미션을 먼저 클릭해서 선택하세요! ☝️');
    return;
  }

  const mission = G.missions[G.activeMissionIdx];
  if (!mission || mission.complete) return;

  // 첫 번째 호환 가능한 빈 슬롯 찾기
  let targetSlotIdx = -1;
  for (let i = 0; i < mission.slots.length; i++) {
    const slot = mission.slots[i];
    if (slot.filled !== null) continue;
    if (SLOT_COMPAT[slot.type].includes(act.type)) {
      targetSlotIdx = i;
      break;
    }
  }

  if (targetSlotIdx < 0) {
    showToast('이 미션에 맞지 않는 활동이에요 ❌');
    const stCard = document.getElementById('station-card');
    if (stCard) {
      stCard.style.animation = 'none';
      stCard.offsetHeight;
      stCard.style.animation = 'shake 0.3s ease';
      stCard.addEventListener('animationend', () => { stCard.style.animation = ''; }, { once: true });
    }
    return;
  }

  // 비용 확인
  const [costStat, costAmt] = Object.entries(act.cost)[0];
  if (G.stats[costStat] < costAmt) {
    showToast(`${statEmoji(costStat)} ${costAmt} 필요! (현재 ${G.stats[costStat]})`);
    // 해당 스탯 바 흔들기
    const barEl = document.getElementById(`bar-${costStat}`);
    if (barEl) {
      barEl.style.animation = 'none';
      barEl.offsetHeight;
      barEl.style.animation = 'shake 0.3s ease';
      barEl.addEventListener('animationend', () => { barEl.style.animation = ''; }, { once: true });
    }
    return;
  }

  // 비용 차감
  G.stats[costStat] = Math.max(0, G.stats[costStat] - costAmt);
  addDelta(costStat, -costAmt);

  // 슬롯에 배정
  mission.slots[targetSlotIdx].filled = { ...act };

  renderHUD();
  renderQueue();
  renderStationCard();
  renderShop();

  // 미션 완료 확인
  if (mission.slots.every(s => s.filled !== null)) {
    completeMission(G.activeMissionIdx);
  }
}

// ============================================================
// 미션 완료 처리
// ============================================================
function completeMission(mIdx) {
  const mission = G.missions[mIdx];
  if (!mission || mission.complete) return;

  mission.complete = true;

  // 리스크 확인 (대리출석, 고백 등)
  let extraMsg = '';
  if (mission.riskChance && Math.random() < mission.riskChance) {
    if (mission.isConfession) {
      // 고백 실패
      const lost = G.stats.romance;
      G.stats.romance = 0;
      addDelta('romance', -lost);
      G.romanceResets++;
      G.flags.delete('confession_done');
      extraMsg = mission.riskMsg || '💔 고백 실패!';
    } else if (mission.riskPenalty) {
      for (const [stat, val] of Object.entries(mission.riskPenalty)) {
        applyStatChange(stat, val);
      }
      extraMsg = mission.riskMsg || '⚠️ 리스크 발동!';
    }
  } else {
    // 성공
    if (mission.isConfession) {
      G.flags.add('confession_done');
    }
    for (const [stat, val] of Object.entries(mission.reward)) {
      applyStatChange(stat, val);
    }
  }

  // 완료 효과 플로팅
  floatStatChanges(mission.reward);

  G.summaryMissions.push({ ...mission, result: 'complete', extraMsg });
  G.missionsCompleted++;

  // 미션 선택 해제 후 큐 자동 보충
  G.activeMissionIdx = -1;
  refillQueue();

  renderHUD();
  renderQueue();
  renderStationEmpty();
  renderShop();

  if (extraMsg) showToast(extraMsg);
  else showToast(`${mission.icon} 완료! +${G.missionsCompleted}번째 미션`);
}

// ============================================================
// 주 마무리
// ============================================================
function finishWeek() {
  clearInterval(G.timerHandle);

  // 미완료 미션 패널티 적용
  for (const mission of G.missions) {
    if (mission.complete) continue;
    mission.failed = true;
    if (mission.penalty) {
      for (const [stat, val] of Object.entries(mission.penalty)) {
        applyStatChange(stat, val);
      }
    }
    G.summaryMissions.push({ ...mission, result: 'failed' });
  }

  // 마지막 주 → 엔딩
  if (G.week >= 16) {
    showEnding();
    return;
  }

  showSummaryOverlay();
}

function nextWeek() {
  document.getElementById('overlay-summary').classList.add('hidden');
  G.week++;
  startWeek();
}

// ============================================================
// 스탯 변경 헬퍼
// ============================================================
function applyStatChange(stat, val) {
  if (!(stat in G.stats)) return;
  G.stats[stat] = Math.max(0, Math.min(100, G.stats[stat] + val));
  addDelta(stat, val);
}

function addDelta(stat, val) {
  if (stat in G.weekDelta) G.weekDelta[stat] += val;
}

// ============================================================
// 렌더 — HUD
// ============================================================
function renderHUD() {
  const isExam    = EXAM_WEEKS.includes(G.week);
  const specialId = SPECIAL_WEEKS[G.week];

  // 주차 텍스트
  document.getElementById('week-text').textContent = `1학기 ${G.week}주차`;
  document.getElementById('hud-weekof').textContent = `${G.week}/16`;

  // 타임라인
  document.getElementById('tl-fill').style.width = `${(G.week / 16) * 100}%`;

  // 태그
  const examTag  = document.getElementById('tag-exam');
  const eventTag = document.getElementById('tag-event');
  examTag.classList.toggle('hidden', !isExam);
  if (specialId === 'mt') {
    eventTag.textContent = '🏕 MT';
    eventTag.classList.remove('hidden');
  } else if (G.week === 6) {
    eventTag.textContent = '🎆 축제';
    eventTag.classList.remove('hidden');
  } else if (G.week === 12) {
    eventTag.textContent = '🎤 발표';
    eventTag.classList.remove('hidden');
  } else {
    eventTag.classList.add('hidden');
  }

  // 스탯 바
  updateStatBar('academic');
  updateStatBar('romance');
  updateStatBar('club');
}

function updateStatBar(stat) {
  const val = G.stats[stat];
  document.getElementById(`bar-${stat}`).style.width = `${val}%`;
  document.getElementById(`val-${stat}`).textContent = val;
}

// ============================================================
// 렌더 — 미션 큐 (상단 줄)
// ============================================================
function renderQueue() {
  const row = document.getElementById('queue-row');
  row.innerHTML = '';

  const pending = G.missions.filter(m => !m.complete);
  document.getElementById('queue-count-badge').textContent = pending.length || '';

  G.missions.forEach((mission, idx) => {
    if (mission.complete) return;

    const card = document.createElement('div');
    card.className = 'q-card';
    if (G.activeMissionIdx === idx) card.classList.add('active');

    // 슬롯 진행 도트
    const filled = mission.slots.filter(s => s.filled !== null).length;
    const total  = mission.slots.length;
    const dots = mission.slots.map(s =>
      `<span class="q-dot ${s.filled ? 'filled' : ''}"></span>`
    ).join('');

    card.innerHTML = `
      <div class="q-icon-title">
        <span class="q-icon">${mission.icon}</span>
        <span class="q-title">${mission.title}</span>
      </div>
      <div class="q-dots">${dots}</div>
      <div class="q-reward-preview">${filled}/${total} 완료</div>
    `;
    card.onclick = () => selectMission(idx);
    row.appendChild(card);
  });
}

// ============================================================
// 렌더 — 스테이션 (선택된 미션 상세)
// ============================================================
function renderStationEmpty() {
  document.getElementById('station-empty').classList.remove('hidden');
  document.getElementById('station-card').classList.add('hidden');
}

function renderStationCard() {
  if (G.activeMissionIdx < 0) {
    renderStationEmpty();
    return;
  }

  const mission = G.missions[G.activeMissionIdx];
  if (!mission) { renderStationEmpty(); return; }

  document.getElementById('station-empty').classList.add('hidden');
  const card = document.getElementById('station-card');
  card.classList.remove('hidden');

  // 헤더
  document.getElementById('st-icon').textContent  = mission.icon;
  document.getElementById('st-title').textContent = mission.title;
  const badge = document.getElementById('st-cat-badge');
  badge.textContent  = catLabel(mission.category);
  badge.className    = `st-badge stbadge-${mission.category}`;

  // 진행 텍스트
  const filled = mission.slots.filter(s => s.filled !== null).length;
  document.getElementById('st-progress-text').textContent = `${filled} / ${mission.slots.length}`;

  // 설명
  document.getElementById('st-desc').textContent = mission.desc;

  // 슬롯
  const slotsEl = document.getElementById('st-slots');
  slotsEl.innerHTML = '';
  mission.slots.forEach((slot) => {
    const el = document.createElement('div');
    el.className = `sslot stype-${slot.type} ${slot.filled ? 'filled' : 'empty'}`;
    if (slot.filled) {
      el.innerHTML = `<span class="sslot-emoji">${slot.filled.emoji}</span><span class="sslot-label">${slot.filled.label}</span>`;
    } else {
      el.innerHTML = `<span class="sslot-type-label">${slotTypeLabel(slot.type)}</span>`;
    }
    slotsEl.appendChild(el);
  });

  // 효과 블록
  renderEffects(mission);
}

function renderEffects(mission) {
  // 보상 (완료 시)
  const rewardItems = document.getElementById('st-reward-items');
  rewardItems.innerHTML = '';
  const rewardBlock = document.getElementById('st-reward-block');

  const rewardEntries = Object.entries(mission.reward).filter(([, v]) => v !== 0);
  if (rewardEntries.length === 0) {
    rewardBlock.classList.add('hidden');
  } else {
    rewardBlock.classList.remove('hidden');
    rewardEntries.forEach(([stat, val]) => {
      const tag = document.createElement('span');
      const sign = val > 0 ? '+' : '';
      tag.className = `eff-tag ${val > 0 ? 'pos' : 'neg'}`;
      tag.textContent = `${statEmoji(stat)} ${sign}${val}`;
      rewardItems.appendChild(tag);
    });
  }

  // 패널티 (미완료 시)
  const penaltyItems = document.getElementById('st-penalty-items');
  penaltyItems.innerHTML = '';
  const penaltyBlock = document.getElementById('st-penalty-block');

  const penaltyEntries = Object.entries(mission.penalty || {}).filter(([, v]) => v !== 0);
  if (penaltyEntries.length === 0) {
    penaltyBlock.classList.add('hidden');
  } else {
    penaltyBlock.classList.remove('hidden');
    penaltyEntries.forEach(([stat, val]) => {
      const tag = document.createElement('span');
      tag.className = 'eff-tag neg';
      tag.textContent = `${statEmoji(stat)} ${val}`;
      penaltyItems.appendChild(tag);
    });
  }
}

// ============================================================
// 렌더 — 활동 카드
// ============================================================
function renderActivities() {
  const row = document.getElementById('act-row');
  row.innerHTML = '';

  const activeMission = G.activeMissionIdx >= 0 ? G.missions[G.activeMissionIdx] : null;

  // 현재 선택된 미션에서 아직 빈 슬롯들의 타입 모음
  let neededTypes = new Set();
  if (activeMission && !activeMission.complete) {
    for (const slot of activeMission.slots) {
      if (slot.filled === null) neededTypes.add(slot.type);
    }
  }

  const remaining = G.activities.filter(a => !a.used).length;
  document.getElementById('act-left-badge').textContent = remaining;

  G.activities.forEach((act, idx) => {
    if (act.used) return;

    const card = document.createElement('div');
    card.className = `act-card type-${act.type}`;

    // 호환성 표시
    if (activeMission && !activeMission.complete) {
      let compatible = false;
      for (const slotType of neededTypes) {
        if (SLOT_COMPAT[slotType].includes(act.type)) {
          compatible = true;
          break;
        }
      }
      card.classList.add(compatible ? 'compatible' : 'incompatible');
    }

    card.innerHTML = `
      <span class="act-emoji">${act.emoji}</span>
      <span class="act-name">${act.label}</span>
      <span class="act-type-badge atb-${act.type}">${typeLabel(act.type)}</span>
    `;
    card.onclick = () => useActivity(idx);
    row.appendChild(card);
  });
}

// ============================================================
// 렌더 — 주차 요약 오버레이
// ============================================================
function showSummaryOverlay() {
  document.getElementById('sum-week-label').textContent = `1학기 ${G.week}주차 결산`;

  const completed = G.summaryMissions.filter(m => m.result === 'complete').length;
  const total     = G.summaryMissions.length;
  let gradeLabel, gradeCls;
  if (completed === total)          { gradeLabel = '완벽'; gradeCls = 'sg-perfect'; }
  else if (completed >= total * 0.7){ gradeLabel = '우수'; gradeCls = 'sg-good'; }
  else if (completed >= total * 0.4){ gradeLabel = '보통'; gradeCls = 'sg-partial'; }
  else                              { gradeLabel = '부진'; gradeCls = 'sg-fail'; }

  const gradeEl = document.getElementById('sum-grade-badge');
  gradeEl.textContent = gradeLabel;
  gradeEl.className   = `sum-grade ${gradeCls}`;

  // 미션 목록
  const listEl = document.getElementById('sum-missions-list');
  listEl.innerHTML = '';
  for (const m of G.summaryMissions) {
    const isDone = m.result === 'complete';
    const row = document.createElement('div');
    row.className = `sum-item ${isDone ? 'done' : 'fail'}`;
    row.innerHTML = `
      <span class="sum-item-icon">${m.icon}</span>
      <div class="sum-item-body">
        <div class="sum-item-name">${m.title}</div>
        ${m.extraMsg ? `<div class="sum-item-effects">${m.extraMsg}</div>` : ''}
      </div>
      <span class="sum-item-tag ${isDone ? 'done' : 'fail'}">${isDone ? '✅' : '❌'}</span>
    `;
    listEl.appendChild(row);
  }

  // 스탯 변화
  ['academic', 'romance', 'club'].forEach(stat => {
    const val   = G.stats[stat];
    const delta = G.weekDelta[stat];
    document.getElementById(`sbar-${stat}`).style.width   = `${val}%`;
    document.getElementById(`sval-${stat}`).textContent   = val;
    const dEl = document.getElementById(`sdelta-${stat}`);
    dEl.textContent = delta >= 0 ? `+${delta}` : `${delta}`;
    dEl.style.color = delta > 0 ? '#4ade80' : delta < 0 ? '#f87171' : 'var(--muted)';
  });

  document.getElementById('overlay-summary').classList.remove('hidden');
}

// ============================================================
// 엔딩
// ============================================================
function showEnding() {
  const s = G.stats;
  const r = G.romanceResets;

  let ending = ENDINGS.find(e => e.check(s, r));
  if (!ending) ending = ENDINGS[ENDINGS.length - 1];

  showScreen('screen-ending');

  const circle = document.getElementById('ending-circle');
  circle.textContent = ending.grade;
  circle.className   = `ending-circle grade-${ending.grade}`;

  document.getElementById('ending-title').textContent = ending.title;
  document.getElementById('ending-desc').textContent  = ending.desc;

  ['academic', 'romance', 'club'].forEach(stat => {
    document.getElementById(`ebar-${stat}`).style.width  = `${s[stat]}%`;
    document.getElementById(`eval-${stat}`).textContent  = s[stat];
  });
}

// ============================================================
// 스탯 플로팅 애니메이션
// ============================================================
function floatStatChanges(reward) {
  for (const [stat, val] of Object.entries(reward)) {
    if (val === 0) continue;
    const barEl = document.getElementById(`bar-${stat}`);
    if (!barEl) continue;

    const el   = document.createElement('div');
    el.className = `float-stat ${val > 0 ? 'float-pos' : 'float-neg'}`;
    el.textContent = (val > 0 ? '+' : '') + val;

    const rect = barEl.getBoundingClientRect();
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top  = `${rect.top}px`;
    document.body.appendChild(el);

    el.addEventListener('animationend', () => el.remove());
  }
}

// ============================================================
// 토스트
// ============================================================
function showToast(msg) {
  // Remove existing toast, then recreate to restart animation
  const old = document.getElementById('toast');
  if (old) old.remove();

  const t = document.createElement('div');
  t.id = 'toast';
  t.className = 'toast';
  t.textContent = msg;
  document.getElementById('app').appendChild(t);

  setTimeout(() => t.remove(), 2400);
}

// ============================================================
// 화면 전환
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ============================================================
// 유틸
// ============================================================
function catLabel(cat) {
  return { academic: '학업', romance: '연애', club: '동아리', special: '특수' }[cat] || cat;
}

function typeLabel(type) {
  return { academic: '학업', romance: '연애', club: '동아리', wild: '자유' }[type] || type;
}

function slotTypeLabel(type) {
  return { academic: '📚', romance: '💕', club: '🎯', any: '✨' }[type] || '?';
}

function statEmoji(stat) {
  return { academic: '📚', romance: '💕', club: '🎯' }[stat] || stat;
}
