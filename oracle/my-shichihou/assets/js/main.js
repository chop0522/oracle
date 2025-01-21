document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('fortuneForm');
    const resultDiv = document.getElementById('diagnosisResult');
  
    if (!form || !resultDiv) return;
  
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      // 入力値の取得
      const birthDateValue = document.getElementById('birthDate').value; // 例: 1988-05-22
      const userName = document.getElementById('userName').value.trim(); // 例: TANAKA YUYA
  
      if (!birthDateValue || !userName) {
        resultDiv.textContent = '生年月日と名前を正しく入力してください。';
        return;
      }
  
      // 生年月日からの算出
      const { gemType, lifePath } = calcBirthData(birthDateValue);
  
      // 名前からの算出
      const { soulNumber, expressionNumber } = calcNameData(userName);
  
      // 結果の組み立て
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
  });
  
  /**
   * 生年月日から宝石タイプとライフパスナンバーを計算
   */
  function calcBirthData(birthDateStr) {
    // birthDateStr例: "1988-05-22"
    const [year, month, day] = birthDateStr.split('-');
    // 各桁を配列化
    const digits = [...year, ...month, ...day].map(Number); 
    const sum = digits.reduce((a, b) => a + b, 0);
  
    // 1) 宝石タイプ
    //    a) 一桁になるまで足す
    let gemNum = reduceToSingle(sum);
    //    b) 7を超えたら7を引く
    if (gemNum > 7) gemNum -= 7;
    const gemType = getGemType(gemNum);
  
    // 2) ライフパスナンバー: 7で引く操作はしない
    const lifePath = reduceToSingle(sum);
  
    return { gemType, lifePath };
  }
  
  /**
   * 一桁になるまで足し続ける（数秘術でよく使う処理）
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
   * 宝石タイプ番号 -> 具体的な宝石名
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
   * 名前（ローマ字）からソウルナンバー（母音合計）＆表現数（子音合計）を算出
   */
  function calcNameData(nameStr) {
    // 大文字に揃える & スペース削除
    const upperName = nameStr.toUpperCase().replace(/\s+/g, '');
  
    // アルファベット→数字の対応表
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