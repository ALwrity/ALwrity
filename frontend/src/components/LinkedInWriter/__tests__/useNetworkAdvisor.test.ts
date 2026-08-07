import { renderHook, act, waitFor } from "@testing-library/react";
import { useNetworkAdvisor } from "../components/dashboard/useNetworkAdvisor";
import { linkedInGrowthApi } from "../../../services/linkedInGrowthApi";

jest.mock("../../../services/linkedInGrowthApi", () => ({
  linkedInGrowthApi: {
    getNetworkSuggestions: jest.fn(),
  },
}));

const mockGetNetworkSuggestions =
  linkedInGrowthApi.getNetworkSuggestions as jest.Mock;

describe("useNetworkAdvisor", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockGetNetworkSuggestions.mockReset();
    mockGetNetworkSuggestions.mockResolvedValue({
      suggestions: [],
      data_source_summary: "Insufficient research data",
      generated_at: "2026-01-01T00:00:00.000Z",
    });
  });

  it("auto-loads when modal opens, connected, and cache is empty", async () => {
    const { result } = renderHook(() =>
      useNetworkAdvisor(true, { autoLoad: true, connected: true }),
    );

    await waitFor(() => {
      expect(mockGetNetworkSuggestions).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(result.current.hasAttemptedFetch).toBe(true);
    });
    expect(result.current.dataSourceSummary).toBe("Insufficient research data");
  });

  it("does not auto-load when disconnected", async () => {
    renderHook(() =>
      useNetworkAdvisor(true, { autoLoad: true, connected: false }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockGetNetworkSuggestions).not.toHaveBeenCalled();
  });

  it("loadSuggestions merges result into session cache", async () => {
    mockGetNetworkSuggestions.mockResolvedValue({
      suggestions: [
        {
          name: "Jane Doe",
          title: "VP",
          company: "Acme",
          why_connect: "Shared industry",
          suggested_note: "Hi Jane",
          data_source_detail: "Exa #1",
          confidence: "high",
        },
      ],
      data_source_summary: "Grounded",
      generated_at: "2026-02-01T00:00:00.000Z",
    });

    const { result } = renderHook(() =>
      useNetworkAdvisor(false, { autoLoad: false, connected: true }),
    );

    await act(async () => {
      await result.current.loadSuggestions();
    });

    expect(result.current.suggestions).toHaveLength(1);
    const cached = sessionStorage.getItem("alwrity_growth_engine");
    expect(cached).toContain("Jane Doe");
  });
});
