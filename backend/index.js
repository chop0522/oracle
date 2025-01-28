const express = require('express');
const app = express();
const port = 5000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
const cors = require('cors');
app.use(cors());
app.use(express.json()); // JSON形式のリクエストを解析
app.post('/api/calculate', (req, res) => {
    const { birthDate, name } = req.body;
    // ここに占いの計算ロジックを実装
    // 生年月日から宝石タイプを計算
  // 1. birthDateをYYYYMMDDの形式に変換
  const dateStr = birthDate.replace(/-/g, '');
  const digits = dateStr.split('').map(Number);
  const sum = digits.reduce((a, b) => a + b, 0);

  let gemNumber = sum;
  while (gemNumber > 7) {
    gemNumber -= 7;
  }

  // 名前からソウルナンバーなどを計算
  // ...

  const result = {
    gemType: gemNumber,
    // 他の計算結果
  };

  res.json(result);
});
    const result = {
      message: '占い結果をここに返します',
    };
    res.json(result);
    if (!birthDate || !name) {
        return res.status(400).json({ error: '生年月日と名前は必須です' });
      }
    
      // さらに詳細なバリデーションを実施
    
      // 計算ロジック
// App.jsなどで
import axios from 'axios';
import React, { useState } from 'react';

function App() {
  const [birthDate, setBirthDate] = useState('');
  const [name, setName] = useState('');
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/calculate', {
        birthDate,
        name,
      });
      setResult(response.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div>
      <h1>占いアプリ</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="名前（ローマ字）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit">占う</button>
      </form>
      {result && <div>{result.message}</div>}
    </div>
  );
}

export default App;
  