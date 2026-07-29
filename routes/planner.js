const express = require('express');
const pool = require('../db/database');
const requireLogin = require('../middleware/auth');

const router = express.Router();

const CATEGORY_COLORS = {
  Food: '#FFE9A8',
  Rent: '#FFCBA4',
  Insurance: '#AEDFF7',
  Subscription: '#D8C4F0',
  Other: '#F6B8C6',
};

// Get a user's budget row, creating one (defaulting to $0) if it
// doesn't exist yet.
async function getOrCreateBudget(userId) {
  let result = await pool.query('SELECT * FROM budgets WHERE user_id = $1', [userId]);
  if (result.rows.length === 0) {
    await pool.query('INSERT INTO budgets (user_id, amount) VALUES ($1, 0)', [userId]);
    result = await pool.query('SELECT * FROM budgets WHERE user_id = $1', [userId]);
  }
  return result.rows[0];
}

function displayCategory(expense) {
  if (expense.category === 'Other' && expense.custom_category) {
    return expense.custom_category;
  }
  return expense.category;
}

async function askGemini(question, expenses) {
  const summary = expenses
    .map(e => `${e.date} - ${displayCategory(e)} - $${e.amount}`)
    .join('\n');

  const prompt = `You are a helpful financial assistant. Here is the user's transaction history:\n\n${summary}\n\nAnswer the user's question based on this data. Be concise and helpful.\n\nQuestion: ${question}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (err) {
    console.error('Gemini API error:', err);
    return "Sorry, I couldn't process your question right now. Please try again in a moment.";
  }
}

async function getDashboardData(userId) {
  const budget = await getOrCreateBudget(userId);
  const expensesResult = await pool.query('SELECT * FROM expenses WHERE user_id = $1', [userId]);
  const expenses = expensesResult.rows;

  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const remaining = Number(budget.amount) - totalExpense;

  const budgetUsedPercent = budget.amount > 0
    ? Math.round((totalExpense / Number(budget.amount)) * 100)
    : 0;

  const circumference = 502.65;
  const cappedPercent = Math.min(budgetUsedPercent, 100);
  const donutDashArray = `${(cappedPercent / 100 * circumference).toFixed(1)} ${circumference}`;

  return {
    budget: budget.amount,
    total_expense: totalExpense,
    remaining,
    budget_used_percent: budgetUsedPercent,
    donut_dash_array: donutDashArray,
    transaction_count: expenses.length,
  };
}

async function getSpendingTrend(userId, totalSpending, budgetAmount) {
  const budgetUsedPercent = budgetAmount > 0
    ? Math.round((totalSpending / budgetAmount) * 100)
    : 0;

  const expensesResult = await pool.query('SELECT * FROM expenses WHERE user_id = $1', [userId]);
  const expenses = expensesResult.rows;

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const last7Days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateString = d.toISOString().split('T')[0];

    const dayTotal = expenses
      .filter(e => e.date === dateString)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    last7Days.push({
      label: dayLabels[d.getDay()],
      total: dayTotal,
    });
  }

  const maxValue = Math.max(...last7Days.map(d => d.total), 1);
  const chartWidth = 700;
  const chartHeight = 150;
  const stepX = chartWidth / (last7Days.length - 1);

  const points = last7Days.map((d, i) => {
    const x = i * stepX;
    const y = chartHeight - (d.total / maxValue) * (chartHeight - 20);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePoints = points.join(' ');
  const areaPoints = `0,${chartHeight} ${linePoints} ${chartWidth},${chartHeight}`;

  return {
    budget_used_percent: budgetUsedPercent,
    last_7_days: last7Days,
    line_points: linePoints,
    area_points: areaPoints,
  };
}

router.get('/', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const data = await getDashboardData(userId);

  res.render('planner/dashboard', {
    ...data,
    ai_response: null,
    question: null,
    current_page: 'home',
  });
});

router.post('/', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const { budget_amount } = req.body;
  await pool.query('UPDATE budgets SET amount = $1 WHERE user_id = $2', [budget_amount, userId]);
  res.redirect('/');
});

router.get('/transactions', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const expensesResult = await pool.query(
    'SELECT * FROM expenses WHERE user_id = $1 ORDER BY date DESC',
    [userId]
  );
  const expenses = expensesResult.rows;

  const totalSpending = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const categoryTotals = {};
  expenses.forEach(e => {
    const cat = displayCategory(e);
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(e.amount);
  });

  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  const chartColors = ['#4F46E5', '#7C74EA', '#A5A0F2', '#C7C3F7', '#E0DEFB'];
  const circumference = 502.65;

  let cumulativeLength = 0;
  const chartData = sortedCategories.map(([category, amount], i) => {
    const percent = totalSpending > 0 ? (amount / totalSpending) * 100 : 0;
    const sliceLength = totalSpending > 0 ? (amount / totalSpending) * circumference : 0;

    const slice = {
      category,
      amount,
      percent: percent.toFixed(1),
      dash_array: `${sliceLength.toFixed(1)} ${(circumference - sliceLength).toFixed(1)}`,
      dash_offset: -cumulativeLength,
      color: chartColors[i % chartColors.length],
    };

    cumulativeLength += sliceLength;
    return slice;
  });

  const highestCategory = sortedCategories.length > 0 ? sortedCategories[0][0] : 'N/A';

  const budget = await getOrCreateBudget(userId);
  const remaining = Number(budget.amount) - totalSpending;

  const expensesWithDisplay = expenses.map(e => ({
    ...e,
    display_category: displayCategory(e),
  }));

  const trend = await getSpendingTrend(userId, totalSpending, budget.amount);

  res.render('planner/transactions', {
    expenses: expensesWithDisplay,
    chart_data: chartData,
    total_spending: totalSpending,
    total_transactions: expenses.length,
    highest_category: highestCategory,
    remaining,
    ...trend,
    current_page: 'transactions',
  });
});

router.get('/calendar', requireLogin, async (req, res) => {
  const userId = req.session.user.id;

  const today = new Date();
  let year, month;

  if (req.query.month) {
    const [y, m] = req.query.month.split('-');
    year = parseInt(y);
    month = parseInt(m) - 1;
  } else {
    year = today.getFullYear();
    month = today.getMonth();
  }

  const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' });
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  const expensesResult = await pool.query(
    "SELECT * FROM expenses WHERE user_id = $1 AND date LIKE $2",
    [userId, `${monthPrefix}%`]
  );
  const expenses = expensesResult.rows;

  const dayTotals = {};
  expenses.forEach(e => {
    if (!dayTotals[e.date]) {
      dayTotals[e.date] = {};
    }
    dayTotals[e.date][e.category] = (dayTotals[e.date][e.category] || 0) + Number(e.amount);
  });

  const daySegments = {};
  Object.keys(dayTotals).forEach(date => {
    const categories = Object.entries(dayTotals[date]);
    const dayTotal = categories.reduce((sum, [, amount]) => sum + amount, 0);

    daySegments[date] = categories.map(([category, amount]) => ({
      color: CATEGORY_COLORS[category] || '#F5F3EE',
      percent: (amount / dayTotal) * 100,
    }));
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const todayString = today.toISOString().split('T')[0];

  const calendarDays = [];
  for (let i = 0; i < firstWeekday; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateString = `${monthPrefix}-${String(day).padStart(2, '0')}`;
    calendarDays.push({
      day,
      segments: daySegments[dateString] || [{ color: '#F5F3EE', percent: 100 }],
      isToday: dateString === todayString,
    });
  }

  const budget = await getOrCreateBudget(userId);
  const allExpensesResult = await pool.query('SELECT * FROM expenses WHERE user_id = $1', [userId]);
  const totalSpendingAllTime = allExpensesResult.rows.reduce((sum, e) => sum + Number(e.amount), 0);
  const trend = await getSpendingTrend(userId, totalSpendingAllTime, budget.amount);

  res.render('planner/calendar', {
    month_name: monthName,
    year,
    calendar_days: calendarDays,
    category_colors: CATEGORY_COLORS,
    selected_month: monthPrefix,
    current_page: 'calendar',
    ...trend,
  });
});

router.post('/add-expense', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const { category, custom_category, amount, date } = req.body;
  const expenseDate = date || new Date().toISOString().split('T')[0];

  await pool.query(
    'INSERT INTO expenses (user_id, category, custom_category, amount, date) VALUES ($1, $2, $3, $4, $5)',
    [userId, category, custom_category || '', amount, expenseDate]
  );

  res.redirect('/');
});

router.get('/delete-expense/:id', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  await pool.query('DELETE FROM expenses WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
  res.redirect('/transactions');
});

router.get('/edit-expense/:id', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const result = await pool.query(
    'SELECT * FROM expenses WHERE id = $1 AND user_id = $2',
    [req.params.id, userId]
  );
  res.render('planner/edit-expense', { expense: result.rows[0] });
});

router.post('/edit-expense/:id', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const { category, custom_category, amount, date } = req.body;

  await pool.query(
    'UPDATE expenses SET category = $1, custom_category = $2, amount = $3, date = $4 WHERE id = $5 AND user_id = $6',
    [category, custom_category || '', amount, date, req.params.id, userId]
  );

  res.redirect('/transactions');
});

router.post('/ask-ai', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const { question } = req.body;
  const expensesResult = await pool.query('SELECT * FROM expenses WHERE user_id = $1', [userId]);

  const aiResponse = await askGemini(question, expensesResult.rows);
  const data = await getDashboardData(userId);

  res.render('planner/dashboard', {
    ...data,
    ai_response: aiResponse,
    question,
    current_page: 'home',
  });
});

module.exports = router;