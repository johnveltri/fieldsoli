import type { Metadata } from "next";
import { publicPageMetadata } from "../../lib/search-metadata";
import Link from "next/link";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  ...publicPageMetadata("/support"),
  title: "Support",
  description: "Get help using FieldSoli, managing your account, or requesting account deletion.",
};

export default function SupportPage() {
  return (
    <main className={styles.page}>
      <article className={styles.policy}>
        <Link className={styles.back} href="/">
          ← Back to FieldSoli
        </Link>

        <h1>FieldSoli support</h1>
        <p>
          FieldSoli is built for the field. If you need help with the app, account access, or a
          job record, email <a href="mailto:support@fieldsoli.com">support@fieldsoli.com</a>.
          Include the email address on your account and a short description of what happened so we
          can look into it.
        </p>
        <p>
          Support requests are reviewed in the order received. We will reply to the email address
          you use and ask for more detail if we need it.
        </p>

        <h2>Common help</h2>
        <ul>
          <li>
            <strong>Job records:</strong> Start a session when work begins, then add materials,
            notes, revenue, and payment as you have them.
          </li>
          <li>
            <strong>Earnings:</strong> Earnings depend on the time, materials, revenue, and payment
            information entered for each job.
          </li>
          <li>
            <strong>Account access:</strong> Email support from the address associated with your
            FieldSoli account.
          </li>
        </ul>

        <h2>Privacy and account deletion</h2>
        <p>
          For privacy questions, use <a href="mailto:privacy@fieldsoli.com">privacy@fieldsoli.com</a>.
          To permanently delete an account, follow the instructions on the <Link href="/delete-account">Delete account</Link>
          {" "}page. Account deletion cannot be undone.
        </p>
        <p>
          The <Link href="/privacy">Privacy Policy</Link> explains what we collect and how account
          deletion, retention, and privacy choices work.
        </p>
      </article>
    </main>
  );
}
