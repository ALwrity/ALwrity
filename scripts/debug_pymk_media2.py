import json
import re
from pathlib import Path

data = json.loads(Path(r"c:\alwrity-tool\ALwrity\pymk-response.json").read_text(encoding="utf-8"))["data"]

# Headlines via textProps
text_props = re.findall(
    r'"textProps":\{[^}]{0,400}?"children":\["([^"\\]{8,300})"\]',
    data,
)
print("textProps headlines:", len(text_props))
for h in text_props[:8]:
    print(" ", h[:80])

# children without textProps
children = re.findall(r'"children":\["([^"\\]{15,300})"\]', data)
headlines = [
    c
    for c in children
    if c not in ("Connect", "Pending", "Invitation sent", "Message")
    and "|" in c or " at " in c or "@" in c or len(c) > 25
]
print("children headlines:", len(headlines))
for h in headlines[:8]:
    print(" ", h[:80])

# profile blocks with firstName
blocks = list(re.finditer(r'"firstName":"([^"]+)","lastName":"([^"]+)"', data))
print("name blocks", len(blocks))
for m in blocks[:3]:
    seg = data[m.start() : m.start() + 4000]
    url = re.search(r'"profileCanonicalUrl":"([^"]+)"', seg)
    pic = re.search(r'"profilePictureRenderPayload":"([^"]+)"', seg)
    hl = re.findall(r'"children":\["([^"\\]{15,300})"\]', seg)
    hl = [x for x in hl if x not in ("Connect", "Pending")]
    print(m.group(1), m.group(2), url.group(1) if url else None, "pic", bool(pic), "hl", hl[:2])
