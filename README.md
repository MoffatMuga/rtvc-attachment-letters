# RTVC Attachment Letters

Trainees request an industrial attachment letter. The ILO approves, and the system emails the PDF to the trainee, sends a copy plus the updated Excel log to the ILO.

Built with Next.js, Tailwind and Node.js API routes (no separate Express server needed).

## Run it on your computer

1. Install Node.js 20 or newer.
2. In this folder: `npm install`
3. Copy `.env.example` to `.env.local` and fill it in (at least `ADMIN_PASSWORD` and `AUTH_SECRET`).
4. `npm run dev`, then open http://localhost:3000

While `SMTP_HOST` is empty, emails are saved into the `outbox` folder instead of being sent, so you can test safely.

## Pages

- `/` trainee form (section, cycle, level and module lists only offer valid choices; the server checks again)
- `/admin` ILO sign in, pending/approved/rejected lists, preview, approve, reject, Excel log download
- `/admin/settings` upload your stamp and signature, position the date, and open a test letter

## Stamp and signature

Scan or photograph the stamp on plain white paper with the **date box empty**. The white is removed automatically, and the current date is printed into the date box on every letter. Use the sliders to line the date up, save, then open a test letter.

## Adding courses, sections, cycles and modules

Everything lives in `lib/rules.json`. `lib/rules.example.json` shows ready-to-copy blocks for Civil Engineering (Building Technology, Plumbing), Hospitality (Food and Beverage, Cosmetology) and a course without sections.

**A course with no sections** (Electrical Engineering, Liberal Studies): put `cycles` straight inside the course. `option` is the text printed in brackets on the letter (e.g. "power option"). Use `""` or leave it out when the course has none. If you copy a block from another course, change or clear `option`.

**A department with sections**: use `sections`, each with its own `cycles`. The form then shows a Section dropdown and the letter prints "Civil Engineering (Plumbing)".

```json
"Civil Engineering": {
  "sections": {
    "Building Technology": {
      "cycles": { "3": { "levels": {
        "4": { "attachment_modules": { "2": { "units": ["Unit A", "Unit B"] } } }
      } } }
    },
    "Plumbing": {
      "cycles": { "3": { "levels": {
        "4": { "attachment_modules": { "2": { "units": ["Unit X", "Unit Y"] } } }
      } } }
    }
  }
}
```

Use `"same_as": ["5", "5"]` (level, module) to reuse another level's unit list inside the same section. Mind the commas between entries. Restart the app after editing.

## Cycles with no modules (e.g. cycle 2)

For a cycle where trainees are not split into modules, give each level a plain `units` list instead of `attachment_modules`. The form then hides the Module box for that level, and the letter lists those units.

```json
"2": { "levels": {
  "4": { "units": ["Unit A", "Unit B"] },
  "5": { "units": ["Unit A", "Unit B", "Unit C"] }
} }
```

An empty list (`"units": []`) prints the letter without the "areas of skills" list. Cycle 3 style levels (with `attachment_modules`) keep working as before, and one course can have both.

## NITA form

In `/admin/settings`, upload the NITA form as a PDF (up to 4 MB). It is emailed to every trainee together with their attachment letter. If no form is uploaded, only the letter is sent. You can view, replace or remove it at any time. Your own copy of each approval still contains the letter and the Excel log.

## SMS (optional)

After a letter is emailed, the trainee can also get a short SMS ("... has been sent to your email. Check Inbox/Spam."). It uses Africa's Talking and is off until you fill `AT_USERNAME` and `AT_API_KEY` in `.env.local`.

- `AT_USERNAME=sandbox` is a test mode: it accepts the call but does not deliver to real phones.
- Real SMS needs a live Africa's Talking account with airtime credit. Messages cost a small amount each.
- A failed SMS never stops the email or the approval. The admin page tells you if the SMS could not be sent.

## Email with Gmail

Create an App Password (Google Account > Security > 2-Step Verification > App passwords) and put it in `SMTP_PASS`. Use `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`.

## Hosting

The app stores data in a database file (`data/app.db`). Hosts with a persistent disk (a small VPS, Railway, Render with a disk) work as is. On hosts without a disk, such as Vercel, create a free Turso database and set `DATABASE_URL` and `DATABASE_AUTH_TOKEN`; no code changes are needed.

## Not included yet

- WhatsApp sending (email only for now)

## Cycle 2 (no modules)

Cycle 2 has levels only, no modules. In `lib/rules.json` a cycle 2 level holds `units` directly (no `attachment_modules`), and the form hides the Module box for it:

```json
"2": { "levels": { "4": { "units": ["Skill A", "Skill B"] }, "5": { "units": [] } } }
```

To add cycle 2 to every course and section at once, run `node scripts/add-cycle2.mjs --dry-run` to preview, then `node scripts/add-cycle2.mjs` (a backup of your file is kept). It copies the level numbers from cycle 3 and leaves each `units` list empty; fill them in afterwards. An empty list prints the letter without the skills list. Restart the app after editing.

## Trainee accounts, assessors and placements

- When you approve a letter, the trainee automatically gets an account. Trainees approved earlier get one the first time they log in (or when you open Trainees and assessors).
- Trainees log in at `/trainee` with the email they used for the request. They get a 6-digit one-time code by email (valid 10 minutes, 5 tries, 5 codes per hour). No passwords.
- On their page trainees see their assessor (or "Not assigned yet"), re-download their letters, and fill in their firm: name, town/county, address, firm phone, department, supervisor name/title/phone/email and start and end dates. They tick a short data notice the first time they save.
- You manage assessors and assignments at `/admin/trainees`: add assessors, pick one for each trainee (the trainee is emailed), search and filter ("no assessor yet", "no firm details yet"), and download an Excel of all placements.
- Removing an assessor puts their trainees back to "Not assigned".
- Your database gets the new tables automatically on first use. Nothing to migrate.
- The login code email uses the same email settings as the letters (SMTP). Make sure `APP_URL` is your live address so links in emails are right.

## WhatsApp contact button

Set `ILO_WHATSAPP=2547XXXXXXXX` (country code, digits only, no plus) in `.env.local` and on Vercel. Trainees then see a "Contact the ILO on WhatsApp" button on their page. It opens a chat with you with a ready message containing their name and admission number. With the setting empty, the button is hidden.

## Chat button (home page)

Set your WhatsApp number in **ILO sign-in, then Settings, then WhatsApp number**. No redeploy needed. (The `ILO_WHATSAPP` environment setting still works as a fallback.)


A floating green chat button appears on the home page when `ILO_WHATSAPP` is set. The trainee picks a topic, types a message and taps Send; WhatsApp opens with the message ready for your number, and they press send there. (Messages can't be pushed into WhatsApp silently: that needs the paid WhatsApp Business API.) It pulses and wiggles gently, and the animation switches off for people who set "reduce motion".

## Logo and browser tab icon

1. Copy your logo into the project as `public/assets/logo.png` (replace the old one). From WSL: `cp "/mnt/c/Users/USER/Downloads/YOURFILE.png" public/assets/logo.png`
2. Run `node scripts/make-favicon.mjs` to make the tab icon (`app/icon.png`) from it.
3. Restart the app. The letter PDF keeps its own built-in logo.

## Security rules

- One email belongs to one admission number, and one admission number to one email. Gmail dots and `+tags` are treated as the same mailbox (`a.b+x@gmail.com` = `ab@gmail.com`). Rejected requests do not count, so a trainee who typed a wrong email can be rejected and try again.
- A trainee can't request the same approved cycle/level again (they download it from their account), and only one pending request per admission number is allowed.
- Temporary-email domains are refused, and the part after the @ must exist (catches `gmial.com`). If DNS can't be checked, nobody is blocked.
- Limits (stored in the database): 60 requests per hour per network, 6 per hour per email, 60 login-code requests per hour per network, and the ILO sign-in locks for 15 minutes after 10 wrong passwords.
- Security headers are sent on every page (no framing, no content sniffing, HTTPS only).
- Old data that already contains duplicates won't stop the app. The database-level unique rule on trainee emails is skipped in that case (it is logged), and the checks above still protect new requests. Fix the old duplicates by hand when convenient.

## Text in brackets on the letter

The letter prints the course name, then optional bracket text, e.g. "Building Technology (Masonry) Level 4". The bracket text comes from, in this order:

1. The level's own `"option"`, e.g. `"4": { "option": "Masonry", "attachment_modules": { ... } }`. Use `"option": ""` to force no brackets for that level.
2. Otherwise the section name, unless it is the same as the course name (so a section called "Building Technology" inside the course "Building Technology" prints no brackets).
3. Otherwise the course's `"option"` (e.g. "power option").

## Feedback

After a trainee submits a request they can rate the experience (1 to 5 stars, optional comment). Read the results in the ILO area under **Feedback**.

## Insurance letters
ILO > Insurance. Upload the insurer's zip; it is unzipped in the browser (Vercel limits requests to 4.5 MB), files are matched to trainees by admission number or name in the file name, and you can fix any match by hand. Each file (PDF/JPG/PNG, up to 4 MB) is stored per trainee. Trainees download theirs from their account; until then it says "Not uploaded yet". Uploading again replaces the old file. Needs `npm install jszip`.
