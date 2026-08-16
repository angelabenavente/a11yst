import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Framework Next.js example</h1>
      <nav aria-label="Primary">
        <Link href="/">Home</Link>
        {" · "}
        <Link href="/about">About</Link>
        {" · "}
        <Link href="/products/example">Example product</Link>
      </nav>
      <p>App Router routes are discovered from the filesystem.</p>
    </main>
  );
}
