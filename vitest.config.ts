import { defineConfig } from "vitest/config";

// 번들러는 없다. 2026-08-31 철거로 SPA 진입점이 전부 사라졌고, 제품은 정적
// HTML 생성기 하나가 굽는다 — vite.config.ts 가 여기 남을 이유는 vitest 의
// 설정 파일이라는 것뿐이다.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
