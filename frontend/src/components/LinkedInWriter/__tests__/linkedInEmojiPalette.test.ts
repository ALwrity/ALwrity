/**
 * Tests for shared LinkedIn emoji palette (Comment Assistant + Assistive Editor).
 */

import { LINKEDIN_EMOJI_PALETTE } from "../utils/linkedInEmojiPalette";
import { COMMENT_ASSISTANT_EMOJI_PALETTE } from "../components/dashboard/commentAssistantEmojis";

describe("linkedInEmojiPalette", () => {
  it("exports a non-empty compact emoji list", () => {
    expect(LINKEDIN_EMOJI_PALETTE.length).toBeGreaterThan(10);
    expect(LINKEDIN_EMOJI_PALETTE).toContain("😊");
    expect(LINKEDIN_EMOJI_PALETTE).toContain("👍");
  });

  it("keeps Comment Assistant palette as an alias of the shared list", () => {
    expect(COMMENT_ASSISTANT_EMOJI_PALETTE).toEqual(LINKEDIN_EMOJI_PALETTE);
  });
});
