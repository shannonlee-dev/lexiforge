# RC Vocabulary Lab Implementation Plan
> **For agentic workers:** Use superpowers:executing-plans to implement inline.
**Goal:** 오프라인 어휘·의미 학습과 기록/복원을 제공하는 실행 가능한 한국어 앱.
**Architecture:** React UI → 순수 학습 함수 → IndexedDB 원자적 상태; 정적 JSON 콘텐츠 및 PWA 캐시.
**Tech Stack:** React, TypeScript, Vite, idb, zod, Vitest, Playwright, Python 데이터 파이프라인.
**Spec:** docs/superpowers/specs/2026-10-25-rc-design.md and docs/REQUEST.md
## Global Constraints
자기 평가만으로 숙달하지 않음. 검수 상태를 과장하지 않음. 후보/실제 학습 가능 수 분리. API 키 불필요. 예측 점수 없음.
## Review Focus
복원 실패 시 기존 데이터 보존; 동일 단어 다른 의미 독립; 반복 같은 문맥으로 숙달 방지; 오프라인 재시작; 대량 검색/모바일 overflow.
## Tasks
- [x] 1. tests/core.test.ts 작성 후 실패 확인. src/lib/model.ts, learning.ts, storage.ts에서 일정·숙달·진단·백업 검증 구현. npm test.
- [x] 2. scripts/data_pipeline.py 및 data/batches/*.tsv: 출처 다운로드/해시, 정규화·중복 검사, 품사·필수 필드 검사, 체크포인트. tests/test_pipeline.py로 중복·대량 처리 검증.
- [x] 3. src/App.tsx 및 components: 대시보드, 진단, 카드, 문맥, 정밀해석, 독해, 오답, 통계, 검색, 설정. tests/app.spec.ts에서 사용자 흐름을 구현 전 기술하고 실행.
- [x] 4. 오프라인 캐시, 백업/복원, 다크/모바일/단축키 완성. 빌드와 E2E 실행.
- [x] 5. 전체 검증, 별도 검토, README 및 QUALITY/체크포인트 기록. 미완료 데이터 범위를 정확히 보고.

## Completion scope
첫 실행 버전 구현 및 검사 완료. 전체 어휘 콘텐츠 확장은 미완료이며 docs/QUALITY.md와 data/checkpoint.json에서 이어갑니다. 브라우저 최종 결과는 docs/VERIFICATION.md 참조.
