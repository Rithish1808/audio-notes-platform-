import os
import requests
from dotenv import load_dotenv

load_dotenv()

GNANI_API_KEY = os.getenv("GNANI_API_KEY")

if not GNANI_API_KEY:
    raise RuntimeError("GNANI_API_KEY is not set")


def create_transcription_job(signed_url: str):
    url = "https://api.vachana.ai/stt/v3/batch/jobs"

    headers = {
        "X-API-Key-ID": GNANI_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "config": {
            "model": "gnani-prisma-v2.5",
            "language_code": "hi-IN,en-IN",
            "mode": "transcribe",
            "with_diarization": False,
            "is_multi_channel": False,
            "with_denoise": False,
        },
        "source": {
            "type": "cloud_storage",
            "auth": {
                "mode": "public"
            },
            "paths": [signed_url],
        },
    }

    response = requests.post(
        url,
        json=payload,
        headers=headers,
        timeout=30,
    )

    response.raise_for_status()

    return response.json()


def start_transcription_job(job_id: str):
    url = f"https://api.vachana.ai/stt/v3/batch/jobs/{job_id}/start"

    headers = {
        "X-API-Key-ID": GNANI_API_KEY,
    }

    response = requests.post(
        url,
        headers=headers,
        timeout=30,
    )

    response.raise_for_status()

    return response.json()


def get_transcription_status(job_id: str):
    url = f"https://api.vachana.ai/stt/v3/batch/jobs/{job_id}"

    headers = {
        "X-API-Key-ID": GNANI_API_KEY,
    }

    response = requests.get(
        url,
        headers=headers,
        timeout=30,
    )

    response.raise_for_status()

    return response.json()

def get_transcription_files(job_id: str):
    url = f"https://api.vachana.ai/stt/v3/batch/jobs/{job_id}/files"

    headers = {
        "X-API-Key-ID": GNANI_API_KEY,
    }

    params = {
        "status": "COMPLETED"
    }

    response = requests.get(
        url,
        headers=headers,
        params=params,
        timeout=30,
    )

    response.raise_for_status()

    return response.json()

def download_transcript(transcript_url: str):
    response = requests.get(
        transcript_url,
        timeout=30,
    )

    response.raise_for_status()

    return response.json()