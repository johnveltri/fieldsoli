# FieldSoli

### Was this job worth it?

**FieldSoli** is a mobile-first job record and earnings intelligence app for independent tradespeople.

Not invoicing software.  
Not field service management.  
Not accounting software.

**FieldSoli is a job receipt layer.**

It helps solo operators turn every job into a trusted financial record so they can understand what they earned, what they’re owed, and which jobs are actually worth doing.

---

## What is FieldSoli?

Think of FieldSoli as a **digital field notebook** built around the economic unit that matters most:

**The Job.**

Every job becomes a record that can capture:

- Time worked  
- Revenue billed  
- Materials used  
- Payment status  
- Notes and field evidence  
- Profitability signals  

**Log the job. Know what it was worth.**

---

## The Problem

Independent tradespeople often manage jobs across:

- Notes apps  
- Photos  
- Text threads  
- Calendar entries  
- Invoices  
- Spreadsheets  
- Memory

That creates fragmented records and makes basic questions hard to answer:

- How much did I actually earn today?
- Which jobs make me money?
- What work is still unpaid?
- What is my real hourly rate?
- Was that last customer worth taking again?

Many can tell you what they billed.

Far fewer can tell you what they netted.

FieldSoli exists to solve that.

---

# Start With the Job, Not the Invoice

Most software starts with:

- Scheduling  
- Dispatching  
- CRM  
- Invoicing  
- Team operations  

FieldSoli starts somewhere else:

**the job itself.**

| Most Tools Start With | FieldSoli Starts With |
|-----------------------|------------------------|
| Scheduling            | The Job                |
| Invoicing             | Job Economics          |
| Managing Teams        | Solo Operator Workflow |
| Operations Software   | Earnings Truth         |

---

# Core Product Loop

```text
Perform Job
→ Capture Job Record
→ See Earnings Insight
→ Repeat
```

The goal is simple:

Become the **system of record for work performed.**

---

# MVP Focus (Phase 1: Reliable Job Capture)

Current focus is the **Job Receipt Layer**.

Core capabilities include:

## Job Capture
- Fast job logging
- Start/end live job sessions
- Manual or retroactive job creation
- Draft and incomplete job workflows

## Job Records
Each job can capture:

- Revenue
- Materials
- Time tracked
- Payment status
- Notes
- Attachments
- Job history

## Earnings Visibility
- Estimated job profit
- Net-per-hour visibility
- Unpaid job tracking
- Basic earnings rollups

## Field-Friendly Workflow
Built for:
- Quick taps
- Short interruptions
- Between-job usage
- End-of-day reconciliation
- Mobile-first use in the field

---

# Product Principles

FieldSoli is built around a few principles:

## Logging should be faster than remembering later
Capture in seconds.

## Designed for field work, not office work
Built for trucks, job sites, and in-between moments.

## Capture first, refine later
Partial entries now.
Complete details later.

## Every job becomes a trusted financial record
Not scattered notes.
One source of truth.

## Better than free alternatives
The bar is not enterprise software.

The bar is:

- Notes  
- Spreadsheets  
- Photos  
- Memory

---

# Free First Philosophy

FieldSoli is designed with a strong free foundation.

## Free includes
Core “capture truth” workflows:

- Unlimited job logging
- Job records
- Materials + notes tracking
- Basic profitability visibility
- Payment tracking
- Core exports
- System-of-record workflows

## Pro will focus on automating truth
Potential paid features may include:

- Advanced insights
- Benchmarking
- Automation
- AI-assisted capture
- Smarter recommendations
- Advanced reporting

## Teams may focus on shared truth
For larger operators over time:

- Multi-user collaboration
- Crew workflows
- Team visibility

**Free = Capture Truth**  
**Pro = Automate Truth**  
**Teams = Share Truth**

---

# Who It’s For

Built first for:

- Solo owner-operators
- Handymen
- Plumbers
- Electricians
- HVAC technicians
- Independent field service pros

Especially people running one-person businesses in the field.

---

# What FieldSoli Is Not

FieldSoli is not:

- Heavy field service software
- Dispatch software
- CRM for managing crews
- Accounting software
- Another invoicing-first tool

It starts with one thing:

**A trusted record for every job.**

---

# Long-Term Vision

FieldSoli starts as:

## 1. Job Receipt Layer
Capture a reliable financial record for every job.

## 2. Earnings Truth Layer
Turn job records into real earnings visibility.

## 3. Decision Intelligence Layer
Help users improve pricing, job selection, and profitability over time.

Move from:

**What happened on this job?**

to

**Which jobs should I take more of?**

---

# Tech Stack

Current stack:

- Expo / React Native
- TypeScript
- Supabase
- Postgres
- Tailwind / Native styling
- Figma design system

---

# Project Status

🚧 In Active Development

Current progress:

- [x] Product brief / PRD
- [x] Canonical data model
- [x] Interactive prototype
- [x] Auth + backend foundation
- [x] Job detail foundation
- [ ] Edit flows
- [ ] Live session workflows
- [ ] MVP beta

---

# Getting Started

```bash
git clone https://github.com/johnveltri/fieldsoli.git
cd fieldsolo
npm install
npm run mobile
```

## Rebrand Status (FieldSolo → FieldSoli)

Done: GitHub repo (`fieldsoli`), local `origin` remote, README product name, Supabase/PostHog
project display names, marketing site / domains / support email, Expo display name `FieldSoli`,
in-app copy and legal URLs (`fieldsoli.com` / `support@fieldsoli.com`).

Still confirm before store release:
- Supabase Auth → URL Configuration, branded email templates, **custom SMTP (Resend)** — checklist in [`backend/supabase/README.md`](backend/supabase/README.md#custom-smtp-production-auth-mail)
- Auth email smoke: confirmation + password reset from `noreply@fieldsoli.com` with FieldSoli HTML templates
- App Store / Play listings (name, support URL, privacy URL) when you create them
- Figma file/library display names (optional)

Keep technical ids unchanged unless intentionally migrating: EAS slug `fieldsolo`,
storage bucket `fieldsolo`, npm scope `@fieldsolo/*`.

App identity (pre-public TestFlight polish):
- iOS bundle ID / Android package: `com.veltriventures.fieldsoli`
- Deep link scheme: `fieldsoli`
- After creating the new App Store Connect app, replace `ascAppId` in
  `apps/mobile-expo/eas.json` with the new numeric app id.

Legal versions (`2026-09-20`) include customer phone/email, device-contact, address-suggestion, and Job Summary export disclosures. Deploy marketing `/privacy` and `/terms` before or with any mobile build that requires the new version so reacceptance links show the updated documents.

---

# Contributing

Currently a solo-built project, but feedback is welcome.

---

# License

TBD
