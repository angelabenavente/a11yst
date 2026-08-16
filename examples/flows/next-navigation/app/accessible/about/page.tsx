import Link from "next/link";
import { FocusHeading } from "../../../components/FocusHeading";

export default function AccessibleAboutPage() {
  return (
    <main>
      <FocusHeading>Accessible about</FocusHeading>
      <p>Focus should land on this heading after navigating from home.</p>
      <nav aria-label="Primary">
        <Link href="/accessible">Home</Link>
        {" · "}
        <Link href="/accessible/about">About</Link>
      </nav>
    </main>
  );
}
