from datetime import datetime
from uuid import uuid4

from sqlalchemy import String, DateTime, Text, Integer
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AudioFile(Base):
    __tablename__ = "audio_files"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4())
    )

    filename: Mapped[str] = mapped_column(
        String(255)
    )

    storage_path: Mapped[str] = mapped_column(
        String(500)
    )

    content_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default="uploaded"
    )

    transcript: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    gnani_job_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    progress_percent: Mapped[int] = mapped_column(
        Integer,
        default=0
    )

    gnani_retry_count: Mapped[int] = mapped_column(
        Integer,
        default=0
    )

    gemini_retry_count: Mapped[int] = mapped_column(
        Integer,
        default=0
    )

    next_retry_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )