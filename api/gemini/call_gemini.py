import os
import sys
from dotenv import load_dotenv, find_dotenv

from google import genai
from google.genai import types

dotenv_path = find_dotenv()
if dotenv_path:
    load_dotenv(dotenv_path)
else:
    load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("ERROR: GEMINI_API_KEY not set. Create a .env file with GEMINI_API_KEY=your_key", file=sys.stderr)
    sys.exit(1)

client = genai.Client(api_key=api_key)

def generate_response(system_prompt="", prompt="", model="gemini-2.5-flash"):

    try:

        config = types.GenerateContentConfig(system_instruction=system_prompt)

        response = client.models.generate_content(
            model=model,
            config=config,
            contents=prompt
        )

        return response.text
    
    except Exception as e:

        raise RuntimeError(f"API request failed {e}")
    