"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

type AudioFile = {
  id: string;
  filename: string;
  status: string;
  transcript?: string | null;
  summary?: string | null;
  error_message?: string | null;
  progress_percent: number;
  created_at: string;
};

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default function AudioDetailPage({
  params,
}: Props) {
  const [audio, setAudio] =
    useState<AudioFile | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  const [retrying, setRetrying] =
    useState(false);

  const [audioId, setAudioId] =
    useState("");

  useEffect(() => {
    params.then((value) => {
      setAudioId(value.id);
    });
  }, [params]);

  const loadAudio = useCallback(
    async () => {
      if (!audioId) {
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/audio/${audioId}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load recording."
          );
        }

        const data =
          await response.json();

        setAudio(data);
        setPageError("");

      } catch {
        setPageError(
          "We couldn't load this recording right now. Please try again."
        );

      } finally {
        setLoading(false);
      }
    },
    [audioId]
  );

  useEffect(() => {
    loadAudio();
  }, [loadAudio]);

  useEffect(() => {
    if (!audio) {
      return;
    }

    const shouldPoll =
      audio.status === "uploaded" ||
      audio.status === "processing" ||
      (
        audio.status === "transcribed" &&
        !audio.summary &&
        !audio.error_message
      );

    if (!shouldPoll) {
      return;
    }

    const interval = setInterval(
      loadAudio,
      5000
    );

    return () => {
      clearInterval(interval);
    };
  }, [audio, loadAudio]);

  async function handleRetry() {
    if (!audio) {
      return;
    }

    try {
      setRetrying(true);
      setPageError("");

      const response = await fetch(
        `${API_URL}/audio/${audio.id}/retry`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const body =
          await response
            .json()
            .catch(() => null);

        throw new Error(
          body?.detail ||
            "Retry failed."
        );
      }

      await loadAudio();

    } catch {
      setPageError(
        "We couldn't restart processing. Please try again."
      );

    } finally {
      setRetrying(false);
    }
  }

  if (loading) {
    return (
      <section className="page-section">
        <div className="page-state">
          Loading recording...
        </div>
      </section>
    );
  }

  if (!audio) {
    return (
      <section className="page-section">

        <div className="page-state error-state">
          {pageError ||
            "Recording not found."}
        </div>

        <Link
          href="/history"
          className="secondary-button"
        >
          Back to history
        </Link>

      </section>
    );
  }

  const isProcessing =
    audio.status === "uploaded" ||
    audio.status === "processing";

  const summaryFailed =
    audio.status === "transcribed" &&
    !!audio.error_message &&
    !audio.summary;

  const permanentlyFailed =
    audio.status === "failed";

  let statusLabel = "Processing";

  if (audio.status === "uploaded") {
    statusLabel = "Queued";
  }

  if (audio.status === "processing") {
    statusLabel = "Processing";
  }

  if (audio.status === "transcribed") {
    statusLabel = summaryFailed
      ? "Summary unavailable"
      : "Transcript ready";
  }

  if (audio.status === "completed") {
    statusLabel = "Completed";
  }

  if (audio.status === "failed") {
    statusLabel = "Failed";
  }

  return (
    <section className="page-section detail-page">

      {/* Header */}

      <div className="detail-header">

        <div>

          <Link
            href="/history"
            className="back-link"
          >
            ← Back to history
          </Link>

          <h1 className="detail-title">
            {audio.filename}
          </h1>

          <p className="detail-date">
            Uploaded{" "}
            {new Date(
              audio.created_at
            ).toLocaleString()}
          </p>

        </div>

        <span
          className={`status-badge status-${audio.status}`}
        >
          {statusLabel}
        </span>

      </div>


      {/* Page-level error */}

      {pageError && (
        <div className="inline-error">
          {pageError}
        </div>
      )}


      {/* Processing */}

      {isProcessing && (
        <div className="processing-card">

          <div className="processing-header">

            <div>

              <h2>
                Processing your audio
              </h2>

              <p>
                Your recording is being
                transcribed and summarized.
              </p>

            </div>

            <strong>
              {audio.progress_percent}%
            </strong>

          </div>

          <div className="progress-track">

            <div
              className="progress-fill"
              style={{
                width:
                  `${audio.progress_percent}%`,
              }}
            />

          </div>

          <p className="processing-step">

            {audio.progress_percent < 20 &&
              "Preparing transcription..."}

            {audio.progress_percent >= 20 &&
              audio.progress_percent < 80 &&
              "Transcribing your audio..."}

            {audio.progress_percent >= 80 &&
              "Generating your summary..."}

          </p>

        </div>
      )}


      {/* Permanent failure */}

      {permanentlyFailed && (
        <div className="failure-card">

          <div>

            <h2>
              We couldn't finish processing
              this recording.
            </h2>

            <p>
              {audio.error_message ||
                "Something went wrong while processing this audio."}
            </p>

          </div>

          <button
            className="primary-button"
            onClick={handleRetry}
            disabled={retrying}
          >
            {retrying
              ? "Retrying..."
              : "Retry"}
          </button>

        </div>
      )}


      {/* Transcript */}

      {audio.transcript && (
        <section className="content-card">

          <div className="content-card-header">

            <div>

              <p className="section-label">
                TRANSCRIPT
              </p>

              <h2>
                Transcript
              </h2>

            </div>

          </div>

          <div className="transcript-content">
            {audio.transcript}
          </div>

        </section>
      )}


      {/* Summary failure */}

      {summaryFailed && (
        <section
          className="content-card summary-error-card"
        >

          <div className="summary-error-content">

            <p className="section-label">
              SUMMARY
            </p>

            <h2>
              Summary temporarily unavailable
            </h2>

            <p>
              {audio.error_message}
            </p>

            <button
              className="primary-button"
              onClick={handleRetry}
              disabled={retrying}
            >
              {retrying
                ? "Retrying..."
                : "Retry summary"}
            </button>

          </div>

        </section>
      )}


      {/* Successful summary */}

      {audio.summary && (
        <section className="content-card">

          <div className="content-card-header">

            <div>

              <p className="section-label">
                AI SUMMARY
              </p>

              <h2>
                Key Takeaways
              </h2>

            </div>

            <span className="status-badge status-completed">
              ✓ Generated
            </span>

          </div>

          <div className="markdown-content">

            <ReactMarkdown>
              {audio.summary}
            </ReactMarkdown>

          </div>

        </section>
      )}

    </section>
  );
}