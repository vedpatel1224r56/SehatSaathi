# Pilot QR Code Checklist

## Blocker
The final patient app URL is required before generating the QR code.

Use the deployed patient URL, not localhost. Example:

```text
https://app.yourdomain.com
```

## Generate
After the URL is live, generate a high-resolution QR image and place it at:

```text
docs/marketing/assets/pilot-patient-qr.png
```

Suggested command:

```bash
npx qrcode "https://app.yourdomain.com" --output docs/marketing/assets/pilot-patient-qr.png --width 1200
```

## Print Check
- Scan the QR from a printed page.
- Confirm it opens the patient landing page on mobile data.
- Confirm signup, consent, and report upload all work from the QR path.
- Replace all poster and brochure placeholders before printing.
