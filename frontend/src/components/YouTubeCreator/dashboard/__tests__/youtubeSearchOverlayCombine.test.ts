/**
 * Combined Search filters: remember compatible columns, drop illegal pairs.
 *
 * Compatible: Videos/Movies + Duration + Upload Date + one FEATURES id.
 * Shorts + FEATURES + Upload Date (Shorts already means duration short).
 * Channels/Playlists + Upload Date only.
 *
 * Last click on a conflict wins. Upload Date is never a video-only switch.
 * One FEATURES id at a time. Tap the selected option again to clear that column.
 * Do not invent 4K.
 */

type OverlaySelection = {
  searchType?: "videos" | "shorts" | "channel" | "playlist" | "movie";
  duration?: "short" | "medium" | "long";
  uploadDate?: "today" | "week" | "month" | "year";
  feature?: "live" | "hd" | "subtitles" | "creative_commons" | "3d";
};

describe("resolveYouTubeSearchOverlayCombine", () => {
  async function loadCombine() {
    return import("../youtubeSearchOverlayCombine");
  }

  const empty: OverlaySelection = {};

  it("keeps Duration, FEATURES, and Upload Date when TYPE is videos", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    const afterDuration = resolveYouTubeSearchOverlayCombine(empty, {
      field: "duration",
      value: "medium",
    });
    const afterFeature = resolveYouTubeSearchOverlayCombine(afterDuration, {
      field: "feature",
      value: "hd",
    });
    const afterDate = resolveYouTubeSearchOverlayCombine(afterFeature, {
      field: "uploadDate",
      value: "today",
    });
    const afterType = resolveYouTubeSearchOverlayCombine(afterDate, {
      field: "type",
      value: "videos",
    });

    expect(afterType).toEqual({
      searchType: "videos",
      duration: "medium",
      feature: "hd",
      uploadDate: "today",
    });
  });

  it("keeps Duration and FEATURES when TYPE is movie", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    let next = resolveYouTubeSearchOverlayCombine(empty, {
      field: "duration",
      value: "long",
    });
    next = resolveYouTubeSearchOverlayCombine(next, {
      field: "feature",
      value: "subtitles",
    });
    next = resolveYouTubeSearchOverlayCombine(next, {
      field: "type",
      value: "movie",
    });

    expect(next).toEqual({
      searchType: "movie",
      duration: "long",
      feature: "subtitles",
    });
  });

  it("TYPE channel drops Duration and FEATURES and keeps Upload Date", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    let next: OverlaySelection = {
      duration: "medium",
      feature: "hd",
      uploadDate: "week",
    };
    next = resolveYouTubeSearchOverlayCombine(next, {
      field: "type",
      value: "channel",
    });

    expect(next).toEqual({
      searchType: "channel",
      uploadDate: "week",
    });
  });

  it("TYPE playlist drops FEATURES and keeps Upload Date", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    const next = resolveYouTubeSearchOverlayCombine(
      { feature: "subtitles", uploadDate: "month" },
      { field: "type", value: "playlist" },
    );

    expect(next).toEqual({
      searchType: "playlist",
      uploadDate: "month",
    });
  });

  it("TYPE shorts drops Duration and keeps FEATURES and Upload Date", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    const next = resolveYouTubeSearchOverlayCombine(
      { duration: "long", feature: "hd", uploadDate: "today" },
      { field: "type", value: "shorts" },
    );

    expect(next).toEqual({
      searchType: "shorts",
      feature: "hd",
      uploadDate: "today",
    });
  });

  it("Duration while TYPE is channel clears TYPE and keeps FEATURES", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    const next = resolveYouTubeSearchOverlayCombine(
      { searchType: "channel", feature: "live", uploadDate: "year" },
      { field: "duration", value: "short" },
    );

    expect(next).toEqual({
      duration: "short",
      feature: "live",
      uploadDate: "year",
    });
  });

  it("Duration while TYPE is shorts clears Shorts TYPE", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    const next = resolveYouTubeSearchOverlayCombine(
      { searchType: "shorts", feature: "3d", uploadDate: "today" },
      { field: "duration", value: "medium" },
    );

    expect(next).toEqual({
      duration: "medium",
      feature: "3d",
      uploadDate: "today",
    });
  });

  it("FEATURES while TYPE is playlist clears TYPE and keeps Duration", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    const next = resolveYouTubeSearchOverlayCombine(
      { searchType: "playlist", duration: "long", uploadDate: "week" },
      { field: "feature", value: "creative_commons" },
    );

    expect(next).toEqual({
      duration: "long",
      feature: "creative_commons",
      uploadDate: "week",
    });
  });

  it("FEATURES while TYPE is shorts keeps Shorts and FEATURES", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    const next = resolveYouTubeSearchOverlayCombine(
      { searchType: "shorts", uploadDate: "today" },
      { field: "feature", value: "hd" },
    );

    expect(next).toEqual({
      searchType: "shorts",
      feature: "hd",
      uploadDate: "today",
    });
  });

  it("replaces the previous FEATURES id (one FEATURES option at a time)", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    const next = resolveYouTubeSearchOverlayCombine(
      { searchType: "videos", feature: "hd", duration: "medium" },
      { field: "feature", value: "3d" },
    );

    expect(next).toEqual({
      searchType: "videos",
      feature: "3d",
      duration: "medium",
    });
  });
});

describe("resolveYouTubeSearchOverlayCombine tap-to-clear", () => {
  async function loadCombine() {
    return import("../youtubeSearchOverlayCombine");
  }

  it("tapping selected FEATURES clears FEATURES and keeps Upload Date", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    const next = resolveYouTubeSearchOverlayCombine(
      { feature: "hd", uploadDate: "today", duration: "medium" },
      { field: "feature", value: "hd" },
    );

    expect(next).toEqual({
      uploadDate: "today",
      duration: "medium",
    });
  });

  it("tapping selected Duration clears Duration and keeps FEATURES", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    const next = resolveYouTubeSearchOverlayCombine(
      { duration: "long", feature: "subtitles", searchType: "videos" },
      { field: "duration", value: "long" },
    );

    expect(next).toEqual({
      feature: "subtitles",
      searchType: "videos",
    });
  });

  it("tapping selected TYPE clears TYPE and keeps Duration and FEATURES", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    const next = resolveYouTubeSearchOverlayCombine(
      { searchType: "videos", duration: "short", feature: "live" },
      { field: "type", value: "videos" },
    );

    expect(next).toEqual({
      duration: "short",
      feature: "live",
    });
  });

  it("tapping selected Upload Date clears Upload Date and keeps FEATURES", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    const next = resolveYouTubeSearchOverlayCombine(
      { uploadDate: "week", feature: "3d" },
      { field: "uploadDate", value: "week" },
    );

    expect(next).toEqual({ feature: "3d" });
  });

  it("tapping a different FEATURES id still replaces the previous one", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    const next = resolveYouTubeSearchOverlayCombine(
      { feature: "hd", uploadDate: "today" },
      { field: "feature", value: "live" },
    );

    expect(next).toEqual({
      feature: "live",
      uploadDate: "today",
    });
  });

  it("tapping FEATURES again after clear reselects it", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    const cleared = resolveYouTubeSearchOverlayCombine(
      { feature: "hd", uploadDate: "month" },
      { field: "feature", value: "hd" },
    );
    const reselected = resolveYouTubeSearchOverlayCombine(cleared, {
      field: "feature",
      value: "hd",
    });

    expect(cleared).toEqual({ uploadDate: "month" });
    expect(reselected).toEqual({
      uploadDate: "month",
      feature: "hd",
    });
  });

  it("clearing the last overlay column yields an empty selection", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    const next = resolveYouTubeSearchOverlayCombine(
      { feature: "creative_commons" },
      { field: "feature", value: "creative_commons" },
    );

    expect(next).toEqual({});
  });

  it("tapping selected Channels TYPE keeps Upload Date", async () => {
    const { resolveYouTubeSearchOverlayCombine } = await loadCombine();
    const next = resolveYouTubeSearchOverlayCombine(
      { searchType: "channel", uploadDate: "year" },
      { field: "type", value: "channel" },
    );

    expect(next).toEqual({ uploadDate: "year" });
  });
});
