# api/gemini/parse_gemini_resp.py
import json
import re
from typing import List, Any


def _strip_trailing_and_leading(s: str) -> str:
    """Remove surrounding whitespace and stray quotes."""
    if not isinstance(s, str):
        return s
    s = s.strip()
    # Remove wrapping quotes if they wrap the whole string (e.g. "\"[...]" or "'[...]'")
    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
        s = s[1:-1].strip()
    return s


def parse_gemini_response(raw_text: Any) -> List[str]:
    """
    Parse a Gemini-like text response into a Python list of strings.

    Accepts:
      - a JSON string like: '{"response":"[\"amenity=bar\", \"amenity=cafe\"]"}'
      - a plain JSON array string: '["amenity=bar","amenity=cafe"]'
      - a Python-list-like string with single quotes
      - or even the direct Python list object.

    Returns a list of strings (amenity filters), e.g. ["amenity=bar", "amenity=cafe"].

    If nothing can be parsed, returns an empty list.
    """
    if raw_text is None:
        return []

    # If already a list (e.g. caller passed a Python list), normalize and return
    if isinstance(raw_text, list):
        return [str(x).strip() for x in raw_text if x is not None]

    # Convert bytes to str if necessary
    if isinstance(raw_text, (bytes, bytearray)):
        try:
            raw_text = raw_text.decode("utf-8")
        except Exception:
            raw_text = str(raw_text)

    text = str(raw_text).strip()

    # 1) Try to parse as JSON top-level (dict or list)
    try:
        parsed = json.loads(text)
        # If it's a dict with "response" key (your example), extract it
        if isinstance(parsed, dict):
            # try common keys
            candidate = None
            for k in ("response", "result", "data", "choices", "output"):
                if k in parsed:
                    candidate = parsed[k]
                    break
            # if none found, try to guess the only string/list value
            if candidate is None:
                # find the first value that is a string or list
                for v in parsed.values():
                    if isinstance(v, (str, list)):
                        candidate = v
                        break

            if candidate is None:
                # nothing usable
                return []

            # candidate might be list or string
            if isinstance(candidate, list):
                return [str(x).strip() for x in candidate if x is not None]
            if isinstance(candidate, str):
                # try to decode the candidate string as JSON array
                candidate = _strip_trailing_and_leading(candidate)
                try:
                    arr = json.loads(candidate)
                    if isinstance(arr, list):
                        return [str(x).strip() for x in arr if x is not None]
                except Exception:
                    # fall through to later parsing attempts
                    text = candidate

        elif isinstance(parsed, list):
            # top-level JSON list
            return [str(x).strip() for x in parsed if x is not None]
    except Exception:
        # not JSON — continue
        pass

    # 2) If the string itself looks like an array (starts with [ and ends with ])
    stripped = _strip_trailing_and_leading(text)
    if stripped.startswith("[") and stripped.endswith("]"):
        try:
            arr = json.loads(stripped)
            if isinstance(arr, list):
                return [str(x).strip() for x in arr if x is not None]
        except Exception:
            # try manually splitting while respecting quotes
            # remove surrounding brackets then split by comma not inside quotes
            inner = stripped[1:-1].strip()
            # quick split handling: split on commas then remove quotes
            parts = re.split(r'\s*,\s*(?=(?:[^"]*"[^"]*")*[^"]*$)', inner)
            cleaned = []
            for p in parts:
                p2 = p.strip()
                if (p2.startswith('"') and p2.endswith('"')) or (p2.startswith("'") and p2.endswith("'")):
                    p2 = p2[1:-1]
                if p2:
                    cleaned.append(p2.strip())
            return cleaned

    # 3) If text contains bracketed JSON somewhere, extract the first bracketed substring
    m = re.search(r"\[[^\]]+\]", text)
    if m:
        candidate = m.group(0)
        try:
            arr = json.loads(candidate)
            if isinstance(arr, list):
                return [str(x).strip() for x in arr if x is not None]
        except Exception:
            inner = candidate[1:-1]
            parts = re.split(r'\s*,\s*(?=(?:[^"]*"[^"]*")*[^"]*$)', inner)
            cleaned = []
            for p in parts:
                p2 = p.strip()
                if (p2.startswith('"') and p2.endswith('"')) or (p2.startswith("'") and p2.endswith("'")):
                    p2 = p2[1:-1]
                if p2:
                    cleaned.append(p2.strip())
            return cleaned

    # 4) Last resort: try to split the entire string by commas and clean tokens
    parts = re.split(r'\s*,\s*(?=(?:[^"]*"[^"]*")*[^"]*$)', text)
    cleaned = []
    for p in parts:
        p2 = p.strip()
        # remove surrounding quotes
        if (p2.startswith('"') and p2.endswith('"')) or (p2.startswith("'") and p2.endswith("'")):
            p2 = p2[1:-1]
        # drop braces/brackets/curly that might remain
        p2 = p2.strip("[]{} ")
        if p2:
            cleaned.append(p2.strip())
    return cleaned
