# api/routers/gemini/gemini_router.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import threading
import logging
import importlib
import traceback

router = APIRouter()

# Module-level variables (in-memory).
# Note: these are process-local. Use persistent storage if you need durability or multi-instance sharing.
USER_PROMPT_LOCK = threading.Lock()
USER_PROMPT: Optional[str] = None
USER_SYSTEM_PROMPT: Optional[str] = None  # store system prompt alongside user prompt if desired

GEMINI_RESPONSE_LOCK = threading.Lock()
GEMINI_RESPONSE: Optional[str] = None

# Simple request model for setting a prompt
class SetPromptRequest(BaseModel):
    # Accept prompt as optional now; at least one of prompt or system_prompt must be non-empty.
    prompt: Optional[str] = None
    system_prompt: Optional[str] = None  # <-- now accepted from client


@router.post("/set_prompt")
def set_prompt(req: SetPromptRequest) -> Dict[str, Any]:
    """
    Set the module-level USER_PROMPT (and optionally USER_SYSTEM_PROMPT) variable and immediately
    attempt to call Gemini (via api.gemini.call_gemini.generate_response). The Gemini output is
    stored in GEMINI_RESPONSE and can be retrieved via /get_response.

    Note: either `prompt` or `system_prompt` must contain non-empty text. If both are empty, the
    endpoint returns 400.
    """
    global USER_PROMPT, USER_SYSTEM_PROMPT, GEMINI_RESPONSE

    # At least one of prompt or system_prompt must be provided and non-empty
    prompt_ok = isinstance(req.prompt, str) and req.prompt.strip() != ""
    system_ok = isinstance(req.system_prompt, str) and req.system_prompt.strip() != ""

    if not (prompt_ok or system_ok):
        raise HTTPException(status_code=400, detail="Either 'prompt' or 'system_prompt' must be provided and non-empty")

    # Normalize values to strings (use empty string if missing)
    user_prompt_val = req.prompt if isinstance(req.prompt, str) else ""
    user_system_prompt_val = req.system_prompt if isinstance(req.system_prompt, str) else ""

    # Save prompt/system_prompt (thread-safe)
    with USER_PROMPT_LOCK:
        USER_PROMPT = user_prompt_val
        USER_SYSTEM_PROMPT = user_system_prompt_val

    # Reset previous gemini response
    with GEMINI_RESPONSE_LOCK:
        GEMINI_RESPONSE = None

    # Try to import and call the provided call_gemini helper.
    # We import dynamically and protect against SystemExit (call_gemini may call sys.exit if key missing).
    try:
        cg = importlib.import_module("api.gemini.call_gemini")
    except SystemExit:
        # call_gemini tried to sys.exit (likely missing GEMINI_API_KEY) — don't crash server
        logging.exception("api.gemini.call_gemini attempted to exit (likely missing GEMINI_API_KEY)")
        return {
            "status": "ok",
            "saved_prompt_length": len(user_prompt_val),
            "saved_system_prompt_length": len(user_system_prompt_val),
            "gemini_called": False,
            "error": "call_gemini attempted to exit (likely missing GEMINI_API_KEY). Check server logs."
        }
    except Exception as exc:
        logging.exception("Failed to import api.gemini.call_gemini")
        logging.debug(traceback.format_exc())
        return {
            "status": "ok",
            "saved_prompt_length": len(user_prompt_val),
            "saved_system_prompt_length": len(user_system_prompt_val),
            "gemini_called": False,
            "error": f"Import error: {str(exc)}"
        }

    # Ensure the module exposes generate_response
    generate_fn = getattr(cg, "generate_response", None)

    if not callable(generate_fn):
        logging.error("api.gemini.call_gemini.generate_response not found or not callable")
        return {
            "status": "ok",
            "saved_prompt_length": len(user_prompt_val),
            "saved_system_prompt_length": len(user_system_prompt_val),
            "gemini_called": False,
            "error": "generate_response not found in api.gemini.call_gemini"
        }

    # Call the Gemini function (synchronously). Keep exceptions isolated.
    try:
        # Choose system prompt precedence:
        # - If the provided system_prompt is non-empty, use it
        # - Otherwise, allow call_gemini to use an empty string (or its default behaviour)
        system_prompt_to_use = user_system_prompt_val or ""

        # 🟢 DEBUGGING PRINT: Log that the Gemini call is starting
        print(f"--- DEBUG: Calling Gemini with prompt length {len(user_prompt_val)} and system_prompt length {len(system_prompt_to_use)} ---")

        # call_gemini.generate_response(system_prompt=..., prompt=..., model=...)
        gemini_text = generate_fn(system_prompt=system_prompt_to_use, prompt=user_prompt_val)

        # Ensure we store a string (some wrappers return complex objects)
        gemini_text_str = gemini_text if isinstance(gemini_text, str) else str(gemini_text)

        # 🟢 DEBUGGING PRINT: Log the response length
        print(f"--- DEBUG: Gemini returned response length: {len(gemini_text_str)} ---")

        with GEMINI_RESPONSE_LOCK:
            GEMINI_RESPONSE = gemini_text_str

        return {
            "status": "ok",
            "saved_prompt_length": len(user_prompt_val),
            "saved_system_prompt_length": len(system_prompt_to_use),
            "gemini_called": True,
            "gemini_length": len(gemini_text_str),
        }
    except SystemExit:
        # Protect against any unexpected sys.exit inside call_gemini
        logging.exception("call_gemini requested process exit while generating response")
        return {
            "status": "ok",
            "saved_prompt_length": len(user_prompt_val),
            "saved_system_prompt_length": len(user_system_prompt_val),
            "gemini_called": False,
            "error": "call_gemini requested process exit. Check GEMINI_API_KEY and call_gemini implementation."
        }
    except Exception as exc:
        logging.exception("Error while calling Gemini via call_gemini.generate_response")
        logging.debug(traceback.format_exc())
        return {
            "status": "ok",
            "saved_prompt_length": len(user_prompt_val),
            "saved_system_prompt_length": len(user_system_prompt_val),
            "gemini_called": False,
            "error": f"Gemini generation failed: {str(exc)}"
        }


@router.get("/get_prompt")
def get_prompt():
    """Return the currently-stored USER_PROMPT and USER_SYSTEM_PROMPT (or null)."""
    return {"prompt": USER_PROMPT, "system_prompt": USER_SYSTEM_PROMPT}


@router.get("/get_response")
def get_response():
    """Return the currently-stored GEMINI response (or null)."""
    return {"response": GEMINI_RESPONSE}


@router.post("/generate")
def generate_from_current_prompt(model: Optional[str] = None, system_prompt: Optional[str] = None):
    """
    Trigger generation using the currently-stored USER_PROMPT and store to GEMINI_RESPONSE.
    Optionally pass `model` to override the call_gemini default. Pass `system_prompt` to override
    the previously-saved system prompt.
    """
    global USER_PROMPT, GEMINI_RESPONSE, USER_SYSTEM_PROMPT

    if not USER_PROMPT and not USER_SYSTEM_PROMPT and not system_prompt:
        raise HTTPException(status_code=400, detail="No USER_PROMPT or USER_SYSTEM_PROMPT set")

    # Import call_gemini dynamically as above
    try:
        cg = importlib.import_module("api.gemini.call_gemini")
    except SystemExit:
        logging.exception("api.gemini.call_gemini attempted to exit (likely missing GEMINI_API_KEY)")
        raise HTTPException(status_code=500, detail="Gemini client not configured")
    except Exception as exc:
        logging.exception("Failed to import api.gemini.call_gemini")
        raise HTTPException(status_code=500, detail=f"Import error: {str(exc)}")

    generate_fn = getattr(cg, "generate_response", None)

    if not callable(generate_fn):
        logging.error("api.gemini.call_gemini.generate_response not found or not callable")
        raise HTTPException(status_code=500, detail="generate_response not available")

    try:
        # system_prompt preference:
        # 1. argument `system_prompt` if provided
        # 2. saved USER_SYSTEM_PROMPT if available
        # 3. empty string fallback
        sp = system_prompt if isinstance(system_prompt, str) and system_prompt.strip() != "" else (USER_SYSTEM_PROMPT or "")

        prompt_to_use = USER_PROMPT or ""

        if model:
            gemini_text = generate_fn(system_prompt=sp, prompt=prompt_to_use, model=model)
        else:
            gemini_text = generate_fn(system_prompt=sp, prompt=prompt_to_use)
        gemini_text_str = gemini_text if isinstance(gemini_text, str) else str(gemini_text)
        with GEMINI_RESPONSE_LOCK:
            GEMINI_RESPONSE = gemini_text_str
        return {"status": "ok", "gemini_length": len(gemini_text_str)}
    except Exception as exc:
        logging.exception("Gemini generation failed")
        raise HTTPException(status_code=500, detail=str(exc))
