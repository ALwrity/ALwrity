---
description: ALwrity Test Your Indexing - Verify ALwrity understands your website by asking questions and reading the semantic search results.
---

# Test Your Indexing

Once ALwrity has finished indexing your website, you'll see a **"Test your indexing"** section with sample questions like *"What is the main product?"* or *"List the pricing plans."* This page explains what that feature is doing, how to read its results, and how to tell if it's working correctly.

## What "Test your indexing" actually does

When you click a sample question, ALwrity runs a **semantic search** across your indexed pages and returns the most relevant passages. Two things matter here:

1. **It retrieves, it doesn't generate.** The answers are real snippets copied word-for-word from your own pages. There is no "made-up" content — every answer traces back to a URL you actually indexed.
2. **It matches meaning, not exact words.** A question like *"How does the platform work?"* can find a page that describes your product's workflow even if it never uses the phrase "how it works."

## How to read a result

Each answer is displayed in three parts:

```
#1 · score 0.82
https://www.yoursite.com/pricing
Start with a free plan that includes 10 projects…
```

- **`#1`** — the ranking. Results are ordered from most to least relevant.
- **`score 0.82`** — a relevance (similarity) score from 0 to 1. Higher = closer match.
- **The URL** — the exact page on your site the snippet came from.
- **The snippet** — the matching passage from that page.

## How to tell if it's working correctly

Run a few questions and check these three things:

| Check | What good looks like |
|---|---|
| **Right page** | The top URL is a *relevant* page — "pricing" should return your pricing page, not the homepage. |
| **Confident score** | The top hit scores roughly **0.7 or higher**; weaker matches score lower. |
| **Different answers** | Different questions return *different* top pages. If every question returns the homepage, the index is too shallow. |

## Understanding the relevance score

| Score | Meaning |
|---|---|
| **0.7 – 1.0** | Strong match — the page is clearly about what you asked. |
| **0.5 – 0.7** | Moderate match — related content, but not a perfect answer. |
| **Below 0.5** | Weak match — the closest thing in the index, not necessarily on-topic. |

A low score doesn't mean the feature is broken — it usually means the specific topic simply isn't well covered by the pages that were indexed.

## Why are some answers weaker than others?

The precision of your answers depends mostly on **how much of your site was indexed**. ALwrity indexes a limited number of pages per run (based on your subscription tier), prioritising the most important ones. If a niche question returns a loose match, it's often because the page that would answer it perfectly wasn't included in the index yet.

To improve results:

- Make sure your site has a working `sitemap.xml` so ALwrity can discover all your pages.
- Keep your most important pages (pricing, features, use cases) accessible and clearly written.
- Re-run indexing after you publish significant new content.

## Common questions

**Are the answers AI-generated and could they be wrong?**

No. "Test your indexing" only retrieves existing text from your pages — it never invents content. You can always click through to the source URL to confirm the snippet really exists on your page.

**Why does clicking a question take a moment?**

ALwrity is computing the semantic match between your question and every indexed page.

**What if I see "No results found"?**

Your content hasn't been indexed yet, or the index is empty. Wait for indexing to complete, or retry it from the SIF panel.

**Can I ask my own question instead of the samples?**

The sample questions are a quick way to validate the index. The same underlying search powers ALwrity's other AI features, so a healthy index here means the rest of the platform understands your business too.

## Related pages

- **[SIF Semantic Indexing](semantic-indexing.md)** — how your content gets indexed.
- **[SIF & AI Agents Overview](overview.md)** — the agent team that uses the index.
