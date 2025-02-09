/***************************************************
 * assets/js/main.js
 * 
 * 1) DOMContentLoaded後にフォームイベントを設定
 * 2) fortuneForm（無料簡易診断）
 * 3) loginForm（ログイン → JWTトークン取得）
 * 4) subscribeForm（サブスク申し込み → token送信）
 * 5) gem.html用: 宝石データを "assets/data/gemsData.json" から読み込み
 * 6) service.html用: UI切り替え (ログイン状態確認→ボタン出し分け)
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
        // ★本番用のURLを適宜書き換えて使用
        const loginUrl = 'https://oracle-ja2k.onrender.com/api/login';

        const res = await fetch(loginUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
          // 成功: トークンを localStorage に保存
          localStorage.setItem('token', data.token);
          // ユーザーのemailなども保存できる
          localStorage.setItem('email', email);

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
        // ★本番用のURLを適宜書き換えて使用
        const subscribeUrl = 'https://oracle-ja2k.onrender.com/api/subscribe';

        const res = await fetch(subscribeUrl, {
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
   * 4) gem.html 用 (宝石データを "assets/data/gemsData.json" から読み込み)
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
      if (!data) {
        document.getElementById('gemName').textContent = '宝石情報が見つかりません。';
        return;
      }

      const gemIcon = document.getElementById('gemIcon');
      const gemName = document.getElementById('gemName');
      const gemElement = document.getElementById('gemElement');
      const mainImage = document.getElementById('mainImage');
      const description = document.getElementById('description');

      if (gemIcon) gemIcon.src = data.icon_url || '';
      if (gemName) gemName.textContent = data.gem_type_name || '名称不明';
      if (gemElement) gemElement.textContent = data.element || 'エレメント不明';
      if (mainImage) mainImage.src = data.main_image_url || '';

      let rawDesc = data.detail_description || '';
      rawDesc = rawDesc.replace(/\\n/g, "\n").replace(/\\/g, "");
      if (description) description.textContent = rawDesc;
    });

    // 再取得ボタン (id="fetchGemBtn") と結果表示領域 (id="fetchResult")
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
   * 5) service.html 用: ログイン状態によるUI切り替え
   *****************************************/
  setupUserStatusUI();

});

/***************************************************
 * fetchGemData: ローカルJSONから gemTypeId に合う宝石オブジェクトを返す
 ***************************************************/
async function fetchGemData(gemId) {
  const allData = await fetchAllGemsData();
  if (!allData) return null;
  const gem = allData.gems.find(g => g.id === gemId);
  return gem || null;
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
 * service.html用のUI切り替え (ログイン状態チェック→ボタン制御)
 ***************************************************/
function setupUserStatusUI() {
  const userStatusSection = document.getElementById('userStatusSection');
  if (!userStatusSection) return; // service.html 以外はスキップ

  const userStatusMsg = document.getElementById('userStatusMsg');
  const goLoginBtn = document.getElementById('goLoginBtn');
  const goSubscribeBtn = document.getElementById('goSubscribeBtn');

  // 申し込みボタン(年間運勢/特別鑑定) 
  const annualReportBtn = document.getElementById('annualReportBtn');
  const specialPlanBtn = document.getElementById('specialPlanBtn');
  // (個別鑑定は削除したため存在しない)

  const token = localStorage.getItem('token');
  const userEmail = localStorage.getItem('email') || '(不明)';

  if (!token) {
    // 未ログイン
    if (userStatusMsg) {
      userStatusMsg.textContent = '未ログインです。有料サービスのご利用にはログインが必要です。';
    }
    if (goLoginBtn) {
      goLoginBtn.style.display = 'inline-block';
      goLoginBtn.addEventListener('click', () => {
        // ログインページ（例: login.html）へ誘導
        window.location.href = 'login.html';
      });
    }
    if (goSubscribeBtn) {
      goSubscribeBtn.style.display = 'none';
    }

    // 申し込むボタンをクリックしたらログインページへ
    if (annualReportBtn) {
      annualReportBtn.addEventListener('click', () => {
        alert('ログインが必要です。ログインページに移動します。');
        window.location.href = 'login.html';
      });
    }
    if (specialPlanBtn) {
      specialPlanBtn.addEventListener('click', () => {
        alert('ログインが必要です。ログインページに移動します。');
        window.location.href = 'login.html';
      });
    }

  } else {
    // ログイン済み
    if (userStatusMsg) {
      userStatusMsg.textContent = `ログイン中: ${userEmail} 様`;
    }
    if (goLoginBtn) {
      goLoginBtn.style.display = 'none';
    }
    if (goSubscribeBtn) {
      goSubscribeBtn.style.display = 'inline-block';
      goSubscribeBtn.addEventListener('click', () => {
        // サブスクフォームのあるページ or セクションへ飛ぶなど
        // 例: service.html内に #subscribeFormSection があればそこへ移動
        window.location.href = '#subscribeForm';
      });
    }

    // 申し込みボタンをクリックしたらサブスクフォームへ
    if (annualReportBtn) {
      annualReportBtn.addEventListener('click', () => {
        window.location.href = '#subscribeForm';
      });
    }
    if (specialPlanBtn) {
      specialPlanBtn.addEventListener('click', () => {
        window.location.href = '#subscribeForm';
      });
    }
  }
}

/***************************************************
 * 以下: 占い計算ロジック
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