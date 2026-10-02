"use client";

import {
  ChangeEvent,
  DragEvent,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

export default function HomePage() {
  const router = useRouter();

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [isDragging, setIsDragging] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [error, setError] =
    useState("");

  function selectFile(file: File | null) {
    setError("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.type.startsWith("audio/")) {
      setSelectedFile(null);

      setError(
        "Please select a valid audio file."
      );

      return;
    }

    setSelectedFile(file);
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0] || null;

    selectFile(file);
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    setIsDragging(false);

    const file =
      event.dataTransfer.files?.[0] || null;

    selectFile(file);
  }

  function removeFile() {
    setSelectedFile(null);
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  async function handleUpload() {
    if (!selectedFile) {
      setError(
        "Please select an audio file first."
      );

      return;
    }

    try {
      setUploading(true);
      setError("");

      const formData = new FormData();

      formData.append(
        "file",
        selectedFile
      );

      const response = await fetch(
        `${API_URL}/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Upload failed."
        );
      }

      router.push(
        `/history/${data.id}`
      );

    } catch (error) {
      console.error(
        "UPLOAD ERROR:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "We couldn't upload your audio file. Please try again."
      );

    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="page-section upload-page">

      <div className="hero">

        <h1>
          Turn your audio into clear,
          useful notes.
        </h1>

        <p>
          Upload a recording and let the
          platform generate a transcript
          and AI-powered summary for you.
        </p>

      </div>

      <div className="upload-card">

        <div
          className={`drop-zone ${
            isDragging
              ? "drop-zone-active"
              : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >

          <div className="upload-icon">
            ↑
          </div>

          <h2 className="drop-zone-title">
            Drop your audio here
          </h2>

          <p className="drop-zone-text">
            or choose a file from your computer
          </p>

          <label
            htmlFor="audio-upload"
            className="choose-audio-button"
          >
            Choose Audio
          </label>

          <input
            ref={fileInputRef}
            id="audio-upload"
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden-file-input"
          />

          <p className="supported-formats">
            MP3, WAV, M4A and other
            supported audio formats
          </p>

        </div>

        {selectedFile && (
          <div className="selected-file">

            <div className="selected-file-info">

              <p className="selected-file-name">
                {selectedFile.name}
              </p>

              <p className="selected-file-size">
                {formatFileSize(
                  selectedFile.size
                )}
              </p>

            </div>

            <button
              type="button"
              className="remove-file"
              onClick={removeFile}
            >
              Remove
            </button>

          </div>
        )}

        {error && (
          <div className="upload-error">
            {error}
          </div>
        )}

        {selectedFile && (
          <div className="upload-actions">

            <button
              type="button"
              className="primary-button upload-submit-button"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <span className="button-spinner" />
                  Uploading...
                </>
              ) : (
                "Upload recording"
              )}
            </button>

          </div>
        )}

      </div>

      <div className="feature-grid">

        <div className="feature-card">
          <div className="feature-number">
            01
          </div>

          <h3>
            Upload
          </h3>

          <p>
            Store your recording securely
            and start processing in the
            background.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-number">
            02
          </div>

          <h3>
            Transcribe
          </h3>

          <p>
            Convert your audio into a
            readable transcript using
            speech recognition.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-number">
            03
          </div>

          <h3>
            Summarize
          </h3>

          <p>
            Generate a concise AI summary
            so you can understand the
            recording quickly.
          </p>
        </div>

      </div>

    </section>
  );
}