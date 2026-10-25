export const domains: Record<string, string> = {
  contract: "계약·법무",
  finance: "회계·재무",
  banking: "은행·결제",
  hr: "인사·채용",
  office: "공지·행정",
  logistics: "물류·배송",
  procurement: "구매·조달",
  production: "생산·품질",
  sales: "영업·마케팅",
  service: "고객 서비스",
  travel: "출장·교통",
  hotel: "호텔·관광",
  facility: "시설·부동산",
  it: "IT·소프트웨어",
  education: "교육·행사",
  health: "의료·복리후생",
  news: "기업·기사",
  general: "일반 독해",
};
export const errors = [
  "어휘 부족",
  "다의어 선택 오류",
  "문법 구조 오류",
  "수식 관계 오류",
  "시간 및 숫자 오류",
  "논리적 추론 오류",
  "단순 실수",
];
export interface Sentence {
  id: string;
  en: string;
  ko: string;
  chunks: [string, string][];
  structure: string;
  pitfall: string;
  vocab: string[];
  checks: string[];
}
export const sentences: Sentence[] = [
  {
    id: "s1",
    en: "The supplier, whose quotation was lower than expected, agreed to waive the delivery fee provided that payment was received by Friday.",
    ko: "견적이 예상보다 낮았던 공급업체는 금요일까지 대금을 받는다는 조건으로 배송비를 면제하는 데 동의했다.",
    chunks: [
      ["The supplier", "공급업체는"],
      [
        "whose quotation was lower than expected",
        "그 업체의 견적이 예상보다 낮았는데",
      ],
      ["agreed to waive the delivery fee", "배송비를 면제하는 데 동의했다"],
      [
        "provided that payment was received by Friday",
        "금요일까지 대금을 받는다는 조건으로",
      ],
    ],
    structure:
      "주어: The supplier / 동사: agreed / 보충어: to waive ... . whose는 supplier의 소유 관계를 나타내며 quotation을 수식합니다. provided that은 조건절을 이끕니다.",
    pitfall:
      "quotation은 인용문이 아닌 견적. waive는 연기가 아닌 면제. by Friday는 금요일까지.",
    vocab: ["quote", "waive", "provided that"],
    checks: [
      "견적이 예상보다 낮았다는 점을 이해했다",
      "배송비를 면제한다는 행위를 전달했다",
      "금요일까지 대금 수령이라는 조건을 포함했다",
    ],
  },
  {
    id: "s2",
    en: "Employees who incur travel expenses must retain their receipts until the finance department has reconciled the claims with the approved budget.",
    ko: "출장비를 지출한 직원은 재무 부서가 청구 내역을 승인된 예산과 대조하여 조정할 때까지 영수증을 보관해야 한다.",
    chunks: [
      ["Employees who incur travel expenses", "출장비를 지출한 직원은"],
      ["must retain their receipts", "영수증을 보관해야 한다"],
      [
        "until the finance department has reconciled the claims",
        "재무 부서가 청구 내역을 대조하여 조정할 때까지",
      ],
      ["with the approved budget", "승인된 예산과"],
    ],
    structure:
      "주어: Employees / 동사: must retain / 목적어: their receipts. who 관계절이 Employees를 수식합니다. until절은 보관 기간의 끝을 정합니다.",
    pitfall:
      "incur는 비용을 얻는 것이 아니라 부담하는 것. claims는 주장 아닌 비용 청구.",
    vocab: ["incur", "retain", "receipt", "reconcile", "claim"],
    checks: [
      "누가 무엇을 보관하는지 명확히 했다",
      "until이 정하는 보관 기간을 표현했다",
      "claims를 비용 청구로 이해했다",
    ],
  },
  {
    id: "s3",
    en: "Although the itinerary remains tentative, prospective attendees are advised to reserve accommodation before the discounted rates expire.",
    ko: "일정은 아직 잠정적이지만, 참석을 고려하는 사람들에게는 할인 요금이 만료되기 전에 숙소를 예약할 것을 권한다.",
    chunks: [
      ["Although the itinerary remains tentative", "일정은 아직 잠정적이지만"],
      ["prospective attendees are advised", "참석 예정자들은 권고받는다"],
      ["to reserve accommodation", "숙소를 예약하도록"],
      ["before the discounted rates expire", "할인 요금이 만료되기 전에"],
    ],
    structure:
      "양보절: Although ... / 주어: prospective attendees / 수동태 동사: are advised / 내용: to reserve accommodation. remains의 보어는 tentative.",
    pitfall:
      "prospective는 과거 참석자가 아니라 앞으로 참석할 가능성이 있는 사람. tentative는 확정되지 않은 상태.",
    vocab: ["itinerary", "tentative", "prospective", "accommodate"],
    checks: [
      "일정이 미확정이라는 점을 전달했다",
      "아직 참석하지 않은 잠재 참석자로 이해했다",
      "할인 만료 전에 예약하라는 권고를 포함했다",
    ],
  },
  {
    id: "s4",
    en: "Any outstanding balance will be carried forward to the next billing period unless the account is settled within ten days of receipt of this notice.",
    ko: "이 통지를 받은 날로부터 10일 이내에 대금을 정산하지 않으면 미결제 잔액은 다음 청구 기간으로 이월된다.",
    chunks: [
      ["Any outstanding balance", "모든 미결제 잔액은"],
      [
        "will be carried forward to the next billing period",
        "다음 청구 기간으로 이월된다",
      ],
      [
        "unless the account is settled within ten days",
        "10일 이내에 대금을 정산하지 않으면",
      ],
      ["of receipt of this notice", "이 통지를 수령한 날로부터"],
    ],
    structure:
      "주어: Any outstanding balance / 수동태: will be carried forward. unless는 부정 조건. within ten days of receipt가 정산 기한을 나타냅니다.",
    pitfall:
      "receipt는 여기서 영수증이 아닌 수령. outstanding은 뛰어난 아닌 미결제. unless의 부정을 놓치지 마세요.",
    vocab: ["outstanding", "carry forward", "settle", "receipt", "notice"],
    checks: [
      "미결제 잔액을 정확히 이해했다",
      "통지를 받은 날부터 10일로 해석했다",
      "기한 내 정산하지 않을 때만 이월됨을 이해했다",
    ],
  },
];
export interface Passage {
  id: string;
  type: string;
  title: string;
  documents: { title: string; text: string }[];
  questions: {
    prompt: string;
    options: string[];
    answer: number;
    evidence: string;
    senses: string[];
  }[];
}
export const passages: Passage[] = [
  {
    id: "p1",
    type: "이메일",
    title: "납품 일정 변경",
    documents: [
      {
        title: "From: Mia Chen · To: Purchasing team",
        text: "Our supplier has confirmed that the replacement monitors will be dispatched on Tuesday. Delivery normally takes two business days. Please retain the original packaging until the equipment has been inspected. If any unit is defective, notify the supplier within five days of receipt. A replacement will be provided at no additional charge.",
      },
    ],
    questions: [
      {
        prompt: "제품에 결함이 있으면 언제까지 알려야 합니까?",
        options: [
          "발송 후 2일 이내",
          "수령 후 5일 이내",
          "화요일 이전",
          "검사 후 한 달 이내",
        ],
        answer: 1,
        evidence: "within five days of receipt: receipt는 수령을 의미합니다.",
        senses: ["receipt-receiving", "notify-inform"],
      },
      {
        prompt: "포장재는 언제까지 보관해야 합니까?",
        options: [
          "제품 검사가 끝날 때까지",
          "배송비를 낼 때까지",
          "공급업체가 방문할 때까지",
          "새 주문을 할 때까지",
        ],
        answer: 0,
        evidence: "until the equipment has been inspected",
        senses: ["retain-keep"],
      },
    ],
  },
  {
    id: "p2",
    type: "내부 공지",
    title: "시설 보수 안내",
    documents: [
      {
        title: "Notice · East entrance maintenance",
        text: "The east entrance will be closed for scheduled maintenance from March 4 through March 8. All staff should use the west entrance during this period. Visitors must collect a temporary badge at the west reception desk. Access to the underground car park will not be affected. We apologize for the inconvenience.",
      },
    ],
    questions: [
      {
        prompt: "방문객은 어디에서 출입증을 받아야 합니까?",
        options: ["동쪽 입구", "지하 주차장", "서쪽 안내 데스크", "인사부"],
        answer: 2,
        evidence:
          "Visitors must collect a temporary badge at the west reception desk.",
        senses: ["maintenance-upkeep"],
      },
      {
        prompt: "보수 작업 중에도 영향을 받지 않는 것은?",
        options: [
          "동쪽 출입구",
          "방문객 등록 절차",
          "서쪽 데스크 운영 시간",
          "지하 주차장 접근",
        ],
        answer: 3,
        evidence: "Access to the underground car park will not be affected.",
        senses: ["maintenance-upkeep"],
      },
    ],
  },
  {
    id: "p3",
    type: "계약 안내",
    title: "사무실 임대 갱신",
    documents: [
      {
        title: "Lease renewal terms",
        text: "Your current lease expires on June 30. To retain the same monthly rate, please return the signed renewal agreement by May 15. The revised agreement stipulates that tenants must obtain written consent before making structural alterations. Utility costs remain the responsibility of the tenant. No additional security deposit is required for renewal.",
      },
    ],
    questions: [
      {
        prompt: "현재 월 임대료를 유지하려면 무엇을 해야 합니까?",
        options: [
          "6월 30일에 퇴거한다",
          "추가 보증금을 낸다",
          "5월 15일까지 서명한 갱신 계약서를 반환한다",
          "구조 변경 허가를 받는다",
        ],
        answer: 2,
        evidence: "To retain the same monthly rate ... by May 15.",
        senses: ["retain-keep", "stipulate-require"],
      },
    ],
  },
  {
    id: "p4",
    type: "고객 응대",
    title: "환불과 교환",
    documents: [
      {
        title: "Customer Support · Order 814",
        text: "Thank you for contacting us about the damaged lamp. You may return it for a full refund or request a replacement. We will reimburse you for return postage if you attach the shipping receipt. Please keep a copy for your records. Refunds are processed within seven business days after the item reaches our warehouse.",
      },
    ],
    questions: [
      {
        prompt: "반송 우편 요금을 돌려받으려면 무엇이 필요합니까?",
        options: [
          "창고 방문",
          "배송 영수증 첨부",
          "새 램프 주문",
          "7일 이내 전화",
        ],
        answer: 1,
        evidence:
          "reimburse you for return postage if you attach the shipping receipt",
        senses: ["reimburse-repay", "receipt-document"],
      },
    ],
  },
  {
    id: "p5",
    type: "청구서 메시지",
    title: "미결제 잔액 확인",
    documents: [
      {
        title: "Payment reminder · Invoice 206",
        text: "Our records indicate an outstanding balance of $480. This amount does not include the $120 deposit already received. Please remit payment by April 20. If you have already settled the account, send us the transaction reference so we can reconcile our records. No late fee will be imposed before April 25.",
      },
    ],
    questions: [
      {
        prompt: "현재 미결제 금액은 얼마입니까?",
        options: ["$120", "$360", "$480", "$600"],
        answer: 2,
        evidence:
          "outstanding balance of $480. 보증금은 이미 반영되어 있어 다시 빼지 않습니다.",
        senses: ["outstanding-unpaid", "remit-send"],
      },
      {
        prompt: "이미 대금을 지급했다면 무엇을 보내야 합니까?",
        options: ["거래 참조 번호", "새 보증금", "계약서 사본", "연체료"],
        answer: 0,
        evidence:
          "If you have already settled the account, send us the transaction reference",
        senses: ["settle-pay", "reconcile-compare"],
      },
    ],
  },
  {
    id: "p6",
    type: "업무 기사",
    title: "지역 유통망 확대",
    documents: [
      {
        title: "Business brief · Harbor Foods",
        text: "Harbor Foods announced the acquisition of a local distributor on Monday. The move is expected to expand its delivery network without increasing warehouse capacity. Online orders now account for sixty percent of the company’s revenue. The director said the firm would retain all employees at the acquired business and invest in training.",
      },
    ],
    questions: [
      {
        prompt: "인수된 회사의 직원에 대한 계획은?",
        options: [
          "전원 전근",
          "고용 유지와 교육 투자",
          "임시 계약 전환",
          "채용 중단 후 해고",
        ],
        answer: 1,
        evidence: "retain all employees ... invest in training",
        senses: ["retain-keep", "acquisition-purchase"],
      },
    ],
  },
  {
    id: "p7",
    type: "일정표 + 이메일",
    title: "워크숍 일정 조정",
    documents: [
      {
        title: "Thursday schedule",
        text: "09:00–10:00 Registration, Hall A\n10:00–11:30 Procurement workshop, Room 2\n11:30–12:30 Lunch, Café\n13:00–14:00 Budget review, Room 4",
      },
      {
        title: "Email · Updated venue",
        text: "The procurement workshop has attracted more prospective attendees than expected. It will therefore move to Hall A. Its start time remains unchanged. The budget review will begin thirty minutes later than originally scheduled, but will still finish at 14:00.",
      },
    ],
    questions: [
      {
        prompt: "변경된 예산 검토 회의 시간은?",
        options: ["13:00–14:00", "13:30–14:30", "13:30–14:00", "10:00–11:30"],
        answer: 2,
        evidence: "기존 시작 13:00 + 30분 = 13:30, 종료 14:00은 그대로입니다.",
        senses: ["prospective-potential"],
      },
      {
        prompt: "조달 워크숍은 어디에서 열립니까?",
        options: ["Room 2", "Hall A", "Room 4", "Café"],
        answer: 1,
        evidence:
          "이메일의 It will therefore move to Hall A가 기존 일정표를 수정합니다.",
        senses: ["procurement-purchasing"],
      },
    ],
  },
  {
    id: "p8",
    type: "이중 지문",
    title: "견적과 발주 확인",
    documents: [
      {
        title: "Quotation · Oak Office",
        text: "20 adjustable chairs: $2,400\nDelivery: $100\nInstallation: $150\nThis quotation is valid until May 10. Delivery is complimentary for orders exceeding $3,000.",
      },
      {
        title: "Email · Purchase approval",
        text: "We approve the purchase of twenty chairs at the quoted price. Our staff will assemble them, so installation is not required. Please deliver them by May 8 and send the final invoice to our finance team.",
      },
    ],
    questions: [
      {
        prompt: "최종 청구 금액은 얼마입니까?",
        options: ["$2,400", "$2,500", "$2,550", "$2,650"],
        answer: 1,
        evidence:
          "의자 $2,400 + 배송 $100. 설치는 제외, $3,000 초과가 아니므로 무료 배송도 아닙니다.",
        senses: ["quote-price", "complimentary-free", "assemble-puttogether"],
      },
    ],
  },
  {
    id: "p9",
    type: "삼중 지문",
    title: "행사 예약과 정산",
    documents: [
      {
        title: "Event policy",
        text: "A deposit of $200 is required to reserve the venue. Cancellations received at least seven days before the event receive a full deposit refund. Later cancellations forfeit the deposit. Rescheduling is subject to availability.",
      },
      {
        title: "Booking confirmation",
        text: "Your seminar is confirmed for October 18. We received your $200 deposit on September 30. Please remit the outstanding balance of $600 by October 11.",
      },
      {
        title: "Email · October 9",
        text: "We need to cancel our October 18 seminar because the speaker is unavailable. Please confirm whether our deposit can be refunded. We have not yet paid the remaining balance.",
      },
    ],
    questions: [
      {
        prompt: "이 고객의 보증금은 어떻게 처리됩니까?",
        options: [
          "전액 환불 가능",
          "절반만 환불 가능",
          "전액 몰수",
          "추가 대금 납부 후 환불",
        ],
        answer: 0,
        evidence:
          "10월 9일 취소는 10월 18일보다 9일 전으로 7일 전 취소 조건을 충족합니다.",
        senses: ["refund-money", "subject-to-conditional"],
      },
      {
        prompt: "취소 요청 시점까지 고객이 납부한 금액은?",
        options: ["$600", "$800", "$200", "$0"],
        answer: 2,
        evidence:
          "보증금 $200은 받았으며 remaining balance는 아직 납부하지 않았습니다.",
        senses: ["outstanding-unpaid", "remit-send"],
      },
    ],
  },
];
