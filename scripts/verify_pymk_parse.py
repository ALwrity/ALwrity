import json
from pathlib import Path

from services.integrations.linkedin.pymk_parser import parse_pymk_response
from services.integrations.linkedin.pymk_types import PymkCohort

raw = json.loads(Path(r"c:\alwrity-tool\ALwrity\pymk-response.json").read_text(encoding="utf-8"))
parsed = parse_pymk_response(raw, cohort=PymkCohort.RECENT_ACTIVITY, page_start=0, page_size=10)
for s in parsed["suggestions"][:8]:
    hl = (s.get("headline") or "")[:60]
    photo = "yes" if s.get("photo_url") else "no"
    print(f"{s['name'][:25]:25} hl={'yes' if hl else 'no':3} photo={photo}")
