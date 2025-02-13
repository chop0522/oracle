/***************************************************
 * assets/js/main.js
 * 
 * [最終版] 
 * 1) DOMContentLoaded後にフォームイベントを設定
 * 2) fortuneForm（無料簡易診断）
 * 3) loginForm（ログイン → JWTトークン取得 → premium.htmlへリダイレクト）
 * 4) gem.html用: 宝石データを "assets/data/gemsData.json" から読み込み
 * 5) service.html用: UI切り替え (ログイン状態確認→ボタン出し分け)
 * 6) Stripe Checkout呼び出し (openStripeCheckout)
 * 7) ログアウト関数 (logout)
 * 8) 相性診断フォーム (compatForm) → /api/compatibility にPOST (有料ユーザ向け)
 ***************************************************/

document.addEventListener('DOMContentLoaded', () => {

  /*****************************************
   * 1) 無料簡易診断フォーム (fortuneForm)
   *****************************************/
  const fortuneForm = document.getElementById('fortuneForm');
  const resultDiv = document.getElementById('diagnosisResult');

  if (fortuneForm && resultDiv) {
    fortuneForm.addEventListener('submit', (e) => {
      e.preventDefault();
      // 入力値
      const birthDateValue = document.getElementById('birthDate').value; 
      const userName = document.getElementById('userName').value.trim();

      if (!birthDateValue || !userName) {
        resultDiv.textContent = '生年月日と名前を正しく入力してください。';
        return;
      }

      // 生年月日から算出
      const { gemType, lifePath } = calcBirthData(birthDateValue);
      // 名前から算出
      const { soulNumber, expressionNumber } = calcNameData(userName);

      // 結果をHTML化
      const html = `
        <h3>占い結果</h3>
        <p><strong>宝石タイプ</strong>: ${gemType}</p>
        <p><strong>ライフパスナンバー</strong>: ${lifePath}</p>
        <p><strong>ソウルナンバー</strong>: ${soulNumber}</p>
        <p><strong>表現数</strong>: ${expressionNumber}</p>
        <hr/>
        <p>
          ※宝石タイプは七宝占術の簡易計算法に基づいた結果です。<br/>
          ※ライフパスナンバーは数秘術上の生涯テーマ、<br/>
          　ソウルナンバーと表現数はお名前（ローマ字）から導いた内面・外面の傾向を示します。
        </p>
      `;
      resultDiv.innerHTML = html;
    });
  }

  /*****************************************
   * 2) ログインフォーム (loginForm)
   *    → 成功時に premium.html へ自動遷移
   *****************************************/
  const loginForm = document.getElementById('loginForm');
  const loginResultDiv = document.getElementById('loginResult');

  if (loginForm && loginResultDiv) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;

      if (!email || !password) {
        loginResultDiv.textContent = 'メールアドレスとパスワードを入力してください。';
        return;
      }

      try {
        // ★本番URLに書き換えて使用
        const loginUrl = 'https://oracle-ja2k.onrender.com/api/login';

        const res = await fetch(loginUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
          // トークン & メールをlocalStorageに保存
          localStorage.setItem('token', data.token);
          localStorage.setItem('email', email);

          loginResultDiv.textContent = 'ログイン成功！トークンを保存しました。';

          // ▼ ログイン後、premium.htmlへ自動リダイレクト
          window.location.href = 'premium.html';

        } else {
          loginResultDiv.textContent = 'ログイン失敗: ' + (data.error || '不明なエラー');
        }
      } catch (err) {
        console.error(err);
        loginResultDiv.textContent = '通信エラーが発生しました。';
      }
    });
  }

  /*****************************************
   * 3) gem.html 用 (宝石データを読み込み)
   *****************************************/
  const gemContent = document.getElementById('gemContent'); 
  if (gemContent) {
    const params = new URLSearchParams(location.search);
    const gemTypeId = params.get('id'); 

    fetchGemData(gemTypeId).then(data => {
      if (!data) {
        document.getElementById('gemName').textContent = '宝石情報が見つかりません。';
        return;
      }
      document.getElementById('gemIcon').src = data.icon_url || '';
      document.getElementById('gemName').textContent = data.gem_type_name || '名称不明';
      document.getElementById('gemElement').textContent = data.element || 'エレメント不明';
      document.getElementById('mainImage').src = data.main_image_url || '';

      let rawDesc = data.detail_description || '';
      rawDesc = rawDesc.replace(/\\n/g, "\n").replace(/\\/g, "");
      document.getElementById('description').textContent = rawDesc;
    });

    const fetchGemBtn = document.getElementById('fetchGemBtn');
    const fetchResultDiv = document.getElementById('fetchResult');
    if (fetchGemBtn && fetchResultDiv) {
      fetchGemBtn.addEventListener('click', async () => {
        const data = await fetchGemData(gemTypeId);
        if (data) {
          fetchResultDiv.textContent = JSON.stringify(data, null, 2);
        } else {
          fetchResultDiv.textContent = 'データを再取得できませんでした。';
        }
      });
    }
  }

  /*****************************************
   * 4) service.html 用のUI切り替え (例)
   *****************************************/
  setupUserStatusUI();

  /*****************************************
   * 8) 相性診断フォーム (compatForm)
   *    → /api/compatibility にPOST (有料向け想定)
   *****************************************/
  const compatForm = document.getElementById('compatForm');
  const compatResultDiv = document.getElementById('compatResult');
  if (compatForm && compatResultDiv) {
    compatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      // 2人分の誕生日を取得
      const birthdate1 = document.getElementById('birthdate1').value;
      const birthdate2 = document.getElementById('birthdate2').value;

      const token = localStorage.getItem('token');
      if (!token) {
        compatResultDiv.textContent = "未ログインです。相性診断は有料です。";
        return;
      }

      try {
        // 実際はあなたのバックエンドURLに書き換え
        const url = 'https://oracle-ja2k.onrender.com/api/compatibility'; 
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ birthdate1, birthdate2 })
        });
        if (!res.ok) {
          if (res.status === 403) {
            compatResultDiv.textContent = "サブスクが有効ではありません。有料登録をお願いします。";
          } else {
            compatResultDiv.textContent = "エラー: " + res.status;
          }
          return;
        }
        const data = await res.json();
        // data.score, data.comment, data.stars 等を表示
        compatResultDiv.innerHTML = `
          <p>相性スコア: ${data.score}</p>
          <p>評価: ${data.stars} (5段階)</p>
          <p>${data.comment}</p>
        `;
      } catch (err) {
        console.error(err);
        compatResultDiv.textContent = "通信エラーが発生しました。";
      }
    });
  }

});

/***************************************************
 * fetchGemData: ローカルJSONから1つの宝石データ取得
 ***************************************************/
async function fetchGemData(gemId) {
  const allData = await fetchAllGemsData();
  if (!allData) return null;
  return allData.gems.find(g => g.id === gemId) || null;
}

async function fetchAllGemsData() {
  const url = 'assets/data/gemsData.json';
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('Error fetching gemsData.json:', res.status, res.statusText);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('Network error:', err);
    return null;
  }
}

/***************************************************
 * setupUserStatusUI: (service.html などで使う)
 ***************************************************/
function setupUserStatusUI() {
  // 必要に応じてログイン状態でUI切り替えする処理を追記
}

/***************************************************
 * 6) Stripe Checkout呼び出し (openStripeCheckout)
 ***************************************************/
async function openStripeCheckout(planType) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('ログインしていません。');
    return;
  }
  try {
    // ★本番URLに書き換える
    const createCheckoutUrl = 'https://oracle-ja2k.onrender.com/api/payment/create-checkout-session';

    const res = await fetch(createCheckoutUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ planType })
    });
    const data = await res.json();
    if (res.ok && data.url) {
      // Stripe決済画面へ移動
      window.location.href = data.url;
    } else {
      alert('Checkoutセッション作成に失敗: ' + (data.error || '不明なエラー'));
    }
  } catch (err) {
    console.error(err);
    alert('通信エラーが発生しました: ' + err);
  }
}

/***************************************************
 * 7) ログアウト用関数
 ***************************************************/
function logout() {
  // ローカルストレージのトークン/メールを削除し、未ログイン状態に戻す
  localStorage.removeItem('token');
  localStorage.removeItem('email');
  // トップページへ移動 or リロード
  window.location.href = 'index.html';
}

/***************************************************
 * 占い計算ロジック (無料診断用)
 ***************************************************/
function calcBirthData(birthDateStr) {
  const [year, month, day] = birthDateStr.split('-');
  const digits = [...year, ...month, ...day].map(Number);
  const sum = digits.reduce((a, b) => a + b, 0);

  let gemNum = reduceToSingle(sum);
  if (gemNum > 7) gemNum -= 7;
  const gemType = getGemType(gemNum);

  const lifePath = reduceToSingle(sum);
  return { gemType, lifePath };
}

function reduceToSingle(num) {
  let result = num;
  while (result > 9) {
    const arr = String(result).split('').map(Number);
    result = arr.reduce((a, b) => a + b, 0);
  }
  return result;
}

function getGemType(num) {
  switch(num) {
    case 1: return 'ダイヤモンド（火のエレメント）';
    case 2: return 'ルビー（火のエレメント）';
    case 3: return 'サファイア（水のエレメント）';
    case 4: return 'エメラルド（風のエレメント）';
    case 5: return 'アメジスト（土のエレメント）';
    case 6: return 'トパーズ（風のエレメント）';
    case 7: return 'オパール（土のエレメント）';
    default: return '不明';
  }
}

function calcNameData(nameStr) {
  const upperName = nameStr.toUpperCase().replace(/\s+/g, '');
  const charToNum = {
    A:1, J:1, S:1,
    B:2, K:2, T:2,
    C:3, L:3, U:3,
    D:4, M:4, V:4,
    E:5, N:5, W:5,
    F:6, O:6, X:6,
    G:7, P:7, Y:7,
    H:8, Q:8, Z:8,
    I:9, R:9
  };

  const vowels = ['A','E','I','O','U'];
  let sumVowels = 0;
  let sumConsonants = 0;

  for (const ch of upperName) {
    if (!charToNum[ch]) continue;
    if (vowels.includes(ch)) {
      sumVowels += charToNum[ch];
    } else {
      sumConsonants += charToNum[ch];
    }
  }

  const soulNumber = reduceToSingle(sumVowels);
  const expressionNumber = reduceToSingle(sumConsonants);

  return { soulNumber, expressionNumber };
}