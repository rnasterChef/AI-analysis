// src/prompt.js
// =======================
// 시나리오 / 세계관 설정
// =======================

const SCENARIO = {
  title: "크래프톤 빌딩 생존자 15인",
  premise:
    "2026년 1월 원인 불명 감염 사태로 도시가 붕괴했고, 생존자들이 크래프톤 빌딩 102호에 피신했다. 플레이어는 결정권자로서 공동체의 생존 규칙을 선택한다.",
  factions: {
    A: {
      name: "성열",
      ideology: "보수 성향",
      tag: "능력·성과·질서·안전·고립/리스크 회피",
    },
    B: {
      name: "재면",
      ideology: "진보 성향",
      tag: "제도·평등·연대·수용·집단 이동/공동체",
    },
  },
};

// =======================
// 문항 정의 (모두 내장)
// =======================

const QUESTIONS = [
  {
    id: 1,
    qnum: 1,
    kind: "route",
    title: "원정대 파견",
    scene:
      "식량이 바닥나 동측 매점 원정이 필요하다. 특전사 출신 재원을 다시 보낼지, 제도로 순번을 정할지가 쟁점이다.",
    options: {
      A: "[성열] 능력자 재원을 다시 파견한다 (성과 보상/합리성 강조)",
      B: "[재면] 제비뽑기·순번제로 파견한다 (제도화된 공정/억울함 최소화)",
    },
    mapping_hint: {
      A: "능력·성과 중심, 위험 감수자 보상, 효율 우선",
      B: "제도·절차 중심, 평등한 부담 분배, 공동체 공정",
    },
  },
  {
    id: 2,
    qnum: 2,
    kind: "binary",
    title: "분배의 자격",
    scene:
      "원정 결과와 무관하게 식량 분배 방식이 쟁점이다. 기여도 차등 vs N분의1 균등.",
    options: {
      A: "[성열] 기여도/위험 감수자 우선 차등 배급",
      B: "[재면] 전원 N분의1 완전 균등 배급",
    },
    mapping_hint: {
      A: "성과·기여·책임을 중시(능력주의)",
      B: "평등·약자 보호·연대(분배 정의)",
    },
  },
  {
    id: 3,
    qnum: 3,
    kind: "binary",
    title: "외부인과 규칙",
    scene:
      "문밖의 생존자를 받을지 결정한다. 감염 리스크 vs 연대/노동력/규칙 기반 수용.",
    options: {
      A: "[성열] 진입 거부 (안전 최우선, 고립 강화)",
      B: "[재면] 격리 규칙 후 수용 (연대/자원 확장, 내부 감염 위험)",
    },
    mapping_hint: {
      A: "안전·통제·리스크 회피",
      B: "포용·연대·제도적 관리",
    },
  },
  {
    id: 4,
    qnum: 4,
    kind: "binary",
    title: "탈출 vs 존버",
    scene:
      "전기가 끊기고 자원이 줄어든다. 현위치 사수 vs 단체 탈출.",
    options: {
      A: "[성열] 현위치 사수 (리스크 최소, 개인 생존 집중)",
      B: "[재면] 단체 탈출 시도 (집단 운명 공동체, 조직적 이동)",
    },
    mapping_hint: {
      A: "안정/현상 유지/리스크 최소화",
      B: "집단 행동/연대/변화 감수",
    },
  },
  {
    id: 5,
    qnum: 5,
    kind: "leader",
    title: "지도자 선택",
    scene:
      "갈등 이후 새로운 공동체를 이끌 대표를 고른다. 이 선택은 가치 정렬을 직접적으로 드러낸다.",
    options: {
      A: "[성열] 질서·성과·통제 중심 리더",
      B: "[재면] 규칙·평등·연대 중심 리더",
    },
    mapping_hint: {
      A: "보수적 리더십(질서/통제/성과)",
      B: "진보적 리더십(평등/연대/제도)",
    },
  },
];

// =======================
// 유틸
// =======================

function normalizeDecision(d) {
  if (d === "A" || d === "B") return d;
  if (d === "Y") return "A";
  if (d === "N") return "B";
  return null;
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

// =======================
// 메인 프롬프트 빌더
// =======================

export function buildPrompt(votes) {
  const questionsById = new Map(QUESTIONS.map((q) => [q.id, q]));
  const blocks = [];
  const missing = [];
  const invalid = [];

  for (const v of votes) {
    const q = questionsById.get(v.question_id);
    if (!q) {
      missing.push(v.question_id);
      continue;
    }

    const decision = normalizeDecision(v.decision);
    if (!decision) {
      invalid.push(v.question_id);
      continue;
    }

    blocks.push(`
[Q${q.qnum}. ${q.title}]
- 문항 종류: ${q.kind}
- 상황: ${q.scene}
- 선택지 A: ${q.options.A}
- 선택지 B: ${q.options.B}
- 선택 의미:
  - A: ${q.mapping_hint.A}
  - B: ${q.mapping_hint.B}
- 사용자 선택: ${decision}
`.trim());
  }

  if (missing.length > 0) {
    throw new Error(`존재하지 않는 question_id: ${uniq(missing).join(", ")}`);
  }
  if (invalid.length > 0) {
    throw new Error(`잘못된 decision 값: ${uniq(invalid).join(", ")} (A/B만 허용)`);
  }

  return `
너는 "아포칼립스 의사결정 기반 가치/정치 성향 분석" 전문가다.
아래 세계관과 문항 정의를 기반으로 사용자의 성향을 게임 스탯으로 추정하라.

[세계관]
- 제목: ${SCENARIO.title}
- 전제: ${SCENARIO.premise}

[대립 구도]
- A 진영: ${SCENARIO.factions.A.name} (${SCENARIO.factions.A.ideology}) / ${SCENARIO.factions.A.tag}
- B 진영: ${SCENARIO.factions.B.name} (${SCENARIO.factions.B.ideology}) / ${SCENARIO.factions.B.tag}

[의사결정 규칙]
- decision은 A 또는 B이다.
- A는 성열(보수 성향), B는 재면(진보 성향)을 의미한다.
- 사용자를 특정 이념으로 단정하지 말고, 선택 경향으로만 해석하라.

[사용자 선택 로그]
${blocks.join("\n\n")}

[출력 규칙]
- 출력은 반드시 JSON 하나만.
- JSON 외의 텍스트(설명, 마크다운, 코드블록)를 절대 출력하지 마라.
- JSON의 모든 문자열은 한국어로만 작성하라.
- 단정 금지: 불확실성을 명시(예: "추정", "가능성", "상황에 따라").
- 낙인/비하 표현 금지.
- 스탯은 0~100 정수, 높을수록 강함.
- 신뢰도는 0~100 정수.
- 문항 수가 적거나 선택이 상충하면 신뢰도를 낮추고, 요약에 그 이유를 포함하라.
- 지도자 선택(kind=leader)은 가치 정렬이 비교적 직접적이므로 다른 문항보다 약간 더 반영하되, 그것만으로 전체를 단정하지 마라.

[스탯 정의]
- 질서: 규칙·통제·안전 최우선
- 자유: 개인 자율·간섭 최소
- 성과: 능력·기여·위험 감수 보상
- 평등: 균등 분배·약자 보호
- 공동체: 연대·집단 생존
- 개인: 개인 책임·각자 생존

[추가 질문 추천 규칙]
- 사용자가 자신의 성향을 더 확실히 하기 위해 고려해볼 질문을 4~6개 추천하라.
- 질문은 이 시나리오(아포칼립스 공동체) 맥락을 유지하라.
- 기존 문항(원정/분배/외부인/탈출/지도자)과 완전히 같은 내용은 피하라.
- 각 질문은 A/B 양자택일로 답할 수 있게 명확한 선택지를 포함하라.
- 질문은 도덕적 비난/조롱/낙인을 유도하면 안 된다.
- 각 질문마다 "구분하려는_스탯"을 1~3개 지정하고, 왜 도움이 되는지 "의도"를 1문장으로 적어라.

[응답 JSON 형식]
{
  "최종_라벨": "예: 질서·성과 중심 생존가 / 연대·평등 중심 생존가 / 혼합형",
  "신뢰도": 0,
  "스탯": {
    "질서": 0,
    "자유": 0,
    "성과": 0,
    "평등": 0,
    "공동체": 0,
    "개인": 0
  },
  "근거": [
    {
      "문항": "Q1",
      "선택": "A 또는 B",
      "설명": "해당 선택이 어떤 가치(스탯)에 왜 연결되는지 1~2문장(불확실성 포함)"
    }
  ],
  "요약": "사용자에게 보여줄 2~4문장 요약(불확실성 포함)",
  "추천_추가질문": [
    {
      "질문": "추가로 답해보면 좋은 질문(아포칼립스 맥락)",
      "선택지": {
        "A": "선택지 A",
        "B": "선택지 B"
      },
      "구분하려는_스탯": ["질서", "자유"],
      "의도": "왜 이 질문이 성향을 더 명확히 하는지 1문장"
    }
  ]
}
`.trim();
}