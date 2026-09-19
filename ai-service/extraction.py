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
  "action": string or null,
  "report_type": one of ["rescue", "injured", "missing", "incident", "safe"] or null
}}

report_type means: rescue = someone is trapped or in danger and still needs rescuing;
injured = someone is hurt; missing = someone can't be found; incident = a hazard or event
such as a landslide, flood or blocked road; safe = people are OK (including "were rescued").

Report:
\"\"\"{report_text}\"\"\"
"""


# Words that show which kind of report a message is, most urgent first. The first kind that
# matches wins, so "injured hiker was rescued" counts as injured. Note that "rescued" (already
# out of danger) is a safe word, while "rescue" (still needs rescuing) is not.
REPORT_TYPE_PATTERNS = [
    ("rescue", r"\b(?:trapped|stuck|stranded|buried|drowning|sos|help us|need(?:s|ing)? (?:a )?rescue|rescue needed|can(?:no|'|’)t get out|water (?:\w+ )?rising)\b"),
    ("injured", r"\b(?:injur(?:ed|y|ies)|hurt|bleeding|broken (?:leg|arm|bone|ankle|wrist)|fractur\w*|unconscious|wounded|sprain\w*|can(?:no|'|’)t walk)\b"),
    ("missing", r"\b(?:missing|lost contact|lost track|can(?:no|'|’)t find|disappeared|not return(?:ed)?|didn(?:'|’)t return|hasn(?:'|’)t returned|no contact|no news|haven(?:'|’)t heard)\b"),
    ("incident", r"\b(?:landslides?|flood(?:s|ed|ing)?|avalanche|blocked|road closed|bridge|earthquake|fire|storm|rockfall|collapsed?)\b"),
    ("safe", r"\b(?:safe|rescued|evacuated|reached (?:the )?shelter|everyone is (?:ok|okay|fine)|all (?:ok|okay|fine)|we are (?:ok|okay|fine))\b"),
]

# Nouns that count people, as in "3 trekkers" or "two climbers".
PEOPLE_WORDS = r"(?:tourists?|people|persons?|travell?ers?|hikers?|trekkers?|climbers?|passengers?|students?|children|kids?|members?|porters?|guides?|visitors?|adults?|men|women|friends?)"


def _report_type(text: str):
    for report_type, pattern in REPORT_TYPE_PATTERNS:
        if re.search(pattern, text):
            return report_type
    return None


def extraction_mode() -> str:
    """How extract() works right now: "rules" (keyword rules), or the language model provider."""
    cfg = PROVIDERS.get(AI_PROVIDER)
    if USE_MOCK or cfg is None or not os.environ.get(cfg["key_env"]):
        return "rules"
    return AI_PROVIDER


def _mock_extract(report_text: str) -> dict:
    text = report_text.lower()

    # Detect the incident status from known keywords.
    status = None
    for s in ["missing", "injured", "rescued", "safe"]:
        if s in text:
            status = s
            break

    # Detect a number only when it is explicitly associated with people.
    number_words = {
        "one": 1,
        "two": 2,
        "three": 3,
        "four": 4,
        "five": 5,
        "six": 6,
        "seven": 7,
        "eight": 8,
        "nine": 9,
        "ten": 10,
        "eleven": 11,
        "twelve": 12,
        "fifteen": 15,
        "twenty": 20,
    }

    count_match = re.search(
        rf"\b(\d+)\s+(?:\w+\s+)?{PEOPLE_WORDS}\b",
        text
    )

    if count_match:
        people_count = int(count_match.group(1))
    else:
        people_count = None

        for word, number in number_words.items():
            if re.search(
                rf"\b{word}\s+(?:\w+\s+)?{PEOPLE_WORDS}\b",
                text
            ):
                people_count = number
                break

    # "family of 4", "group of five", "3 of us"
    if people_count is None:
        number = r"(\d+|" + "|".join(number_words) + r")"
        group_match = re.search(rf"\b(?:family|group|team|party) of {number}\b|\b{number} of us\b", text)
        if group_match:
            value = group_match.group(1) or group_match.group(2)
            people_count = int(value) if value.isdigit() else number_words[value]

    # Detect a location after words such as "near", "at", "in", or "around".
    location_match = re.search(
        r"\b(?:near|at|in|around)\s+([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)*)",
        report_text
    )

    location = location_match.group(1) if location_match else None

    # Detect simple AM/PM times.
    time_match = re.search(
        r"\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b",
        report_text,
        re.IGNORECASE
    )

    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2) or 0)
        period = time_match.group(3).upper()

        if period == "PM" and hour != 12:
            hour += 12
        elif period == "AM" and hour == 12:
            hour = 0

        extracted_time = datetime.now().replace(
            hour=hour,
            minute=minute,
            second=0,
            microsecond=0
        ).isoformat()
    else:
        extracted_time = None

    return {
        "name": None,
        "location": location,
        "status": status,
        "time": extracted_time,
        "people_count": people_count,
        "action": None,
        "report_type": _report_type(text),
        "_mock": True,
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