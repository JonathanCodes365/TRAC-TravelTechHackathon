import os
import json
import re
import requests

try:
    from dotenv import load_dotenv
    # Look for a .env next to this file first, then one at the repo root.
    _here = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(_here, ".env"))
    load_dotenv(os.path.join(os.path.dirname(_here), ".env"))
except ImportError:
    pass

USE_MOCK = False

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
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


def _parse_json_text(raw_text: str) -> dict:
    """Parse the model's reply, tolerating markdown fences around the JSON."""
    text = raw_text.strip()
    fenced = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)
    return json.loads(text)


def _call_gemini(report_text: str) -> dict:
    """Call Gemini and return the parsed record. Raises on any failure."""
    prompt = EXTRACTION_PROMPT.format(report_text=report_text)
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        # Ask for raw JSON so the reply never arrives wrapped in markdown fences.
        "generationConfig": {"responseMimeType": "application/json"},
    }

    resp = requests.post(
        GEMINI_URL,
        json=payload,
        headers={"x-goog-api-key": GEMINI_API_KEY},
        timeout=15,
    )

    if resp.status_code != 200:
        # Gemini explains itself in the body; raise_for_status alone would hide it.
        raise RuntimeError(f"HTTP {resp.status_code} from Gemini: {resp.text[:500]}")

    body = resp.json()
    candidates = body.get("candidates") or []
    if not candidates:
        reason = body.get("promptFeedback", {}).get("blockReason", "no candidates")
        raise RuntimeError(f"Gemini returned no output ({reason}): {json.dumps(body)[:500]}")

    parts = candidates[0].get("content", {}).get("parts") or []
    if not parts:
        finish = candidates[0].get("finishReason", "unknown")
        raise RuntimeError(f"Gemini returned an empty reply (finishReason={finish})")

    return _parse_json_text(parts[0]["text"])


def extract(report_text: str) -> dict:
    if USE_MOCK:
        return _mock_extract(report_text)

    if not GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Put it in ai-service/.env as "
            "GEMINI_API_KEY=your-key, or set USE_MOCK = True to run without the API."
        )

    try:
        return _call_gemini(report_text)
    except Exception as e:
        print(f"[extraction] API call failed, falling back to mock: {e}")
        fallback = _mock_extract(report_text)
        fallback["_fallback_used"] = True
        fallback["_error"] = str(e)
        return fallback


if __name__ == "__main__":
    print(f"[extraction] model={GEMINI_MODEL} key={'set' if GEMINI_API_KEY else 'MISSING'}")
    sample = "Three tourists were rescued near Timure at 4 PM."
    print(json.dumps(extract(sample), indent=2))
