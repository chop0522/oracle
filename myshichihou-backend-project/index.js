/*******************************************
 * index.js (Webhook導入 + 有料コンテンツAPI + 相性診断API)
 *   - Stripe Checkout & Webhook済み
 *   - gemCompatibilityScoreを「藤原光輝」流に魅力的な数値へ
 *******************************************/
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Webhook 署名シークレット
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

const app = express();
app.use(cors());

// /webhook/stripe だけは rawボディ
app.use('/webhook/stripe', express.raw({ type: 'application/json' }));
// 他ルートは普通のJSONでOK
app.use(express.json());

// DB接続 - SSL (Render等)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false }
});

// JWT秘密鍵
const JWT_SECRET = process.env.JWT_SECRET;

/*******************************************
 * JWT認証ミドルウェア
 *******************************************/
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = decoded; // user_id, email, ...
    next();
  });
}

/*******************************************
 * 動作確認
 *******************************************/
app.get('/', (req, res) => {
  res.send('Hello from Node.js + DB + Stripe + Webhook + PremiumContent + Compatibility!');
});

/*******************************************
 * ユーザー関連API (register, login)
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

    const userResult = await pool.query(`
      SELECT user_id, email, password_hash
        FROM users
       WHERE email = $1
    `, [email]);

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
 * サブスク (subscribe)
 *******************************************/
app.post('/api/subscribe', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { plan, price } = req.body;

    const result = await pool.query(`
      INSERT INTO subscriptions (user_id, plan, price, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING subscription_id
    `, [userId, plan, price]);

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
 * 宝石タイプAPI (例: gems, etc.)
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
    const result = await pool.query(`
      SELECT * FROM gem_types WHERE gem_type_id = $1
    `, [gemTypeId]);

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
 * サブスク状態チェック用
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
 * 年運API (例)
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
 * 月運API (例)
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
 * モザイク処理 (有料非サブスク→伏字)
 *******************************************/
function maskContent(originalText) {
  const cutoff = Math.floor(originalText.length / 2);
  return originalText.slice(0, cutoff) + ' ... ****(有料会員限定)****';
}

/*******************************************
 * Stripe Checkout (create-checkout-session)
 *******************************************/
app.post('/api/payment/create-checkout-session', authenticateToken, async (req, res) => {
  try {
    const { planType } = req.body;
    const userId = req.user.user_id;

    // ここを実際のPriceIDに書き換え
    let priceId = '';
    if (planType === 'monthly') {
      priceId = 'price_1Qqbz0RYC6bzdq0lNtKREtAs'; 
    } else if (planType === 'annual') {
      priceId = 'price_1QrIefRYC6bzdq0lnx18O08B'; 
    } else {
      return res.status(400).json({ error: 'Invalid planType' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // ここをNetlifyの正しいURLに書き換え
      success_url: 'https://stirring-sunflower-f2ca8e.netlify.app/payment-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://stirring-sunflower-f2ca8e.netlify.app/payment-cancel',
      metadata: { userId: String(userId) }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/*******************************************
 * Stripe Webhook (/webhook/stripe)
 *******************************************/
app.post('/webhook/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).send('Missing Stripe Signature');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    return res.sendStatus(400);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        if (!userId) {
          console.warn('No userId in session.metadata');
          break;
        }
        console.log(`Payment success for userId=${userId}, setting sub active...`);

        try {
          await pool.query(`
            UPDATE subscriptions 
               SET status='active'
             WHERE user_id=$1 
               AND status<>'active'
          `, [userId]);
        } catch (dbErr) {
          console.error('Failed to update subscription:', dbErr);
        }
      }
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
      break;
  }

  res.json({ received: true });
});

/*******************************************
 * 有料向けコンテンツAPI (/api/premium-content)
 *******************************************/
app.get('/api/premium-content', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const subRes = await pool.query(`
      SELECT * FROM subscriptions
       WHERE user_id = $1
         AND status = 'active'
       LIMIT 1
    `, [userId]);

    if (subRes.rows.length === 0) {
      return res.status(403).json({ error: 'No active subscription' });
    }

    // サンプル有料コンテンツ
    const premiumData = {
      title: "有料専用のプレミアム占い",
      detail: "ここに高度な占い結果や深いコラムを配置可能。"
    };
    res.json(premiumData);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/*******************************************
 * 相性診断API (/api/compatibility)
 *******************************************/
app.post('/api/compatibility', authenticateToken, async (req, res) => {
  try {
    // サブスクチェック
    const userId = req.user.user_id;
    const subCheck = await pool.query(`
      SELECT * FROM subscriptions
       WHERE user_id=$1
         AND status='active'
       LIMIT 1
    `, [userId]);
    if (subCheck.rows.length === 0) {
      return res.status(403).json({ error: 'No active subscription' });
    }

    // リクエストパラメータ
    const { birthdate1, birthdate2 } = req.body;
    if (!birthdate1 || !birthdate2) {
      return res.status(400).json({ error: 'Missing birthdates' });
    }

    // personX: { gemTypeId, gemTypeStr, lifePath }
    const person1 = calcPerson(birthdate1);
    const person2 = calcPerson(birthdate2);

    const baseScore = getGemCompatibilityScore(person1.gemTypeId, person2.gemTypeId);
    const lpBonus  = getLifePathBonus(person1.lifePath, person2.lifePath);

    let total = baseScore + lpBonus;
    if (total>100) total=100;
    if (total<0) total=0;

    const stars   = getStars(total);
    const comment = getComment(total);

    res.json({
      score: total,
      stars,
      comment,
      person1,
      person2
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/*******************************************
 * 相性診断の内部関数
 *******************************************/
// birthdateStr => { gemTypeId, gemTypeStr, lifePath }
function calcPerson(birthdateStr) {
  const { gemType, lifePath } = calcBirthDataNode(birthdateStr);
  const gemTypeId = getGemTypeId(gemType);
  return { gemTypeId, gemTypeStr: gemType, lifePath };
}

// 生年月日から宝石タイプ/ライフパス
function calcBirthDataNode(birthDateStr) {
  const [year, month, day] = birthDateStr.split('-');
  const digits = [...year, ...month, ...day].map(Number).filter(n => !isNaN(n));
  const sum = digits.reduce((a,b)=>a+b, 0);

  let gemNum = reduceToSingle(sum);
  if (gemNum>7) gemNum -= 7;
  const gemType = getGemTypeStr(gemNum);

  const lifePath = reduceToSingle(sum);
  return { gemType, lifePath };
}

function reduceToSingle(num) {
  let result = num;
  while (result>9) {
    const arr = String(result).split('').map(Number);
    result = arr.reduce((a,b)=>a+b,0);
  }
  return result;
}

function getGemTypeStr(num) {
  switch(num) {
    case 1: return 'ダイヤモンド（火）';
    case 2: return 'ルビー（火）';
    case 3: return 'サファイア（水）';
    case 4: return 'エメラルド（風）';
    case 5: return 'アメジスト（土）';
    case 6: return 'トパーズ（風）';
    case 7: return 'オパール（土）';
    default: return '不明';
  }
}

// 七宝占術 gemTypeId
function getGemTypeId(gemTypeStr) {
  if (!gemTypeStr) return 0;
  if (gemTypeStr.includes('ダイヤモンド')) return 1;
  if (gemTypeStr.includes('ルビー'))       return 2;
  if (gemTypeStr.includes('サファイア'))   return 3;
  if (gemTypeStr.includes('エメラルド'))   return 4;
  if (gemTypeStr.includes('アメジスト'))   return 5;
  if (gemTypeStr.includes('トパーズ'))     return 6;
  if (gemTypeStr.includes('オパール'))     return 7;
  return 0;
}

/*******************************************
 * ★ 藤原光輝オリジナル: gemCompatibilityScore表
 *******************************************/
// gemTypeId: 1~7
function getGemCompatibilityScore(id1, id2) {
  // ダイヤ(1)=火, ルビー(2)=火, サファイア(3)=水, エメラルド(4)=風,
  // アメジスト(5)=土, トパーズ(6)=風, オパール(7)=土

  // "人々が夢中になる"ようバランス調整。火×火は高め、火×水は低めなど
  const table = {
    1: {1:88,2:92,3:45,4:75,5:65,6:78,7:60}, // ダイヤ × 各
    2: {1:92,2:85,3:50,4:70,5:60,6:72,7:58}, // ルビー
    3: {1:45,2:50,3:82,4:67,5:72,6:65,7:74}, // サファイア
    4: {1:75,2:70,3:67,4:85,5:58,6:80,7:62}, // エメラルド
    5: {1:65,2:60,3:72,4:58,5:80,6:60,7:78}, // アメジスト
    6: {1:78,2:72,3:65,4:80,5:60,6:86,7:64}, // トパーズ
    7: {1:60,2:58,3:74,4:62,5:78,6:64,7:83}  // オパール
  };

  if (!table[id1] || table[id1][id2]==null) {
    return 50; // default
  }
  return table[id1][id2];
}

// ライフパス差→ボーナス
function getLifePathBonus(lp1, lp2) {
  const diff = Math.abs(lp1-lp2);
  if (diff===0) return 20;
  if (diff<=2) return 10;
  return 0;
}

// スコア→★1～5
function getStars(score) {
  if (score<=20) return '★1';
  if (score<=40) return '★2';
  if (score<=60) return '★3';
  if (score<=80) return '★4';
  return '★5';
}

// スコア→コメント
function getComment(score) {
  if (score<=20) return '相性が厳しいかも...慎重に距離感を保ちましょう。';
  if (score<=40) return 'まぁまぁ。工夫次第でうまくいきそう。';
  if (score<=60) return '普通の相性。お互い尊重すれば十分可能性あり。';
  if (score<=80) return '良い感じ！協力し合えば素敵な関係になれます。';
  return '最高の相性！二人の相乗効果が大きく期待できます。';
}

/*******************************************
 * サーバー起動
 *******************************************/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});