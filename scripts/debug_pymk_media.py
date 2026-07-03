import json
import re
from pathlib import Path

data = json.loads(Path(r"c:\alwrity-tool\ALwrity\pymk-response.json").read_text(encoding="utf-8"))["data"]

# sample profile urls
urls = re.findall(r'"profileCanonicalUrl":"(https://www\.linkedin\.com/in/[^"]+)"', data)
print("profiles", len(urls))
for url in urls[:3]:
    slug = url.split("/in/")[-1].rstrip("/")
    idx = data.find(slug)
    seg = data[max(0, idx - 1500): idx + 3500]
    children = re.findall(r'"children":\["([^"\\]{8,240})"\]', seg)
    photos = re.findall(
        r"https://media\.licdn\.com/dms/image/v2/[^\s\"\\]+profile-displayphoto-shrink_\d+_\d+/[^\s\"\\]+",
        seg,
    )
    print("---", slug)
    print("children samples:", [c for c in children if c not in ("Connect", "Pending")][:5])
    print("photos", len(photos), photos[0][:100] if photos else None)
