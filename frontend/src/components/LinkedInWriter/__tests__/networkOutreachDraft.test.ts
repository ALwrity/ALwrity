import {
  buildAiSuggestionOutreachInput,
  buildPymkOutreachInput,
} from "../components/dashboard/networkOutreachDraft";
import { resolvePymkConnectAction } from "../components/dashboard/pymkConnectAction";
import type { NetworkSuggestionItem } from "../../../services/linkedInGrowthApi";
import type { PymkSuggestionItem } from "../../../services/linkedInPymkApi";

describe("networkOutreachDraft builders", () => {
  it("buildAiSuggestionOutreachInput uses grounded suggestion fields", () => {
    const item: NetworkSuggestionItem = {
      name: "Jane Doe",
      title: "VP Marketing",
      company: "Acme",
      why_connect: "Shared industry focus",
      suggested_note: "Hi Jane, let's connect.",
      data_source_detail: "Exa #1",
      confidence: "high",
    };
    const input = buildAiSuggestionOutreachInput(item);
    expect(input.originalPost).toContain("Jane Doe");
    expect(input.fallbackNote).toBe("Hi Jane, let's connect.");
  });

  it("buildPymkOutreachInput uses verified LinkedIn identity only", () => {
    const person: PymkSuggestionItem = {
      profile_id: "abc",
      name: "John Smith",
      first_name: "John",
      last_name: "Smith",
      profile_url: "https://linkedin.com/in/john",
      headline: "Engineer at Corp",
      reason: "Based on your recent activity",
      mutual_connections_text: "3 mutual connections",
    };
    const input = buildPymkOutreachInput(person);
    expect(input.originalPost).toContain("John Smith");
    expect(input.comment).toContain("Engineer at Corp");
    expect(input.fallbackNote).toContain("John");
  });
});

describe("resolvePymkConnectAction", () => {
  const base: PymkSuggestionItem = {
    profile_id: "x",
    name: "Test User",
    first_name: "Test",
    last_name: "User",
    profile_url: "https://linkedin.com/in/test",
    reason: "cohort",
  };

  it("returns Connect on LinkedIn link for new profiles", () => {
    const action = resolvePymkConnectAction(base);
    expect(action.variant).toBe("connect");
    expect(action.disabled).toBe(false);
    expect(action.href).toBe(base.profile_url);
  });

  it("disables when invitation pending", () => {
    const action = resolvePymkConnectAction({
      ...base,
      connection_state: "invitation_pending",
    });
    expect(action.variant).toBe("pending");
    expect(action.disabled).toBe(true);
  });

  it("disables when already connected", () => {
    const action = resolvePymkConnectAction({
      ...base,
      connection_state: "connected",
    });
    expect(action.variant).toBe("connected");
    expect(action.disabled).toBe(true);
  });
});
