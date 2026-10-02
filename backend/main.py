import os
import shutil
import tempfile
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import (
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


load_dotenv()


app = FastAPI(
    title="Audio Notes API",
    description="Backend for the Audio Notes Platform",
)


# ============================================================
# CORS
# ============================================================

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


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# HOME
# ============================================================

@app.get("/")
def home():
    return {
        "message": "Audio Notes API is running"
    }


# ============================================================
# UPLOAD
# ============================================================

@app.post("/upload")
async def upload_audio(
    file: UploadFile = File(...)
):

    temp_file_path = None

    try:

        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail="Please select an audio file."
            )

        if not file.content_type:
            raise HTTPException(
                status_code=400,
                detail="The file type could not be detected."
            )

        if not file.content_type.startswith("audio/"):
            raise HTTPException(
                status_code=400,
                detail="Please upload an audio file."
            )

        suffix = ""

        if "." in file.filename:
            suffix = (
                "."
                + file.filename.rsplit(
                    ".",
                    1
                )[1]
            )

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix,
        ) as temp_file:

            temp_file_path = temp_file.name

            shutil.copyfileobj(
                file.file,
                temp_file,
                length=1024 * 1024,
            )

        file_path = (
            f"{uuid4()}_{file.filename}"
        )

        with open(
            temp_file_path,
            "rb",
        ) as temp_file:

            (
                supabase
                .storage
                .from_("audio")
                .upload(
                    file=temp_file,
                    path=file_path,
                    file_options={
                        "content-type": (
                            file.content_type
                            or "application/octet-stream"
                        )
                    },
                )
            )

        with Session(engine) as db:

            audio_file = AudioFile(
                filename=file.filename,
                storage_path=file_path,
                content_type=file.content_type,
                status="uploaded",
                progress_percent=0,
                error_message=None,
                gnani_retry_count=0,
                gemini_retry_count=0,
                next_retry_at=None,
            )

            db.add(audio_file)

            db.commit()
            db.refresh(audio_file)

            return {
                "id": audio_file.id,
                "filename": audio_file.filename,
                "status": audio_file.status,
                "progress_percent": (
                    audio_file.progress_percent
                ),
            }

    except HTTPException:
        raise

    except Exception as error:

        print(
            "UPLOAD ERROR:",
            repr(error),
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


# ============================================================
# LIST
# ============================================================

@app.get("/audio")
def get_audio_files():

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
                "id": audio.id,
                "filename": audio.filename,
                "status": audio.status,
                "progress_percent": (
                    audio.progress_percent
                ),
                "error_message": (
                    audio.error_message
                ),
                "created_at": audio.created_at,
            }
            for audio in audio_files
        ]


# ============================================================
# SINGLE AUDIO
# ============================================================

@app.get("/audio/{audio_id}")
def get_audio(audio_id: str):

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
                detail="Audio file not found."
            )

        return {
            "id": audio_file.id,
            "filename": audio_file.filename,
            "content_type": audio_file.content_type,
            "status": audio_file.status,
            "transcript": audio_file.transcript,
            "summary": audio_file.summary,
            "error_message": (
                audio_file.error_message
            ),
            "progress_percent": (
                audio_file.progress_percent
            ),
            "created_at": audio_file.created_at,
            "gnani_retry_count": (
                audio_file.gnani_retry_count
            ),
            "gemini_retry_count": (
                audio_file.gemini_retry_count
            ),
            "next_retry_at": (
                audio_file.next_retry_at
            ),
        }


# ============================================================
# RETRY
# ============================================================

@app.post("/audio/{audio_id}/retry")
def retry_audio(audio_id: str):

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
                detail="Audio file not found."
            )

        audio_file.gnani_retry_count = 0
        audio_file.gemini_retry_count = 0
        audio_file.next_retry_at = None
        audio_file.error_message = None

        # Transcript exists -> only retry summary.
        if audio_file.transcript:

            audio_file.status = "transcribed"
            audio_file.progress_percent = 80

        # Transcript doesn't exist -> restart transcription.
        else:

            audio_file.status = "uploaded"
            audio_file.progress_percent = 0
            audio_file.gnani_job_id = None

        db.commit()
        db.refresh(audio_file)

        return {
            "id": audio_file.id,
            "status": audio_file.status,
            "progress_percent": (
                audio_file.progress_percent
            ),
            "message": "Retry started.",
        }