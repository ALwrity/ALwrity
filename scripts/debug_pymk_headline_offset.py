import json
import re
from pathlib import Path

data = json.loads(Path(r"c:\alwrity-tool\ALwrity\pymk-response.json").read_text(encoding="utf-8"))["data"]

slug = "itsankitjaiswal"
url_pat = f'"profileCanonicalUrl":"https://www.linkedin.com/in/{slug}"'
idx = data.find(url_pat)
print("url idx", idx)
# find headline
hl = "SEO Strategist | Visibility"
hidx = data.find(hl)
print("headline idx", hidx, "offset from url", hidx - idx if idx >= 0 and hidx >= 0 else None)

# all profile urls with positions
urls = [(m.start(), m.group(1)) for m in re.finditer(r'"profileCanonicalUrl":"(https://www\.linkedin\.com/in/[^"]+)"', data)]
print("unique urls", len(urls))

# map headlines in order from textProps
headlines = re.findall(
    r'"textProps":\{[^}]{0,600}?"children":\["([^"\\]{8,300})"\]',
    data,
)
# filter real headlines
def is_hl(t):
    if t in ("Connect", "Pending", "Message", "Follow", "Following", "Withdraw invitation"):
        return False
    if "mutual connection" in t.lower():
        return False
    if t.isdigit():
        return False
    # names only (2-3 words, no markers)
    if "|" in t or " at " in t or "@" in t:
        return True
    markers = ("Engineer", "Strategist", "Manager", "Director", "Founder", "Student", "Developer", "Writer", "Marketing", "SEO")
    return any(m in t for m in markers)

filtered_hl = [h for h in headlines if is_hl(h)]
print("filtered headlines", len(filtered_hl))
for i, h in enumerate(filtered_hl[:12]):
    print(i, h[:70])

# dedupe urls by profile id
seen = set()
unique_urls = []
for pos, url in urls:
  slug = url.split("/in/")[-1].rstrip("/")
  if slug in seen:
    continue
  seen.add(slug)
  unique_urls.append((pos, url, slug))
print("deduped", len(unique_urls))

# for each url, search forward 6000 chars for headline children
for pos, url, slug in unique_urls[:5]:
    seg = data[pos:pos+6000]
    local = [h for h in re.findall(r'"children":\["([^"\\]{8,300})"\]', seg) if is_hl(h)]
    print(slug, "forward hl", local[:2])
