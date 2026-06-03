const express = require('express');
const path = require('path');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ===== カードデータベース =====
const cardDatabase = [
    { id: 1, name: 'スライム', icon: '👾', cost: 1, attack: 1, defense: 1, effect: 'basic' },
    { id: 2, name: 'ゴブリン', icon: '🧛', cost: 2, attack: 2, defense: 1, effect: 'basic' },
    { id: 3, name: 'ナイト', icon: '🛡️', cost: 3, attack: 2, defense: 3, effect: 'tank' },
    { id: 4, name: 'ウィザード', icon: '🧙', cost: 3, attack: 3, defense: 1, effect: 'magic' },
    { id: 5, name: 'ドラゴン', icon: '🐉', cost: 5, attack: 4, defense: 2, effect: 'flying' },
    { id: 6, name: 'ヒール', icon: '💚', cost: 2, attack: 0, defense: 0, effect: 'heal' },
    { id: 7, name: 'ファイア', icon: '🔥', cost: 2, attack: 0, defense: 0, effect: 'damage' },
];

// ===== デッキ・手札ユーティリティ =====
function initializeDeck() {
    const deck = [];
    for (let i = 0; i < 5; i++) {
        deck.push(...cardDatabase.slice(0, 5));
    }
    deck.sort(() => Math.random() - 0.5);
    return deck;
}

function drawCards(deck, count) {
    const hand = [];
    for (let i = 0; i < count; i++) {
        if (deck.length > 0) {
            const card = deck.pop();
            hand.push({ ...card, instanceId: Math.random() });
        }
    }
    return hand;
}

// ===== ゲーム状態管理 =====
const gameRooms = new Map();

function generateRoomId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function createRoom() {
    const roomId = generateRoomId();
    gameRooms.set(roomId, {
        roomId,
        players: {},
        gameState: {
            currentTurn: 1,
            currentPlayer: 1,
            gameActive: false,
        },
        playerData: {
            1: {
                health: 100,
                maxHealth: 100,
                hand: [],
                field: [],
                mana: 5,
                maxMana: 5,
                deck: [],
            },
            2: {
                health: 100,
                maxHealth: 100,
                hand: [],
                field: [],
                mana: 5,
                maxMana: 5,
                deck: [],
            },
        },
        gameLog: [],
        clients: [],
    });
    return roomId;
}

// ===== REST API エンドポイント =====

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.post('/api/create-room', (req, res) => {
    try {
        const roomId = createRoom();
        res.json({
            success: true,
            roomId,
            message: 'ルームを作成しました',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'ルーム作成に失敗しました',
            error: error.message,
        });
    }
});

app.post('/api/join-room/:roomId', (req, res) => {
    const { roomId } = req.params;
    const { playerNumber } = req.body;

    try {
        const room = gameRooms.get(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'ルームが見つかりません',
            });
        }

        room.players[playerNumber] = {
            playerNumber,
            joinedAt: new Date().toISOString(),
        };

        res.json({
            success: true,
            roomId,
            playerNumber,
            playerData: room.playerData,
            gameState: room.gameState,
            gameLog: room.gameLog,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'ルーム参加に失敗しました',
            error: error.message,
        });
    }
});

app.get('/api/game-state/:roomId', (req, res) => {
    const { roomId } = req.params;

    try {
        const room = gameRooms.get(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'ルームが見つかりません',
            });
        }

        res.json({
            success: true,
            gameState: room.gameState,
            playerData: room.playerData,
            gameLog: room.gameLog,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'ゲーム状態取得に失敗しました',
            error: error.message,
        });
    }
});

app.get('/api/game-info', (req, res) => {
    res.json({
        name: 'カードバトル',
        version: '1.0.0',
        description: '2人対戦型カードゲーム',
        maxPlayers: 2,
        onlineSupported: true,
    });
});

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// ===== WebSocket 処理 =====

wss.on('connection', (ws) => {
    console.log('クライアント接続: WebSocket');

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleWebSocketMessage(ws, message);
        } catch (error) {
            console.error('WebSocketメッセージ処理エラー:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'メッセージ処理に失敗しました',
            }));
        }
    });

    ws.on('close', () => {
        console.log('クライアント切断: WebSocket');
    });

    ws.on('error', (error) => {
        console.error('WebSocketエラー:', error);
    });
});

function handleWebSocketMessage(ws, message) {
    const { type, roomId, playerNumber, payload } = message;

    const room = gameRooms.get(roomId);
    if (!room) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'ルームが見つかりません',
        }));
        return;
    }

    switch (type) {
        case 'join':
            room.clients.push({ ws, playerNumber });
            broadcastToRoom(room, {
                type: 'player-joined',
                playerNumber,
                message: `プレイヤー${playerNumber}が参加しました`,
            });
            break;

        case 'start-game':
            // デッキ初期化と手札配布
            room.playerData[1].deck = initializeDeck();
            room.playerData[2].deck = initializeDeck();
            room.playerData[1].hand = drawCards(room.playerData[1].deck, 3);
            room.playerData[2].hand = drawCards(room.playerData[2].deck, 3);

            room.gameState.gameActive = true;
            room.gameLog.push('ゲーム開始！');
            room.gameLog.push('プレイヤー1のターン開始');

            broadcastToRoom(room, {
                type: 'game-started',
                gameState: room.gameState,
                playerData: room.playerData,
                gameLog: room.gameLog,
            });
            break;

        case 'play-card':
            room.playerData = payload.playerData;
            room.gameState = payload.gameState;
            room.gameLog.push(payload.logMessage);
            broadcastToRoom(room, {
                type: 'card-played',
                playerData: room.playerData,
                gameState: room.gameState,
                gameLog: room.gameLog,
            });
            break;

        case 'end-turn':
            room.gameState = payload.gameState;
            room.playerData = payload.playerData;
            room.gameLog.push(payload.logMessage);
            broadcastToRoom(room, {
                type: 'turn-ended',
                gameState: room.gameState,
                playerData: room.playerData,
                gameLog: room.gameLog,
            });
            break;

        case 'game-over':
            room.gameState.gameActive = false;
            room.gameLog.push(message.logMessage);
            broadcastToRoom(room, {
                type: 'game-over',
                winner: message.winner,
                gameLog: room.gameLog,
            });
            break;

        default:
            ws.send(JSON.stringify({
                type: 'error',
                message: '不明なメッセージタイプ',
            }));
    }
}

function broadcastToRoom(room, message) {
    room.clients.forEach(({ ws }) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    });
}

server.listen(PORT, () => {
    console.log(`🎮 カードゲームサーバーが起動しました: http://localhost:${PORT}`);
    console.log(`📡 WebSocket対応: ws://localhost:${PORT}`);
});
