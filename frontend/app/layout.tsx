import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Audio Notes",
  description:
    "Turn audio recordings into transcripts and summaries.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">

          <aside className="sidebar">

            <div className="sidebar-brand">
              <h1>Audio Notes</h1>
              <p>AI-powered notes</p>
            </div>

            <nav className="sidebar-nav">
              <Link href="/">
                Upload
              </Link>

              <Link href="/history">
                History
              </Link>

              <Link href="/architecture">
                Architecture
              </Link>
            </nav>

            <div className="sidebar-footer">
              <p>
                Audio → Transcript → Summary
              </p>
            </div>

          </aside>

          <main className="main-content">
            {children}
          </main>

        </div>
      </body>
    </html>
  );
}