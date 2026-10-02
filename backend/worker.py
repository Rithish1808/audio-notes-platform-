import re
import time
from datetime import datetime, timedelta

from requests.exceptions import HTTPError
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import engine
from error import get_user_friendly_error
from gemini_service import generate_summary
from gnani_service import (
    create_transcription_job,
    start_transcription_job,
    get_transcription_status,
    get_transcription_files,
    download_transcript,
)
from models import AudioFile
from storage import supabase


MAX_GNANI_RETRIES = 3
MAX_GEMINI_RETRIES = 3

GNANI_DEFAULT_RETRY_SECONDS = 30
GEMINI_DEFAULT_RETRY_SECONDS = 60

WORKER_IDLE_SECONDS = 5
WORKER_BETWEEN_JOBS_SECONDS = 2


# ============================================================
# RETRY DELAY
# ============================================================

def extract_retry_delay(error: Exception) -> int | None:
    """
    Extract a retry delay from a provider error when available.
    """

    message = str(error)

    match = re.search(
        r"retry in "
        r"(?:(\d+(?:\.\d+)?)h)?"
        r"(?:(\d+(?:\.\d+)?)m)?"
        r"(?:(\d+(?:\.\d+)?)s)?",
        message,
        re.IGNORECASE,
    )

    if match:
        hours = float(match.group(1) or 0)
        minutes = float(match.group(2) or 0)
        seconds = float(match.group(3) or 0)

        total_seconds = (
            hours * 3600
            + minutes * 60
            + seconds
        )

        if total_seconds > 0:
            return int(total_seconds)

    match = re.search(
        r"retryDelay[\"']?\s*[:=]\s*[\"']?(\d+(?:\.\d+)?)s",
        message,
        re.IGNORECASE,
    )

    if match:
        return int(float(match.group(1)))

    return None


# ============================================================
# DATABASE
# ============================================================

def get_next_job():
    """
    Get the next eligible job.

    Jobs waiting for a future retry time are ignored.
    """

    with Session(engine) as db:

        now = datetime.utcnow()

        retry_ready = or_(
            AudioFile.next_retry_at.is_(None),
            AudioFile.next_retry_at <= now,
        )

        # Fresh transcription work gets priority.
        audio_file = (
            db.query(AudioFile)
            .filter(
                AudioFile.status.in_(
                    ["uploaded", "processing"]
                ),
                retry_ready,
            )
            .order_by(
                AudioFile.created_at.asc()
            )
            .first()
        )

        # Then process eligible summary jobs.
        if not audio_file:

            audio_file = (
                db.query(AudioFile)
                .filter(
                    AudioFile.status == "transcribed",
                    AudioFile.summary.is_(None),
                    retry_ready,
                )
                .order_by(
                    AudioFile.created_at.asc()
                )
                .first()
            )

        if not audio_file:
            return None

        if audio_file.status == "uploaded":

            audio_file.status = "processing"
            audio_file.progress_percent = 0
            audio_file.error_message = None

            db.commit()

        return {
            "id": audio_file.id,
            "filename": audio_file.filename,
            "storage_path": audio_file.storage_path,
            "gnani_job_id": audio_file.gnani_job_id,
            "status": audio_file.status,
            "transcript": audio_file.transcript,
            "summary": audio_file.summary,
            "gnani_retry_count": audio_file.gnani_retry_count,
            "gemini_retry_count": audio_file.gemini_retry_count,
            "next_retry_at": audio_file.next_retry_at,
        }


def update_job(audio_id, **fields):
    with Session(engine) as db:

        audio_file = (
            db.query(AudioFile)
            .filter(
                AudioFile.id == audio_id
            )
            .first()
        )

        if not audio_file:
            print(
                "Database row not found:",
                audio_id,
            )
            return

        for key, value in fields.items():
            setattr(audio_file, key, value)

        db.commit()


# ============================================================
# GNANI RETRY
# ============================================================

def schedule_gnani_retry(job, error: Exception):

    current_count = job["gnani_retry_count"]
    next_count = current_count + 1

    if next_count > MAX_GNANI_RETRIES:

        friendly_error = get_user_friendly_error(
            "gnani",
            error,
        )

        print(
            "Gnani retry limit reached."
        )

        update_job(
            job["id"],
            status="failed",
            error_message=friendly_error,
            next_retry_at=None,
            gnani_retry_count=current_count,
            gnani_job_id=None,
        )

        return

    provider_delay = extract_retry_delay(error)

    if provider_delay is not None:
        delay_seconds = provider_delay
    else:
        delay_seconds = (
            GNANI_DEFAULT_RETRY_SECONDS
            * (2 ** (next_count - 1))
        )

    next_retry_at = (
        datetime.utcnow()
        + timedelta(seconds=delay_seconds)
    )

    friendly_error = get_user_friendly_error(
        "gnani",
        error,
    )

    print(
        f"Gnani retry "
        f"{next_count}/{MAX_GNANI_RETRIES}"
    )

    print(
        "Next retry at:",
        next_retry_at,
    )

    update_job(
        job["id"],
        status="processing",
        error_message=friendly_error,
        gnani_retry_count=next_count,
        next_retry_at=next_retry_at,
    )


# ============================================================
# GEMINI RETRY
# ============================================================

def schedule_gemini_retry(job, error: Exception):

    current_count = job["gemini_retry_count"]
    next_count = current_count + 1

    if next_count > MAX_GEMINI_RETRIES:

        friendly_error = get_user_friendly_error(
            "gemini",
            error,
        )

        print(
            "Gemini retry limit reached."
        )

        update_job(
            job["id"],
            status="failed",
            progress_percent=80,
            error_message=friendly_error,
            next_retry_at=None,
            gemini_retry_count=current_count,
        )

        return

    provider_delay = extract_retry_delay(error)

    if provider_delay is not None:
        delay_seconds = provider_delay
    else:
        delay_seconds = (
            GEMINI_DEFAULT_RETRY_SECONDS
            * (2 ** (next_count - 1))
        )

    next_retry_at = (
        datetime.utcnow()
        + timedelta(seconds=delay_seconds)
    )

    friendly_error = get_user_friendly_error(
        "gemini",
        error,
    )

    print(
        f"Gemini retry "
        f"{next_count}/{MAX_GEMINI_RETRIES}"
    )

    print(
        "Next retry at:",
        next_retry_at,
    )

    update_job(
        job["id"],
        status="transcribed",
        progress_percent=80,
        error_message=friendly_error,
        gemini_retry_count=next_count,
        next_retry_at=next_retry_at,
    )


# ============================================================
# GNANI
# ============================================================

def create_gnani_job(job):

    print("Creating Gnani job...")

    signed_result = (
        supabase
        .storage
        .from_("audio")
        .create_signed_url(
            job["storage_path"],
            3600,
        )
    )

    signed_url = signed_result["signedURL"]

    response = create_transcription_job(
        signed_url
    )

    gnani_job_id = response["job_id"]

    print(
        "Gnani job created:",
        gnani_job_id,
    )

    update_job(
        job["id"],
        gnani_job_id=gnani_job_id,
        progress_percent=10,
        error_message=None,
        next_retry_at=None,
    )

    return gnani_job_id


def start_gnani_job(job_id):

    return start_transcription_job(
        job_id
    )


# ============================================================
# TRANSCRIPTION
# ============================================================

def process_transcription(job):

    audio_id = job["id"]
    gnani_job_id = job["gnani_job_id"]

    if not gnani_job_id:

        gnani_job_id = create_gnani_job(
            job
        )

    else:

        print(
            "Resuming Gnani job:",
            gnani_job_id,
        )

    status_response = (
        get_transcription_status(
            gnani_job_id
        )
    )

    status = status_response["status"]

    print(
        "Gnani status:",
        status,
    )

    if status == "CREATED":

        start_response = (
            start_gnani_job(
                gnani_job_id
            )
        )

        print(
            "Gnani start:",
            start_response.get(
                "status"
            ),
        )

        update_job(
            audio_id,
            progress_percent=20,
        )

    while True:

        status_response = (
            get_transcription_status(
                gnani_job_id
            )
        )

        status = status_response["status"]

        progress_data = status_response.get(
            "progress",
            {},
        )

        percent = progress_data.get(
            "percent"
        )

        print(
            "Gnani status:",
            status,
            "progress:",
            percent,
        )

        if percent is not None:

            db_percent = min(
                int(percent),
                95,
            )

            update_job(
                audio_id,
                progress_percent=db_percent,
            )

        if status == "COMPLETED":
            break

        if status in [
            "FAILED",
            "CANCELLED",
        ]:

            update_job(
                audio_id,
                gnani_job_id=None,
            )

            raise RuntimeError(
                f"Gnani job ended with status: {status}"
            )

        time.sleep(10)

    update_job(
        audio_id,
        progress_percent=97,
    )

    files_response = (
        get_transcription_files(
            gnani_job_id
        )
    )

    if not files_response.get("data"):

        raise RuntimeError(
            "Gnani returned no completed files."
        )

    file_info = files_response["data"][0]

    transcript_url = (
        file_info["transcript_url"]
    )

    transcript_data = (
        download_transcript(
            transcript_url
        )
    )

    transcript = transcript_data.get(
        "full_transcript"
    )

    if transcript is None:

        raise RuntimeError(
            "Gnani response does not contain "
            "full_transcript."
        )

    update_job(
        audio_id,
        transcript=transcript,
        status="transcribed",
        progress_percent=80,
        error_message=None,
        next_retry_at=None,
        gnani_retry_count=0,
        gemini_retry_count=0,
    )

    print(
        "Transcript saved."
    )

    return transcript


# ============================================================
# GEMINI SUMMARY
# ============================================================

def process_summary(job, transcript):

    audio_id = job["id"]

    if not transcript:

        raise RuntimeError(
            "Cannot generate summary without transcript."
        )

    update_job(
        audio_id,
        progress_percent=90,
    )

    print(
        "Generating Gemini summary..."
    )

    summary = generate_summary(
        transcript
    )

    if not summary:

        raise RuntimeError(
            "Gemini returned an empty summary."
        )

    update_job(
        audio_id,
        summary=summary,
        status="completed",
        progress_percent=100,
        error_message=None,
        next_retry_at=None,
        gemini_retry_count=0,
    )

    print(
        "Summary saved."
    )


# ============================================================
# PROCESS ONE JOB
# ============================================================

def process_job(job):

    print()
    print("=" * 60)
    print("Processing:", job["id"])
    print("Filename:", job["filename"])
    print("Status:", job["status"])
    print("=" * 60)

    # Existing transcript -> Gemini only
    if (
        job["status"] == "transcribed"
        and job["transcript"]
        and not job["summary"]
    ):

        try:

            process_summary(
                job,
                job["transcript"],
            )

        except Exception as error:

            print(
                "GEMINI ERROR:",
                repr(error),
            )

            schedule_gemini_retry(
                job,
                error,
            )

        return

    # Transcription
    try:

        transcript = process_transcription(
            job
        )

    except HTTPError as error:

        print(
            "GNANI HTTP ERROR:",
            repr(error),
        )

        status_code = (
            error.response.status_code
            if error.response is not None
            else None
        )

        if status_code in [
            429,
            500,
            502,
            503,
            504,
        ]:

            schedule_gnani_retry(
                job,
                error,
            )

            return

        friendly_error = get_user_friendly_error(
            "gnani",
            error,
        )

        update_job(
            job["id"],
            status="failed",
            error_message=friendly_error,
            next_retry_at=None,
        )

        return

    except Exception as error:

        print(
            "GNANI PROCESSING ERROR:",
            repr(error),
        )

        schedule_gnani_retry(
            job,
            error,
        )

        return

    # Gnani succeeded -> Gemini
    try:

        process_summary(
            job,
            transcript,
        )

    except Exception as error:

        print(
            "GEMINI ERROR:",
            repr(error),
        )

        schedule_gemini_retry(
            job,
            error,
        )


# ============================================================
# WORKER LOOP
# ============================================================

def worker_loop():

    print(
        "Background worker started"
    )

    while True:

        try:

            job = get_next_job()

            if not job:

                time.sleep(
                    WORKER_IDLE_SECONDS
                )

                continue

            process_job(job)

            time.sleep(
                WORKER_BETWEEN_JOBS_SECONDS
            )

        except Exception as error:

            print(
                "WORKER ERROR:",
                repr(error),
            )

            time.sleep(
                WORKER_IDLE_SECONDS
            )


if __name__ == "__main__":
    worker_loop()