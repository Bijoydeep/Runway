# Runway — LinkedIn PDF → Resume PDF

Turns a LinkedIn "Save to PDF" export into a polished one-page resume, aimed
at college students and new grads. Email OTP login, AI-structured drafting,
editable review step, downloadable PDF.

```
resume-builder/
├── backend/          Express API: auth (email OTP), PDF parsing, AI structuring, PDF generation
│   ├── server.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── resume.js
│   ├── services/
│   │   ├── otpStore.js      in-memory OTP codes (swap for Redis/DB in production)
│   │   ├── emailService.js  sends the OTP by email via nodemailer
│   │   ├── aiService.js     calls AI to structure resume JSON
│   │   └── pdfService.js    renders the final resume PDF
│   ├── middleware/auth.js   JWT check for protected routes
│   ├── package.json
│   └── .env.example
└── frontend/         Static site: plain HTML/CSS/JS, no build step
    ├── index.html
    ├── css/style.css
    └── js/app.js
```

## Running it locally

**1. Backend**

```bash
cd backend
cp .env.example .env
# edit .env: set JWT_SECRET, ANTHROPIC_API_KEY, and real SMTP_* credentials
npm install
npm run dev   # or: npm start
```

The API listens on `http://localhost:4000` by default.

For `SMTP_*`, any provider works — a Gmail account with an
[app password](https://myaccount.google.com/apppasswords), or a transactional
provider like Postmark, Resend, or SendGrid's SMTP endpoint. Without valid
SMTP credentials, `/api/auth/request-otp` will fail — check the backend logs.

For `ANTHROPIC_API_KEY`, create a key at
[console.anthropic.com](https://console.anthropic.com/settings/keys).

**2. Frontend**

The frontend is static — no build step. Serve it with any static server, e.g.:

```bash
cd frontend
npx serve .        # or: python3 -m http.server 5173
```

Open the served URL in your browser. If your backend isn't on
`http://localhost:4000/api`, set the base URL before `app.js` loads by adding
this to `index.html`:

```html
<script>window.RUNWAY_API_BASE = "https://your-api.example.com/api";</script>
<script src="js/app.js"></script>
```

Also update `CORS_ORIGIN` in the backend's `.env` to match wherever the
frontend is served from.

## How the flow works

1. **Sign in** — user enters their email, backend generates a 6-digit code,
   stores it (10 min expiry) and emails it. User enters the code, backend
   verifies it and issues a JWT used for all further requests.
2. **Upload** — user drops their LinkedIn PDF. It's sent to
   `POST /api/resume/parse`, which extracts the text (`pdf-parse`) and asks
   AI to restructure it into resume JSON tuned for students/new grads.
3. **Review & edit** — every field is editable client-side before anything
   is turned into a PDF.
4. **Download** — the (possibly edited) resume JSON is sent to
   `POST /api/resume/pdf`, which renders it with `pdfkit` and streams back a
   PDF file.

## Before deploying this for real

- Swap the in-memory OTP store (`services/otpStore.js`) for Redis or a
  database table if you'll run more than one backend instance.
- Put the backend behind HTTPS and set a strict `CORS_ORIGIN`.
- Consider persisting users/resumes in a real database (Postgres, MongoDB,
  etc.) if you want resume history — right now nothing is stored beyond the
  current session.
- Add logging/monitoring and a proper rate limit tier in front of the OTP and
  AI endpoints to control abuse and cost.
