import time

from requests.exceptions import HTTPError
from sqlalchemy.orm import Session

from database import engine
from models import AudioFile
from storage import supabase

from gnani_service import (
    create_transcription_job,
    start_transcription_job,
    get_transcription_status,
    get_transcription_files,
    download_transcript,
)

from gemini_service import generate_summary
from error import get_user_friendly_error


# ============================================================
# DATABASE HELPERS
# ============================================================


def update_job(audio_id: str, **fields):
    """
    Update fields of one audio_files row.
    """

    with Session(engine) as db:
        audio_file = (
            db.query(AudioFile)
            .filter(AudioFile.id == audio_id)
            .first()
        )

        if not audio_file:
            print("Database row not found:", audio_id)
            return

        for key, value in fields.items():
            setattr(audio_file, key, value)

        db.commit()


def get_audio_job(audio_id: str):
    """
    Load one audio job from the database.
    """

    with Session(engine) as db:
        audio_file = (
            db.query(AudioFile)
            .filter(AudioFile.id == audio_id)
            .first()
        )

        if not audio_file:
            return None

        return {
            "id": audio_file.id,
            "filename": audio_file.filename,
            "storage_path": audio_file.storage_path,
            "gnani_job_id": audio_file.gnani_job_id,
            "status": audio_file.status,
            "transcript": audio_file.transcript,
            "summary": audio_file.summary,
        }


# ============================================================
# GNANI JOB CREATION
# ============================================================


def create_gnani_job(job):
    """
    Create a Gnani Batch job using a temporary
    signed Supabase Storage URL.
    """

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

    print("Signed URL created")

    gnani_response = create_transcription_job(
        signed_url
    )

    gnani_job_id = gnani_response["job_id"]

    print("Gnani job created:", gnani_job_id)

    # Save immediately so that if the process is interrupted,
    # we don't create a duplicate Gnani job later.
    update_job(
        job["id"],
        gnani_job_id=gnani_job_id,
        progress_percent=10,
        error_message=None,
    )

    return gnani_job_id


# ============================================================
# GNANI START
# ============================================================


def start_gnani_job(job_id: str):
    """
    Start a Gnani job.

    A few short retries are made for temporary HTTP 429
    rate limiting.
    """

    max_attempts = 3

    for attempt in range(max_attempts):
        try:
            return start_transcription_job(job_id)

        except HTTPError as error:
            response = error.response

            if (
                response is not None
                and response.status_code == 429
            ):
                wait_time = 20 * (2 ** attempt)

                print(
                    f"Gnani rate limited us. "
                    f"Waiting {wait_time} seconds..."
                )

                time.sleep(wait_time)
                continue

            raise

    raise RuntimeError(
        "Gnani could not be started after temporary retries."
    )


# ============================================================
# GNANI TRANSCRIPTION
# ============================================================


def process_transcription(job):
    """
    Process one audio file through Gnani.

    Returns:
        transcript string
    """

    audio_id = job["id"]

    # --------------------------------------------------------
    # 1. Get existing Gnani job or create a new one
    # --------------------------------------------------------

    gnani_job_id = job["gnani_job_id"]

    if not gnani_job_id:
        gnani_job_id = create_gnani_job(job)
    else:
        print(
            "Resuming Gnani job:",
            gnani_job_id,
        )

    # --------------------------------------------------------
    # 2. Check current Gnani status
    # --------------------------------------------------------

    status_response = get_transcription_status(
        gnani_job_id
    )

    status = status_response["status"]

    print(
        "Gnani status:",
        status,
    )

    # --------------------------------------------------------
    # 3. Start if job is still CREATED
    # --------------------------------------------------------

    if status == "CREATED":

        start_response = start_gnani_job(
            gnani_job_id
        )

        print(
            "Gnani start:",
            start_response.get("status")
            if start_response
            else "unknown",
        )

        update_job(
            audio_id,
            progress_percent=20,
        )

    # --------------------------------------------------------
    # 4. Poll until Gnani finishes
    # --------------------------------------------------------

    while True:

        status_response = get_transcription_status(
            gnani_job_id
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

            # Keep room for transcript download
            # and Gemini processing.
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

        if status in ["FAILED", "CANCELLED"]:

            # Clear the provider job ID because this
            # provider job can no longer be resumed.
            update_job(
                audio_id,
                gnani_job_id=None,
            )

            raise RuntimeError(
                f"Gnani job ended with status: {status}"
            )

        time.sleep(10)

    # --------------------------------------------------------
    # 5. Get transcript file
    # --------------------------------------------------------

    update_job(
        audio_id,
        progress_percent=97,
    )

    files_response = get_transcription_files(
        gnani_job_id
    )

    if not files_response.get("data"):

        raise RuntimeError(
            "Gnani returned no completed files."
        )

    file_info = files_response["data"][0]

    transcript_url = file_info[
        "transcript_url"
    ]

    # --------------------------------------------------------
    # 6. Download transcript JSON
    # --------------------------------------------------------

    transcript_data = download_transcript(
        transcript_url
    )

    transcript = transcript_data.get(
        "full_transcript"
    )

    if transcript is None:

        raise RuntimeError(
            "Gnani response does not contain "
            "full_transcript."
        )

    print("Transcript:")
    print(transcript)

    # --------------------------------------------------------
    # 7. Save transcript
    # --------------------------------------------------------

    update_job(
        audio_id,
        transcript=transcript,
        status="transcribed",
        progress_percent=80,
        error_message=None,
        next_retry_at=None,
        gnani_retry_count=0,
    )

    print("✅ Transcript saved")

    return transcript


# ============================================================
# GEMINI SUMMARY
# ============================================================


def process_summary(job, transcript):
    """
    Generate and save Gemini summary.
    """

    audio_id = job["id"]

    if not transcript:
        raise RuntimeError(
            "Cannot generate summary without transcript."
        )

    print("Generating Gemini summary...")

    update_job(
        audio_id,
        progress_percent=90,
    )

    summary = generate_summary(
        transcript
    )

    if not summary:

        raise RuntimeError(
            "Gemini returned an empty summary."
        )

    print("Summary:")
    print(summary)

    # --------------------------------------------------------
    # Save final result
    # --------------------------------------------------------

    update_job(
        audio_id,
        summary=summary,
        status="completed",
        progress_percent=100,
        error_message=None,
        next_retry_at=None,
        gemini_retry_count=0,
    )

    print("✅ Summary saved")
    print("✅ Job completed")


# ============================================================
# PROCESS ONE JOB
# ============================================================


def process_job(job):
    """
    Process exactly one database job.

    This function does not search for the next job.
    FastAPI decides which job should be processed.
    """

    print()
    print("=" * 60)
    print("Processing:", job["id"])
    print("Filename:", job["filename"])
    print("Current status:", job["status"])
    print("=" * 60)

    # --------------------------------------------------------
    # CASE 1:
    # Transcript already exists
    # Only Gemini is required.
    # --------------------------------------------------------

    if (
        job["status"] == "transcribed"
        and job["transcript"]
        and not job["summary"]
    ):

        print("Transcript already exists.")
        print("Generating Gemini summary...")

        try:

            process_summary(
                job,
                job["transcript"],
            )

        except Exception as error:

            print(
                "❌ GEMINI ERROR:",
                repr(error),
            )

            update_job(
                job["id"],
                status="transcribed",
                progress_percent=80,
                error_message=get_user_friendly_error(
                    "gemini",
                    error,
                ),
                next_retry_at=None,
            )

            print(
                "Transcript is safe."
            )

        return

    # --------------------------------------------------------
    # CASE 2:
    # Audio still needs transcription
    # --------------------------------------------------------

    try:

        transcript = process_transcription(
            job
        )

    except Exception as error:

        print(
            "❌ GNANI ERROR:",
            repr(error),
        )

        update_job(
            job["id"],
            status="failed",
            progress_percent=0,
            error_message=get_user_friendly_error(
                "gnani",
                error,
            ),
            next_retry_at=None,
        )

        return

    # --------------------------------------------------------
    # CASE 3:
    # Gnani succeeded -> Gemini
    # --------------------------------------------------------

    try:

        process_summary(
            job,
            transcript,
        )

    except Exception as error:

        print(
            "❌ GEMINI ERROR:",
            repr(error),
        )

        # Transcript succeeded, so keep it.
        update_job(
            job["id"],
            status="transcribed",
            progress_percent=80,
            error_message=get_user_friendly_error(
                "gemini",
                error,
            ),
            next_retry_at=None,
        )

        print(
            "Transcript is safe."
        )


# ============================================================
# FASTAPI BACKGROUND ENTRY POINT
# ============================================================


def process_audio_job(audio_id: str):
    """
    Entry point called by FastAPI BackgroundTasks.

    It loads one audio record and processes that
    specific record.
    """

    print()
    print("=" * 60)
    print(
        "Background task started:",
        audio_id,
    )
    print("=" * 60)

    job = get_audio_job(
        audio_id
    )

    if not job:

        print(
            "Audio file not found:",
            audio_id,
        )

        return

    # A newly uploaded file is now being processed.
    if job["status"] == "uploaded":

        update_job(
            audio_id,
            status="processing",
            progress_percent=0,
            error_message=None,
        )

        job["status"] = "processing"

    process_job(job)

    print()
    print("=" * 60)
    print(
        "Background task finished:",
        audio_id,
    )
    print("=" * 60)