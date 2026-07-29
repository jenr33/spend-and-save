const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/database');

const router = express.Router();

router.get('/signup', (req, res) => {
  res.render('account/signup', { error: null });
});

router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  const existing = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  if (existing.rows.length > 0) {
    return res.render('account/signup', { error: 'Username already exists.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await pool.query(
    'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id',
    [username, email, hashedPassword]
  );

  req.session.user = { id: result.rows[0].id, username };
  res.redirect('/');
});

router.get('/login', (req, res) => {
  res.render('account/login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const userRow = result.rows[0];

  if (userRow && await bcrypt.compare(password, userRow.password)) {
    req.session.user = { id: userRow.id, username: userRow.username };
    return res.redirect('/');
  }

  res.render('account/login', { error: 'Invalid username or password.' });
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;