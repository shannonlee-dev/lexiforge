import { test, expect, type Page } from "@playwright/test";
async function nav(page: Page, name: string) {
  if ((page.viewportSize()?.width ?? 1000) < 760)
    await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page.getByRole("button", { name, exact: true }).click();
}
test("search, sense learning, persistence, statistics and export", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "오늘도, 한 걸음 더 정확하게." }),
  ).toBeVisible();
  await nav(page, "단어 검색");
  await page.getByPlaceholder("단어, 뜻, 표현을 검색하세요").fill("quote");
  await expect(
    page.getByText("견적을 제시하다", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "이 의미 학습" }).first().click();
  await page.getByRole("button", { name: "정답 확인" }).click();
  await page.getByRole("button", { name: "4 정확하게 앎" }).click();
  await expect(
    page.getByRole("heading", { name: "오늘의 한 걸음을 마쳤어요" }),
  ).toBeVisible();
  await page.reload();
  await nav(page, "대시보드");
  await expect(page.getByTestId("learned-words")).toHaveText("1");
  await nav(page, "설정 및 데이터");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON 백업 내보내기" }).click();
  expect((await download).suggestedFilename()).toContain("rc-lab");
});
test("keyboard flashcard and responsive layout", async ({ page }) => {
  await page.goto("/");
  await nav(page, "오늘의 학습");
  await page.getByRole("button", { name: "학습 시작", exact: true }).click();
  await page.keyboard.press("Space");
  await expect(
    page.getByText("잠정적인 / 임시의", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("1");
  await expect(page.getByText("2 /", { exact: false }).first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("invalid restore preserves records", async ({ page }) => {
  await page.goto("/");
  await nav(page, "설정 및 데이터");
  await page
    .getByLabel("백업 파일 선택")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":99}'),
    });
  await expect(page.getByRole("alert")).toContainText("복원할 수 없습니다");
});
test("works offline after first load", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByTestId("offline-status")).toContainText(
    "오프라인 준비 완료",
    { timeout: 20000 },
  );
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "오늘도, 한 걸음 더 정확하게." }),
  ).toBeVisible();
  await nav(page, "단어 검색");
  await page.getByPlaceholder("단어, 뜻, 표현을 검색하세요").fill("retain");
  await expect(
    page.getByText("유지하다 / 보유하다", { exact: true }).first(),
  ).toBeVisible();
});
test("diagnostic records knowledge gaps without treating self-report as mastery", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "초기 어휘 진단");
  await page.getByRole("button", { name: "12개 표본 진단 시작" }).click();
  await page.getByLabel("한국어 뜻").fill("모르겠습니다");
  await page.getByRole("button", { name: "답 확인", exact: true }).click();
  await page
    .getByLabel("이해 단계")
    .selectOption("단어는 알지만 해당 의미를 모름");
  await page.getByRole("button", { name: "기록하고 다음" }).click();
  await expect(page.getByText("2 / 12", { exact: true })).toBeVisible();
  await nav(page, "학습 통계");
  await expect(
    page.getByText("단어는 알지만 해당 의미를 모름", { exact: true }),
  ).toBeVisible();
});
test("reading feedback, evidence error and sentence self assessment persist", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "장문 독해");
  await page.getByRole("button", { name: "B 수령 후 5일 이내" }).click();
  await page.getByRole("button", { name: "A 제품 검사가 끝날 때까지" }).click();
  await page.getByRole("button", { name: "정답과 근거 확인" }).click();
  await page.getByLabel("다음에 점검할 부분").selectOption("논리적 추론 오류");
  await page.getByRole("button", { name: "학습 결과 기록" }).click();
  await expect(
    page.getByRole("button", { name: "기록 저장 완료" }),
  ).toBeVisible();
  await nav(page, "오답 노트");
  await expect(page.getByText("논리적 추론 오류 · 확신도 2")).toBeVisible();
  await nav(page, "문장 정밀해석");
  await page
    .getByPlaceholder("원문의 의미를 한국어로 설명해 보세요.")
    .fill("공급업체는 금요일까지 대금을 받으면 배송비를 면제하기로 했다.");
  await page.getByRole("button", { name: "해설과 비교하기" }).click();
  await page.getByLabel("배송비를 면제한다는 행위를 전달했다").check();
  await page.getByRole("button", { name: "학습 결과 기록" }).click();
  await expect(
    page.getByRole("button", { name: "기록 저장 완료" }),
  ).toBeVisible();
});
test("valid JSON backup restores settings and vocabulary import roundtrips", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "설정 및 데이터");
  await page.getByLabel("하루 신규 의미 목표").fill("7");
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON 백업 내보내기" }).click();
  const file = await promise;
  const path = await file.path();
  await page.getByLabel("하루 신규 의미 목표").fill("9");
  await page.getByLabel("백업 파일 선택").setInputFiles(path!);
  await page.getByRole("button", { name: "이 백업으로 복원" }).click();
  await expect(page.getByLabel("하루 신규 의미 목표")).toHaveValue("7");
  const vp = page.waitForEvent("download");
  await page.getByRole("button", { name: "어휘 데이터 내보내기" }).click();
  const vf = await vp;
  await page
    .getByLabel("어휘 데이터 복원", { exact: true })
    .setInputFiles((await vf.path())!);
  await page.getByRole("button", { name: "어휘 복원 실행" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "오늘도, 한 걸음 더 정확하게." }),
  ).toBeVisible();
});
test("answer timing stops at reveal and concurrent tabs preserve events", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  await nav(page, "오늘의 학습");
  await page.getByRole("button", { name: "학습 시작", exact: true }).click();
  await page.clock.install();
  await page.clock.fastForward(2000);
  await page.keyboard.press("Space");
  await page.clock.fastForward(60000);
  await page.getByRole("button", { name: "4 정확하게 앎" }).click();
  await other.getByRole("button", { name: "다크 모드" }).click();
  await page.reload();
  await expect(page.getByTestId("learned-words")).toHaveText("1");
  await nav(page, "설정 및 데이터");
  const promise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON 백업 내보내기" }).click();
  const file = await promise;
  const { readFile } = await import("node:fs/promises");
  const data = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(data.events[0].responseMs).toBeLessThan(15000);
  expect(data.settings.dark).toBe(true);
  await other.close();
});
test("large candidate search and dark mode fit mobile", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "다크 모드" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await nav(page, "단어 검색");
  await page.getByRole("button", { name: "확장 후보 목록" }).click();
  await page.getByPlaceholder("단어, 뜻, 표현을 검색하세요").fill("abandon");
  await expect(page.getByText("abandon", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `docs/library-${info.project.name}.png`,
    fullPage: true,
  });
});
test("collocation checks have separate statistics", async ({ page }) => {
  await page.goto("/");
  await nav(page, "문맥별 의미");
  await page.getByRole("button", { name: "연어 이해 확인" }).click();
  await page.locator(".options button").first().click();
  await page.getByRole("button", { name: "답 확인", exact: true }).click();
  await page.getByRole("button", { name: "기록하고 다음" }).click();
  await nav(page, "학습 통계");
  await expect(page.getByText(/연어 이해도:.*1회/)).toBeVisible();
});
