"""One-off analyzer for pymk-response.json structure."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
raw = (ROOT / "pymk-response.json").read_text(encoding="utf-8")
obj = json.loads(raw)
data = obj.get("data", "")
print("top keys:", list(obj.keys()))
print("data length:", len(data))

patterns = [
    (r"linkedin\.com/in/[a-zA-Z0-9\-_%]+", "profile path"),
    (r"urn:li:fsd_profile:[A-Za-z0-9_-]+", "profile urn"),
    (r'"firstName"', "firstName"),
    (r'"lastName"', "lastName"),
    (r'"headline"', "headline"),
    (r"Connect", "Connect"),
    (r"mutual", "mutual"),
    (r"navigationUrl", "navigationUrl"),
    (r"profilePicture", "profilePicture"),
    (r"memberDistance", "memberDistance"),
    (r"PYMK", "PYMK"),
]
for pat, label in patterns:
    m = re.findall(pat, data)
    print(f"{label}: {len(m)}", m[:3] if m else "")

urls = sorted(set(re.findall(r"https://www\.linkedin\.com/in/[a-zA-Z0-9\-_%]+", data)))
print("unique profile urls:", len(urls))
for u in urls[:15]:
    print(" ", u)

# Find JSON-like chunks with names
chunks = re.findall(r'\{[^{}]{0,500}firstName[^{}]{0,500}\}', data)
print("name chunks:", len(chunks))
for c in chunks[:3]:
    print(c[:400])

# SDUI text patterns
texts = re.findall(r'"text":"([^"]{3,120})"', data)
interesting = [t for t in texts if not t.startswith("$") and "proto." not in t]
print("sample texts:", interesting[:30])

first_names = re.findall(r'"firstName":"([^"]+)"', data)
last_names = re.findall(r'"lastName":"([^"]+)"', data)
print("people:", list(zip(first_names, last_names)))

occupations = re.findall(r'"occupation":"([^"]+)"', data)
print("occupations:", occupations[:15])

for key in ["headline", "subtitle", "title", "subTitle", "primarySubtitle", "secondarySubtitle", "insightText", "reason", "cohort"]:
    vals = re.findall(rf'"{key}":"([^"]+)"', data)
    if vals:
        print(f"{key}:", vals[:8])

# profile blocks with regex
blocks = re.findall(
    r'profileCanonicalUrl":"(https://www\.linkedin\.com/in/[^"]+)"[^}]{0,1200}',
    data,
)
print("profile blocks:", len(blocks))

profiles = re.findall(
    r'(?:nonIterableProfileId|profileId)":"(ACo[^"]+)".*?'
    r'"firstName":"([^"]*)".*?'
    r'"lastName":"([^"]*)".*?'
    r'"profileCanonicalUrl":"(https://www\.linkedin\.com/in/[^"]+)"'
    r'(?:.*?"profilePictureRenderPayload":"([^"]*)")?',
    data,
)
print("structured profiles:", len(profiles))
for p in profiles[:5]:
    print(p)

# decode avatar payload sample
import base64

def decode_avatar_payload(payload: str) -> str | None:
    if not payload:
        return None
    try:
        raw = base64.b64decode(payload + "==")
        text = raw.decode("utf-8", errors="ignore")
        m = re.search(r"https://media\.licdn\.com/[^\x00]+", text)
        return m.group(0) if m else None
    except Exception:
        return None

if profiles:
    print("avatar:", decode_avatar_payload(profiles[0][4] if len(profiles[0]) > 4 else ""))

# reason / subtitle text near names
reasons = re.findall(r'"children":"([^"]{5,120})"', data)
print("children texts:", [r for r in reasons if "mutual" in r.lower() or "school" in r.lower() or "based" in r.lower()][:10])

profile_urls = re.findall(
    r'"url":"(https://www\.linkedin\.com/in/[^"]+)"', data
)
print("url field profiles:", profile_urls[:15])

# mutual connection text
mutual_texts = re.findall(r'mutual[^"]{0,80}', data, re.I)
print("mutual snippets:", mutual_texts[:10])

# image urls
imgs = re.findall(r'https://media\.licdn\.com/[^"\\]+', data)
print("image urls:", len(set(imgs)))
for img in list(set(imgs))[:5]:
    print(" ", img[:120])
