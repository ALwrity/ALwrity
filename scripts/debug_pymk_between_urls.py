import json
import re
from pathlib import Path

data = json.loads(Path(r"c:\alwrity-tool\ALwrity\pymk-response.json").read_text(encoding="utf-8"))["data"]

SKIP = frozenset({"Connect", "Pending", "Message", "Follow", "Following", "Withdraw invitation"})

def is_headline(text: str, first_name: str = "") -> bool:
    if not text or text in SKIP:
        return False
    lower = text.lower()
    if "mutual connection" in lower or lower.startswith("based on"):
        return False
    if first_name and text.startswith(first_name) and "connect" in lower:
        return False
    if text.isdigit():
        return False
    markers = ("|", " at ", "@", "Engineer", "Strategist", "Manager", "Director", "Founder", "Student", "Developer", "Writer", "Marketing", "SEO", "CEO", "CTO", "Lead", "Consultant")
    return any(m.lower() in lower if m in ("|", " at ", "@") else m.lower() in lower for m in markers) or len(text) > 40

urls = list(re.finditer(r'"profileCanonicalUrl":"(https://www\.linkedin\.com/in/[^"]+)"', data))
seen = set()
positions = []
for m in urls:
    slug = m.group(1).split("/in/")[-1].rstrip("/")
    if slug in seen:
        continue
    seen.add(slug)
    positions.append(m)

for i, m in enumerate(positions[:8]):
    start = m.start()
    end = positions[i + 1].start() if i + 1 < len(positions) else min(len(data), start + 15000)
    seg = data[start:end]
    name_m = re.search(r'"firstName":"([^"]*)".*?"lastName":"([^"]*)"', seg, re.DOTALL)
    fn = name_m.group(1) if name_m else ""
    children = re.findall(r'"children":\["([^"\\]{6,300})"\]', seg)
    hl = [c for c in children if is_headline(c, fn)]
    textprops = re.findall(r'"textProps":\{[^}]{0,600}?"children":\["([^"\\]{6,300})"\]', seg)
    hl2 = [c for c in textprops if is_headline(c, fn)]
    slug = m.group(1).split("/in/")[-1]
    print(slug, "children", hl[:1], "textProps", hl2[:1])
