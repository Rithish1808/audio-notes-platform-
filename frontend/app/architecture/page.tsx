import Link from "next/link";

export default function ArchitecturePage() {
  return (
    <section className="page-section architecture-page">

      <div className="architecture-header">

        <p className="section-label">
          DOCUMENTATION
        </p>

        <h1>
          System Architecture
        </h1>

        <p>
          How the Audio Notes Platform handles uploads,
          transcription, summarization, and long-running
          processing.
        </p>

        <Link
          href="/"
          className="back-link"
        >
          ← Back to Upload
        </Link>

      </div>


      <div className="architecture-grid">

        {/* ================================================= */}
        {/* 01 OVERALL FLOW */}
        {/* ================================================= */}

        <section className="architecture-card">

          <div className="architecture-number">
            01
          </div>

          <h2>
            Overall Flow
          </h2>

          <p className="architecture-description">
            The upload request is kept small and fast.
            Long-running transcription and summarization
            happen in the background worker.
          </p>

          <div className="architecture-flow">

            <div className="architecture-flow-card">
              <span className="flow-number">
                01
              </span>

              <h3>
                User
              </h3>

              <p>
                Selects an audio recording from
                the browser.
              </p>
            </div>


            <div className="flow-arrow">
              →
            </div>


            <div className="architecture-flow-card">
              <span className="flow-number">
                02
              </span>

              <h3>
                Next.js
              </h3>

              <p>
                Sends the upload request and
                displays processing progress.
              </p>
            </div>


            <div className="flow-arrow">
              →
            </div>


            <div className="architecture-flow-card">
              <span className="flow-number">
                03
              </span>

              <h3>
                FastAPI
              </h3>

              <p>
                Receives the file, stores it,
                and creates a database job.
              </p>
            </div>


            <div className="flow-arrow">
              →
            </div>


            <div className="architecture-flow-card">
              <span className="flow-number">
                04
              </span>

              <h3>
                Background Worker
              </h3>

              <p>
                Performs transcription and
                summary generation.
              </p>
            </div>


            <div className="flow-arrow">
              →
            </div>


            <div className="architecture-flow-card">
              <span className="flow-number">
                05
              </span>

              <h3>
                Completed
              </h3>

              <p>
                Transcript and summary are
                available from History.
              </p>
            </div>

          </div>

        </section>


        {/* ================================================= */}
        {/* 02 DATA STORAGE */}
        {/* ================================================= */}

        <section className="architecture-card">

          <div className="architecture-number">
            02
          </div>

          <h2>
            Where Data Lives
          </h2>

          <p className="architecture-description">
            Audio files and application metadata are
            stored separately.
          </p>

          <div className="architecture-two-column">

            <div className="architecture-info-box">

              <h3>
                Supabase Storage
              </h3>

              <p>
                Stores the actual audio files in
                a private storage bucket.
              </p>

            </div>

            <div className="architecture-info-box">

              <h3>
                PostgreSQL
              </h3>

              <p>
                Stores filename, storage path,
                status, progress, transcript,
                summary, retry information,
                and error state.
              </p>

            </div>

          </div>

        </section>


        {/* ================================================= */}
        {/* 03 LONG AUDIO */}
        {/* ================================================= */}

        <section className="architecture-card">

          <div className="architecture-number">
            03
          </div>

          <h2>
            Handling Long Audio
          </h2>

          <p className="architecture-description">
            The API does not wait for transcription and
            summarization to finish.
          </p>

          <div className="architecture-info-box">

            <h3>
              Background processing
            </h3>

            <p>
              After the upload completes, the worker
              creates a temporary signed URL for the
              private audio file and submits it to
              Gnani Batch STT. The worker polls the
              transcription job and stores the result
              in PostgreSQL before generating the AI
              summary.
            </p>

          </div>

        </section>


        {/* ================================================= */}
        {/* 04 SYNC VS BACKGROUND */}
        {/* ================================================= */}

        <section className="architecture-card">

          <div className="architecture-number">
            04
          </div>

          <h2>
            Sync vs Background Work
          </h2>

          <div className="architecture-two-column">

            <div className="architecture-info-box">

              <h3>
                Synchronous
              </h3>

              <p>
                Upload validation, temporary file
                creation, storage upload, and creation
                of the database record happen during
                the API request.
              </p>

            </div>

            <div className="architecture-info-box">

              <h3>
                Background
              </h3>

              <p>
                Gnani transcription, polling, transcript
                retrieval, Gemini summarization, retries,
                and failure recovery run in the worker.
              </p>

            </div>

          </div>

        </section>


        {/* ================================================= */}
        {/* 05 FAILURE HANDLING */}
        {/* ================================================= */}

        <section className="architecture-card">

          <div className="architecture-number">
            05
          </div>

          <h2>
            Failure Handling
          </h2>

          <p className="architecture-description">
            Provider failures are handled without exposing
            raw API responses to the user.
          </p>

          <div className="architecture-list">

            <div>
              <strong>
                Upload failure
              </strong>

              <span>
                The API returns a clean user-facing
                upload error.
              </span>
            </div>

            <div>
              <strong>
                Gnani failure
              </strong>

              <span>
                The failed provider job is discarded,
                and bounded retries can create a fresh
                Gnani job.
              </span>
            </div>

            <div>
              <strong>
                Gemini failure
              </strong>

              <span>
                The transcript is preserved while the
                summary is retried separately.
              </span>
            </div>

            <div>
              <strong>
                Retry scheduling
              </strong>

              <span>
                Retry delays are stored in PostgreSQL so
                one failed job does not block newer uploads.
              </span>
            </div>

          </div>

        </section>


        {/* ================================================= */}
        {/* 06 PROCESSING STATES */}
        {/* ================================================= */}

        <section className="architecture-card">

          <div className="architecture-number">
            06
          </div>

          <h2>
            Processing States
          </h2>

          <div className="state-flow">

            <span>
              Uploaded
            </span>

            <b>→</b>

            <span>
              Processing
            </span>

            <b>→</b>

            <span>
              Transcribed
            </span>

            <b>→</b>

            <span>
              Completed
            </span>

          </div>

          <p className="architecture-description">
            If transcription or summarization fails,
            the corresponding error is stored and the
            user can retry from the recording page.
          </p>

        </section>


        {/* ================================================= */}
        {/* 07 TRADEOFFS */}
        {/* ================================================= */}

        <section className="architecture-card">

          <div className="architecture-number">
            07
          </div>

          <h2>
            Design Tradeoffs
          </h2>

          <div className="architecture-list">

            <div>
              <strong>
                Why a background worker?
              </strong>

              <span>
                Long-running external API calls should
                not keep an HTTP request open.
              </span>
            </div>

            <div>
              <strong>
                Why object storage?
              </strong>

              <span>
                Audio files are stored outside PostgreSQL,
                while PostgreSQL keeps only metadata and
                generated text.
              </span>
            </div>

            <div>
              <strong>
                Why persist retry state?
              </strong>

              <span>
                A worker restart should not cause repeated
                provider requests or lose retry progress.
              </span>
            </div>

          </div>

        </section>


        {/* ================================================= */}
        {/* GITHUB */}
        {/* ================================================= */}

        <section className="architecture-card architecture-github-card">

          <div>

            <div className="architecture-number">
              PROJECT
            </div>

            <h2>
              Source Code
            </h2>

            <p>
              The complete implementation and setup
              instructions are available in the GitHub
              repository.
            </p>

          </div>

          <a
            href="https://github.com/your-username/your-repository"
            target="_blank"
            rel="noreferrer"
            className="architecture-github"
          >
            View GitHub Repository →
          </a>

        </section>

      </div>

    </section>
  );
}