/*******************************************
 * index.js
 *******************************************/

// ① .env読み込み
require('dotenv').config();

// 必要なライブラリをインポート
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // PostgreSQLドライバ
const bcrypt = require('bcrypt'); 
const jwt = require('jsonwebtoken'); // JWT発行・検証用

// Expressアプリ作成
const app = express();

// CORSを許可
app.use(cors());

// JSONボディをパース
app.use(express.json());

/*******************************************
 * ② DBプールを作る (環境変数を参照)
 *******************************************/
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/*******************************************
 * 動作確認用
 *******************************************/
app.get('/', (req, res) => {
  res.send('Hello from Node.js + DB!');
});

/*******************************************
 * ユーザー関連API (ユーザー一覧, 登録, ログイン)
 *******************************************/

// ユーザー一覧(仮)
// 例: GET /api/users
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ユーザー登録API
// 例: POST /api/register
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name, birthdate } = req.body;

    // パスワードハッシュ化
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // INSERT
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, birthdate)
       VALUES ($1, $2, $3, $4) RETURNING user_id`,
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

// ★ 新規追加 ★ ログインAPI
// 例: POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1) ユーザーを検索
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

    // 2) パスワード比較
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 3) JWTトークン発行
    // .env で JWT_SECRET=xxxx を設定しておき、process.env.JWT_SECRET を利用するのがおすすめ
    const secretKey = process.env.JWT_SECRET || 'SECRET_KEY'; // 簡易例
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email },
      secretKey,
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
 * ★ 宝石タイプ（gem_types）関連API
 *******************************************/

// 【1】宝石一覧
// 例: GET /api/gems
app.get('/api/gems', async (req, res) => {
  try {
    // 必要に応じて返すカラムを絞ることも可能
    const sql = 'SELECT * FROM gem_types';
    const result = await pool.query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch gem list' });
  }
});

// 【2】単一の宝石詳細を取得
// 例: GET /api/gems/:id
app.get('/api/gems/:id', async (req, res) => {
  const gemTypeId = req.params.id;
  try {
    const result = await pool.query(
      'SELECT * FROM gem_types WHERE gem_type_id = $1',
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
 * サーバー起動
 *******************************************/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});