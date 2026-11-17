"use client";

// Last-resort page if even the main layout breaks.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "20vh 16px" }}>
        <h1 style={{ fontSize: 28 }}>Something went wrong</h1>
        <p style={{ color: "#555" }}>Please try again in a moment.</p>
        <button onClick={reset} style={{ marginTop: 24, padding: "12px 32px", borderRadius: 999, background: "#171717", color: "#fff", border: 0, fontSize: 14 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
