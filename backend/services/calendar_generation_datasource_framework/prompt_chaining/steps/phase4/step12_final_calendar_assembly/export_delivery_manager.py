import json
import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)


class ExportDeliveryManager:
    def __init__(self):
        logger.info("Export & Delivery Manager initialized")

    async def generate_pdf(self, calendar_data: dict) -> bytes:
        import io
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
        except ImportError:
            logger.warning("reportlab not installed — returning placeholder PDF bytes")
            return b"PDF generation requires reportlab library"

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []

        story.append(Paragraph("Content Calendar", styles["Title"]))
        story.append(Spacer(1, 12))

        summary = calendar_data.get("enhancement_summary", calendar_data.get("calendar_summary", {}))
        if summary:
            for key, val in summary.items():
                story.append(Paragraph(f"<b>{key}:</b> {val}", styles["Normal"]))
            story.append(Spacer(1, 12))

        schedule = calendar_data.get("content_schedule", calendar_data.get("daily_schedule", []))
        for day in schedule[:14]:
            date = day.get("date", "unknown")
            pieces = day.get("content_pieces", [])
            if pieces:
                story.append(Paragraph(f"<b>{date}</b>", styles["Heading2"]))
                for p in pieces:
                    story.append(
                        Paragraph(
                            f"{p.get('platform', 'any')} | {p.get('content_type', 'post')}: {p.get('title', 'untitled')}",
                            styles["Normal"],
                        )
                    )
                story.append(Spacer(1, 6))

        doc.build(story)
        pdf_bytes = buf.getvalue()
        buf.close()
        return pdf_bytes

    async def export_json(self, calendar_data: dict) -> dict:
        export = {
            "export_version": "1.0",
            "exported_at": datetime.utcnow().isoformat(),
            "calendar": calendar_data,
        }
        return export

    async def create_calendar_integration(self, calendar_data: dict) -> dict:
        schedule = calendar_data.get("content_schedule", calendar_data.get("daily_schedule", []))
        events = []
        for day in schedule:
            date_str = day.get("date")
            pieces = day.get("content_pieces", [])
            for piece in pieces:
                title = piece.get("title", "Untitled")
                platform = piece.get("platform", "web")
                content_type = piece.get("content_type", "post")
                events.append({
                    "summary": f"[{platform}] {title}",
                    "description": f"Content type: {content_type}",
                    "start": {"date": date_str} if date_str else None,
                    "end": {"date": date_str} if date_str else None,
                })

        integrations = {
            "ical": self._build_ical(events),
            "google_calendar": {
                "events": events,
                "import_instructions": "Use Google Calendar API or copy events manually",
            },
            "event_count": len(events),
        }
        return integrations

    def _build_ical(self, events: List[Dict]) -> str:
        lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//ALwrity//ContentCalendar//EN",
        ]
        for ev in events:
            lines.append("BEGIN:VEVENT")
            lines.append(f"SUMMARY:{ev.get('summary', 'Content')}")
            if ev.get("start", {}).get("date"):
                lines.append(f"DTSTART;VALUE=DATE:{ev['start']['date'].replace('-', '')}")
            if ev.get("end", {}).get("date"):
                lines.append(f"DTEND;VALUE=DATE:{ev['end']['date'].replace('-', '')}")
            lines.append("END:VEVENT")
        lines.append("END:VCALENDAR")
        return "\n".join(lines)
