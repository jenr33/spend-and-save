const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const db = require('./db/database'); // sets up the SQLite database and tables
const accountRoutes = require('./routes/account'); // signup/login/logout
const plannerRoutes = require('./routes/planner'); // dashboard/transactions/expenses

const app = express();

// Tell Express to use EJS as the template engine (like Django's TEMPLATES setting)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve files in /public directly (like Django's STATICFILES_DIRS)
// e.g. public/css/style.css becomes available at /css/style.css
app.use(express.static(path.join(__dirname, 'public')));

// Lets us read form data from POST requests (req.body.username, etc.)
// This is the equivalent of Django automatically giving you request.POST
app.use(express.urlencoded({ extended: true }));

// Sessions: this is what makes "being logged in" persist across page visits.
// Similar to how Django's login() function works behind the scenes.
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
}));

// Make the logged-in user available in every template as `user`
// (Django does this automatically; in Express we do it ourselves)
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Wire up our route files (like Django's urls.py include())
app.use('/', accountRoutes);
app.use('/', plannerRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
