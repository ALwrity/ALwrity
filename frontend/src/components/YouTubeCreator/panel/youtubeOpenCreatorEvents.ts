/**
 * Re-export Studio Hub open-creator events so Video Creator and Hub share one pending queue.
 */
export {
  YT_OPEN_CREATOR_EVENT,
  consumePendingOpenCreator,
  queueYouTubeCreatorOpen,
  type YouTubeOpenCreatorDetail,
} from "../dashboard/youtubeStudioEvents";
