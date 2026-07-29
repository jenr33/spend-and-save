# Spend & Save

An expense tracker web app with an AI financial assistant. Users sign up, log in, track their expenses, set a monthly budget, and ask an AI assistant questions about their spending.

## Features

- Sign up / log in / log out (passwords are hashed, sessions handled securely)
- Add, edit, delete, and view expenses (Create, Read, Update, Delete)
- Set and update a monthly budget
- Dashboard showing total spending, remaining savings, and budget used
- Pie chart of spending by category
- Spending calendar (color-coded by category per day)
- AI financial assistant powered by Google's Gemini API — ask questions about your spending and get real answers based on your actual data

## Tech stack

- **Frontend:** HTML, CSS, JavaScript, EJS templates, Bootstrap
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (hosted on Render)
- **AI:** Google Gemini API

## Database schema

**users** — id, username, email, password (hashed)

**budgets** — id, user_id, amount

**expenses** — id, user_id, category, custom_category, amount, date

## How to run it locally

1. Clone the repo and go into the folder
   ```bash
   git clone <your-repo-url>
   cd spend-and-save
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up your `.env` file
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and add:
   - `GEMINI_API_KEY` — your own Gemini API key
   - `SESSION_SECRET` — any random string
   - `DATABASE_URL` — a PostgreSQL connection string (e.g. from a free Render Postgres database)

4. Start the server
   ```bash
   node server.js
   ```

5. Open `http://localhost:3000` in your browser

## Live app

## Live app

- **Deployed app:** https://spend-and-save.onrender.com
- **GitHub repo:** https://github.com/jenr33/spend-and-save