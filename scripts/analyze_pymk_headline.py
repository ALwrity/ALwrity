"""Extract headline patterns from pymk-response.json."""
import json
import re
from pathlib import Path

data = json.loads(Path(r"c:\alwrity-tool\ALwrity\pymk-response.json").read_text(encoding="utf-8"))["data"]

# Search patterns near profileCanonicalUrl
for pat in [
    r'"headline":"([^"]+)"',
    r'"occupation":"([^"]+)"',
    r'"subtitle":"([^"]+)"',
    r'"primarySubtitle":\{"text":"([^"]+)"',
    r'"text":"([^"]{20,120})"',
    r'professionalHeadline":"([^"]+)"',
    r'profileHeadline":"([^"]+)"',
]:
    m = re.findall(pat, data)
    filtered = [x for x in m if "proto." not in x and "$" not in x and "Withdraw" not in x][:8]
    if filtered:
        print(pat, "->", filtered[:5])

# snippet around nitish profile
idx = data.find("nitish-srivastava")
if idx > 0:
    chunk = data[max(0, idx - 2500): idx + 1200]
    print("--- chunk excerpt ---")
    # find SEO Strategist context
    for term in ["SEO Strategist", "Nitish", "headline", "subtitle"]:
        pos = chunk.find(term)
        if pos >= 0:
            print(term, ":", repr(chunk[max(0,pos-80):pos+120]))
