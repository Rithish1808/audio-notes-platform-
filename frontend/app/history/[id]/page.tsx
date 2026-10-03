"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

type AudioData = {
  id: string;
  filename: string;
  content_type?: string | null;
  status: string;
  transcript?: string | null;
  summary?: string | null;
  error_message?: string | null;
  progress?: number | null;
  created_at?: string | null;
  gnani_retry_count?: number;
  gemini_retry_count?: number;
  next_retry_at?: string | null;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

const getProgress = (audio: AudioData | null) => {
  const value = audio?.progress ?? 0;

  return Math.min(
    100,
    Math.max(0, Number(value) || 0)
  );
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "uploaded":
      return "Uploaded";

    case "processing":
      return "Processing";

    case "transcribed":
      return "Transcript ready";

    case "completed":
      return "Completed";

    case "failed":
      return "Failed";

    default:
      return status;
  }
};

const getProcessingMessage = (
  audio: AudioData
) => {
  if (audio.status === "uploaded") {
    return "Preparing your audio for processing.";
  }

  if (
    audio.status === "processing" &&
    getProgress(audio) < 80
  ) {
    return "Your recording is being transcribed.";
  }

  if (
    audio.status === "transcribed" &&
    !audio.summary
  ) {
    return "Your transcript is ready. Generating the summary.";
  }

  return "Your recording is being processed.";
};

export default function AudioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [audioId, setAudioId] = useState("");
  const [audio, setAudio] = useState<AudioData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((value) => {
      setAudioId(value.id);
    });
  }, [params]);

  useEffect(() => {
    if (!audioId) {
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null =
      null;

    const loadAudio = async () => {
      try {
        const response = await fetch(
          `${API_URL}/audio/${audioId}`,
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load audio."
          );
        }

        const data: AudioData =
          await response.json();

        if (!cancelled) {
          setAudio(data);
          setLoading(false);
          setError("");
        }

        const shouldPoll =
          data.status === "uploaded" ||
          data.status === "processing" ||
          (
            data.status === "transcribed" &&
            !data.summary &&
            !data.error_message
          );

        if (
          shouldPoll &&
          !intervalId
        ) {
          intervalId = setInterval(
            loadAudio,
            5000
          );
        }

        if (
          !shouldPoll &&
          intervalId
        ) {
          clearInterval(intervalId);
          intervalId = null;
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
          setError(
            "We couldn't load this recording right now. Please try again."
          );
        }
      }
    };

    loadAudio();

    return () => {
      cancelled = true;

      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [audioId]);

  const handleRetry = async () => {
    if (!audioId) {
      return;
    }

    setRetrying(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/audio/${audioId}/retry`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Retry failed."
        );
      }

      const data: AudioData =
        await fetch(
          `${API_URL}/audio/${audioId}`,
          {
            cache: "no-store",
          }
        ).then((res) => res.json());

      setAudio(data);
    } catch {
      setError(
        "We couldn't restart processing right now. Please try again."
      );
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="detail-page">
        <div className="detail-loading">
          Loading recording...
        </div>
      </div>
    );
  }

  if (!audio) {
    return (
      <div className="detail-page">
        <Link
          href="/history"
          className="back-link"
        >
          ← Back to history
        </Link>

        <div className="detail-error">
          <h2>Recording not found</h2>
          <p>
            We couldn't find this recording.
          </p>
        </div>
      </div>
    );
  }

  const progress = getProgress(audio);
  const isProcessing =
    audio.status === "uploaded" ||
    audio.status === "processing";

  const summaryPending =
    audio.status === "transcribed" &&
    !audio.summary &&
    !audio.error_message;

  const showProcessingCard =
    isProcessing || summaryPending;

  return (
    <div className="detail-page">
      <div className="detail-top">
        <Link
          href="/history"
          className="back-link"
        >
          ← Back to history
        </Link>

        <span
          className={`status-badge status-${audio.status}`}
        >
          {getStatusLabel(audio.status)}
        </span>
      </div>

      <div className="detail-title-row">
        <div>
          <h1 className="detail-title">
            {audio.filename}
          </h1>

          {audio.created_at && (
            <p className="detail-date">
              Uploaded{" "}
              {new Date(
                audio.created_at
              ).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="detail-error">
          <p>{error}</p>
        </div>
      )}

      {/* ================================================== */}
      {/* PROCESSING */}
      {/* ================================================== */}

      {showProcessingCard && (
        <section className="processing-card">
          <div className="processing-header">
            <div>
              <h2>
                {summaryPending
                  ? "Generating your summary"
                  : "Processing your audio"}
              </h2>

              <p>
                {getProcessingMessage(audio)}
              </p>
            </div>

            <div className="processing-percent">
              {progress}%
            </div>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

          <div className="processing-step">
            {progress < 80
              ? "Transcribing with Gnani..."
              : "Generating your summary..."}
          </div>
        </section>
      )}

      {/* ================================================== */}
      {/* FAILED */}
      {/* ================================================== */}

      {audio.status === "failed" && (
        <section className="detail-error">
          <div>
            <h2>
              Processing failed
            </h2>

            <p>
              {audio.error_message ||
                "Something went wrong while processing this audio."}
            </p>
          </div>

          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="retry-button"
          >
            {retrying
              ? "Retrying..."
              : "Retry"}
          </button>
        </section>
      )}

      {/* ================================================== */}
      {/* TRANSCRIPT */}
      {/* ================================================== */}

      {audio.transcript && (
        <section className="content-card">
          <div className="content-card-header">
            <div>
              <p className="content-label">
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

      {/* ================================================== */}
      {/* GEMINI ERROR */}
      {/* ================================================== */}

      {audio.status === "transcribed" &&
        !audio.summary &&
        audio.error_message && (
          <section className="detail-error">
            <div>
              <h2>
                Summary unavailable
              </h2>

              <p>
                {audio.error_message}
              </p>
            </div>

            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className="retry-button"
            >
              {retrying
                ? "Retrying..."
                : "Retry"}
            </button>
          </section>
        )}

      {/* ================================================== */}
      {/* SUMMARY */}
      {/* ================================================== */}

      {audio.summary && (
        <section className="content-card summary-card">
          <div className="content-card-header">
            <div>
              <p className="content-label">
                GENERATED SUMMARY
              </p>

              <h2>
                Key Takeaways
              </h2>
            </div>

            <span className="generated-badge">
              Gemini
            </span>
          </div>

          <div className="markdown-content">
            <ReactMarkdown>
              {audio.summary}
            </ReactMarkdown>
          </div>
        </section>
      )}
    </div>
  );
}