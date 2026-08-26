import React, { useEffect, useState } from "react";
import { YouTubeActionModal } from "../YouTubeActionModal";
import { youtubeStudioApi } from "../../../../services/youtubeStudioApi";
import {
  YOUTUBE_WEDGE_MODAL_MAX_WIDTH,
  type YouTubeModalShellProps,
} from "../youtubeWedgeModalUi";

export const PlaylistAttachModal: React.FC<{
  open: boolean;
  onClose: () => void;
  shell?: YouTubeModalShellProps;
}> = ({ open, onClose, shell }) => {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [playlistId, setPlaylistId] = useState("");
  const [videoId, setVideoId] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      youtubeStudioApi.listPlaylists(),
      youtubeStudioApi.listChannelVideos({ max_results: 20 }),
    ])
      .then(([p, v]) => {
        setPlaylists(p.playlists || []);
        setVideos(v.videos || []);
        if (p.playlists?.[0]) setPlaylistId(p.playlists[0].playlist_id);
        if (v.videos?.[0]) setVideoId(v.videos[0].video_id);
        if (!p.success) setStatus(p.message);
      })
      .catch((e) => setStatus(e?.message || "Load failed"));
  }, [open]);

  const add = async () => {
    if (!playlistId || !videoId) return;
    try {
      const res = await youtubeStudioApi.addVideoToPlaylist({
        playlist_id: playlistId,
        video_id: videoId,
      });
      setStatus(res.message || (res.success ? "Added" : "Failed"));
    } catch (e: any) {
      setStatus(e?.message || "Failed");
    }
  };

  return (
    <YouTubeActionModal
      open={open}
      title="Playlist / Series Attach"
      intro="Attach a published video to a playlist for retention packaging."
      onClose={onClose}
      maxWidth={shell?.maxWidth ?? YOUTUBE_WEDGE_MODAL_MAX_WIDTH}
      onBack={shell?.onBack}
      backLabel={shell?.backLabel}
      titleSize={shell?.titleSize}
      headerLayout={shell?.headerLayout}
    >
      {status && <p className="yt-modal-intro">{status}</p>}
      <label style={{ fontSize: 12, fontWeight: 700 }}>Playlist</label>
      <select
        value={playlistId}
        onChange={(e) => setPlaylistId(e.target.value)}
        style={{ width: "100%", marginBottom: 10, padding: 8 }}
      >
        {playlists.map((p) => (
          <option key={p.playlist_id} value={p.playlist_id}>
            {p.title}
          </option>
        ))}
      </select>
      <label style={{ fontSize: 12, fontWeight: 700 }}>Video</label>
      <select
        value={videoId}
        onChange={(e) => setVideoId(e.target.value)}
        style={{ width: "100%", marginBottom: 10, padding: 8 }}
      >
        {videos.map((v) => (
          <option key={v.video_id} value={v.video_id}>
            {v.title}
          </option>
        ))}
      </select>
      <button type="button" className="yt-rail-btn yt-rail-btn--primary" onClick={() => void add()}>
        Add to playlist
      </button>
    </YouTubeActionModal>
  );
};
