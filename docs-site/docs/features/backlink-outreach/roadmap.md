---
description: Planned and potential enhancements for the backlink prospect feature.
---

# Roadmap & Future Enhancements

This document outlines planned and potential improvements to the backlink prospect feature, based on community feedback and product strategy.

## Planned Features (Next 2-3 Months)

### 1. Advanced Prospect Scoring

**Goal:** Provide more nuanced prospect prioritization using ML-based signals.

**Features:**
- **Domain Authority (DA) integration**: Automatically fetch Moz DA, Ahrefs DR, or similar metrics
- **Traffic estimation**: Show estimated monthly traffic to help prioritize high-traffic sites
- **Competitive proximity**: Flag if competitors have already been featured on this site
- **Content affinity**: Score likelihood based on your past successful placements
- **Engagement metrics**: Extract comment count, social shares to gauge audience quality

**API Enhancement:**
```json
{
  "url": "https://example.com/write-for-us",
  "confidence_score": 0.87,
  "quality_score": 0.79,
  "domain_authority": 45,  // NEW
  "estimated_monthly_traffic": 15000,  // NEW
  "competitor_featured": false,  // NEW
  "affinity_score": 0.92,  // NEW (based on your content)
  "engagement_score": 0.65  // NEW (comments, shares)
}
```

**Timeline:** 3-4 weeks

### 2. Prospect Tagging & Custom Fields

**Goal:** Enable flexible prospect organization beyond campaigns and status.

**Features:**
- **Custom tags**: Tag prospects with user-defined categories (e.g., "high-da", "e-commerce", "priority")
- **Custom fields**: Add extra metadata fields (e.g., traffic source, audience geography, niche fit)
- **Tag-based filtering**: Filter/sort prospects by tags
- **Tag suggestions**: AI suggests tags based on prospect content

**Example Usage:**
```json
{
  "lead_id": "lead_123",
  "tags": ["high-da", "tech-industry", "responded-positively"],
  "custom_fields": {
    "audience_geography": "USA-focused",
    "content_depth": "technical",
    "monetization_model": "ads + sponsorships"
  }
}
```

**UI:** Prospects → Tag management → Add bulk tags to selection

**Timeline:** 2-3 weeks

### 3. Prospect Enrichment Pipeline

**Goal:** Automatically gather additional intel on prospects to improve targeting.

**Features:**
- **Social profile detection**: Find Twitter, LinkedIn, etc. for the site's editor
- **Email domain validation**: Real-time email verification with warmth scoring
- **Content sample fetching**: Automatically grab recent blog posts to understand style
- **Contact frequency tracking**: Know how often you've contacted this prospect previously
- **Response time history**: Track average response times per domain

**Enrichment triggers:**
- Automatic: On discovery, trigger background enrichment job
- Manual: Click "Enrich" button on prospect card for immediate update
- Scheduled: Run nightly enrichment on all prospects older than 7 days

**Timeline:** 4-6 weeks

### 4. Prospect Deduplication & Merging

**Goal:** Handle cases where the same prospect appears multiple times across campaigns.

**Features:**
- **Fuzzy domain matching**: Detect `blog.example.com` vs. `example.com/blog` as same prospect
- **Email-based deduplication**: Flag prospects with same email across campaigns
- **Manual merge UI**: Combine duplicate prospects while preserving outreach history
- **Conflict resolution**: When merging, keep the prospect with highest confidence score
- **Cross-campaign view**: Show prospect status across all campaigns

**Scenario:**
- Campaign A has prospect at `https://example.com/write-for-us` (email: `editor@example.com`)
- Campaign B has prospect at `https://blog.example.com/contact` (email: `editor@example.com`)
- System flags as duplicate, offers to merge

**Timeline:** 3-4 weeks

## Under Consideration (Next 3-6 Months)

### 5. Prospect Outreach History & Relationship Timeline

**Goal:** Build institutional memory of past interactions with prospects.

**Features:**
- **Relationship timeline**: Visual timeline of all past interactions (emails sent, replies, calls, notes)
- **Outreach frequency capping**: Don't re-contact prospects too quickly
- **Relationship scoring**: Track prospect relationship strength over time
- **CRM integration**: Sync with HubSpot/Pipedrive for unified relationship view
- **Previous placement tracking**: Show if you've placed guest posts with this prospect before

**Timeline:** 6-8 weeks

### 6. Prospect Analytics & Cohort Analysis

**Goal:** Understand which types of prospects convert best.

**Features:**
- **Conversion rate by source**: See which discovery sources (Exa, DuckDuckGo, manual) convert best
- **Conversion rate by quality tier**: Understand ROI of low-confidence vs. high-confidence prospects
- **Cohort analysis**: Group prospects by characteristics and track outcomes
- **A/B testing**: Test different email templates/tones on similar prospect cohorts
- **Predictive scoring**: ML model predicts likelihood of success for new prospects
- **Churn prediction**: Identify prospects likely to unsubscribe or never reply

**Dashboard widget:**
```
Prospects by Source & Conversion Rate
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Source          | Count | Converted | Rate
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Exa (0.75+)     |  32   |    9      | 28%
DuckDuckGo      |  45   |    7      | 16%
Manual Import   |  12   |    6      | 50%
Exa (< 0.75)    |  28   |    2      | 7%
```

**Timeline:** 8-10 weeks

### 7. Prospect List Management & Distribution

**Goal:** Enable team collaboration on prospect management.

**Features:**
- **Prospect list sharing**: Share discovery results with team members
- **Assignment**: Assign prospects to team members for outreach
- **Assignment tracking**: Know who is responsible for each prospect
- **Workload balancing**: Automatically distribute prospects among team members
- **Batch operations on assigned prospects**: Bulk update status/tags for your assigned list

**Timeline:** 4-6 weeks

### 8. Automated Prospect Verification & Validation

**Goal:** Reduce invalid prospects and improve data quality.

**Features:**
- **Email validation**: Real-time SMTP check or third-party (ZeroBounce, Hunter)
- **Website validation**: Confirm website is still active and accepts guest posts
- **Language detection**: Identify non-English websites to filter if needed
- **Industry classification**: Auto-tag prospects by industry/vertical
- **Spam detection**: Flag potential spam sites or link farms
- **Manual verification workflow**: Queue suspicious prospects for human review

**Timeline:** 5-7 weeks

## Community Requests

### 9. Prospect Prioritization AI Assistant

**Goal:** Get smart recommendations on which prospects to contact first.

**Features:**
- **Daily recommendation**: "Based on your success patterns, here are your top 5 prospects to contact today"
- **Smart filtering**: "Show me prospects with > 70% confidence score that I haven't contacted in 3+ months"
- **Predictive ranking**: Rank prospects by estimated conversion likelihood
- **Adaptive**: Model learns from your past replies and placements

**Timeline:** 8-12 weeks

### 10. Integration with Email Scheduling Platforms

**Goal:** Better coordination with email/outreach tools.

**Features:**
- **Zapier integration**: Export prospects to Zapier workflows
- **Make.com integration**: Create automations for prospect management
- **Email provider sync**: Sync prospect status with Mailchimp, ConvertKit, etc.
- **Calendar sync**: Schedule outreach waves automatically
- **Webhook support**: Send prospect events (discovered, replied, placed) to external systems

**Timeline:** 4-6 weeks

### 11. Mobile App for Prospect Review

**Goal:** Review and manage prospects on-the-go.

**Features:**
- **Mobile dashboard**: View prospects, filter by status/score
- **Quick actions**: Swipe to mark as contacted, replied, or placed
- **Offline mode**: View cached prospects without internet
- **Photo capture**: Attach notes/images to prospects
- **Push notifications**: Get alerted when replies come in

**Timeline:** 10-14 weeks

## Technical Improvements

### 12. Prospect Caching & Offline Support

**Goal:** Improve app performance and reliability.

**Features:**
- **Prospect caching**: Cache recent prospects for instant load times
- **Offline reads**: View cached prospects without internet
- **Sync on reconnect**: Auto-sync changes when connection restored
- **Partial sync**: Intelligently sync only changed prospects

**Timeline:** 2-3 weeks

### 13. Performance Optimization

**Goal:** Handle large prospect lists (1000+) efficiently.

**Features:**
- **Virtual scrolling**: Only render visible prospects in list
- **Lazy loading**: Load prospect details on-demand
- **Query optimization**: Index prospects by status, source, confidence score
- **Pagination**: Replace infinite scroll with cursor-based pagination
- **Search indexing**: Full-text search across prospect URLs, emails, notes

**Timeline:** 3-4 weeks

## Infrastructure & Compliance

### 14. Data Privacy & Compliance Enhancements

**Goal:** Support additional compliance frameworks and data protection.

**Features:**
- **CCPA compliance**: Support California Consumer Privacy Act requirements
- **Data retention policies**: Automatically archive/delete old prospects per policy
- **Audit export**: Generate audit logs for compliance reporting
- **Anonymization**: Option to anonymize prospects after placement
- **Right to be forgotten**: Fully delete prospect data including archives

**Timeline:** 4-6 weeks

## How to Contribute

Have an idea for a prospect feature? Let us know:

1. **GitHub Discussions**: Post your feature request
2. **Feature Voting**: Vote on others' requests to show priority
3. **Beta Testing**: Join the beta program to test new features early
4. **Feedback**: Share how you use prospects to help us prioritize

---

*Last updated: July 2026 | Questions? See [Support](../../support.md)*
