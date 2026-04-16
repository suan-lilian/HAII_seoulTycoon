/* ============================================================
   서울대 생존백서 — Hamburger Tycoon Edition
   Game Logic
   ============================================================ */

/* ============================================================
   Supabase 설정
   ─────────────────────────────────────────────────────────────
   1. https://supabase.com 에서 프로젝트 생성
   2. SQL Editor에서 아래 실행:

      create table leaderboard (
        id        bigserial primary key,
        name      text not null,
        grade     text not null,
        academic  int  not null,
        romance   int  not null,
        club      int  not null,
        score     int  not null,
        created_at timestamptz default now()
      );
      alter table leaderboard enable row level security;
      create policy "read all"   on leaderboard for select using (true);
      create policy "insert all" on leaderboard for insert with check (true);

   3. Settings → API 에서 URL과 anon key를 복사해 아래에 붙여넣기
   ============================================================ */
const SUPABASE_URL = "https://wjslaxaopnctjwquosbs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indqc2xheGFvcG5jdGp3cXVvc2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNTM2NzksImV4cCI6MjA5MTgyOTY3OX0.0stYYr02QAMQ-hVlOnq4jxD7acxOJrdBiiCzfnsNVfY"; // ← 교체
const LB_TABLE = "leaderboard";

let TOTAL_WEEKS = 4; // ← 설정 화면에서 변경 가능

// ============================================================
// 활동 카드 데이터
// ============================================================
// cost: 어떤 스탯을 얼마나 소모해야 이 활동을 사용할 수 있는지
// 교차 소모 원칙: 학업활동 → 연애 소모 / 연애활동 → 학업 소모 / 동아리활동 → 학업 소모
// 충전 규칙: 학업 → 동아리로 구매 / 연애 → 학업으로 구매 / 동아리 → 연애로 구매
const ACTIVITY_DB = [
  {
    id: "library",
    type: "academic",
    emoji: "📚",
    label: "도서관",
    cost: { club: 4 },
  },
  {
    id: "homework",
    type: "academic",
    emoji: "📖",
    label: "과제",
    cost: { club: 3 },
  },
  {
    id: "cafe_s",
    type: "academic",
    emoji: "☕",
    label: "카페공부",
    cost: { club: 2 },
  },
  {
    id: "gibo",
    type: "academic",
    emoji: "📋",
    label: "족보",
    cost: { club: 3 },
  },
  {
    id: "kakao",
    type: "romance",
    emoji: "💬",
    label: "카톡",
    cost: { academic: 2 },
  },
  {
    id: "date",
    type: "romance",
    emoji: "🧋",
    label: "데이트",
    cost: { academic: 5 },
  },
  {
    id: "selca",
    type: "romance",
    emoji: "🤳",
    label: "셀카데이트",
    cost: { academic: 3 },
  },
  {
    id: "club_act",
    type: "club",
    emoji: "🎯",
    label: "동아리",
    cost: { romance: 3 },
  },
  {
    id: "hoesik",
    type: "club",
    emoji: "🍻",
    label: "회식",
    cost: { romance: 4 },
  },
  {
    id: "mt_prep",
    type: "club",
    emoji: "⛺",
    label: "MT준비",
    cost: { romance: 3 },
  },
  {
    id: "rest",
    type: "wild",
    emoji: "⭐",
    label: "자유시간",
    cost: { academic: 2 },
  },
];

// 슬롯 타입별 허용 활동 ID (특정 카드 ID 또는 rest(자유시간))
const SLOT_COMPAT = {
  // ── 학업 활동 ──
  library: ["library", "rest"],
  homework: ["homework", "rest"],
  cafe_s: ["cafe_s", "rest"],
  gibo: ["gibo", "rest"],
  // ── 연애 활동 ──
  kakao: ["kakao", "rest"],
  date: ["date", "rest"],
  selca: ["selca", "rest"],
  // ── 동아리 활동 ──
  club_act: ["club_act", "rest"],
  hoesik: ["hoesik", "rest"],
  mt_prep: ["mt_prep", "rest"],
  // ── 와일드 슬롯 (카테고리 단위) ──
  academic: ["library", "homework", "cafe_s", "gibo", "rest"],
  romance: ["kakao", "date", "selca", "rest"],
  club: ["club_act", "hoesik", "mt_prep", "rest"],
  any: [
    "library",
    "homework",
    "cafe_s",
    "gibo",
    "kakao",
    "date",
    "selca",
    "club_act",
    "hoesik",
    "mt_prep",
    "rest",
  ],
};

// ============================================================
// 미션 데이터베이스
// ============================================================
const MISSION_DB = [
  // ── 학업 미션
  {
    id: "library_session",
    title: "도서관 올박",
    icon: "📚",
    category: "academic",
    desc: "관정도서관에서 하루 종일 공부. 자리 선점이 실력이다.",
    required: ["library", "library", "library", "homework", "any"],
    reward: { academic: +18 },
    penalty: {},
    weight: 3,
  },
  {
    id: "midterm",
    title: "중간고사 준비",
    icon: "📝",
    category: "academic",
    desc: "시험 범위를 정리하고 문제풀이에 집중한다.",
    required: ["gibo", "homework", "cafe_s", "any"],
    reward: { academic: +14 },
    penalty: { academic: -8 },
    minWeek: 5,
    maxWeek: 9,
    weight: 4,
  },
  {
    id: "final_exam",
    title: "기말고사",
    icon: "✏️",
    category: "academic",
    desc: "학기 마지막 시험. 모든 것을 쏟아붓자.",
    required: ["gibo", "library", "cafe_s", "homework", "homework"],
    reward: { academic: +22 },
    penalty: { academic: -15 },
    minWeek: TOTAL_WEEKS - 2,
    maxWeek: TOTAL_WEEKS,
    weight: 5,
    specialWeek: TOTAL_WEEKS,
  },
  {
    id: "gibo_hunt",
    title: "족보 구하기",
    icon: "📋",
    category: "academic",
    desc: "선배에게 족보를 받아 시험을 준비한다. 인맥이 성적이다.",
    required: ["club_act", "gibo", "library", "homework"],
    reward: { academic: +12, club: +5 },
    penalty: {},
    weight: 2,
  },
  {
    id: "proxy",
    title: "대리 출석 수락",
    icon: "📝",
    category: "academic",
    desc: "선배가 대리 출석을 부탁했다. 걸리면 큰일이지만...",
    required: ["club_act", "mt_prep", "any"],
    reward: { academic: -8, club: +10, romance: +5 },
    penalty: { academic: -20 },
    riskChance: 0.3,
    riskPenalty: { academic: -20 },
    riskMsg: "⚠️ 적발! 학업 추가 -20",
    weight: 2,
  },

  // ── 연애 미션
  {
    id: "blind_date",
    title: "소개팅",
    icon: "💌",
    category: "romance",
    desc: "선배가 잡아준 소개팅. 준비부터 실전까지 신경 써야 한다.",
    required: ["kakao", "date", "selca", "any"],
    reward: { romance: +18 },
    penalty: { romance: -5 },
    weight: 3,
  },
  {
    id: "text_convo",
    title: "연인에게 연락",
    icon: "💬",
    category: "romance",
    desc: '"오늘 뭐해?" 한 통의 메시지가 관계를 유지시킨다.',
    required: ["kakao", "kakao", "any"],
    reward: { romance: +10 },
    penalty: { romance: -8 },
    weight: 3,
  },
  {
    id: "cafe_date",
    title: "카페 데이트",
    icon: "🧋",
    category: "romance",
    desc: "샤로수길 카페에서 여유로운 오후. 공부는... 나중에.",
    required: ["kakao", "date", "date", "cafe_s"],
    reward: { romance: +14, academic: -5 },
    penalty: { romance: -3 },
    weight: 2,
  },
  {
    id: "exam_date",
    title: "시험기간 데이트",
    icon: "😅",
    category: "romance",
    desc: '"나 보고 싶지 않아?" 수락하면 학업이 흔들린다.',
    required: ["kakao", "date", "selca", "date"],
    reward: { romance: +16, academic: -18 },
    penalty: { romance: -12 },
    minWeek: 7,
    maxWeek: 9,
    weight: 3,
  },
  {
    id: "confession",
    title: "고백 이벤트",
    icon: "💝",
    category: "romance",
    desc: "썸을 정리할 타이밍. 성공하면 대박, 실패하면 연애 0.",
    required: ["kakao", "date", "selca", "date", "any"],
    reward: { romance: +25 },
    penalty: { romance: -99 },
    riskChance: 0.4,
    riskMsg: "💔 고백 실패! 연애 → 0",
    isConfession: true,
    minStat: { romance: 50 },
    weight: 2,
  },

  // ── 동아리 미션
  {
    id: "mt",
    title: "MT 참석",
    icon: "⛺",
    category: "club",
    desc: "선배들과 MT. 불참하면 동아리 내 이미지가 급락한다.",
    required: ["mt_prep", "mt_prep", "club_act", "kakao", "hoesik"],
    reward: { club: +20, romance: +5 },
    penalty: { club: -20 },
    specialWeek: 3,
    weight: 5,
  },
  {
    id: "hoesik",
    title: "동아리 회식",
    icon: "🍻",
    category: "club",
    desc: "회식 참석. 분위기가 좋으면 연애 플래그도 생긴다.",
    required: ["club_act", "hoesik", "hoesik", "any"],
    reward: { club: +12, romance: +3 },
    penalty: { club: -8 },
    weight: 3,
  },
  {
    id: "club_event",
    title: "동아리 행사 기획",
    icon: "🎉",
    category: "club",
    desc: "다가오는 행사를 위해 준비에 매달린다.",
    required: ["club_act", "club_act", "mt_prep", "mt_prep", "any"],
    reward: { club: +18 },
    penalty: { club: -5 },
    weight: 3,
  },
  {
    id: "seminar",
    title: "학회 세미나 준비",
    icon: "🎤",
    category: "club",
    desc: "학업과 동아리를 동시에 챙길 수 있는 흔치 않은 기회.",
    required: ["library", "homework", "homework", "club_act", "club_act"],
    reward: { academic: +10, club: +12 },
    penalty: { club: -8 },
    weight: 2,
  },

  // ── 특수 미션
  {
    id: "festival",
    title: "대학 축제",
    icon: "🎆",
    category: "special",
    desc: "축제에서 공연도 보고 부스도 운영한다.",
    required: ["club_act", "hoesik", "kakao", "any"],
    reward: { club: +10, romance: +8 },
    penalty: {},
    specialWeek: 6,
    weight: 4,
  },
  {
    id: "presentation",
    title: "학회 발표",
    icon: "📊",
    category: "special",
    desc: "학회에서 발표. 잘 준비했다면 모두가 주목한다.",
    required: ["library", "library", "homework", "club_act", "club_act"],
    reward: { academic: +10, club: +15 },
    penalty: { club: -10 },
    specialWeek: 12,
    weight: 4,
  },
  {
    id: "balance_week",
    title: "균형 잡기",
    icon: "⚖️",
    category: "special",
    desc: "학업도, 연애도, 동아리도 조금씩 챙기는 여유로운 한 주.",
    required: ["cafe_s", "kakao", "club_act", "any"],
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
    id: "snu_legend",
    grade: "S",
    title: "서울대의 전설",
    desc: '학업도 연애도 동아리도 완벽. "당신은 실존 인물입니까?"',
    check: (s, _r) => s.academic >= 75 && s.romance >= 65 && s.club >= 65,
  },
  {
    id: "academic_crisis",
    grade: "D",
    title: "유급 위기",
    desc: "재수강 신청 화면으로 이동합니다. 다음 학기는 더 힘들어요.",
    check: (s) => s.academic <= 15,
  },
  {
    id: "eternal_solo",
    grade: "D",
    title: "전설의 솔로",
    desc: "연애 리셋 2회 이상. 이번 생은 공부만 합시다.",
    check: (_s, r) => r >= 2,
  },
  {
    id: "lonely_top",
    grade: "A",
    title: "수석의 고독",
    desc: "GPA 4.3, 하지만 연락처에 저장된 번호가 없다. 도서관과 결혼한 4년이 시작된다.",
    check: (s) => s.academic >= 80 && s.romance < 25 && s.club < 25,
  },
  {
    id: "studying_couple",
    grade: "A",
    title: "공부하는 연인",
    desc: "커플이지만 동아리에선 유령 회원. 그래도 둘이 함께라면 뭐든 할 수 있을 것 같다.",
    check: (s) => s.academic >= 65 && s.romance >= 55 && s.club < 45,
  },
  {
    id: "social_king",
    grade: "A",
    title: "동아리의 핵인싸",
    desc: "인맥은 탄탄하지만 성적표가 문제다. 취업은 인맥으로 하면 된다고 믿는다.",
    check: (s) => s.club >= 70 && s.romance >= 50 && s.academic < 45,
  },
  {
    id: "club_slave",
    grade: "C",
    title: "동아리 노예",
    desc: "선배 심부름만 하다 끝난 학기. 그래도 동아리방이 내 집이다.",
    check: (s) => s.club >= 75 && s.academic <= 25 && s.romance <= 20,
  },
  {
    id: "unrequited",
    grade: "C",
    title: "짝사랑의 계절",
    desc: "연애가 55를 넘었지만 고백을 못 했다. 다음 학기엔 꼭...",
    check: (s) => s.romance >= 55 && !G.flags.has("confession_done"),
  },
  {
    id: "just_student",
    grade: "B",
    title: "그냥 대학생",
    desc: "크게 잘한 것도, 크게 망한 것도 없다. 평범하게 살아남았다.",
    check: (s) => s.academic >= 30 && s.romance >= 25 && s.club >= 25,
  },
  {
    id: "survivor",
    grade: "B",
    title: "1학기 생존자",
    desc: "어떻게든 살아남았다. 그것만으로도 충분하다.",
    check: () => true,
  },
];

let EXAM_WEEKS = [Math.floor(TOTAL_WEEKS / 2), TOTAL_WEEKS];
const SPECIAL_WEEKS = {
  3: "mt",
  6: "festival",
  12: "presentation_week",
};
let TIMER_SEC = 60; // 1분

// 게임 설정 (설정 화면에서 변경 가능)
let CONFIG = {
  timerSec: 60,
  totalWeeks: 4,
  initAcademic: 30,
  initRomance: 20,
  initClub: 20,
};

// ============================================================
// 게임 상태
// ============================================================
let G = {};

function initActivities() {
  const counts = {};
  for (const act of ACTIVITY_DB) {
    counts[act.id] = act.type === "wild" ? 3 : 2;
  }
  return counts;
}

function makeState() {
  return {
    week: 1,
    stats: {
      academic: CONFIG.initAcademic,
      romance: CONFIG.initRomance,
      club: CONFIG.initClub,
    },
    flags: new Set(),
    romanceResets: 0,
    missions: [], // active missions (최대 3개 보임)
    activeMissionIdx: -1,
    timeLeft: TIMER_SEC,
    timerHandle: null,
    weekDelta: { academic: 0, romance: 0, club: 0 },
    summaryMissions: [],
    missionsCompleted: 0, // 이번 주 완수한 미션 수
    activities: initActivities(), // 활동 카드 잔여 수 { actId: count }
  };
}

// ============================================================
// 시작 / 리셋
// ============================================================
function startGame() {
  // CONFIG → 전역 상수 동기화
  TOTAL_WEEKS = CONFIG.totalWeeks;
  TIMER_SEC = CONFIG.timerSec;
  EXAM_WEEKS = [Math.floor(TOTAL_WEEKS / 2), TOTAL_WEEKS];

  // final_exam 미션의 주차 조건 동적 갱신
  const fe = MISSION_DB.find((m) => m.id === "final_exam");
  if (fe) {
    fe.minWeek = TOTAL_WEEKS - 2;
    fe.maxWeek = TOTAL_WEEKS;
    fe.specialWeek = TOTAL_WEEKS;
  }

  G = makeState();
  showScreen("screen-game");
  initChar();
  startWeek();
}

// ============================================================
// 설정 화면
// ============================================================
function openSettings() {
  document.getElementById("cfg-timer").value = CONFIG.timerSec;
  document.getElementById("cfg-weeks").value = CONFIG.totalWeeks;
  document.getElementById("cfg-academic").value = CONFIG.initAcademic;
  document.getElementById("cfg-romance").value = CONFIG.initRomance;
  document.getElementById("cfg-club").value = CONFIG.initClub;
  document.getElementById("overlay-settings").classList.remove("hidden");
}

function closeSettings() {
  document.getElementById("overlay-settings").classList.add("hidden");
}

function saveSettings() {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  CONFIG.timerSec = clamp(
    parseInt(document.getElementById("cfg-timer").value) || 60,
    10,
    300,
  );
  CONFIG.totalWeeks = clamp(
    parseInt(document.getElementById("cfg-weeks").value) || 4,
    2,
    16,
  );
  CONFIG.initAcademic = clamp(
    parseInt(document.getElementById("cfg-academic").value) || 30,
    0,
    100,
  );
  CONFIG.initRomance = clamp(
    parseInt(document.getElementById("cfg-romance").value) || 20,
    0,
    100,
  );
  CONFIG.initClub = clamp(
    parseInt(document.getElementById("cfg-club").value) || 20,
    0,
    100,
  );
  closeSettings();
}

function resetGame() {
  clearInterval(G.timerHandle);
  G = makeState();
  showScreen("screen-title");
}

// ============================================================
// 주차 시작
// ============================================================
function startWeek() {
  G.activeMissionIdx = -1;
  G.weekDelta = { academic: 0, romance: 0, club: 0 };
  G.summaryMissions = [];
  G.missionsCompleted = 0;
  G.missions = [];
  G.activities = initActivities(); // 매 주 활동 카드 리셋

  // 특수 주차 강제 미션 먼저 넣기
  const specialId = SPECIAL_WEEKS[G.week];
  if (specialId === "mt")
    G.missions.push(cloneMission(MISSION_DB.find((m) => m.id === "mt")));
  if (G.week === 6)
    G.missions.push(cloneMission(MISSION_DB.find((m) => m.id === "festival")));
  if (G.week === 12)
    G.missions.push(
      cloneMission(MISSION_DB.find((m) => m.id === "presentation")),
    );
  if (G.week === TOTAL_WEEKS)
    G.missions.push(
      cloneMission(MISSION_DB.find((m) => m.id === "final_exam")),
    );

  refillQueue(); // 큐를 3개로 채우기

  renderHUD();
  renderQueue();
  renderStationEmpty();
  renderShop();
  startTimer();
}

// ── 미션 생성
function buildMissions(week) {
  const isExam = EXAM_WEEKS.includes(week);
  const specialId = SPECIAL_WEEKS[week];

  const forced = [];
  if (specialId === "mt")
    forced.push(cloneMission(MISSION_DB.find((m) => m.id === "mt")));
  if (week === 6)
    forced.push(cloneMission(MISSION_DB.find((m) => m.id === "festival")));
  if (week === 12)
    forced.push(cloneMission(MISSION_DB.find((m) => m.id === "presentation")));
  if (week === TOTAL_WEEKS)
    forced.push(cloneMission(MISSION_DB.find((m) => m.id === "final_exam")));

  const usedIds = new Set(forced.map((m) => m.id));
  const pool = MISSION_DB.filter((m) => {
    if (usedIds.has(m.id)) return false;
    if (m.specialWeek) return false;
    if (m.minWeek && week < m.minWeek) return false;
    if (m.maxWeek && week > m.maxWeek) return false;
    if (m.minStat) {
      for (const [s, v] of Object.entries(m.minStat)) {
        if (G.stats[s] < v) return false;
      }
    }
    if (m.isConfession && G.flags.has("confession_done")) return false;
    return true;
  });

  const shuffled = weightedShuffle(pool, isExam);
  const target = Math.max(0, 3 - forced.length);
  for (let i = 0; i < target && i < shuffled.length; i++) {
    forced.push(cloneMission(shuffled[i]));
  }
  return forced.slice(0, 3);
}

function cloneMission(template) {
  const duration = template.required.length * 20; // 2슬롯=40s, 3슬롯=60s, 4슬롯=80s
  return {
    ...template,
    slots: template.required.map((slotType) => ({
      type: slotType,
      filled: null,
    })),
    complete: false,
    failed: false,
    duration,
    timeLeft: duration,
  };
}

function weightedShuffle(pool, isExam) {
  const weighted = [];
  for (const m of pool) {
    let w = m.weight || 1;
    if (isExam && m.category === "academic") w *= 2;
    for (let i = 0; i < w; i++) weighted.push(m);
  }
  for (let i = weighted.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
  }
  const seen = new Set();
  return weighted.filter((m) =>
    seen.has(m.id) ? false : (seen.add(m.id), true),
  );
}

// ── 큐 자동 보충 (항상 미션 3개 유지)
function refillQueue() {
  const active = G.missions.filter((m) => !m.complete);
  for (let i = active.length; i < 3; i++) {
    const next = generateMission();
    if (next) G.missions.push(next);
  }
}

// ── 미션 1개 랜덤 생성
function generateMission() {
  const week = G.week;
  const isExam = EXAM_WEEKS.includes(week);
  const activeIds = new Set(
    G.missions.filter((m) => !m.complete).map((m) => m.id),
  );

  const pool = MISSION_DB.filter((m) => {
    if (m.specialWeek) return false;
    if (activeIds.has(m.id)) return false; // 이미 큐에 있는 미션 중복 방지
    if (m.minWeek && week < m.minWeek) return false;
    if (m.maxWeek && week > m.maxWeek) return false;
    if (m.minStat) {
      for (const [s, v] of Object.entries(m.minStat)) {
        if (G.stats[s] < v) return false;
      }
    }
    if (m.isConfession && G.flags.has("confession_done")) return false;
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
    tickMissionTimers();
    if (G.timeLeft <= 0) {
      clearInterval(G.timerHandle);
      finishWeek();
    }
  }, 1000);
}

// 미션별 타이머 틱
function tickMissionTimers() {
  let expired = false;
  for (let i = G.missions.length - 1; i >= 0; i--) {
    const m = G.missions[i];
    if (m.complete) continue;
    m.timeLeft--;
    if (m.timeLeft <= 0) {
      expireMission(i);
      expired = true;
    }
  }
  if (!expired) renderQueue(); // 타이머 바 갱신
}

// 미션 시간 초과 처리
function expireMission(mIdx) {
  const mission = G.missions[mIdx];
  mission.failed = true;
  if (mission.penalty) {
    for (const [stat, val] of Object.entries(mission.penalty)) {
      applyStatChange(stat, val);
    }
  }
  G.summaryMissions.push({ ...mission, result: "failed" });

  // 선택 중이던 미션이면 해제
  if (G.activeMissionIdx === mIdx) G.activeMissionIdx = -1;
  else if (G.activeMissionIdx > mIdx) G.activeMissionIdx--;

  G.missions.splice(mIdx, 1);
  triggerCharReaction("fail");
  showToast(`⏰ ${mission.icon} ${mission.title} 시간 초과!`);

  refillQueue();
  renderHUD();
  renderQueue();
  renderStationEmpty();
  renderShop();
}

function updateTimerUI() {
  const ratio = G.timeLeft / TIMER_SEC;
  const fill = document.getElementById("timer-fill");
  const numEl = document.getElementById("timer-num");
  const iconEl = document.getElementById("timer-icon-el");

  fill.style.width = `${ratio * 100}%`;
  numEl.textContent = G.timeLeft;

  fill.className = "";
  if (ratio <= 0.2) {
    fill.classList.add("danger");
    if (iconEl) iconEl.textContent = "🔥";
  } else if (ratio <= 0.5) {
    fill.classList.add("warn");
    if (iconEl) iconEl.textContent = "⏳";
  } else {
    if (iconEl) iconEl.textContent = "⏱";
  }
}

// ============================================================
// 상호작용 — 미션 선택 (hamburger tycoon: 메뉴 선택)
// ============================================================
function selectMission(idx) {
  const mission = G.missions[idx];
  if (!mission || mission.complete) return;

  G.activeMissionIdx = idx;
  renderQueue(); // 선택된 카드 강조
  renderStationCard(); // 어셈블리 스테이션 업데이트
  renderShop(); // 활동 카드 호환성 + 비용 표시 업데이트
}

// ============================================================
// 상호작용 — 활동 카드 클릭 (hamburger tycoon: 재료 넣기)
// ============================================================
function useActivity(actIdx) {
  const act = ACTIVITY_DB[actIdx];
  if (!act) return;

  // 미션 먼저 선택해야 함
  if (G.activeMissionIdx < 0) {
    showToast("위의 미션을 먼저 클릭해서 선택하세요! ☝️");
    return;
  }

  const mission = G.missions[G.activeMissionIdx];
  if (!mission || mission.complete) return;

  // 잔여 카드 확인
  if ((G.activities[act.id] || 0) <= 0) {
    showToast(`${act.emoji} 활동이 고갈됐어요! 충전해주세요 🔄`);
    return;
  }

  // 순서대로만 채우기 — 다음 빈 슬롯이 곧 유일한 목표
  const targetSlotIdx = mission.slots.findIndex((s) => s.filled === null);
  if (targetSlotIdx < 0) return; // 이미 완료

  const targetSlot = mission.slots[targetSlotIdx];
  if (!SLOT_COMPAT[targetSlot.type].includes(act.id)) {
    const needed = slotActivityName(targetSlot.type);
    showToast(`순서 오류! 지금은 ${needed}이 필요해요 ❌`);
    const stCard = document.getElementById("station-card");
    if (stCard) {
      stCard.style.animation = "none";
      stCard.offsetHeight;
      stCard.style.animation = "shake 0.3s ease";
      stCard.addEventListener(
        "animationend",
        () => {
          stCard.style.animation = "";
        },
        { once: true },
      );
    }
    return;
  }

  // 카드 소모 (충전 시에만 스탯 차감)
  G.activities[act.id]--;

  // 슬롯에 배정
  mission.slots[targetSlotIdx].filled = { ...act };

  renderHUD();
  renderQueue();
  renderStationCard();
  renderShop();

  // 미션 완료 확인
  if (mission.slots.every((s) => s.filled !== null)) {
    completeMission(G.activeMissionIdx);
  }
}

// ============================================================
// 활동 카드 충전 (cross-스탯 소모)
// ============================================================
// 주차별 충전 비용 (매 주 2배 증가)
function rechargeCost(act) {
  const [costStat, base] = Object.entries(act.cost)[0];
  return [costStat, base * Math.pow(2, G.week - 1)];
}

function buyActivity(actId) {
  const act = ACTIVITY_DB.find((a) => a.id === actId);
  if (!act) return;

  const [costStat, costAmt] = rechargeCost(act);

  if (G.stats[costStat] < costAmt) {
    showToast(
      `${statEmoji(costStat)} ${costAmt} 필요! (현재 ${G.stats[costStat]})`,
    );
    const barEl = document.getElementById(`bar-${costStat}`);
    if (barEl) {
      barEl.style.animation = "none";
      barEl.offsetHeight;
      barEl.style.animation = "shake 0.3s ease";
      barEl.addEventListener(
        "animationend",
        () => {
          barEl.style.animation = "";
        },
        { once: true },
      );
    }
    return;
  }

  // cross-스탯 차감 + 카드 2장 충전
  G.stats[costStat] = Math.max(0, G.stats[costStat] - costAmt);
  addDelta(costStat, -costAmt);
  G.activities[actId] = (G.activities[actId] || 0) + 2;

  showToast(
    `${act.emoji} ${act.label} 충전! (${statEmoji(costStat)} -${costAmt})`,
  );

  renderHUD();
  renderShop();
}

// ============================================================
// 미션 완료 처리
// ============================================================
function completeMission(mIdx) {
  const mission = G.missions[mIdx];
  if (!mission || mission.complete) return;

  mission.complete = true;

  // 리스크 확인 (대리출석, 고백 등)
  let extraMsg = "";
  if (mission.riskChance && Math.random() < mission.riskChance) {
    if (mission.isConfession) {
      // 고백 실패
      const lost = G.stats.romance;
      G.stats.romance = 0;
      addDelta("romance", -lost);
      G.romanceResets++;
      G.flags.delete("confession_done");
      extraMsg = mission.riskMsg || "💔 고백 실패!";
    } else if (mission.riskPenalty) {
      for (const [stat, val] of Object.entries(mission.riskPenalty)) {
        applyStatChange(stat, val);
      }
      extraMsg = mission.riskMsg || "⚠️ 리스크 발동!";
    }
  } else {
    // 성공
    if (mission.isConfession) {
      G.flags.add("confession_done");
    }
    for (const [stat, val] of Object.entries(mission.reward)) {
      applyStatChange(stat, val);
    }
  }

  // 완료 효과 플로팅
  floatStatChanges(mission.reward);

  G.summaryMissions.push({ ...mission, result: "complete", extraMsg });
  G.missionsCompleted++;

  // 미션 선택 해제 후 큐 자동 보충
  G.activeMissionIdx = -1;
  refillQueue();

  renderHUD();
  renderQueue();
  renderStationEmpty();
  renderShop();

  triggerCharReaction(mission.category);
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
    G.summaryMissions.push({ ...mission, result: "failed" });
  }

  // 마지막 주 → 엔딩
  if (G.week >= TOTAL_WEEKS) {
    showEnding();
    return;
  }

  showSummaryOverlay();
}

function nextWeek() {
  document.getElementById("overlay-summary").classList.add("hidden");
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
  const isExam = EXAM_WEEKS.includes(G.week);
  const specialId = SPECIAL_WEEKS[G.week];

  // 주차 텍스트
  document.getElementById("week-text").textContent = `1학기 ${G.week}주차`;
  document.getElementById("hud-weekof").textContent =
    `${G.week}/${TOTAL_WEEKS}`;

  // 타임라인
  document.getElementById("tl-fill").style.width =
    `${(G.week / TOTAL_WEEKS) * 100}%`;

  // 태그
  const examTag = document.getElementById("tag-exam");
  const eventTag = document.getElementById("tag-event");
  examTag.classList.toggle("hidden", !isExam);
  if (specialId === "mt") {
    eventTag.textContent = "🏕 MT";
    eventTag.classList.remove("hidden");
  } else if (G.week === 6) {
    eventTag.textContent = "🎆 축제";
    eventTag.classList.remove("hidden");
  } else if (G.week === 12) {
    eventTag.textContent = "🎤 발표";
    eventTag.classList.remove("hidden");
  } else {
    eventTag.classList.add("hidden");
  }

  // 스탯 바
  updateStatBar("academic");
  updateStatBar("romance");
  updateStatBar("club");
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
  const row = document.getElementById("queue-row");
  row.innerHTML = "";

  const pending = G.missions.filter((m) => !m.complete);
  document.getElementById("queue-count-badge").textContent =
    pending.length || "";

  G.missions.forEach((mission, idx) => {
    if (mission.complete) return;

    const card = document.createElement("div");
    card.className = "q-card";
    if (G.activeMissionIdx === idx) card.classList.add("active");

    // 슬롯 진행 도트
    const dots = mission.slots
      .map((s) => `<span class="q-dot ${s.filled ? "filled" : ""}"></span>`)
      .join("");

    // 미션 타이머
    const timerRatio = Math.max(0, mission.timeLeft / mission.duration);
    const timerCls =
      timerRatio <= 0.2 ? "danger" : timerRatio <= 0.5 ? "warn" : "";

    card.innerHTML = `
      <div class="q-timer-bar-bg">
        <div class="q-timer-bar ${timerCls}" style="width:${timerRatio * 100}%"></div>
      </div>
      <div class="q-icon-title">
        <span class="q-icon">${mission.icon}</span>
        <span class="q-title">${mission.title}</span>
      </div>
      <div class="q-dots">${dots}</div>
    `;
    card.onclick = () => selectMission(idx);
    row.appendChild(card);
  });
}

// ============================================================
// 렌더 — 스테이션 (선택된 미션 상세)
// ============================================================
function renderStationEmpty() {
  document.getElementById("station-empty").classList.remove("hidden");
  document.getElementById("station-card").classList.add("hidden");
}

function renderStationCard() {
  if (G.activeMissionIdx < 0) {
    renderStationEmpty();
    return;
  }

  const mission = G.missions[G.activeMissionIdx];
  if (!mission) {
    renderStationEmpty();
    return;
  }

  document.getElementById("station-empty").classList.add("hidden");
  const card = document.getElementById("station-card");
  card.classList.remove("hidden");

  // 헤더
  document.getElementById("st-icon").textContent = mission.icon;
  document.getElementById("st-title").textContent = mission.title;
  const badge = document.getElementById("st-cat-badge");
  badge.textContent = catLabel(mission.category);
  badge.className = `st-badge stbadge-${mission.category}`;

  // 진행 텍스트
  const filled = mission.slots.filter((s) => s.filled !== null).length;
  document.getElementById("st-progress-text").textContent =
    `${filled} / ${mission.slots.length}`;

  // 설명
  document.getElementById("st-desc").textContent = mission.desc;

  // 슬롯
  const slotsEl = document.getElementById("st-slots");
  slotsEl.innerHTML = "";
  const nextEmptyIdx = mission.slots.findIndex((s) => s.filled === null);
  mission.slots.forEach((slot, i) => {
    const el = document.createElement("div");
    const isNext = i === nextEmptyIdx;
    const catClass = slotCategory(slot.type);
    el.className = `sslot stype-${catClass} ${slot.filled ? "filled" : "empty"}${isNext ? " next-target" : ""}`;
    if (slot.filled) {
      el.innerHTML = `<span class="sslot-emoji">${slot.filled.emoji}</span><span class="sslot-label">${slot.filled.label}</span>`;
    } else {
      el.innerHTML = `<span class="sslot-emoji" style="opacity:0.35">${slotTypeLabel(slot.type)}</span><span class="sslot-label">${slotActivityName(slot.type)}</span>${isNext ? '<span class="sslot-arrow">▼</span>' : ""}`;
    }
    slotsEl.appendChild(el);
  });

  // 효과 블록
  renderEffects(mission);
}

function renderEffects(mission) {
  // 보상 (완료 시)
  const rewardItems = document.getElementById("st-reward-items");
  rewardItems.innerHTML = "";
  const rewardBlock = document.getElementById("st-reward-block");

  const rewardEntries = Object.entries(mission.reward).filter(
    ([, v]) => v !== 0,
  );
  if (rewardEntries.length === 0) {
    rewardBlock.classList.add("hidden");
  } else {
    rewardBlock.classList.remove("hidden");
    rewardEntries.forEach(([stat, val]) => {
      const tag = document.createElement("span");
      const sign = val > 0 ? "+" : "";
      tag.className = `eff-tag ${val > 0 ? "pos" : "neg"}`;
      tag.textContent = `${statEmoji(stat)} ${sign}${val}`;
      rewardItems.appendChild(tag);
    });
  }

  // 패널티 (미완료 시)
  const penaltyItems = document.getElementById("st-penalty-items");
  penaltyItems.innerHTML = "";
  const penaltyBlock = document.getElementById("st-penalty-block");

  const penaltyEntries = Object.entries(mission.penalty || {}).filter(
    ([, v]) => v !== 0,
  );
  if (penaltyEntries.length === 0) {
    penaltyBlock.classList.add("hidden");
  } else {
    penaltyBlock.classList.remove("hidden");
    penaltyEntries.forEach(([stat, val]) => {
      const tag = document.createElement("span");
      tag.className = "eff-tag neg";
      tag.textContent = `${statEmoji(stat)} ${val}`;
      penaltyItems.appendChild(tag);
    });
  }
}

// ============================================================
// 렌더 — 활동 카드 (충전 가능)
// ============================================================
function renderShop() {
  const row = document.getElementById("act-row");
  row.innerHTML = "";

  const activeMission =
    G.activeMissionIdx >= 0 ? G.missions[G.activeMissionIdx] : null;

  // 다음에 채워야 할 슬롯 타입만 표시 (순서 강제)
  let neededTypes = new Set();
  if (activeMission && !activeMission.complete) {
    const nextSlot = activeMission.slots.find((s) => s.filled === null);
    if (nextSlot) neededTypes.add(nextSlot.type);
  }

  const totalRemaining = ACTIVITY_DB.reduce(
    (sum, act) => sum + (G.activities[act.id] || 0),
    0,
  );
  document.getElementById("act-left-badge").textContent = totalRemaining || "0";

  ACTIVITY_DB.forEach((act, idx) => {
    const count = G.activities[act.id] || 0;

    const card = document.createElement("div");
    card.className = `act-card type-${act.type}`;

    // 호환성 표시

    if (count > 0) {
      card.innerHTML = `
        <span class="act-count-badge">${count}</span>
        <span class="act-emoji">${act.emoji}</span>
        <span class="act-name">${act.label}</span>
        <span class="act-type-badge atb-${act.type}">${typeLabel(act.type)}</span>
      `;
      card.onclick = () => useActivity(idx);
    } else {
      // 고갈 → 충전 버튼 표시 (현재 주차 실제 비용)
      const [costStat, costAmt] = rechargeCost(act);
      card.classList.add("depleted");
      card.innerHTML = `
        <span class="act-emoji depleted-emoji">${act.emoji}</span>
        <span class="act-name">${act.label}</span>
        <button class="btn-recharge" onclick="event.stopPropagation(); buyActivity('${act.id}')">
          충전 ${statEmoji(costStat)}${costAmt}
        </button>
      `;
    }

    row.appendChild(card);
  });
}

// ============================================================
// 렌더 — 주차 요약 오버레이
// ============================================================
function showSummaryOverlay() {
  document.getElementById("sum-week-label").textContent =
    `1학기 ${G.week}주차 결산`;

  const completed = G.summaryMissions.filter(
    (m) => m.result === "complete",
  ).length;
  const total = G.summaryMissions.length;
  let gradeLabel, gradeCls;
  if (completed === total) {
    gradeLabel = "완벽";
    gradeCls = "sg-perfect";
  } else if (completed >= total * 0.7) {
    gradeLabel = "우수";
    gradeCls = "sg-good";
  } else if (completed >= total * 0.4) {
    gradeLabel = "보통";
    gradeCls = "sg-partial";
  } else {
    gradeLabel = "부진";
    gradeCls = "sg-fail";
  }

  const gradeEl = document.getElementById("sum-grade-badge");
  gradeEl.textContent = gradeLabel;
  gradeEl.className = `sum-grade ${gradeCls}`;

  // 미션 목록
  const listEl = document.getElementById("sum-missions-list");
  listEl.innerHTML = "";
  for (const m of G.summaryMissions) {
    const isDone = m.result === "complete";
    const row = document.createElement("div");
    row.className = `sum-item ${isDone ? "done" : "fail"}`;
    row.innerHTML = `
      <span class="sum-item-icon">${m.icon}</span>
      <div class="sum-item-body">
        <div class="sum-item-name">${m.title}</div>
        ${m.extraMsg ? `<div class="sum-item-effects">${m.extraMsg}</div>` : ""}
      </div>
      <span class="sum-item-tag ${isDone ? "done" : "fail"}">${isDone ? "✅" : "❌"}</span>
    `;
    listEl.appendChild(row);
  }

  // 스탯 변화
  ["academic", "romance", "club"].forEach((stat) => {
    const val = G.stats[stat];
    const delta = G.weekDelta[stat];
    document.getElementById(`sbar-${stat}`).style.width = `${val}%`;
    document.getElementById(`sval-${stat}`).textContent = val;
    const dEl = document.getElementById(`sdelta-${stat}`);
    dEl.textContent = delta >= 0 ? `+${delta}` : `${delta}`;
    dEl.style.color =
      delta > 0 ? "#4ade80" : delta < 0 ? "#f87171" : "var(--muted)";
  });

  document.getElementById("overlay-summary").classList.remove("hidden");
}

// ============================================================
// 엔딩
// ============================================================
function showEnding() {
  const s = G.stats;
  const r = G.romanceResets;

  let ending = ENDINGS.find((e) => e.check(s, r));
  if (!ending) ending = ENDINGS[ENDINGS.length - 1];

  cacheEndingForLB(ending);
  stopChar();
  showScreen("screen-ending");

  const circle = document.getElementById("ending-circle");
  circle.textContent = ending.grade;
  circle.className = `ending-circle grade-${ending.grade}`;

  document.getElementById("ending-title").textContent = ending.title;
  document.getElementById("ending-desc").textContent = ending.desc;

  ["academic", "romance", "club"].forEach((stat) => {
    document.getElementById(`ebar-${stat}`).style.width = `${s[stat]}%`;
    document.getElementById(`eval-${stat}`).textContent = s[stat];
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

    const el = document.createElement("div");
    el.className = `float-stat ${val > 0 ? "float-pos" : "float-neg"}`;
    el.textContent = (val > 0 ? "+" : "") + val;

    const rect = barEl.getBoundingClientRect();
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top = `${rect.top}px`;
    document.body.appendChild(el);

    el.addEventListener("animationend", () => el.remove());
  }
}

// ============================================================
// 토스트
// ============================================================
function showToast(msg) {
  // Remove existing toast, then recreate to restart animation
  const old = document.getElementById("toast");
  if (old) old.remove();

  const t = document.createElement("div");
  t.id = "toast";
  t.className = "toast";
  t.textContent = msg;
  document.getElementById("app").appendChild(t);

  setTimeout(() => t.remove(), 2400);
}

// ============================================================
// 화면 전환
// ============================================================
function showScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach((el) => el.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ============================================================
// 유틸
// ============================================================
function catLabel(cat) {
  return (
    { academic: "학업", romance: "연애", club: "동아리", special: "특수" }[
      cat
    ] || cat
  );
}

function typeLabel(type) {
  return (
    { academic: "학업", romance: "연애", club: "동아리", wild: "자유" }[type] ||
    type
  );
}

function slotTypeLabel(type) {
  const map = {
    academic: "📚",
    romance: "💕",
    club: "🎯",
    any: "✨",
    library: "📚",
    homework: "📖",
    cafe_s: "☕",
    gibo: "📋",
    kakao: "💬",
    date: "🧋",
    selca: "🤳",
    club_act: "🎯",
    hoesik: "🍻",
    mt_prep: "⛺",
  };
  return map[type] || "?";
}

// 슬롯 타입 → 한글 이름 (토스트 메시지용)
function slotActivityName(type) {
  const map = {
    academic: "학업 활동",
    romance: "연애 활동",
    club: "동아리 활동",
    any: "아무 활동",
    library: "📚 도서관",
    homework: "📖 과제",
    cafe_s: "☕ 카페공부",
    gibo: "📋 족보",
    kakao: "💬 카톡",
    date: "🧋 데이트",
    selca: "🤳 셀카데이트",
    club_act: "🎯 동아리",
    hoesik: "🍻 회식",
    mt_prep: "⛺ MT준비",
  };
  return map[type] || type;
}

// 슬롯 특정 ID → 카테고리 (CSS 색상 클래스용)
function slotCategory(type) {
  if (["library", "homework", "cafe_s", "gibo"].includes(type))
    return "academic";
  if (["kakao", "date", "selca"].includes(type)) return "romance";
  if (["club_act", "hoesik", "mt_prep"].includes(type)) return "club";
  return type; // academic / romance / club / any 그대로
}

function statEmoji(stat) {
  return { academic: "📚", romance: "💕", club: "🎯" }[stat] || stat;
}

// ============================================================
// 리더보드
// ============================================================
let _lastEnding = null; // showEnding에서 저장

// showEnding 내에서 호출해 현재 엔딩 정보를 캐시
function cacheEndingForLB(ending) {
  _lastEnding = ending;
}

// Supabase REST API 헬퍼
async function sbFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ── 점수 등록 모달 열기
function openSubmitScore() {
  const s = G.stats;
  const score = s.academic + s.romance + s.club;
  const grade = _lastEnding ? _lastEnding.grade : "?";

  const preview = document.getElementById("submit-grade-preview");
  preview.innerHTML = `
    <div class="submit-grade-circle grade-${grade}">${grade}</div>
    <div class="submit-stats-row">
      <span>📚 ${s.academic}</span>
      <span>💕 ${s.romance}</span>
      <span>🎯 ${s.club}</span>
      <span class="submit-total">합계 ${score}</span>
    </div>
  `;
  document.getElementById("input-playername").value = "";
  document.getElementById("submit-status").textContent = "";
  document.getElementById("overlay-submit").classList.remove("hidden");
}

function closeSubmitScore() {
  document.getElementById("overlay-submit").classList.add("hidden");
}

// ── 점수 Supabase에 저장
async function submitScore() {
  const name = document.getElementById("input-playername").value.trim();
  if (!name) {
    document.getElementById("submit-status").textContent =
      "닉네임을 입력해주세요!";
    return;
  }

  const statusEl = document.getElementById("submit-status");
  statusEl.textContent = "등록 중…";

  const s = G.stats;
  const payload = {
    name,
    grade: _lastEnding ? _lastEnding.grade : "B",
    academic: s.academic,
    romance: s.romance,
    club: s.club,
    score: s.academic + s.romance + s.club,
  };

  try {
    await sbFetch(LB_TABLE, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    statusEl.textContent = "✅ 등록 완료!";
    setTimeout(() => {
      closeSubmitScore();
      openLeaderboard();
    }, 800);
  } catch (e) {
    statusEl.textContent = `❌ 등록 실패: ${e.message}`;
  }
}

// ── 리더보드 모달 열기 + 데이터 로드
async function openLeaderboard() {
  document.getElementById("overlay-leaderboard").classList.remove("hidden");
  const listEl = document.getElementById("lb-list");
  listEl.innerHTML = '<div class="lb-loading">불러오는 중…</div>';

  try {
    const rows = await sbFetch(
      `${LB_TABLE}?select=name,grade,academic,romance,club,score,created_at&order=score.desc&limit=10`,
    );
    renderLeaderboard(rows, listEl);
  } catch (e) {
    listEl.innerHTML = `<div class="lb-loading lb-error">불러오기 실패: ${e.message}</div>`;
  }
}

function closeLeaderboard() {
  document.getElementById("overlay-leaderboard").classList.add("hidden");
}

function renderLeaderboard(rows, container) {
  if (!rows || rows.length === 0) {
    container.innerHTML = '<div class="lb-loading">아직 기록이 없습니다!</div>';
    return;
  }

  const MEDAL = ["🥇", "🥈", "🥉"];
  container.innerHTML = rows
    .map((row, i) => {
      const rank = i < 3 ? MEDAL[i] : `${i + 1}`;
      const date = new Date(row.created_at).toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
      });
      return `
        <div class="lb-row">
          <span class="lb-rank">${rank}</span>
          <div class="lb-info">
            <div class="lb-name-grade">
              <span class="lb-name">${escHtml(row.name)}</span>
              <span class="lb-grade-badge grade-${row.grade}">${row.grade}</span>
            </div>
            <div class="lb-detail">📚${row.academic} 💕${row.romance} 🎯${row.club}</div>
          </div>
          <div class="lb-right">
            <span class="lb-score">${row.score}</span>
            <span class="lb-date">${date}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

// ============================================================
// 캐릭터 픽셀아트
// ============================================================
const CPXL = 3; // 픽셀 1칸 = 3 canvas px
const CGRID_W = 20; // 캐릭터 그리드 너비
const CGRID_H = 28; // 캐릭터 그리드 높이
const CYPAD = 3; // 머리 위 반응 공간 (그리드 단위)

let _cRaf = null;
let _cT = 0;
let _cReact = null; // 'academic'|'romance'|'club'|'special'|'fail'
let _cReactEnd = 0;

function initChar() {
  const c = document.getElementById("char-canvas");
  if (!c) return;
  c.width = CGRID_W * CPXL;
  c.height = CGRID_H * CPXL;
  if (_cRaf) cancelAnimationFrame(_cRaf);
  const tick = (t) => {
    _cT = t;
    if (Date.now() > _cReactEnd) _cReact = null;
    _drawChar();
    _cRaf = requestAnimationFrame(tick);
  };
  _cRaf = requestAnimationFrame(tick);
}

function stopChar() {
  if (_cRaf) cancelAnimationFrame(_cRaf);
  _cRaf = null;
}

function triggerCharReaction(type) {
  _cReact = type;
  _cReactEnd = Date.now() + 1600;
}

function _drawChar() {
  const c = document.getElementById("char-canvas");
  if (!c || !G) return;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);

  const tired = Math.min(3, Math.floor(((G.week - 1) * 4) / TOTAL_WEEKS));
  const breath = Math.sin(_cT * 0.0012) > 0 ? 1 : 0; // 숨쉬기

  // 색상 팔레트
  const PAL = {
    SK: "#F5C99A",
    SKD: "#D4995A",
    HR: "#3D2B1F",
    HRM: "#6B4A35",
    EY: "#1A0A05",
    EYW: "#FDF4E7",
    BL: "#E8A0A8",
    DC: "#9B8AAB",
    SW: "#A8C8E8",
    SH: ["#6B8FC9", "#7A9FC8", "#9060A0", "#C04040"][tired],
    SHD: ["#4A6FA5", "#5A7FB5", "#703090", "#A03030"][tired],
    PT: "#5B7FA6",
    PTD: "#3D5F86",
    SHO: "#2A1A10",
    CG: "#7AAB8A",
    CD: "#5A8A6A",
    CB: "#8B5E3C",
  };

  const px = CPXL;
  const g = (x, y, w, h, col) => {
    if (x < 0 || y < 0) return;
    ctx.fillStyle = col;
    ctx.fillRect(x * px, y * px, w * px, h * px);
  };

  const slouch = tired;
  const yH = CYPAD + breath;
  const yB = yH + 9 + slouch;
  const yP = yB + 7;
  const yS = yP + 4;

  // ── 머리카락 ──
  g(5, yH, 10, 1, PAL.HR);
  g(4, yH + 1, 12, 1, PAL.HR);
  g(3, yH + 2, 2, 6, PAL.HR);
  g(15, yH + 2, 2, 6, PAL.HR);
  g(3, yH + 2, 1, 3, PAL.HRM);

  // ── 얼굴 ──
  g(5, yH + 1, 10, 1, PAL.SK);
  g(4, yH + 2, 11, 7, PAL.SK);
  g(14, yH + 2, 1, 7, PAL.SKD);

  // ── 눈 ──
  const ey = yH + 4;
  if (tired === 0) {
    g(6, ey, 2, 2, PAL.EYW);
    g(7, ey, 1, 2, PAL.EY);
    g(11, ey, 2, 2, PAL.EYW);
    g(12, ey, 1, 2, PAL.EY);
  } else if (tired === 1) {
    g(6, ey, 2, 2, PAL.EY);
    g(6, ey, 2, 1, PAL.HR);
    g(11, ey, 2, 2, PAL.EY);
    g(11, ey, 2, 1, PAL.HR);
  } else if (tired === 2) {
    g(6, ey + 1, 2, 1, PAL.EY);
    g(6, ey, 2, 1, PAL.HR);
    g(11, ey + 1, 2, 1, PAL.EY);
    g(11, ey, 2, 1, PAL.HR);
    g(5, ey + 2, 4, 1, PAL.DC);
    g(10, ey + 2, 4, 1, PAL.DC);
  } else {
    g(6, ey + 1, 2, 1, PAL.EY);
    g(6, ey, 2, 2, PAL.HR);
    g(11, ey + 1, 2, 1, PAL.EY);
    g(11, ey, 2, 2, PAL.HR);
    g(5, ey + 2, 5, 2, PAL.DC);
    g(10, ey + 2, 5, 2, PAL.DC);
    g(6, ey + 4, 1, 2, PAL.SW);
  }

  // ── 볼터치 ──
  if (tired <= 1) {
    g(5, yH + 6, 2, 1, PAL.BL);
    g(13, yH + 6, 2, 1, PAL.BL);
  }

  // ── 입 ──
  const my = yH + 7;
  if (tired === 0) {
    g(7, my, 1, 1, PAL.EY);
    g(8, my + 1, 3, 1, PAL.EY);
    g(11, my, 1, 1, PAL.EY);
  } else if (tired === 1) {
    g(7, my, 5, 1, PAL.EY);
  } else if (tired === 2) {
    g(7, my + 1, 1, 1, PAL.EY);
    g(8, my, 3, 1, PAL.EY);
    g(11, my + 1, 1, 1, PAL.EY);
  } else {
    g(7, my, 6, 1, PAL.EY);
    g(7, my + 1, 6, 1, PAL.EY);
    g(8, my + 1, 4, 1, PAL.SKD);
  }

  // ── 땀방울 (exhausted) ──
  if (tired >= 3) {
    g(2, yH + 3, 1, 1, PAL.SW);
    g(3, yH + 4, 1, 2, PAL.SW);
    g(17, yH + 3, 1, 1, PAL.SW);
    g(17, yH + 4, 1, 2, PAL.SW);
  }

  // ── 목 + 셔츠 ──
  g(8, yB - 1, 4, 1, PAL.SK);
  g(4, yB, 12, 7, PAL.SH);
  g(4, yB, 12, 1, PAL.SHD);
  g(8, yB, 4, 1, PAL.SK);
  g(9, yB, 2, 2, PAL.SK);

  // ── 왼팔 ──
  const laD = tired >= 2 ? 2 : 0;
  g(1, yB + 1 + laD, 3, 5, PAL.SH);
  g(1, yB + 4 + laD, 3, 2, PAL.SHD);
  g(0, yB + 5 + laD, 2, 2, PAL.SK);

  // ── 오른팔 + 커피컵 ──
  const raD = tired >= 2 ? 3 : 0;
  g(16, yB + 1 + raD, 3, 5, PAL.SH);
  g(16, yB + 4 + raD, 3, 2, PAL.SHD);
  if (tired >= 2) {
    g(16, yB + 5 + raD, 3, 3, PAL.CG);
    g(16, yB + 5 + raD, 3, 1, PAL.CD);
    g(16, yB + 6 + raD, 3, 1, PAL.CB);
    g(19, yB + 6 + raD, 1, 2, PAL.CD);
  } else {
    g(17, yB + 5, 2, 2, PAL.SK);
  }

  // ── 바지 ──
  g(4, yP, 4, 5, PAL.PT);
  g(5, yP, 2, 5, PAL.PTD);
  g(12, yP, 4, 5, PAL.PT);
  g(13, yP, 2, 5, PAL.PTD);
  g(4, yP, 12, 1, PAL.PTD);

  // ── 신발 ──
  g(3, yS, 6, 2, PAL.SHO);
  g(11, yS, 6, 2, PAL.SHO);

  // ── 반응 애니메이션 ──
  if (_cReact) {
    const prog = Math.max(0, 1 - (_cReactEnd - Date.now()) / 1600);
    const ry = Math.max(0, Math.floor(yH - 2 - prog * 4));
    const HC = "#E87090",
      SC = "#F0E060",
      BC = "#6B8FC9";

    if (_cReact === "romance") {
      g(6, ry + 1, 2, 2, HC);
      g(10, ry + 1, 2, 2, HC);
      g(5, ry + 2, 8, 2, HC);
      g(6, ry + 4, 6, 1, HC);
      g(7, ry + 5, 4, 1, HC);
      g(8, ry + 6, 2, 1, HC);
    } else if (_cReact === "academic") {
      g(7, ry, 6, 4, "#F5E0A0");
      g(7, ry, 6, 1, "#C0A060");
      g(9, ry + 1, 2, 3, "#C0A060");
      g(13, ry, 1, 1, SC);
      g(13, ry + 2, 1, 1, SC);
    } else if (_cReact === "club") {
      g(8, ry, 4, 1, SC);
      g(7, ry + 1, 6, 1, SC);
      g(6, ry + 2, 8, 1, SC);
      g(7, ry + 3, 6, 1, SC);
      g(8, ry + 4, 4, 1, SC);
    } else if (_cReact === "special") {
      g(7, ry, 2, 2, HC);
      g(11, ry, 2, 2, SC);
      g(7, ry + 3, 6, 1, BC);
    } else if (_cReact === "fail") {
      g(4, ry + 2, 3, 1, PAL.SW);
      g(5, ry + 3, 2, 2, PAL.SW);
      g(12, ry + 2, 3, 1, PAL.SW);
      g(13, ry + 3, 2, 2, PAL.SW);
    }
  }

  // ── 기분 텍스트 업데이트 ──
  const moods = [
    "신입생의 패기! 🔥",
    "그래도 버틸만해 😐",
    "커피는 생명수... ☕",
    "제발... 끝나라... 😵",
  ];
  const hintEl = document.getElementById("char-event-hint");
  const moodEl = document.getElementById("char-mood-text");
  if (moodEl) moodEl.textContent = moods[tired];
  if (hintEl) {
    const specialId = SPECIAL_WEEKS[G.week];
    if (G.week === TOTAL_WEEKS) hintEl.textContent = "⚠️ 기말고사 주간!";
    else if (specialId === "mt") hintEl.textContent = "🏕 이번 주 MT!";
    else if (G.week === 6) hintEl.textContent = "🎆 축제 주간!";
    else hintEl.textContent = "";
  }
}

function escHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
