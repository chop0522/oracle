/*******************************************
 * index.js (本番専用) 
 *   - 環境変数 (process.env.DATABASE_URL, process.env.JWT_SECRET) を利用
 *   - ローカル用ハードコード＆フォールバックを削除
 *******************************************/
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// ★ DB接続 - SSL対応 (Renderなど本番環境のみ想定)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Renderに設定したDATABASE_URLをそのまま使う
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

// JWT秘密鍵も本番の環境変数で設定する想定 (fallback削除)
const JWT_SECRET = process.env.JWT_SECRET;

/*******************************************
 * JWT認証ミドルウェア
 *******************************************/
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.split(' ')[1]; // "Bearer <token>"
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = decoded; // { user_id, email, iat, exp }
    next();
  });
}

/*******************************************
 * 動作確認 (GET /)
 *******************************************/
app.get('/', (req, res) => {
  res.send('Hello from Node.js + DB (SSL)! - (No fallback for local)');
});

/*******************************************
 * ユーザー関連API
 *******************************************/
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name, birthdate } = req.body;
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, birthdate)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id`,
      [email, password_hash, name, birthdate]
    );

    res.json({
      user_id: result.rows[0].user_id,
      message: 'Registered successfully!'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const userResult = await pool.query(
      `SELECT user_id, email, password_hash
         FROM users
        WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // JWT発行
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      message: 'Logged in successfully',
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/*******************************************
 * サブスク関連API
 *******************************************/
app.post('/api/subscribe', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { plan, price } = req.body;

    const result = await pool.query(
      `INSERT INTO subscriptions (user_id, plan, price, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING subscription_id`,
      [userId, plan, price]
    );

    res.json({
      subscription_id: result.rows[0].subscription_id,
      message: 'Subscribed!'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Subscription failed' });
  }
});

/*******************************************
 * 宝石タイプAPI
 *******************************************/
app.get('/api/gems', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM gem_types');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch gem list' });
  }
});

app.get('/api/gems/:id', async (req, res) => {
  try {
    const gemTypeId = req.params.id;
    const result = await pool.query(
      `SELECT * FROM gem_types WHERE gem_type_id = $1`,
      [gemTypeId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gem type not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch gem data' });
  }
});

/*******************************************
 * サブスク状態チェック (年運・月運など有料APIで利用)
 *******************************************/
async function checkSubscription(req, res, next) {
  try {
    const userId = req.user.user_id;
    const subRes = await pool.query(`
      SELECT * FROM subscriptions
       WHERE user_id = $1
         AND status = 'active'
       LIMIT 1
    `, [userId]);
    req.isPaidUser = (subRes.rows.length > 0);
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Subscription check failed' });
  }
}

/*******************************************
 * 年運API
 *******************************************/
app.get('/api/annual/:year/:gemTypeId', authenticateToken, checkSubscription, async (req, res) => {
  try {
    const { year, gemTypeId } = req.params;
    const query = `
      SELECT content
        FROM annual_fortunes
       WHERE year = $1
         AND gem_type_id = $2
       LIMIT 1
    `;
    const result = await pool.query(query, [year, gemTypeId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No annual fortune found' });
    }

    let content = result.rows[0].content;
    if (!req.isPaidUser) {
      content = maskContent(content);
    }
    res.json({ content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch annual fortune' });
  }
});

/*******************************************
 * 月運API
 *******************************************/
app.get('/api/monthly/:year/:month/:gemTypeId', authenticateToken, checkSubscription, async (req, res) => {
  try {
    const { year, month, gemTypeId } = req.params;
    const query = `
      SELECT content
        FROM monthly_fortunes
       WHERE year = $1
         AND month = $2
         AND gem_type_id = $3
       LIMIT 1
    `;
    const result = await pool.query(query, [year, month, gemTypeId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No monthly fortune found' });
    }

    let content = result.rows[0].content;
    if (!req.isPaidUser) {
      content = maskContent(content);
    }
    res.json({ content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch monthly fortune' });
  }
});

/*******************************************
 * モザイク処理
 *******************************************/
function maskContent(originalText) {
  const cutoff = Math.floor(originalText.length / 2);
  return originalText.slice(0, cutoff) + ' ... ****(有料会員限定)****';
}

/*******************************************
 * サーバー起動
 *******************************************/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});