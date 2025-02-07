/***************************************************
 * assets/js/main.js
 * 
 * 1) DOMContentLoaded後にフォームイベントを設定
 * 2) fortuneForm（無料簡易診断）
 * 3) loginForm（ログイン → JWTトークン取得）
 * 4) subscribeForm（サブスク申し込み → token送信）
 * 5) gem.html用: 宝石データ取得 (gemContent, fetchGemBtn)
 ***************************************************/

// DOM読み込み完了時に一度だけ実行
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
      const birthDateValue = document.getElementById('birthDate').value; // 例: "1988-05-22"
      const userName = document.getElementById('userName').value.trim(); // 例: "TANAKA YUYA"

      if (!birthDateValue || !userName) {
        resultDiv.textContent = '生年月日と名前を正しく入力してください。';
        return;
      }

      // 1) 生年月日から算出
      const { gemType, lifePath } = calcBirthData(birthDateValue);

      // 2) 名前から算出
      const { soulNumber, expressionNumber } = calcNameData(userName);

      // 3) 結果をHTML化
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
        // ★本番では “https://your-backend.onrender.com/api/login” に変える
        const res = await fetch('https://oracle-ja2k.onrender.com/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
          // 成功: トークンを localStorage に保存
          localStorage.setItem('token', data.token);
          loginResultDiv.textContent = 'ログイン成功！トークンを保存しました。';
        } else {
          // 失敗: エラーメッセージ
          loginResultDiv.textContent = 'ログイン失敗: ' + (data.error || '不明なエラー');
        }
      } catch (err) {
        console.error(err);
        loginResultDiv.textContent = '通信エラーが発生しました。';
      }
    });
  }

  /*****************************************
   * 3) サブスク申し込みフォーム (subscribeForm)
   *****************************************/
  const subscribeForm = document.getElementById('subscribeForm');
  const subscribeResultDiv = document.getElementById('subscribeResult');

  if (subscribeForm && subscribeResultDiv) {
    subscribeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const plan = document.getElementById('plan').value;  // monthly / annual
      const price = parseInt(document.getElementById('price').value, 10);

      // ローカルストレージからトークンを取得
      const token = localStorage.getItem('token');
      if (!token) {
        subscribeResultDiv.textContent = 'トークンがありません。先にログインしてください。';
        return;
      }

      try {
        // ★本番では “https://your-backend.onrender.com/api/subscribe” に変える
        const res = await fetch('https://oracle-ja2k.onrender.com/api/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ plan, price })
        });
        const data = await res.json();
        if (res.ok) {
          subscribeResultDiv.textContent = 
            `サブスク登録成功！ subscription_id=${data.subscription_id}, message=${data.message}`;
        } else {
          subscribeResultDiv.textContent = 
            'サブスク登録失敗: ' + (data.error || '不明なエラー');
        }
      } catch (err) {
        console.error(err);
        subscribeResultDiv.textContent = '通信エラーが発生しました。';
      }
    });
  }

  /*****************************************
   * 4) gem.html 用 (宝石データ取得)
   *****************************************/
  const gemContent = document.getElementById('gemContent'); 
  // gem.html にだけ存在する要素 (id="gemContent")

  if (gemContent) {
    // gem.html であれば以下の処理を実行

    // URLのクエリパラメータ (例: gem.html?id=1) を取得
    const params = new URLSearchParams(location.search);
    const gemTypeId = params.get('id'); 

    // ページロード時に宝石データを読み込み、HTML要素に反映
    fetchGemData(gemTypeId).then(data => {
      if (data) {
        // gemIcon, gemName, gemElement, mainImage, description を埋める
        const gemIcon = document.getElementById('gemIcon');
        const gemName = document.getElementById('gemName');
        const gemElement = document.getElementById('gemElement');
        const mainImage = document.getElementById('mainImage');
        const description = document.getElementById('description');

        if (gemIcon) gemIcon.src = data.icon_url || '';
        if (gemName) gemName.textContent = data.gem_type_name || '名称不明';
        if (gemElement) gemElement.textContent = data.element || 'エレメント不明';
        if (mainImage) mainImage.src = data.main_image_url || '';

        
      }
    });

    // 再取得ボタン (id="fetchGemBtn") と結果表示領域 (id="fetchResult")
    const fetchGemBtn = document.getElementById('fetchGemBtn');
    const fetchResultDiv = document.getElementById('fetchResult');

    if (fetchGemBtn && fetchResultDiv) {
      fetchGemBtn.addEventListener('click', async () => {
        const data = await fetchGemData(gemTypeId);
        if (data) {
          // JSONを整形表示
          fetchResultDiv.textContent = JSON.stringify(data, null, 2);
        } else {
          fetchResultDiv.textContent = 'データ取得に失敗しました。';
        }
      });
    }
  }

});

/***************************************************
 * fetchGemData: /api/gems/:id を呼び出すユーティリティ
 ***************************************************/
async function fetchGemData(gemId) {
  // ★本番では “https://your-backend.onrender.com/api/gems/${gemId}” に書き換える
  const url = `https://oracle-ja2k.onrender.com/api/gems/${gemId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error('Fetch error:', res.status, res.statusText);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('Network error:', err);
    return null;
  }
}

/***************************************************
 * 以下: 占い計算ロジック
 * (calcBirthData / calcNameData / reduceToSingle / getGemType)
 ***************************************************/

/**
 * 生年月日から宝石タイプとライフパスナンバーを計算
 */
function calcBirthData(birthDateStr) {
  const [year, month, day] = birthDateStr.split('-');
  const digits = [...year, ...month, ...day].map(Number);
  const sum = digits.reduce((a, b) => a + b, 0);

  // 宝石タイプ
  let gemNum = reduceToSingle(sum);
  if (gemNum > 7) gemNum -= 7;
  const gemType = getGemType(gemNum);

  // ライフパスナンバー (7を引かない)
  const lifePath = reduceToSingle(sum);

  return { gemType, lifePath };
}

/**
 * 一桁になるまで足し続ける数秘術的処理
 */
function reduceToSingle(num) {
  let result = num;
  while (result > 9) {
    const arr = String(result).split('').map(Number);
    result = arr.reduce((a, b) => a + b, 0);
  }
  return result;
}

/**
 * 宝石タイプ番号 -> 宝石名
 */
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

/**
 * 名前からソウルナンバー＆表現数を算出
 */
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