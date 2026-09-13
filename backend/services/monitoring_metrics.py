from enum import Enum

class MetricKey(str, Enum):
    GSC_VISIBILITY_SCORE = "gsc.visibility_score"
    GSC_AVG_POSITION = "gsc.avg_position"
    GSC_IMPRESSIONS_DELTA = "gsc.impressions_delta"
    GSC_CTR = "gsc.ctr"
    GSC_OPPORTUNITIES_COUNT = "gsc.opportunities_count"
    GSC_TREND_DELTA = "gsc.trend_delta_vs_predicted"
    SERP_SHARE_OF_VOICE = "serp.share_of_voice"
    COMPETITOR_CONTENT_COUNT = "competitor.content_count"
    SITEMAP_TOTAL_URLS = "sitemap.total_urls"
    SITEMAP_PUBLISHING_VELOCITY = "sitemap.publishing_velocity"
    SITEMAP_INDEX_COVERAGE = "sitemap.index_coverage"
    PAGESPEED_PERFORMANCE_SCORE = "pagespeed.performance_score"
    TEXTSTAT_READABILITY = "textstat.readability"
    MONITORING_TASK_COMPLETION_RATE = "monitoring.task_completion_rate"
    INFRA_API_QUOTA = "infra.api_quota_remaining"
    INFRA_TOKEN_VALID = "infra.token_valid"
    HUMAN_GOAL_ACHIEVEMENT = "human.goal_achievement_rate"
    HUMAN_INTELLIGENCE_ACCURACY = "human.intelligence_accuracy"
    HUMAN_IMPLEMENTATION_SUCCESS = "human.implementation_success_rate"
    HUMAN_RISK_MANAGEMENT = "human.risk_management_score"

ALLOWED_METRICS = {m.value for m in MetricKey}

ALLOWED_FREQUENCIES = {"Daily", "Weekly", "Monthly", "Quarterly"}

ALLOWED_ASSIGNEES = {"ALwrity", "Human"}

ALLOWED_COMPONENTS = {
    "Strategic Insights",
    "Competitive Analysis",
    "Performance Predictions",
    "Implementation Roadmap",
    "Risk Assessment",
}

ALWRITY_METRICS = {
    MetricKey.GSC_VISIBILITY_SCORE.value,
    MetricKey.GSC_AVG_POSITION.value,
    MetricKey.GSC_IMPRESSIONS_DELTA.value,
    MetricKey.GSC_CTR.value,
    MetricKey.GSC_OPPORTUNITIES_COUNT.value,
    MetricKey.GSC_TREND_DELTA.value,
    MetricKey.SERP_SHARE_OF_VOICE.value,
    MetricKey.COMPETITOR_CONTENT_COUNT.value,
    MetricKey.SITEMAP_TOTAL_URLS.value,
    MetricKey.SITEMAP_PUBLISHING_VELOCITY.value,
    MetricKey.SITEMAP_INDEX_COVERAGE.value,
    MetricKey.PAGESPEED_PERFORMANCE_SCORE.value,
    MetricKey.TEXTSTAT_READABILITY.value,
    MetricKey.MONITORING_TASK_COMPLETION_RATE.value,
    MetricKey.INFRA_API_QUOTA.value,
    MetricKey.INFRA_TOKEN_VALID.value,
}

HUMAN_METRICS = {
    MetricKey.HUMAN_GOAL_ACHIEVEMENT.value,
    MetricKey.HUMAN_INTELLIGENCE_ACCURACY.value,
    MetricKey.HUMAN_IMPLEMENTATION_SUCCESS.value,
    MetricKey.HUMAN_RISK_MANAGEMENT.value,
}

TOOL_REGISTRY = {
    MetricKey.GSC_VISIBILITY_SCORE.value: "services.seo_tools.gsc_analyzer_service.GSCAnalyzerService.analyze_search_performance",
    MetricKey.GSC_AVG_POSITION.value: "services.seo_tools.gsc_analyzer_service.GSCAnalyzerService.analyze_search_performance",
    # analyze_search_performance returns performance_overview with
    # total_impressions + overall_ctr and trends with impressions_trend /
    # ctr_trend — the real source for both delta metrics below.
    MetricKey.GSC_IMPRESSIONS_DELTA.value: "services.seo_tools.gsc_analyzer_service.GSCAnalyzerService.analyze_search_performance",
    MetricKey.GSC_CTR.value: "services.seo_tools.gsc_analyzer_service.GSCAnalyzerService.analyze_search_performance",
    MetricKey.GSC_OPPORTUNITIES_COUNT.value: "services.seo_tools.gsc_analyzer_service.GSCAnalyzerService._identify_content_opportunities",
    MetricKey.GSC_TREND_DELTA.value: "services.seo_tools.gsc_analyzer_service.GSCAnalyzerService._analyze_trends",
    MetricKey.SERP_SHARE_OF_VOICE.value: "services.seo_tools.serp_gap_service.SerpGapService.analyze_topic_gaps",
    MetricKey.COMPETITOR_CONTENT_COUNT.value: "services.seo_tools.competitor_content_service.CompetitorContentService.deep_dive",
    MetricKey.SITEMAP_PUBLISHING_VELOCITY.value: "services.seo_tools.sitemap_service.SitemapService.analyze_sitemap",
    MetricKey.SITEMAP_TOTAL_URLS.value: "services.seo_tools.sitemap_service.SitemapService.analyze_sitemap",
    MetricKey.SITEMAP_INDEX_COVERAGE.value: "services.gsc_service.GSCService.get_sitemaps",
    MetricKey.PAGESPEED_PERFORMANCE_SCORE.value: "services.seo_tools.pagespeed_service.PageSpeedService.analyze_pagespeed",
    MetricKey.TEXTSTAT_READABILITY.value: "services.seo_tools.on_page_seo_service.OnPageSEOService.analyze_on_page_seo",
    MetricKey.MONITORING_TASK_COMPLETION_RATE.value: "services.monitoring_executor.MonitoringExecutor.execute_task_completion",
    MetricKey.INFRA_API_QUOTA.value: "services.oauth_token_monitoring_service.OAuthTokenMonitoringService.check_quota",
    MetricKey.INFRA_TOKEN_VALID.value: "services.gsc_service.GSCService.load_user_credentials",
}

LEGACY_METRIC_MAP = {
    "Market Position Score": MetricKey.GSC_VISIBILITY_SCORE.value,
    "Goal Achievement Rate": MetricKey.HUMAN_GOAL_ACHIEVEMENT.value,
    "Insight Effectiveness Score": MetricKey.GSC_OPPORTUNITIES_COUNT.value,
    "Competitor Activity Score": MetricKey.COMPETITOR_CONTENT_COUNT.value,
    "Competitive Position Rank": MetricKey.SERP_SHARE_OF_VOICE.value,
    "Intelligence Accuracy Score": MetricKey.HUMAN_INTELLIGENCE_ACCURACY.value,
    "Prediction Accuracy Rate": MetricKey.GSC_TREND_DELTA.value,
    "Model Performance Score": MetricKey.GSC_TREND_DELTA.value,
    "Insight Actionability Score": MetricKey.HUMAN_INTELLIGENCE_ACCURACY.value,
    "Implementation Progress Rate": MetricKey.SITEMAP_PUBLISHING_VELOCITY.value,
    "Resource Efficiency Score": MetricKey.INFRA_API_QUOTA.value,
    "Implementation Success Rate": MetricKey.HUMAN_IMPLEMENTATION_SUCCESS.value,
    "Risk Level Score": MetricKey.PAGESPEED_PERFORMANCE_SCORE.value,
    "Mitigation Effectiveness Rate": MetricKey.SITEMAP_INDEX_COVERAGE.value,
    "Risk Management Score": MetricKey.HUMAN_RISK_MANAGEMENT.value,
}
