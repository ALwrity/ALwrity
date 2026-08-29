
import asyncio
import logging
import sys
import os

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from unittest.mock import MagicMock, AsyncMock
from services.intelligence.agents.specialized_agents import ContentGuardianAgent, StrategyArchitectAgent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_content_guardian():
    print("\n=== Testing ContentGuardianAgent ===")
    
    # Mock Intelligence Service
    mock_intelligence = MagicMock()
    mock_intelligence.is_initialized.return_value = True
    
    # Mock search for cannibalization check
    # Scenario 1: No cannibalization
    mock_intelligence.search = AsyncMock(return_value=[]) 
    
    agent = ContentGuardianAgent(mock_intelligence, user_id="test_user")
    
    content = "This is a unique piece of content about AI agents." + " word" * 50 # Make it long enough
    
    print(f"Testing assess_content_quality with content length: {len(content)}")
    result = await agent.assess_content_quality(content)
    
    print("Result:", result)
    
    if result.get("quality_score", 0) > 0:
        print("✅ assess_content_quality returned a valid score.")
    else:
        print("❌ assess_content_quality failed to return a valid score.")
        
    # Scenario 2: Cannibalization detected
    mock_intelligence.search = AsyncMock(return_value=[{'id': 'existing_doc', 'score': 0.9}])
    
    print("\nTesting assess_content_quality with cannibalization...")
    result_cannibal = await agent.assess_content_quality(content)
    print("Result (Cannibalization):", result_cannibal)
    
    if result_cannibal.get("cannibalization_risk", {}).get("warning"):
        print("✅ Cannibalization correctly detected.")
    else:
        print("❌ Cannibalization NOT detected when it should be.")

async def test_strategy_architect():
    print("\n=== Testing StrategyArchitectAgent ===")
    
    mock_intelligence = MagicMock()
    mock_intelligence.is_initialized.return_value = True
    
    # Scenario 1: No clusters
    mock_intelligence.cluster = AsyncMock(return_value=[])
    
    agent = StrategyArchitectAgent(mock_intelligence, user_id="test_user")
    
    print("Testing discover_pillars (No clusters)...")
    pillars = await agent.discover_pillars()
    print(f"Pillars found: {len(pillars)}")
    
    if len(pillars) == 0:
        print("✅ Correctly handled no clusters.")
    else:
        print("❌ Should have returned 0 pillars.")
        
    # Scenario 2: Clusters found
    mock_intelligence.cluster = AsyncMock(return_value=[[0, 1, 2], [3, 4]])
    
    print("\nTesting discover_pillars (With clusters)...")
    pillars = await agent.discover_pillars()
    print(f"Pillars found: {len(pillars)}")
    
    if len(pillars) == 2:
        print("✅ Correctly identified pillars.")
        print("Pillar 1 size:", pillars[0]['size'])
    else:
        print("❌ Failed to identify pillars.")

if __name__ == "__main__":
    asyncio.run(test_content_guardian())
    asyncio.run(test_strategy_architect())
