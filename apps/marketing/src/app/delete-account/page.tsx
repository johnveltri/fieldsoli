import type { Metadata } from "next";
import Link from "next/link";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Delete Account",
  description: "How to request deletion of your FieldSoli account.",
};

export default function DeleteAccountPage() {
  return (
    <main className={styles.page}>
      <article className={styles.policy}>
        <Link className={styles.back} href="/">
          ← Back to FieldSoli
        </Link>

        <h1>Delete your FieldSoli account</h1>
        <p>
          You can request permanent deletion of your FieldSoli account from the mobile app. If you
          cannot access the app, you can request deletion by email.
        </p>

        <h2>Delete your account in the app</h2>
        <ol>
          <li>Sign in to your FieldSoli account.</li>
          <li>Open <strong>Account</strong>.</li>
          <li>Open <strong>Privacy Choices</strong> under Help &amp; Privacy.</li>
          <li>Select <strong>Delete Account</strong> below Legal.</li>
          <li>
            Type <strong>delete account</strong> when prompted and continue.
          </li>
          <li>Confirm the final deletion prompt.</li>
        </ol>
        <p>
          Account deletion cannot be undone. Before deleting your account, save any records you
          need for taxes, customer matters, licensing, insurance, disputes, or other business
          purposes.
        </p>

        <h2>If you cannot access the app</h2>
        <p>
          Email <a href="mailto:privacy@fieldsoli.com">privacy@fieldsoli.com</a> from the email
          address associated with your account. Use <strong>Account deletion request</strong> as
          the subject. We may verify that you control the account before completing the request.
        </p>

        <h2>Deletion details and governing terms</h2>
        <p>
          The <Link href="/privacy">Privacy Policy</Link> is the source of truth for what account
          deletion removes, deletion timing, backup handling, limited retention, and your privacy
          choices and rights.
        </p>
        <p>
          The <Link href="/terms">Terms of Service</Link> is the source of truth for the effect of
          account termination, loss of access to User Content, and obligations that may survive
          termination.
        </p>

        <h2>Waitlist deletion</h2>
        <p>
          To remove a waitlist record, email <a href="mailto:privacy@fieldsoli.com">privacy@fieldsoli.com</a>
          {" "}from the address used to join the waitlist. The Privacy Policy explains how waitlist
          deletion and marketing choices are handled.
        </p>
      </article>
    </main>
  );
}
