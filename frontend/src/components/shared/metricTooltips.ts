/**
 * Plain-language explanations for every metric ALwrity displays.
 * Written for non-technical users - explains WHAT the number means
 * and WHY it matters, without jargon.
 */
export const METRIC_TOOLTIPS: { [key: string]: string } = {
  // ---------- Content Audit ----------
  total_links:
    "Total number of hyperlinks found across all the pages we crawled. Links are how visitors and search engines move around your site.",
  internal_link_percentage:
    "The share of links that point to other pages on your own website. Internal links help search engines discover your pages and spread authority between them.",
  pages_crawled:
    "How many pages of your website we actually visited and analyzed. This is the size of your site as search engines would see it.",
  crawl_waste:
    "The percentage of your crawl budget spent on pages that don't help with SEO, like duplicate content, redirects, or pages with no real value. Lower is better.",
  freshness_score:
    "How recently your content was published or updated. Fresh, regularly-updated sites tend to rank better because search engines see them as more current and relevant.",
  stale_content:
    "The share of your pages that haven't been updated in 6 months or more. Outdated content can make your site feel neglected and lose ranking over time.",
  link_health:
    "An overall look at the links on your site. Healthy sites have a good mix of internal links (connecting their own pages) and high-quality external links.",
  internal_links:
    "Links that point from one page on your website to another page on the same website. They help users navigate and help search engines map your site.",
  external_links:
    "Links that point from your website to other websites. They can add credibility when linking to authoritative sources.",
  nofollow_links:
    "Links marked with a 'nofollow' attribute, which tells search engines not to count them when deciding how important a page is. Common on ads, comments, and user-generated content.",
  avg_links_per_page:
    "The average number of links found on each page. A reasonable amount of relevant links per page keeps visitors engaged and helps search engines crawl deeper.",
  page_status:
    "The HTTP status codes your pages return. A '200' means the page loaded fine; '404' means it's missing; '5xx' means the server had an error. Lots of non-200 codes point to broken pages.",
  crawl_budget:
    "How efficiently search engines use the limited amount of crawling they do on your site. A well-optimized crawl budget makes sure the important pages get found.",
  optimization_score:
    "A 0-100 score of how well your site is set up for search engines to crawl it efficiently. Higher is better.",
  sitemap_total_urls:
    "The total number of URLs you've listed in your sitemap - the blueprint you give search engines of all the pages on your site.",
  top_themes:
    "The topics and keywords that appear most often in your content. They show what your site is really about, from a search engine's point of view.",
  avg_word_count:
    "The average number of words across your pages. In-depth content generally signals authority, but quality and relevance matter more than length.",
  primary_structure:
    "The main section or category that organizes your site's content, shown as the top folder in your URL structure.",

  // ---------- Sitemap Analysis ----------
  total_urls_found:
    "The total count of indexable pages found in your sitemap. A higher count suggests more content authority, provided the quality is high.",
  total_pages:
    "The total number of pages found in your sitemap. This is the size of your site as search engines would see it.",
  avg_path_depth:
    "How many clicks it takes, on average, to reach a page from your homepage. Pages that are close to the homepage are easier for users and search engines to find.",
  posts_per_day:
    "Your average publishing pace. Publishing consistently signals to search engines that your site is active and maintained.",
  content_categories:
    "The distinct sections or categories in your URL structure (like /blog/ or /products/). They show how your content is organized.",
  url_patterns:
    "The recurring structures in your URLs (like /blog/ or /product/). Consistent patterns help search engines understand your site's organization.",
  file_types:
    "The types of files in your sitemap (HTML pages, images, PDFs). Search engines primarily rank HTML pages, so too many non-HTML files can dilute your SEO.",
  structure_quality:
    "How well your site is organized. A flat, logical structure with pages close to the homepage makes crawling easy and helps visitors find content.",
  max_path_depth:
    "The most clicks needed to reach the deepest page on your site. Pages buried too deep are harder for search engines to find and rank.",
  publishing_velocity:
    "Your content cadence - how often you publish. High velocity with high quality signals authority; consistency matters more than occasional bursts.",
  content_gaps:
    "Important topics your competitors cover that you don't. Filling these gaps is one of the fastest ways to strengthen your topical authority.",
  growth_opportunities:
    "Actions with the best chance of increasing your search visibility based on what's missing or underdeveloped in your content.",
  strategic_recommendations:
    "AI-generated, prioritized steps you can take to improve how search engines discover and rank your content.",
  competitive_positioning:
    "How your website stacks up against competitors in the same space - where you're stronger, where you're weaker, and where the opportunity lies.",
  monthly_distribution:
    "How many pages you published or updated in each month. It reveals your publishing rhythm over time.",
  span_days:
    "The total number of days between your oldest and newest piece of content - a measure of how long your site has been active.",

  // ---------- Advertools Insights (Dashboard) ----------
  augmented_themes:
    "The most common words and phrases actually found in your content during the crawl. They reflect the real topics your site covers, not just what you think it covers.",
  site_health:
    "An overall health check of your site based on how much content you have and how fresh it is.",
  url_structure:
    "How your website's URLs are organized - their depth, length, and patterns. Clean, shallow URL structures are easier for both users and search engines to navigate.",
  publishing_velocity_wk:
    "How many pages you're publishing or updating per week on average. Regular publishing keeps your site looking active and current.",
  publishing_trend:
    "Whether your publishing is increasing, decreasing, or holding steady over time. A healthy trend is flat or rising.",
  stale_content_6mo:
    "Pages that haven't been updated in the last 6 months. A high percentage can drag down your site's overall freshness.",
  publishing_recency:
    "When your content was last published or updated, broken into recent time windows. It shows if you're actively maintaining the site.",
  urls_analyzed:
    "The number of URLs from your sitemap that we analyzed for URL structure patterns.",
  avg_depth:
    "The average number of folders in your URLs. Shallow, clean URLs are generally easier for users to understand and for search engines to crawl.",
  max_depth:
    "The deepest URL structure found on your site. Very deep URLs can be harder to crawl and less user-friendly.",
  urls_with_params:
    "The percentage of your URLs that contain query parameters (like ?id=123). Heavy parameter use can create duplicate content and waste crawl budget.",
  subdomains:
    "The number of different subdomains (like blog.example.com) found in your sitemap. Each subdomain is treated separately by search engines.",
  depth_distribution:
    "How your pages are spread across URL depths. Most of your content should live within 2-3 clicks of the homepage.",
  total_redirects:
    "The number of redirects found on your site. Redirects point old or moved pages to new ones - useful, but too many slow things down.",
  unique_chains:
    "The number of distinct redirect sequences. Each chain is one original URL that eventually lands somewhere else.",
  multi_hop_chains:
    "Redirects that take two or more hops before reaching the final page. Each extra hop adds load time and can lose SEO value, so fewer is better.",
  redirect_status:
    "The types of redirects in use (like 301 permanent or 302 temporary). 301 redirects pass on most SEO value; 302s do not.",
  total_images:
    "The number of images found across your crawled pages.",
  missing_alt:
    "Images without alternative text. Alt text describes an image for search engines and screen readers - missing alt text hurts accessibility and image SEO.",
  alt_coverage:
    "The percentage of your images that have alternative text. Aim for 100% - every image should have a short description.",
  robots_compliance:
    "How well your robots.txt file - the instructions you give search engine crawlers - is set up. A compliant file doesn't accidentally block important pages.",
  robots_directives:
    "The number of rules in your robots.txt file that tell crawlers what they may or may not access.",
  robots_sitemap:
    "Whether your robots.txt file points to your sitemap. Doing so helps search engines find your content faster.",
  robots_crawl_delay:
    "Whether your robots.txt sets a crawl-delay, which asks crawlers to wait between requests. Useful for limiting server load, though many search engines now ignore it.",
  page_status_distribution:
    "The breakdown of HTTP response codes across your pages. It shows how many of your pages load successfully versus how many are broken.",
  sitemaps_found:
    "The sitemap locations declared in your robots.txt file or detected on your site. These are the blueprints you provide search engines.",
  sitemap_discovery:
    "How we found your sitemap - directly from your robots.txt file, from a sitemap URL you provided, or by guessing common locations.",

  // ---------- Generic ----------
  average_path_depth:
    "The average number of clicks needed to reach a page from your homepage. Simpler, shallower structures are better for both users and search engines.",
  freshness:
    "A score reflecting how recently your content was published or updated. Sites that update regularly are seen as more relevant.",
  link_percentage:
    "The share of your links that point within your own site. A healthy share of internal links helps search engines understand and rank your site.",
};

export const getMetricTooltip = (key: string): string => METRIC_TOOLTIPS[key] || '';
