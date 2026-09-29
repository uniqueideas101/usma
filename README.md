USMA — Unified Scholarship Mobile Application

Smart India Hackathon 2026 · Problem Statement SIH26238 Ministry of Tribal Affairs, Government of India

Overview

USMA (Unified Scholarship Mobile Application) is a mobile-first prototype that consolidates access to all five Ministry of Tribal Affairs (MoTA) scholarship schemes for Scheduled Tribe (ST) students into a single platform. It addresses the core problem of scholarship delivery being fragmented across multiple disconnected systems — the National Scholarship Portal (NSP), the Scholarship Fellowship Management Portal (SFMP), and the standalone NOS Portal — which currently forces students to track applications, verification stages, and disbursements separately with no unified view.

Problem Statement Summary

MoTA administers five scholarship schemes for ST students:

Pre-Matric Scholarship
Post-Matric Scholarship
Top Class Scholarship
National Fellowship for ST Students (NFST)
National Overseas Scholarship (NOS)

Students currently face repetitive documentation, disconnected tracking, and limited visibility into verification and disbursement status. The problem statement calls for a unified, mobile-first Scholarship Module supported by a digital verification layer and an integrated chatbot (JAGO) to reduce friction and improve transparency in scholarship access.

Key Features
1. Unified Scholarship Dashboard

A single view across all five schemes showing application status, verification stage, and disbursement progress for the logged-in student.

2. Explainable Eligibility Engine

Rather than a binary eligible/ineligible result, the system evaluates each eligibility criterion individually (community category, income ceiling, education level, institution type, document completeness) and presents a clear pass/fail breakdown with plain-language reasoning. Where a student does not qualify for a selected scheme, the system suggests alternate schemes they may be eligible for instead.

3. Application Tracker

A stage-by-stage tracker visualizing progression through Draft, Submitted, Institute Verified, State Approved, Sanctioned, and Disbursed stages, including mock disbursement details (transaction ID, amount, date) once sanctioned.

4. One-Scheme-at-a-Time Safeguard

In line with the constraint that a student may avail only one scholarship or fellowship scheme at a time, the system flags active applications and warns students before they initiate a new one.

5. Smart Drop-off Nudges

An automated monitoring layer that detects applications stalled at a given stage beyond a defined threshold and surfaces proactive reminders to students, reducing application drop-off and improving completion rates.

6. Digital Document Wallet (Mocked)

A reusable document store reflecting the intended DigiLocker-based verification model, reducing the need for repeated document submission across schemes.

7. Automated Verification Layer (Mocked)

A simulated pre-verification layer illustrating how identity, academic, and institutional data could be automatically cross-checked against external sources (DigiLocker, AISHE, UDISE+, APAAR) prior to manual officer review, with exceptions routed for human verification.

8. JAGO Chatbot (Mocked)

A lightweight in-app assistant providing student-specific responses on application status, required documents, and disbursement timelines, reflecting the chatbot integration described in the problem statement.

9. Verification Officer Console

An interface for institute-level officers to review applications, view submitted documents and automated verification results, and approve, request correction on, or reject applications.

10. MoTA Admin Dashboard

A national-level overview showing total applications, scheme-wise distribution, stage-wise breakdown, nudge activity, and an indicative coverage-gap metric for ST students not currently availing any scholarship.

Tech Stack
Frontend: React (Vite)
Styling: Tailwind CSS
Icons: Lucide React
Charts: Recharts
Routing: React Router
Data: Mocked in-memory/local dataset (no live backend integrations in this prototype)
Project Status

This is a prototype built for hackathon evaluation purposes. It does not connect to live government systems (DigiLocker, AISHE, UDISE+, APAAR, UIDAI, NSP, SFMP, or NOS). All verification, disbursement, and coverage-gap data shown in the application are simulated using mock datasets to demonstrate the intended user experience and system architecture.

Team

Built by Bugwiserz for Smart India Hackathon 2026, under Problem Statement SIH26238, Ministry of Tribal Affairs.

Disclaimer

This is a student-built prototype developed for hackathon evaluation. It is not an official Ministry of Tribal Affairs product, is not connected to any live government database, and should not be used to make real eligibility, verification, or disbursement decisions.