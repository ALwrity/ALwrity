/**
 * LinkedIn personal-profile analytics limitations (Unipile / LinkedIn).
 *
 * LinkedIn does not expose clicks or clickthrough_rate for personal profile
 * posts — only for Company/Organization Page posts. Unipile returns only what
 * the authenticated session can see, so personal analytics keys typically are:
 * comments, followers_gained_from_this_post, impressions, members_reached,
 * profile_viewers_from_this_post, reactions, reposts.
 *
 * Keep these metrics hidden in personal Studio UI until company-page analytics
 * are supported. Flip to ``true`` when company-page clicks/CTR are wired.
 */
export const PERSONAL_POST_CLICKS_CTR_AVAILABLE = false;
