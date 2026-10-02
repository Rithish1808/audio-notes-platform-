"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

type AudioFile = {
  id: string;
  filename: string;
  status: string;
  progress_percent: number;
  error_message?: string | null;
  created_at: string;
};

export default function HistoryPage() {
  const [audioFiles, setAudioFiles] =
    useState<AudioFile[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadAudioFiles() {
    try {
      const response = await fetch(
        `${API_URL}/audio`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load recordings."
        );
      }

      const data =
        await response.json();

      setAudioFiles(data);
      setError("");

    }  catch {
        setError(
            "We couldn't load your recordings right now. Please try again."
        );


    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAudioFiles();

    const interval = setInterval(
      loadAudioFiles,
      5000
    );

    return () => {
      clearInterval(interval);
    };
  }, []);

  function getStatusLabel(
    audio: AudioFile
  ) {
    if (audio.status === "uploaded") {
      return "Queued";
    }

    if (audio.status === "processing") {
      return "Processing";
    }

    if (audio.status === "transcribed") {
      return audio.error_message
        ? "Summary unavailable"
        : "Generating summary";
    }

    if (audio.status === "completed") {
      return "Completed";
    }

    if (audio.status === "failed") {
      return "Failed";
    }

    return "Processing";
  }

  function getProcessingText(
    audio: AudioFile
  ) {
    if (audio.status === "uploaded") {
      return "Waiting to start";
    }

    if (audio.status === "processing") {
      if (audio.progress_percent < 80) {
        return "Transcribing";
      }

      return "Generating summary";
    }

    if (audio.status === "transcribed") {
      return "Generating summary";
    }

    return "Processing";
  }

  if (loading) {
    return (
      <section className="page-section">

        <div className="history-header">
          <div>
            <p className="section-label">
              LIBRARY
            </p>

            <h1 className="history-title">
              Your recordings
            </h1>

            <p className="history-subtitle">
              View transcripts and summaries
              from your previous uploads.
            </p>
          </div>
        </div>

        <div className="page-state">
          Loading recordings...
        </div>

      </section>
    );
  }

  return (
    <section className="page-section">

      <div className="history-header">

        <div>
          <p className="section-label">
            LIBRARY
          </p>

          <h1 className="history-title">
            Your recordings
          </h1>

          <p className="history-subtitle">
            View transcripts and summaries
            from your previous uploads.
          </p>
        </div>

        <Link
          href="/"
          className="primary-button"
        >
          + New upload
        </Link>

      </div>

      {error && (
        <div className="inline-error">
          {error}
        </div>
      )}

      {!error &&
        audioFiles.length === 0 && (
          <div className="empty-history">

            <h2>
              No recordings yet
            </h2>

            <p>
              Upload your first audio
              recording to get started.
            </p>

            <Link
              href="/"
              className="primary-button"
            >
              Upload audio
            </Link>

          </div>
        )}

      <div className="history-list">

        {audioFiles.map((audio) => {

          const processing =
            audio.status === "uploaded" ||
            audio.status === "processing" ||
            (
              audio.status === "transcribed" &&
              !audio.error_message
            );

          const failed =
            audio.status === "failed";

          const summaryError =
            audio.status === "transcribed" &&
            !!audio.error_message;

          return (
            <Link
              key={audio.id}
              href={`/history/${audio.id}`}
              className="history-card"
            >

              <div className="history-card-icon">
                <span>♪</span>
              </div>

              <div className="history-card-info">

                <h2 className="history-filename">
                  {audio.filename}
                </h2>

                <p className="history-date">
                  {new Date(
                    audio.created_at
                  ).toLocaleString()}
                </p>

              </div>

              <div className="history-card-status">

                <span
                  className={`status-badge status-${audio.status}`}
                >
                  {getStatusLabel(audio)}
                </span>

                {processing && (
                  <div className="history-processing">

                    <div className="history-processing-label">

                      <span>
                        {getProcessingText(audio)}
                      </span>

                      <span>
                        {audio.progress_percent}%
                      </span>

                    </div>

                    <div className="history-progress-track">

                      <div
                        className="history-progress-fill"
                        style={{
                          width:
                            `${audio.progress_percent}%`,
                        }}
                      />

                    </div>

                  </div>
                )}

                {audio.status === "completed" && (
                  <div className="history-completed-text">
                    Ready to view
                  </div>
                )}

                {failed && (
                  <div className="history-failed-text">
                    {audio.error_message ||
                      "Processing failed"}
                  </div>
                )}

                {summaryError && (
                  <div className="history-failed-text">
                    Summary unavailable
                  </div>
                )}

              </div>

              <div className="history-arrow">
                →
              </div>

            </Link>
          );
        })}

      </div>

    </section>
  );
}