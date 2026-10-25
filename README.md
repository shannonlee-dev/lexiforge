# RC Lab — TOEIC RC Vocabulary Mastery

한국어 사용자를 위한 오프라인 우선 어휘·정밀해석 학습 앱입니다. React + TypeScript + Vite, IndexedDB로 구현했습니다. 계정이나 API 키 없이 작동합니다.

**현재 상태:** 실행 가능한 앱과 초기 학습 콘텐츠, 5천 개 이상의 공개 어휘 후보, 재개 가능한 데이터 파이프라인을 제공합니다. 4,000–6,000개 전체 표제어의 한국어 뜻·문맥 콘텐츠는 아직 완성되지 않았습니다. 검수 완료나 TOEIC 점수 향상을 보장하지 않습니다.

## 실행

Node.js 22.16 이상과 npm, 데이터 파이프라인에는 Python 3.10 이상이 필요합니다.

```bash
npm ci
npm run dev
```

표시된 주소(기본 `http://localhost:5173`)를 엽니다. 개발 모드는 서비스 워커를 설치하지 않습니다.

오프라인 기능을 사용할 실제 빌드:

```bash
npm run build
npm run preview -- --port 4173
```

`http://localhost:4173`에서 첫 로딩 후 **오프라인 준비 완료**를 확인하세요. 이후 네트워크를 끊어도 해당 주소의 앱과 학습 데이터가 동작합니다. 서버 종료 후에도 이미 서비스 워커가 설치된 브라우저에서는 캐시된 앱을 열 수 있습니다. 서비스 워커는 localhost 또는 HTTPS에서 동작합니다. `file://`로 index.html을 열지 마세요. 다른 기기에는 `dist/`를 HTTPS 정적 호스팅으로 제공해야 합니다.

현재 작업 환경에는 기본 Node가 없어서 `/tmp/node-v22.16.0-linux-x64`에 런타임을 준비했습니다. 이 환경에서는 아래 명령으로 실행할 수 있습니다. `/tmp`가 지워지면 일반 Node 설치가 필요합니다.

```bash
PATH=/tmp/node-v22.16.0-linux-x64/bin:$PATH npm run dev
```

## 사용 순서

1. **초기 어휘 진단**: 12개 표본. 난이도와 분야를 바꾸며 객관식과 핵심 뜻 인출을 함께 확인합니다. 실패 원인은 본인이 선택합니다. 느린 인출은 10초 초과의 앱 기준입니다.
2. **오늘의 학습**: 의미별 카드. 먼저 인출한 뒤 `Space`로 뒤집고 `1–5`로 자기 평가합니다.
3. **문맥별 의미**: 아직 검증하지 않은 의미와 복습 시점이 된 의미를 순환합니다. 새 예문이 있는 경우 미노출 문맥을 우선합니다. **연어 이해 확인**은 별도 정답률로 기록합니다.
4. **문장 정밀해석**: 한국어 자유 해석 후 구조·의미 단위 해설과 비교합니다. 문자열 일치로 번역을 채점하지 않습니다. 체크리스트 결과는 자기 확인으로 표시합니다.
5. **장문 독해**: 이메일·공지·계약·고객 응대·청구 메시지·기사·일정표+이메일·이중·삼중 지문. 정답이어도 낮은 확신도나 잘못 이해한 근거를 표시하면 오답 노트에 남습니다.
6. **설정 및 데이터**에서 정기 백업하세요.

### 백업과 데이터 소유권

- 학습 JSON: 학습 이벤트, 의미별 일정, 설정, 진단, 독해, 메모를 내보내고 복원합니다. 형식·참조·중복 검증 후 교체합니다. 복원 직전 상태는 IndexedDB `state/before-restore`에 1회 보관됩니다.
- CSV: 학습 이벤트 분석용입니다. CSV로 복원하지는 않습니다.
- 어휘 JSON: 전체 의미·후보와 현황을 내보내고 **어휘 데이터 복원**으로 불러올 수 있습니다. 학습 기록이 참조하는 의미를 제거하는 파일은 거부합니다. 어휘 복원 후 학습 JSON을 복원하면 다른 기기로 이동할 수 있습니다.
- 데이터는 origin(프로토콜·호스트·포트)별로 분리됩니다. `localhost:5173`과 `localhost:4173`의 기록은 다릅니다. 이동할 때 백업을 사용하세요.
- 여러 탭의 학습 업데이트는 IndexedDB read-modify-write 트랜잭션에서 최신 상태에 적용되어 덮어쓰기를 방지합니다. 다른 탭 화면은 새로고침하거나 다음 저장 시 최신 상태를 반영합니다.
- 브라우저 데이터 삭제, 비공개 모드 종료, 저장 공간 정리는 로컬 기록을 지울 수 있습니다. 영구 저장 요청은 브라우저 정책에 따라 거절될 수 있습니다.

## 학습 모델

`src/lib/model.ts`의 표제어/의미/예문/기록 스키마와 `src/lib/learning.ts`의 순수 함수가 중심입니다.

- 카드가 아닌 **sense ID**에 일정이 연결됩니다. 표제어 수는 동일 단어의 여러 의미를 중복 집계하지 않습니다. 구동사·관용 표현 항목은 별도 수치입니다.
- 자기 보고에는 `correct: null`, 객관식/인출에는 실제 결과를 저장합니다.
- SM-2 원리에 기반한 **변형 알고리즘**입니다. 실패 10분, 성공 1일 → 6일 → 이전 간격×난이도 계수. 낮은 확신도는 최대 1일, 자기 평가는 최대 7일. 지연 복습을 반영한 FSRS 최적화 모델은 아닙니다.
- 앱의 숙달 기준: 마지막 실패 이후, 서로 다른 예문 문맥 2개 이상, 객관식/인출 성공 3회 이상, 핵심 뜻 인출 포함, 서로 다른 3일 이상 관찰, 최초·최종 성공 간 3일 이상. 속도나 자기 평가만으로 숙달하지 않습니다.
- 한국어 핵심 뜻 인출은 허용 답 목록과 정규화 일치를 사용합니다. 표현이 다른 동의어는 오탐할 수 있어 ‘같은 뜻이었어요’를 제공하며, 이때는 검증된 정답이 아닌 자기 평가로 저장합니다.
- 현재 여러 예문이 있는 의미는 30개입니다. 나머지는 새 문맥 확장이 필요하며, 단일 예문 반복만으로는 숙달 조건을 충족하지 못합니다.
- 과거 “12개를 안다”는 자기 보고는 실제 숙달 기록으로 만들지 않았습니다. tentative/prospective/retain은 신규 학습 우선 대상입니다.

알고리즘 참고: [SuperMemo SM-2 원문](https://www.super-memory.org/archive/english/ol/sm2source.htm). 본 앱의 변형과 숙달 기준은 TOEIC 점수 예측으로 검증된 모델이 아닙니다.

## 데이터 생성·검증·재개

```bash
npm run data:validate
npm run data:build
npm run data:next
python3 -m unittest discover -s tests -p 'test_*.py'
```

`data:next`는 아직 의미가 없는 후보 25개를 TSL/BSL 우선으로 출력합니다. `data/next-batch.json`은 이번 작업 종료 시점의 다음 후보 스냅샷입니다.

1. `data/batches/011-*.tsv`부터 작은 배치를 추가합니다. 한 줄 9개 탭 구분 필드:
   `lemma, sense-key, pos, Korean meaning, domain, difficulty, expressions(; 구분), English example, Korean translation`.
2. 기존 표제어의 새 의미는 같은 lemma와 새로운 sense-key로 추가합니다. 기존 sense ID는 학습 기록에 연결되므로 임의 변경하지 않습니다.
3. 추가 문맥·허용 답·혼동어·전치사·파생어는 `data/enrichment.json`의 sense ID 아래에 작성합니다.
4. `npm run data:validate`로 중복 의미·품사·분야·필수 필드·예문·한국어 번역 형식을 검사합니다. 언어 정확성 검수는 별도 사람 작업입니다.
5. `npm run data:build`가 `public/` JSON과 `data/checkpoint.json`을 재생성합니다. 입력 파일 해시와 처리된 배치가 기록되므로 같은 명령을 안전하게 다시 실행할 수 있습니다.
6. 테스트 후 재빌드합니다. 브라우저에서 별도 어휘를 복원한 경우 그 복원본을 우선 사용하므로 새 어휘 JSON을 다시 복원해야 합니다.

표현끼리의 동의어 관계나 어휘군의 파생 관계는 검수자가 결정해야 합니다. 문자열 중복 제거만으로 어휘군 중복 문제가 전부 해결되지는 않습니다. 검수되지 않은 뜻·예문을 `reviewed`로 변경하지 마세요.

## 출처와 라이선스

- [NGSL 공식 페이지](https://www.newgeneralservicelist.com/new-general-service-list): Browne, Culligan, Phillips. 후보 2,809행.
- [TSL 공식 페이지](https://www.newgeneralservicelist.com/toeic-service-list): Browne, Culligan. 후보 1,250행.
- [BSL 공식 페이지](https://www.newgeneralservicelist.com/business-service-list): Browne, Culligan. 실제 내려받은 파일 1,744행. 공식 페이지의 1,700개 설명 및 파일 내 1.0 설명과 차이가 있어 파일 URL·SHA-256·실제 행수를 그대로 기록합니다.

세 목록 및 본 프로젝트의 가공 어휘·예문·독해 콘텐츠는 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). 원문 목록은 `data/raw`, 출처·해시는 `public/data-report.json`에 있습니다. 한국어 뜻·예문·지문은 자체 작성한 초안이며 시험 문제나 유료 단어장 내용을 복제하지 않았습니다. 출현 빈도·RC 커버리지·CEFR은 측정하거나 지정하지 않았습니다. 코드 라이선스는 `LICENSE`를 확인하세요.

## 테스트

```bash
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

E2E는 데스크톱 Chromium과 iPhone 13 크기의 Chromium 에뮬레이션을 사용합니다. 실제 iOS Safari/WebKit 검증과 다중 기기 동기화는 포함하지 않습니다. 테스트가 서버를 시작하고 종료합니다.

## 파일 구성

- `src/App.tsx`: 화면 구성·저장 액션·데이터 로딩
- `src/components/`: 카드/문맥/진단, 정밀해석/독해, 검색/메모
- `src/lib/`: 데이터 스키마, 학습 함수, IndexedDB, 자체 작성 독해 콘텐츠
- `scripts/data_pipeline.py`: 후보 파싱·중복 병합·배치 검증·컴파일·다음 배치
- `vite.config.ts`: 정적 빌드 및 버전별 오프라인 캐시 생성
- `tests/`: 단위·파이프라인·브라우저 테스트
- `docs/QUALITY.md`: 실제 데이터 현황·검증 결과·남은 작업
