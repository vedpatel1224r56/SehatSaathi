# Pilot Support Playbook

Date: 2026-05-05

## Scope

This playbook covers the first-line pilot support paths for:

- upload failed
- extraction unclear
- report partially read
- user confusion about summary
- ABHA fetch issue

## 1. Upload failed

What to ask for:

- screenshot of the error
- file type (`PDF`, image)
- whether the same file opens on the phone

What to tell the user:

- try one clear PDF or one sharp image only
- avoid blurry photos or multi-photo uploads for the first retry
- if it still fails, send the file name and screenshot through support

Support resolution:

- confirm whether the file was stored
- if not stored, ask user to retry once
- if stored but not visible, investigate record ownership and upload path

## 2. Extraction unclear

What to ask for:

- which values look wrong
- screenshot of the original report area
- whether the report was scan/photo/PDF

What to tell the user:

- review the original report before acting on the summary
- use manual value review if needed
- consult a doctor if the report is clinically important and still unclear

Support resolution:

- confirm `qualityGate`
- confirm extracted text exists
- compare extracted metric values against the original report

## 3. Report partially read

What to ask for:

- which section is missing
- whether the report is multi-page
- whether one page is low quality

What to tell the user:

- part of the report may need manual review
- upload a clearer copy if available
- use the original report during follow-up until the values are confirmed

Support resolution:

- check detected sections
- check rejected metrics
- confirm whether a cleaner re-upload is needed

## 4. User confusion about summary

What to ask for:

- which line feels confusing
- whether the original report says something different
- whether the concern is about urgency, meaning, or next step

What to tell the user:

- SehatSaathi is follow-up support, not a diagnosis
- the original lab report remains the source record
- doctor review is safer if the meaning still feels unclear

Support resolution:

- map the confusion to:
  - summary wording
  - wrong extraction
  - wrong grouping
  - expected caution mode

## 5. ABHA fetch issue

What to ask for:

- ABHA number or ABHA address used
- screenshot of the status shown
- whether the issue is fetch, verification, or mismatch

What to tell the user:

- ABHA fetch helps fill profile details when available
- it does not replace the original ABHA record
- if live fetch is unavailable, the profile can still be completed manually

Support resolution:

- confirm format validity
- confirm whether ABDM live fetch is configured
- confirm whether verification is pending or rejected

## Escalation Rule

Escalate to clinician guidance immediately if:

- the patient says symptoms feel severe
- the report is being used for an urgent medical decision
- the patient wants medicine advice
- the app summary and the original report appear materially inconsistent

## Support Close Condition

Close only when:

- the user knows the next action
- the correct report/account context is confirmed
- the issue is either resolved or clearly handed off to clinician/manual review

