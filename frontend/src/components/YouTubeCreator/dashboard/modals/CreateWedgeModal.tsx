import React from "react";
import { YouTubeActionModal, YouTubeToolTile } from "../YouTubeActionModal";
import { WEDGE_MODAL_INTROS } from "../youtubeWorkflowConfig";
import type { CreateWedgeProps } from "./wedgeModalTypes";

export const CreateWedgeModal: React.FC<CreateWedgeProps> = ({
  open,
  onClose,
  goCreate,
  creatorState,
  onOpenSeo,
  onOpenThumb,
}) => (
  <YouTubeActionModal open={open} title="Create" intro={WEDGE_MODAL_INTROS.create} onClose={onClose}>
    <div className="yt-tool-tile-grid">
      <YouTubeToolTile
        icon="🎥"
        accent="#ec4899"
        title="New Video (Full)"
        description="Plan → scenes → assets → render — the core money path."
        hitl
        onClick={() => goCreate({ step: 0, durationType: "medium" })}
      />
      <YouTubeToolTile
        icon="⚡"
        accent="#ff0000"
        title="Shorts Fast Path"
        description="Speed-to-publish with shorts duration prefilled."
        hitl
        onClick={() => goCreate({ step: 0, durationType: "shorts" })}
      />
      <YouTubeToolTile
        icon="🏷️"
        accent="#6366f1"
        title="Title & Hook Lab"
        description="CTR before you burn render credits — review AI titles."
        hitl
        onClick={() => goCreate({ step: creatorState.videoPlan ? 1 : 0 })}
      />
      <YouTubeToolTile
        icon="🔎"
        accent="#0ea5e9"
        title="SEO Pack Editor"
        description="Keywords, description draft, and tags from your plan."
        hitl
        onClick={onOpenSeo}
      />
      <YouTubeToolTile
        icon="🖼️"
        accent="#f59e0b"
        title="Thumbnail Studio"
        description="Generate 3 options — you pick before publish."
        hitl
        onClick={onOpenThumb}
      />
      <YouTubeToolTile
        icon="✍️"
        accent="#10b981"
        title="Script / Scene Coach"
        description="Assistive edits on narration — you approve every line."
        hitl
        onClick={() => goCreate({ step: creatorState.scenes.length > 0 ? 1 : 0 })}
      />
    </div>
  </YouTubeActionModal>
);
