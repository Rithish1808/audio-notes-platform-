import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

engine = create_engine(DATABASE_URL)


def test_connection():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        return result.scalar()


from sqlalchemy.orm import Session
from models import AudioFile


def save_transcript(storage_path: str, transcript: str):
    with Session(engine) as db:

        audio_file = (
            db.query(AudioFile)
            .filter(AudioFile.storage_path == storage_path)
            .first()
        )

        if not audio_file:
            raise ValueError("Audio file not found in database")

        audio_file.transcript = transcript
        audio_file.status = "transcribed"

        db.commit()

        return audio_file.id

from sqlalchemy.orm import Session
from models import AudioFile


def save_transcript(storage_path: str, transcript: str):
    with Session(engine) as db:

        audio_file = (
            db.query(AudioFile)
            .filter(AudioFile.storage_path == storage_path)
            .first()
        )

        if not audio_file:
            raise ValueError("Audio file not found in database")

        audio_file.transcript = transcript
        audio_file.status = "transcribed"

        db.commit()
        db.refresh(audio_file)

        return audio_file.id