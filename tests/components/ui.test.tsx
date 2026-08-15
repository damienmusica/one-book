import { describe, expect, it } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBox } from "../../src/components/SearchBox.tsx";
import { RelationDialog } from "../../src/components/RelationDialog.tsx";
import { DetailPanel } from "../../src/components/DetailPanel.tsx";
import { FilterPanel } from "../../src/components/FilterPanel.tsx";
import { WritersPage } from "../../src/components/WritersPage.tsx";
import { TimelineBar } from "../../src/components/TimelineBar.tsx";
import { renderWithServices } from "./helpers.tsx";

describe("SearchBox", () => {
  it("finds an author by Korean name and selects with keyboard", async () => {
    const user = userEvent.setup();
    const { store } = renderWithServices(() => <SearchBox />);
    const input = screen.getByRole("combobox");
    await user.type(input, "카프카");
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByText("프란츠 카프카")).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(store.getState().selectedAuthorId).toBe("franz-kafka");
    expect(store.getState().page).toBe("globe");
  });

  it("supports arrow-key navigation", async () => {
    const user = userEvent.setup();
    const { store } = renderWithServices(() => <SearchBox />);
    await user.type(screen.getByRole("combobox"), "보르헤스");
    await screen.findByRole("listbox");
    await user.keyboard("{Enter}");
    expect(store.getState().selectedAuthorId).toBe("jorge-luis-borges");
  });
});

describe("DetailPanel", () => {
  it("renders the full editorial profile for the selected author", () => {
    const { store } = renderWithServices(() => <DetailPanel />);
    act(() => store.selectAuthor("franz-kafka"));
    expect(screen.getByRole("heading", { name: "프란츠 카프카" })).toBeInTheDocument();
    expect(screen.getByText(/불가해한 죄의식/)).toBeInTheDocument();
    expect(screen.getByText(/장편으로 시작하면/)).toBeInTheDocument();
    // relation with evidence badge and neighbor link
    expect(screen.getByText(/보르헤스는 「카프카와 그의 선구자들」/)).toBeInTheDocument();
    expect(screen.getByText("문서로 확인됨")).toBeInTheDocument();
  });

  it("close button clears the selection", async () => {
    const user = userEvent.setup();
    const { store } = renderWithServices(() => <DetailPanel />);
    act(() => store.selectAuthor("franz-kafka"));
    await user.click(screen.getByRole("button", { name: "상세 패널 닫기" }));
    expect(store.getState().selectedAuthorId).toBeNull();
  });

  it("renders nothing without a selection", () => {
    const { container } = renderWithServices(() => <DetailPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("FilterPanel", () => {
  it("toggles a period filter in the store", async () => {
    const user = userEvent.setup();
    const { store } = renderWithServices(() => <FilterPanel />);
    act(() => store.set({ filtersOpen: true }));
    const roots = await screen.findByRole("checkbox", { name: /뿌리층/ });
    expect(store.getState().filters.periods).toContain("roots");
    await user.click(roots);
    expect(store.getState().filters.periods).not.toContain("roots");
  });

  it("reset restores defaults", async () => {
    const user = userEvent.setup();
    const { store } = renderWithServices(() => <FilterPanel />);
    act(() => {
      store.set({ filtersOpen: true });
      store.setFilters({ regions: ["east-asia"], speculativeOnly: true });
    });
    await user.click(await screen.findByRole("button", { name: "보기 초기화" }));
    expect(store.getState().filters.regions).toEqual([]);
    expect(store.getState().filters.speculativeOnly).toBe(false);
  });
});

describe("WritersPage", () => {
  it("lists visible authors and honors the local search", async () => {
    const user = userEvent.setup();
    renderWithServices(() => <WritersPage />);
    expect(screen.getByRole("button", { name: "프란츠 카프카" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "마거릿 애트우드" })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: /목록에서 작가 검색/ }), "카프카");
    expect(screen.queryByRole("button", { name: "마거릿 애트우드" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "프란츠 카프카" })).toBeInTheDocument();
  });

  it("row selection jumps to the globe page", async () => {
    const user = userEvent.setup();
    const { store } = renderWithServices(() => <WritersPage />);
    act(() => store.set({ page: "writers" }));
    await user.click(screen.getByRole("button", { name: "프란츠 카프카" }));
    expect(store.getState().page).toBe("globe");
    expect(store.getState().selectedAuthorId).toBe("franz-kafka");
  });

  it("global period filters apply to the list", () => {
    const { store } = renderWithServices(() => <WritersPage />);
    act(() => store.setFilters({ periods: ["mid-century"] }));
    expect(screen.queryByRole("button", { name: "프란츠 카프카" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "호르헤 루이스 보르헤스" })).toBeInTheDocument();
  });
});

describe("RelationDialog", () => {
  it("shows the relation's type, parties, evidence and summary when a line is picked", () => {
    const { store } = renderWithServices(() => <RelationDialog />);
    act(() =>
      store.set({ pickedRelationId: "influence--franz-kafka--jorge-luis-borges" })
    );
    expect(screen.getByRole("dialog", { name: "관계 설명" })).toBeInTheDocument();
    expect(screen.getByText("확인된 직접 영향")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "프란츠 카프카" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "호르헤 루이스 보르헤스" })).toBeInTheDocument();
    expect(screen.getByText(/카프카와 그의 선구자들/)).toBeInTheDocument();
    expect(screen.getByText(/1차 기록으로 확인되는 관계/)).toBeInTheDocument();
  });

  it("renders nothing without a picked relation", () => {
    const { container } = renderWithServices(() => <RelationDialog />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("TimelineBar", () => {
  it("slider updates the year and mode buttons switch yearMode", async () => {
    const user = userEvent.setup();
    const { store } = renderWithServices(() => <TimelineBar />);
    const slider = screen.getByRole("slider", { name: "연대 슬라이더" });
    fireEvent.change(slider, { target: { value: "1968" } });
    expect(store.getState().year).toBe(1968);
    await user.click(screen.getByRole("button", { name: "당시 활동" }));
    expect(store.getState().yearMode).toBe("active");
  });
});
