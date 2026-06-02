const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ルート
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// API エンドポイント例（将来的な拡張用）
app.get('/api/game-info', (req, res) => {
    res.json({
        name: 'カードバトル',
        version: '1.0.0',
        description: '2人対戦型カードゲーム',
        maxPlayers: 2
    });
});

// 404 ハンドリング
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../public', 'index.html'));
});

// エラーハンドリング
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`🎮 カードゲームサーバーが起動しました: http://localhost:${PORT}`);
});
