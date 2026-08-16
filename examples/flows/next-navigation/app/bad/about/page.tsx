import Link from "next/link";

export default function BadAboutPage() {
  return (
    <main>
      <h1>Bad navigation about</h1>
      <p>Focus incorrectly remains on the navigation link that triggered this route change.</p>
      <nav aria-label="Primary">
        <Link href="/bad">Home</Link>
        {" · "}
        <Link href="/bad/about">About</Link>
      </nav>
    </main>
  );
}
