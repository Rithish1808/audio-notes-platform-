# 🎙️ Audio Notes Platform

> Upload an audio recording → get a transcript → get an AI-generated summary.

A full-stack audio processing platform built with **Next.js, FastAPI, PostgreSQL, Supabase Storage, Gnani ASR, and Google Gemini**.

---

## ✨ Features

- 🎵 Upload audio recordings
- 🎙️ Speech-to-text using Gnani ASR
- 🤖 AI-generated summaries using Google Gemini
- ⚡ Background processing for longer recordings
- 📊 Processing progress tracking
- 📚 Upload history and reopenable recordings
- 🔁 Retry failed processing
- 🛡️ Clear error handling
- 🔐 Private audio storage
- 🏗️ Dedicated `/architecture` page

---

> ⚠️ **Current Access Model:** Authentication is not implemented yet. Currently, all uploaded audio recordings and their transcripts/summaries are visible to every user of the application. User-specific access control and authentication are planned as future improvements.


## 🌐 Live Demo

**[Open Audio Notes Platform](https://audio-notes-platform-psi.vercel.app/)**

**[GitHub Repository](https://github.com/Rithish1808/audio-notes-platform-)**

---

## 🏗️ Architecture

```text
User
 │
 ▼
Next.js Frontend
 │
 │ POST /upload
 ▼
FastAPI Backend
 │
 ├──► Supabase Storage
 │       └── Audio File
 │
 └──► FastAPI Background Task
          │
          ▼
       Gnani ASR
          │
          ▼
       Transcript
          │
          ▼
     Google Gemini
          │
          ▼
      PostgreSQL
          │
          ▼
   Transcript + Summary
```

---

## 🔄 Processing Flow

1. User uploads an audio file.
2. FastAPI validates the upload and stores it in private Supabase Storage.
3. A background task starts processing.
4. Gnani ASR transcribes the recording.
5. The transcript is stored in PostgreSQL.
6. Google Gemini generates the summary.
7. The transcript and summary are displayed to the user.

---

## 🎵 Supported Audio

The application accepts uploads whose MIME type starts with `audio/`.

### Formats verified during development

- MP3 (`.mp3`)
- M4A (`.m4a`)

### Gnani STT formats

Gnani's STT REST interface supports:

- WAV (`.wav`)
- MP3 (`.mp3`)
- FLAC (`.flac`)
- OGG (`.ogg`)
- M4A (`.m4a`)

The application is designed to comfortably handle recordings of **2 minutes or longer** using background processing.

---

## 🌐 Supported Languages

### Current Application Configuration

- English (`en-IN`)
- Hindi (`hi-IN`)

### Gnani STT Languages

Gnani Prisma supports:

- English
- Hindi
- Tamil
- Telugu
- Malayalam
- Kannada
- Odia
- Marathi
- Punjabi
- Gujarati
- Bengali
- Assamese

Additional Gnani-supported languages can be enabled by changing the application's transcription configuration.

---

## 🧠 AI Summarization

The Gemini prompt is designed to:

- Use only information present in the transcript
- Avoid hallucinating or inventing details
- Ignore filler and obvious transcription noise
- Preserve important names, dates, numbers, and technical terms
- Scale the summary according to the amount of useful information
- Avoid forcing a fixed number of bullet points
- Include action items only when they are actually present
- Omit irrelevant sections

### Adaptive Summary

```text
Short transcript
      ↓
Short summary

Medium transcript
      ↓
Moderate summary

Long / information-dense transcript
      ↓
More detailed summary
```

---

## 📊 Processing States

```text
uploaded
    │
    ▼
processing
    │
    ▼
transcribed
    │
    ▼
completed
```

A job can also enter:

```text
failed
```

If transcription succeeds but Gemini fails, the transcript is preserved and the user can retry summary generation without retranscribing the audio.

---

## ⚡ Progress Tracking

The application stores progress in PostgreSQL and periodically updates the frontend.

```text
0%   → Processing begins
10%  → Gnani job created
20%  → Gnani job started
...  → Gnani transcription progress
80%  → Transcript ready
90%  → Gemini summary generation
100% → Completed
```

---

## 🛡️ Error Handling

The application handles:

- Invalid audio uploads
- Storage failures
- Gnani API failures
- Rate limiting
- Transcription failures
- Gemini failures
- Temporary service unavailability
- Processing errors

Users receive readable error messages instead of raw API errors.

---

## 🛠️ Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- React Markdown
- CSS

### Backend

- Python
- FastAPI
- SQLAlchemy
- Uvicorn
- Requests

### Database & Storage

- PostgreSQL
- Supabase
- Supabase Storage

### AI

- Gnani ASR
- Google Gemini

### Deployment

- Vercel
- Render
- Supabase

---

## 📁 Project Structure

```text
audio-notes-platform/
├── backend/
│   ├── main.py
│   ├── worker.py
│   ├── database.py
│   ├── models.py
│   ├── storage.py
│   ├── gnani_service.py
│   ├── gemini_service.py
│   └── error.py
│
├── frontend/
│   ├── app/
│   └── ...
│
└── README.md
```

---

## ⚙️ Local Setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:3000
```

Backend:

```text
http://127.0.0.1:8000
```

Swagger:

```text
http://127.0.0.1:8000/docs
```

### Environment Variables

Backend:

```env
DATABASE_URL=your_database_url
SUPABASE_URL=your_supabase_url
SUPABASE_SECRET_KEY=your_supabase_secret_key
GNANI_API_KEY=your_gnani_api_key
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=http://localhost:3000
```

Frontend:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

> Never commit API keys or other secrets.

---

## ⚖️ Architecture Decision

The project uses **FastAPI BackgroundTasks** instead of a separate worker service.

This keeps the deployment simple while allowing transcription and summarization to run outside the initial upload request.

For a larger production system, this could be replaced with a dedicated job queue and worker architecture.

---

## 🔮 Future Improvements

- Dedicated job queue and worker service
- More durable retry scheduling
- Real-time progress updates
- Language selection in the UI
- User authentication
- User-specific recording libraries
- Structured logging and monitoring
- Higher-throughput processing

---

## 📋 Assignment Requirements

- ✅ Audio upload
- ✅ 2+ minute audio processing
- ✅ Gnani ASR transcription
- ✅ LLM-generated summary
- ✅ Past uploads
- ✅ Reopenable recordings
- ✅ Next.js frontend
- ✅ FastAPI backend
- ✅ PostgreSQL
- ✅ Storage bucket
- ✅ Background processing
- ✅ Public deployment
- ✅ `/architecture` page
- ✅ Progress indication
- ✅ Visible failure handling
- ✅ Retry support

---

## 👨‍💻 Author

**Rithish Nandan Reddy**  
IIT (BHU) Varanasi

---

⭐ Built for the Audio Notes Platform Take-Home Assessment.