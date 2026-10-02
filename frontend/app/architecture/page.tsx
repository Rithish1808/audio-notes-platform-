import Link from "next/link";

export default function ArchitecturePage() {
  return (
    <div className="architecture-page">
      <div className="page-header">
        <div>
          <p className="section-label">ARCHITECTURE</p>
          <h1>How Audio Notes works</h1>
          <p className="page-subtitle">
            Upload an audio recording and follow it through storage,
            transcription, summarization, and the final note.
          </p>
        </div>

        <a
          href="https://github.com/Rithish1808/audio-notes-platform-"
          target="_blank"
          rel="noreferrer"
          className="github-link"
        >
          View GitHub ↗
        </a>
      </div>

      {/* ===================================================== */}
      {/* 01 — OVERALL FLOW */}
      {/* ===================================================== */}

      <section className="architecture-section">
        <div className="section-heading">
          <span>01</span>
          <div>
            <h2>Overall Flow</h2>
            <p>
              The upload request is kept short. Audio processing continues
              in the background after the API sends the initial response.
            </p>
          </div>
        </div>

        <div className="architecture-flow">
          <div className="flow-card">
            <span className="flow-number">01</span>
            <h3>Upload</h3>
            <p>
              The user selects an audio file from the Next.js frontend.
            </p>
          </div>

          <div className="flow-arrow">→</div>

          <div className="flow-card">
            <span className="flow-number">02</span>
            <h3>Store</h3>
            <p>
              FastAPI uploads the audio to the private Supabase Storage
              bucket and creates a PostgreSQL record.
            </p>
          </div>

          <div className="flow-arrow">→</div>

          <div className="flow-card">
            <span className="flow-number">03</span>
            <h3>Background Job</h3>
            <p>
              FastAPI returns the job ID and starts background processing.
            </p>
          </div>

          <div className="flow-arrow">→</div>

          <div className="flow-card">
            <span className="flow-number">04</span>
            <h3>Gnani ASR</h3>
            <p>
              The audio is submitted to Gnani and the transcription status
              is checked until completion.
            </p>
          </div>

          <div className="flow-arrow">→</div>

          <div className="flow-card">
            <span className="flow-number">05</span>
            <h3>Gemini Summary</h3>
            <p>
              The transcript is sent to Gemini and the generated summary
              is saved in PostgreSQL.
            </p>
          </div>
        </div>
      </section>

      {/* ===================================================== */}
      {/* 02 — WHERE DATA LIVES */}
      {/* ===================================================== */}

      <section className="architecture-section">
        <div className="section-heading">
          <span>02</span>
          <div>
            <h2>Where Data Lives</h2>
            <p>
              Different types of data are kept in the system that best
              matches their purpose.
            </p>
          </div>
        </div>

        <div className="architecture-grid two-column">
          <div className="info-card">
            <h3>Supabase Storage</h3>
            <p>
              Audio files are stored in a private <code>audio</code> bucket.
              The database stores only the file path, not the complete audio
              binary.
            </p>
          </div>

          <div className="info-card">
            <h3>PostgreSQL</h3>
            <p>
              PostgreSQL stores the filename, storage path, processing status,
              progress, transcript, summary, errors, retry information, and
              timestamps.
            </p>
          </div>

          <div className="info-card">
            <h3>FastAPI</h3>
            <p>
              FastAPI handles uploads, database operations, API responses,
              retry requests, and background processing.
            </p>
          </div>

          <div className="info-card">
            <h3>Next.js</h3>
            <p>
              The frontend displays uploads, history, processing progress,
              transcripts, summaries, and visible failures.
            </p>
          </div>
        </div>
      </section>

      {/* ===================================================== */}
      {/* 03 — LONG AUDIO */}
      {/* ===================================================== */}

      <section className="architecture-section">
        <div className="section-heading">
          <span>03</span>
          <div>
            <h2>Handling Long Audio</h2>
            <p>
              Processing is separated from the initial upload request so a
              longer recording does not make the page look frozen.
            </p>
          </div>
        </div>

        <div className="architecture-grid two-column">
          <div className="info-card">
            <h3>1. Upload once</h3>
            <p>
              The complete audio file is uploaded to Supabase Storage rather
              than being kept in the API process.
            </p>
          </div>

          <div className="info-card">
            <h3>2. Create a job</h3>
            <p>
              PostgreSQL keeps the processing state so the frontend can
              reopen the recording later.
            </p>
          </div>

          <div className="info-card">
            <h3>3. Process in background</h3>
            <p>
              Gnani transcription and Gemini summarization happen after the
              upload response has already been returned.
            </p>
          </div>

          <div className="info-card">
            <h3>4. Show progress</h3>
            <p>
              The backend updates progress and status while the frontend
              polls the recording endpoint.
            </p>
          </div>
        </div>
      </section>

      {/* ===================================================== */}
      {/* 04 — SYNC VS BACKGROUND */}
      {/* ===================================================== */}

      <section className="architecture-section">
        <div className="section-heading">
          <span>04</span>
          <div>
            <h2>Sync vs Background</h2>
            <p>
              Only the work required to acknowledge the upload is performed
              synchronously.
            </p>
          </div>
        </div>

        <div className="architecture-grid two-column">
          <div className="state-card sync-card">
            <div className="state-badge">SYNCHRONOUS</div>

            <h3>Upload path</h3>

            <ul className="architecture-list">
              <li>Validate the uploaded file.</li>
              <li>Save the audio to Supabase Storage.</li>
              <li>Create the PostgreSQL record.</li>
              <li>Return the audio ID to the frontend.</li>
            </ul>
          </div>

          <div className="state-card background-card">
            <div className="state-badge">BACKGROUND</div>

            <h3>Processing path</h3>

            <ul className="architecture-list">
              <li>Create and monitor the Gnani transcription job.</li>
              <li>Save the completed transcript.</li>
              <li>Generate the Gemini summary.</li>
              <li>Update status, progress, and errors.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ===================================================== */}
      {/* 05 — FAILURE HANDLING */}
      {/* ===================================================== */}

      <section className="architecture-section">
        <div className="section-heading">
          <span>05</span>
          <div>
            <h2>Failure Handling</h2>
            <p>
              Provider failures are separated from user-facing messages so
              technical errors are not exposed directly in the UI.
            </p>
          </div>
        </div>

        <div className="architecture-grid two-column">
          <div className="info-card">
            <h3>Upload failure</h3>
            <p>
              The database record is marked failed and the frontend receives
              a simple upload error.
            </p>
          </div>

          <div className="info-card">
            <h3>Gnani failure</h3>
            <p>
              The transcription job is marked failed and the user is told
              that the audio could not be transcribed.
            </p>
          </div>

          <div className="info-card">
            <h3>Gemini failure</h3>
            <p>
              The transcript remains available. The UI explains that the
              summary is temporarily unavailable and can be retried.
            </p>
          </div>

          <div className="info-card">
            <h3>Retry</h3>
            <p>
              A retry request resets the relevant state and starts the
              background processing again.
            </p>
          </div>
        </div>
      </section>

      {/* ===================================================== */}
      {/* 06 — PROCESSING STATES */}
      {/* ===================================================== */}

      <section className="architecture-section">
        <div className="section-heading">
          <span>06</span>
          <div>
            <h2>Processing States</h2>
            <p>
              PostgreSQL acts as the source of truth for the recording state.
            </p>
          </div>
        </div>

        <div className="state-grid">
          <div className="state-item">
            <span className="state-dot uploaded-dot"></span>
            <div>
              <h3>Uploaded</h3>
              <p>The file has been stored and is ready for processing.</p>
            </div>
          </div>

          <div className="state-item">
            <span className="state-dot processing-dot"></span>
            <div>
              <h3>Processing</h3>
              <p>Gnani transcription is being created or monitored.</p>
            </div>
          </div>

          <div className="state-item">
            <span className="state-dot transcribed-dot"></span>
            <div>
              <h3>Transcribed</h3>
              <p>The transcript exists and summary generation is pending.</p>
            </div>
          </div>

          <div className="state-item">
            <span className="state-dot completed-dot"></span>
            <div>
              <h3>Completed</h3>
              <p>Both transcript and summary are available.</p>
            </div>
          </div>

          <div className="state-item">
            <span className="state-dot failed-dot"></span>
            <div>
              <h3>Failed</h3>
              <p>
                Processing stopped and the user is shown a readable error.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================== */}
      {/* 07 — TRADEOFFS */}
      {/* ===================================================== */}

      <section className="architecture-section">
        <div className="section-heading">
          <span>07</span>
          <div>
            <h2>Design Tradeoffs</h2>
            <p>
              The architecture is intentionally simple for this take-home
              assignment while keeping the long-running processing away from
              the upload request.
            </p>
          </div>
        </div>

        <div className="tradeoff-card">
          <h3>Why FastAPI BackgroundTasks?</h3>

          <p>
            A separate worker service would provide stronger isolation and
            better durability for a larger production system. For this
            project, FastAPI background processing keeps the deployment
            simpler while still separating upload handling from the slower
            transcription and summarization work.
          </p>

          <p>
            With more time and higher traffic, I would move the processing
            to a dedicated worker queue so jobs survive API restarts,
            multiple workers can process jobs concurrently, and retries can
            be handled independently from the web service.
          </p>
        </div>
      </section>

      {/* ===================================================== */}
      {/* PROJECT */}
      {/* ===================================================== */}

      <section className="architecture-project">
        <div>
          <p className="section-label">PROJECT</p>
          <h2>Source code</h2>
          <p>
            The complete frontend and backend implementation is available on
            GitHub.
          </p>
        </div>

        <Link
          href="https://github.com/Rithish1808/audio-notes-platform-"
          target="_blank"
          className="project-link"
        >
          github.com/Rithish1808/audio-notes-platform- ↗
        </Link>
      </section>
    </div>
  );
}