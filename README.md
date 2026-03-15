# KnowBot Waitlist

Landing page + secure Vercel Edge API for collecting waitlist signups into Airtable.

## Project Structure

```
knowbot/
├── api/
│   └── waitlist.js       ← Vercel Edge Function (keeps token secret)
├── public/
│   └── index.html        ← Landing page
├── .env.example          ← Copy to .env.local with your secrets
├── vercel.json           ← Routing config
└── package.json
```

## Deploy in 5 Steps

### 1. Set up Airtable
1. Create a free account at airtable.com
2. New base → name it "KnowBot Waitlist"
3. Rename default table to `Signups`
4. Add fields:
   - `Email` → type: Email
   - `Source` → type: Single line text
   - `Signed Up` → type: Created time (auto-fills!)
5. Go to airtable.com/create/tokens → create a Personal Access Token
   - Scope: `data.records:write`
   - Access: your KnowBot Waitlist base
6. Copy the token (starts with `pat...`)
7. Copy your Base ID from the URL: `airtable.com/appXXXXXXXX/...`

### 2. Set up email notifications in Airtable
Automations → New automation → Trigger: "When record created" → Action: "Send email" → your address

### 3. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create knowbot-waitlist --public --push
```

### 4. Deploy to Vercel
```bash
npm i -g vercel
vercel
```
Follow the prompts — link to your GitHub repo when asked.

### 5. Add environment variables in Vercel
Go to: vercel.com → your project → Settings → Environment Variables

Add both:
- `AIRTABLE_TOKEN` = your token (pat...)
- `AIRTABLE_BASE_ID` = your base ID (app...)

Set them for Production, Preview, and Development.

Then redeploy: `vercel --prod`

## Local Development
```bash
cp .env.example .env.local
# Fill in your real values in .env.local
npm install
vercel dev
```
Visit http://localhost:3000

## How it works
- Browser POSTs `{ email, source }` to `/api/waitlist`
- Edge Function validates input + rate limits by IP
- Writes record to Airtable with email, source, and timestamp
- Airtable automation fires → you get an email notification
- Your Airtable base is the source of truth for all signups

## Productionising further
- Update CORS in `api/waitlist.js` — replace `'*'` with your actual domain
- Add a Google Sheet sync via Airtable automations for easy sharing
- Connect Beehiiv or Mailchimp to auto-add signups to a newsletter list
