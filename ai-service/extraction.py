import os
import json
import re
import requests
from datetime import datetime

try:
    from dotenv import load_dotenv
    _here = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(_here, ".env"))
    load_dotenv(os.path.join(os.path.dirname(_here), ".env"))
except ImportError:
    pass

USE_MOCK = False

AI_PROVIDER = os.environ.get("AI_PROVIDER", "openai").strip().lower()

# Everything that differs between providers lives here. Adding a new
# provider later means adding one entry to this dict -- nothing else.
PROVIDERS = {
    "openai": {
        "url": "https://api.openai.com/v1/chat/completions",
        "key_env": "OPENAI_API_KEY",
        "model_env": "OPENAI_MODEL",
        "default_model": "gpt-4o-mini",
        "style": "openai",
    },
    "groq": {
        "url": "https://api.groq.com/openai/v1/chat/completions",
        "key_env": "GROQ_API_KEY",
        "model_env": "GROQ_MODEL",
        "default_model": "llama-3.3-70b-versatile",
        "style": "openai",
    },
    "gemini": {
        "url": "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        "key_env": "GEMINI_API_KEY",
        "model_env": "GEMINI_MODEL",
        "default_model": "gemini-flash-latest",
        "style": "gemini",
    },
}

EXTRACTION_PROMPT = """You are an information extraction system for a disaster response tool.
Today's date is {today}. If the report only gives a clock time (e.g. "4 PM") with no date,
assume it means today, {today}.

Extract ONLY information explicitly stated in the report below. Do not guess or infer
anything not stated (e.g. do not guess nationality from a name).

Return ONLY valid JSON, no other text, no markdown fences, matching exactly this shape:
{{
  "name": string or null,
  "location": string or null,
  "status": one of ["missing", "injured", "rescued", "safe"] or null,
  "time": ISO 8601 string or null,
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
        "name": None, "location": None, "status": status,
        "time": "2026-09-19T16:00:00", "people_count": people_count,
        "action": None, "_mock": True,
    }


def _call_openai_style(cfg: dict, api_key: str, model: str, prompt: str) -> str:
    resp = requests.post(
        cfg["url"],
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
            "temperature": 0,
        },
        timeout=15,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code} from {AI_PROVIDER}: {resp.text[:500]}")
    return resp.json()["choices"][0]["message"]["content"]


def _call_gemini_style(cfg: dict, api_key: str, model: str, prompt: str) -> str:
    url = cfg["url"].format(model=model)
    resp = requests.post(
        url,
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        json={"contents": [{"parts": [{"text": prompt}]}]},
        timeout=15,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code} from gemini: {resp.text[:500]}")
    return resp.json()["candidates"][0]["content"]["parts"][0]["text"]


def extract(report_text: str) -> dict:
    if USE_MOCK:
        return _mock_extract(report_text)

    cfg = PROVIDERS.get(AI_PROVIDER)
    if cfg is None:
        print(f"[extraction] Unknown AI_PROVIDER '{AI_PROVIDER}', falling back to mock")
        return {**_mock_extract(report_text), "_fallback_used": True}

    api_key = os.environ.get(cfg["key_env"], "")
    if not api_key:
        print(f"[extraction] {cfg['key_env']} not set, falling back to mock")
        return {**_mock_extract(report_text), "_fallback_used": True}

    model = os.environ.get(cfg["model_env"], cfg["default_model"])
    today = datetime.now().strftime("%Y-%m-%d")
    prompt = EXTRACTION_PROMPT.format(report_text=report_text, today=today)

    try:
        if cfg["style"] == "openai":
            raw_text = _call_openai_style(cfg, api_key, model, prompt)
        else:
            raw_text = _call_gemini_style(cfg, api_key, model, prompt)

        raw_text = re.sub(r"^```(json)?|```$", "", raw_text.strip()).strip()
        return json.loads(raw_text)
    except Exception as e:
        print(f"[extraction] {AI_PROVIDER} call failed, falling back to mock: {e}")
        fallback = _mock_extract(report_text)
        fallback["_fallback_used"] = True
        fallback["_error"] = str(e)
        return fallback


if __name__ == "__main__":
    print(f"Using provider: {AI_PROVIDER}")
    sample = "Three tourists were rescued near Timure at 4 PM."
    print(json.dumps(extract(sample), indent=2))