import asyncio
import sys
sys.path.insert(0, '.')
from services.research.trends.google_trends_service import GoogleTrendsService

async def test():
    svc = GoogleTrendsService()
    result = await svc.analyze_trends(keywords=['Python programming'], timeframe='today 12-m', geo='US')
    print('=== RESULTS ===')
    print(f'interest_over_time: {len(result["interest_over_time"])} points')
    print(f'interest_by_region: {len(result["interest_by_region"])} regions')
    rt = result["related_topics"]
    rq = result["related_queries"]
    print(f'related_topics top: {len(rt["top"])} items')
    print(f'related_topics rising: {len(rt["rising"])} items')
    print(f'related_queries top: {len(rq["top"])} items')
    print(f'related_queries rising: {len(rq["rising"])} items')
    print(f'error: {result.get("error", "none")}')
    print(f'cached: {result.get("cached", False)}')

asyncio.run(test())