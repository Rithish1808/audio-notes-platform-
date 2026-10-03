import os
import shutil
import tempfile
from datetime import datetime

from dotenv import load_dotenv
from fastapi import (
    BackgroundTasks,
    FastAPI,
    File,
    HTTPException,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine
from error import get_user_friendly_error
from models import AudioFile
from storage import supabase
from worker import process_audio_job

load_dotenv()

frontend_url = os.getenv(
    "FRONTEND_URL",
    "http://localhost:3000",
)

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

if frontend_url not in allowed_origins:
    allowed_origins.append(frontend_url)


app = FastAPI(
    title="Audio Notes API",
    description="Backend for the Audio Notes Platform",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "Audio Notes API is running"
    }

@app.post("/upload")
async def upload_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Upload an audio file to Supabase Storage,
    create a database job, and start processing
    in the background.
    """

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Please select an audio file.",
        )

    if not file.content_type:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file has no content type.",
        )

    if not file.content_type.startswith("audio/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload an audio file.",
        )

    temp_file_path = None

    try:

        file_extension = ""

        if "." in file.filename:
            file_extension = (
                "." + file.filename.rsplit(".", 1)[1].lower()
            )

        audio_id = None

        with Session(engine) as db:

            audio_file = AudioFile(
                filename=file.filename,
                storage_path="",
                content_type=file.content_type,
                status="uploaded",
                progress_percent=0,
                gnani_retry_count=0,
                gemini_retry_count=0,
                next_retry_at=None,
            )

            db.add(audio_file)
            db.commit()
            db.refresh(audio_file)

            audio_id = audio_file.id

        storage_path = (
            f"uploads/{audio_id}{file_extension}"
        )

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=file_extension,
        ) as temp_file:

            temp_file_path = temp_file.name

            shutil.copyfileobj(
                file.file,
                temp_file,
                length=1024 * 1024,
            )

        with open(
            temp_file_path,
            "rb",
        ) as temp_file:

            supabase.storage.from_("audio").upload(
                file=temp_file,
                path=storage_path,
                file_options={
                    "content-type": (
                        file.content_type
                        or "application/octet-stream"
                    )
                },
            )

        with Session(engine) as db:

            audio_file = (
                db.query(AudioFile)
                .filter(
                    AudioFile.id == audio_id
                )
                .first()
            )

            if not audio_file:
                raise RuntimeError(
                    "Database record disappeared after upload."
                )

            audio_file.storage_path = storage_path
            audio_file.status = "uploaded"
            audio_file.progress_percent = 0
            audio_file.error_message = None

            db.commit()

        background_tasks.add_task(
            process_audio_job,
            audio_id,
        )

        return {
            "id": audio_id,
            "filename": file.filename,
            "status": "uploaded",
            "progress": 0,
        }

    except HTTPException:
        raise

    except Exception as error:

        print(
            "❌ UPLOAD ERROR:",
            repr(error),
        )

        if audio_id:

            try:

                with Session(engine) as db:

                    audio_file = (
                        db.query(AudioFile)
                        .filter(
                            AudioFile.id == audio_id
                        )
                        .first()
                    )

                    if audio_file:

                        audio_file.status = "failed"
                        audio_file.progress_percent = 0
                        audio_file.error_message = (
                            get_user_friendly_error(
                                "upload",
                                error,
                            )
                        )

                        db.commit()

            except Exception as db_error:

                print(
                    "❌ FAILED TO SAVE UPLOAD ERROR:",
                    repr(db_error),
                )

        raise HTTPException(
            status_code=500,
            detail=get_user_friendly_error(
                "upload",
                error,
            ),
        )

    finally:

        await file.close()

        if (
            temp_file_path
            and os.path.exists(temp_file_path)
        ):
            os.remove(temp_file_path)

@app.get("/audio")
def list_audio():
    """
    Return newest audio records first.
    """

    with Session(engine) as db:

        audio_files = (
            db.query(AudioFile)
            .order_by(
                AudioFile.created_at.desc()
            )
            .all()
        )

        return [
            {
                "id": audio_file.id,
                "filename": audio_file.filename,
                "status": audio_file.status,
                "progress": (
                    audio_file.progress_percent
                ),
                "error_message": (
                    audio_file.error_message
                ),
                "created_at": (
                    audio_file.created_at.isoformat()
                    if audio_file.created_at
                    else None
                ),
            }
            for audio_file in audio_files
        ]

@app.get("/audio/{audio_id}")
def get_audio(audio_id: str):
    """
    Return one audio record with transcript, summary, progress and processing status.
    """

    with Session(engine) as db:

        audio_file = (
            db.query(AudioFile)
            .filter(
                AudioFile.id == audio_id
            )
            .first()
        )

        if not audio_file:
            raise HTTPException(
                status_code=404,
                detail="Audio file not found.",
            )

        return {
            "id": audio_file.id,
            "filename": audio_file.filename,
            "content_type": audio_file.content_type,
            "status": audio_file.status,
            "transcript": audio_file.transcript,
            "summary": audio_file.summary,
            "error_message": audio_file.error_message,
            "progress": audio_file.progress_percent,
            "created_at": (
                audio_file.created_at.isoformat()
                if audio_file.created_at
                else None
            ),
            "gnani_retry_count": (
                audio_file.gnani_retry_count
            ),
            "gemini_retry_count": (
                audio_file.gemini_retry_count
            ),
            "next_retry_at": (
                audio_file.next_retry_at.isoformat()
                if audio_file.next_retry_at
                else None
            ),
        }

@app.post("/audio/{audio_id}/retry")
def retry_audio(
    audio_id: str,
    background_tasks: BackgroundTasks,
):
    """
    Reset a failed job and process it again in the background.
    """

    with Session(engine) as db:

        audio_file = (
            db.query(AudioFile)
            .filter(
                AudioFile.id == audio_id
            )
            .first()
        )

        if not audio_file:
            raise HTTPException(
                status_code=404,
                detail="Audio file not found.",
            )


        if audio_file.transcript:

            audio_file.status = "transcribed"
            audio_file.progress_percent = 80
            audio_file.error_message = None
            audio_file.gemini_retry_count = 0
            audio_file.next_retry_at = None


        else:

            audio_file.status = "uploaded"
            audio_file.progress_percent = 0
            audio_file.error_message = None
            audio_file.gnani_job_id = None
            audio_file.gnani_retry_count = 0
            audio_file.gemini_retry_count = 0
            audio_file.next_retry_at = None

        db.commit()

    background_tasks.add_task(
        process_audio_job,
        audio_id,
    )

    return {
        "id": audio_id,
        "message": "Retry started.",
    }