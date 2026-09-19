import os
import json
import re
import requests

USE_MOCK = True

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)

EXTRACTION_PROMPT = """You are an information extraction system for a disaster response tool.
Extract ONLY information explicitly stated in the report below. Do not guess or infer
anything not stated (e.g. do not guess nationality from a name).

Return ONLY valid JSON, no other text, no markdown fences, matching exactly this shape:
{{
  "name": string or null,
  "location": string or null,
  "status": one of ["missing", "injured", "rescued", "safe"] or null,
  "time": ISO 8601 string (assume today's date if only a clock time is given) or null,
  "people_count": integer or null,
  "action": string or null
}}

Report:
\"\"\"{report_text}\"\"\"
"""


def _mock_extract(report_text: str) -> dict:
    text = report_text.lower()
    status = None
    for s in ["missing", "injured", "rescued", "safe"]:
        if s in text:
            status = s
            break

    count_match = re.search(r"\b(\d+)\b", report_text)
    people_count = int(count_match.group(1)) if count_match else 1

    return {
        "name": None,
        "location": None,
        "status": status,
        "time": "2026-09-19T16:00:00",
        "people_count": people_count,
        "action": None,
        "_mock": True,
    }


def extract(report_text: str) -> dict:
    if USE_MOCK or not GEMINI_API_KEY:
        return _mock_extract(report_text)

    prompt = EXTRACTION_PROMPT.format(report_text=report_text)
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    try:
        resp = requests.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            json=payload,
            timeout=15,
        )
        resp.raise_for_status()
        raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        raw_text = raw_text.strip().strip("`").replace("json\n", "", 1)
        return json.loads(raw_text)
    except Exception as e:
        print(f"[extraction] API call failed, falling back to mock: {e}")
        fallback = _mock_extract(report_text)
        fallback["_fallback_used"] = True
        return fallback


if __name__ == "__main__":
    sample = "Three tourists were rescued near Timure at 4 PM."
    print(json.dumps(extract(sample), indent=2))