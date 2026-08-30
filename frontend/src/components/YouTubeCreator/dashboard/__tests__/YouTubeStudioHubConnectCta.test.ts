/**
 * TDD: desktop hub-axis button must toggle Connect / Disconnect,
 * same as LinkedIn's hub CTA — not Create Video.
 */
import * as fs from "fs";
import * as path from "path";

function hubConnectButtonJsx(source: string): string {
  const start = source.indexOf("<YouTubeHubConnectButton");
  if (start < 0) {
    throw new Error("YouTubeStudioHub must render YouTubeHubConnectButton");
  }
  const end = source.indexOf("/>", start);
  if (end < 0) {
    throw new Error("YouTubeHubConnectButton JSX is not self-closing");
  }
  return source.slice(start, end + 2);
}

describe("YouTubeStudioHub desktop connect CTA wiring", () => {
  const hubSource = fs.readFileSync(
    path.join(__dirname, "../YouTubeStudioHub.tsx"),
    "utf8",
  );
  const hubCta = hubConnectButtonJsx(hubSource);

  it("wires onDisconnect into the hub-axis button (LinkedIn parity)", () => {
    expect(hubCta).toContain("onDisconnect={onDisconnect}");
  });

  it("does not use the hub-axis button as Create Video after connect", () => {
    expect(hubCta).not.toContain("onCreateVideo");
  });
});
