"""Invoke the real summary endpoint function against the real user DB."""
import asyncio
import json


async def main():
    from api.onboarding_utils.endpoints_summary import get_onboarding_summary

    user = {
        "id": "user_3HM34SZQoy9TpWjbwy0QLSBs3I7",
        "clerk_user_id": "user_3HM34SZQoy9TpWjbwy0QLSBs3I7",
    }
    try:
        result = await get_onboarding_summary(current_user=user)
        print(json.dumps(result, indent=2, default=str)[:3000])
    except Exception as e:
        print(f"ENDPOINT RAISED: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()


asyncio.run(main())
