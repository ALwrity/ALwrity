
import asyncio
import time
import os
import sys
from typing import Dict, Any, List
from tabulate import tabulate
from loguru import logger

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.llm_providers.main_image_generation import generate_image_with_provider
from services.llm_providers.image_generation.wavespeed_provider import WaveSpeedImageProvider

async def benchmark_provider(provider_name: str, model: str, prompt: str) -> Dict[str, Any]:
    """Benchmark a single provider/model combination."""
    logger.info(f"Benchmarking {provider_name} ({model})...")
    
    start_time = time.time()
    try:
        # We use a mocked user_id for validation bypass if needed, 
        # or rely on the system to handle "benchmark_user"
        result = await generate_image_with_provider(
            prompt=prompt,
            provider=provider_name,
            model=model,
            width=1024,
            height=1024,
            user_id="benchmark_user"
        )
        
        duration = time.time() - start_time
        success = result.get("success", False)
        
        return {
            "provider": provider_name,
            "model": model,
            "duration": duration,
            "success": success,
            "error": result.get("error")
        }
    except Exception as e:
        return {
            "provider": provider_name,
            "model": model,
            "duration": time.time() - start_time,
            "success": False,
            "error": str(e)
        }

async def run_benchmarks():
    """Run benchmarks across configured providers."""
    
    # Check configured providers
    wavespeed_key = os.getenv("WAVESPEED_API_KEY")
    stability_key = os.getenv("STABILITY_API_KEY")
    hf_token = os.getenv("HF_TOKEN")
    
    logger.info("Checking configured providers...")
    logger.info(f"WaveSpeed: {'✅ Configured' if wavespeed_key else '❌ Missing API Key'}")
    logger.info(f"Stability: {'✅ Configured' if stability_key else '❌ Missing API Key'}")
    logger.info(f"HuggingFace: {'✅ Configured' if hf_token else '❌ Missing API Key'}")
    
    prompt = "A professional brand avatar of a creative designer, minimalist style, clean background, high resolution"
    
    tasks = []
    
    # WaveSpeed Models
    if wavespeed_key:
        tasks.append(benchmark_provider("wavespeed", "ideogram-v3-turbo", prompt))
        tasks.append(benchmark_provider("wavespeed", "qwen-image", prompt))
        tasks.append(benchmark_provider("wavespeed", "flux-kontext-pro", prompt))
    
    # Stability Models
    if stability_key:
        tasks.append(benchmark_provider("stability", "core", prompt))
    
    # HuggingFace Models
    if hf_token:
        tasks.append(benchmark_provider("huggingface", "black-forest-labs/FLUX.1-dev", prompt))
    
    if not tasks:
        logger.warning("No providers configured for benchmarking.")
        return
    
    logger.info(f"Starting benchmark for {len(tasks)} configurations...")
    results = await asyncio.gather(*tasks)
    
    # Display results
    table_data = []
    for r in results:
        status = "✅ Success" if r["success"] else f"❌ Failed: {r['error'][:30]}..."
        table_data.append([
            r["provider"],
            r["model"],
            f"{r['duration']:.2f}s",
            status
        ])
    
    print("\n" + "="*60)
    print("AVATAR GENERATION PERFORMANCE BENCHMARK")
    print("="*60)
    print(tabulate(table_data, headers=["Provider", "Model", "Time", "Status"], tablefmt="grid"))
    print("\nRecommendation:")
    
    # Simple recommendation logic
    successful = [r for r in results if r["success"]]
    if successful:
        fastest = min(successful, key=lambda x: x["duration"])
        print(f"Fastest provider: {fastest['provider']} ({fastest['model']}) at {fastest['duration']:.2f}s")
        
        # Check WaveSpeed specifically
        wavespeed_results = [r for r in successful if r["provider"] == "wavespeed"]
        if wavespeed_results:
            avg_wavespeed = sum(r["duration"] for r in wavespeed_results) / len(wavespeed_results)
            print(f"WaveSpeed Average: {avg_wavespeed:.2f}s")
    else:
        print("No successful generations to analyze.")

if __name__ == "__main__":
    asyncio.run(run_benchmarks())
