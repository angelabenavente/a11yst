import Link from "next/link";
import { FocusHeading } from "../../components/FocusHeading";

export default function AccessibleHomePage() {
  return (
    <main>
      <FocusHeading>Accessible home</FocusHeading>
      <p>Client-side navigation moves focus to the destination page heading.</p>
      <nav aria-label="Primary">
        <Link href="/accessible">Home</Link>
        {" · "}
        <Link href="/accessible/about">About</Link>
      </nav>
    </main>
  );
}
