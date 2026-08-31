// 빌드는 자기 출력을 비운다 — 값을 치르고 얻은 계약.
//
// 2026-08-31 철거 첫 배포에서 은퇴한 진입점(`universe.html`·`chart.html`·옛
// assets 청크)이 **프로덕션에서 200 을 반환했다.** 원인은 코드가 아니라 상태였다:
// 번들러가 하던 `dist` 청소를 아무도 물려받지 않았고, 생성기는 쓰기만 하고
// 지우지 않는다. 링크를 지우는 것과 파일을 지우는 것은 다른 일이다.
//
// 이 결함은 **소스 변이로는 잡히지 않는다** — 깨끗한 트리에는 남을 낡은 파일이
// 없어서, `rmSync` 를 주석 처리해도 아무 일도 일어나지 않는다. 재현하려면
// 낡은 상태를 **심어야** 한다. 그래서 이것은 변이가 아니라 테스트다.
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("생성기는 출력을 비우고 시작한다", () => {
  it("지난 빌드가 남긴 은퇴한 진입점이 살아남지 않는다", () => {
    const out = mkdtempSync(join(tmpdir(), "one-book-build-"));
    try {
      // 지난 판의 잔해를 심는다 — 실제로 배포된 그 파일들
      mkdirSync(join(out, "assets"), { recursive: true });
      writeFileSync(join(out, "universe.html"), "<!doctype html><title>문학의 성계</title>");
      writeFileSync(join(out, "chart.html"), "<!doctype html><title>문학의 성좌도</title>");
      writeFileSync(join(out, "assets", "main-oOTPV1Du.js"), "// 은퇴한 번들");

      execSync(`npx tsx scripts/generate-static-pages.ts --out ${JSON.stringify(out)}`, {
        stdio: "pipe"
      });

      expect(existsSync(join(out, "universe.html")), "universe.html 이 살아남았다").toBe(false);
      expect(existsSync(join(out, "chart.html")), "chart.html 이 살아남았다").toBe(false);
      expect(existsSync(join(out, "assets", "main-oOTPV1Du.js")), "옛 번들이 살아남았다").toBe(
        false
      );
      // 그리고 실제로 새 책을 구웠다
      expect(existsSync(join(out, "index.html"))).toBe(true);
      expect(existsSync(join(out, "authors", "franz-kafka", "index.html"))).toBe(true);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 120_000);
});
