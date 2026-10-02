import os
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set")


client = genai.Client(
    api_key=GEMINI_API_KEY,
    http_options=types.HttpOptions(
        retry_options=types.HttpRetryOptions(
            attempts=5,
            initial_delay=2.0,
            max_delay=30.0,
            exp_base=2.0,
            jitter=1.0,
            http_status_codes=[
                408,
                429,
                500,
                502,
                503,
                504,
            ],
        )
    ),
)


def generate_summary(transcript: str) -> str:

    prompt = f"""
Summarize the following audio transcript.

Give:
1. A short overview
2. The main points
3. Important details or actions

Keep the summary concise and easy to read.

Transcript:
{transcript}
"""

    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=prompt,
    )

    if not response.text:
        raise RuntimeError("Gemini returned an empty response")

    return response.text