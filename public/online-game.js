// ===== グローバル変数 =====
let ws = null;
let currentRoomId = null;
let currentPlayerNumber = null;
let currentPlayerName = null;  // ✅ 追加: 再接続時に使用
let allPlayers = {};  // ✅ 修正: undefined エラーを防止
let gameState = {
    currentTurn: 1,
    currentPlayer: 1,
    gameActive: false,
    selectedCard: null,
};
let playerData = {};
let gameLog = [];

const cardDatabase = [
    { id: 1, name: 'スライム', icon: '👾', cost: 1, attack: 1, effect: 'basic' },
    { id: 2, name: 'ゴブリン', icon: '🧛', cost: 2, attack: 2, effect: 'basic' },
    { id: 3, name: 'ナイト', icon: '🛡️', cost: 3, attack: 2, effect: 'tank' },
    { id: 4, name: 'ウィザード', icon: '🧙', cost: 3, attack: 3, effect: 'magic' },
    { id: 5, name: 'ドラゴン', icon: '🐉', cost: 5, attack: 4, effect: 'flying' },
    { id: 6, name: 'ヒール', icon: '💚', cost: 2, attack: 0, effect: 'heal' },
    { id: 7, name: 'ファイア', icon: '🔥', cost: 2, attack: 0, effect: 'damage' },
];

// ===== ローカルストレージ管理 =====
function saveGameSession() {
    // ✅ 追加: ゲーム情報をローカルストレージに保存
    const sessionData = {
        roomId: currentRoomId,
        playerNumber: currentPlayerNumber,
        playerName: currentPlayerName,
        gameActive: gameState.gameActive,
        timestamp: Date.now(),
    };
    localStorage.setItem('cardGameSession', JSON.stringify(sessionData));
}

function loadGameSession() {
    // ✅ 追加: ローカルストレージからゲーム情報を復元
    try {
        const sessionData = JSON.parse(localStorage.getItem('cardGameSession'));
        if (!sessionData) return null;
        
        // セッションが24時間以上古い場合は無効化
        if (Date.now() - sessionData.timestamp > 24 * 60 * 60 * 1000) {
            localStorage.removeItem('cardGameSession');
            return null;
        }
        
        return sessionData;
    } catch (error) {
        console.error('セッション復元エラー:', error);
        return null;
    }
}

function clearGameSession() {
    // ✅ 追加: ローカルストレージからゲーム情報を削除
    localStorage.removeItem('cardGameSession');
}

// ===== ルーム管理 =====

function showCreateRoomDialog() {
    document.getElementById('roomSelectScreen').style.display = 'none';
    document.getElementById('createRoomScreen').style.display = 'block';
    createNewRoom();
}

function showJoinRoomDialog() {
    document.getElementById('roomSelectScreen').style.display = 'none';
    document.getElementById('joinRoomScreen').style.display = 'block';
}

function backToRoomSelect() {
    document.getElementById('createRoomScreen').style.display = 'none';
    document.getElementById('joinRoomScreen').style.display = 'none';
    document.getElementById('roomSelectScreen').style.display = 'block';
    document.getElementById('joinErrorMessage').style.display = 'none';
    clearGameSession();
}

async function createNewRoom() {
    try {
        const response = await fetch('/api/create-room', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            currentRoomId = data.roomId;
            currentPlayerNumber = 1;
            currentPlayerName = document.getElementById('playerNameInput').value || "プレイヤー1";  // ✅ 保存
            document.getElementById('roomIdText').textContent = data.roomId;
            document.getElementById('roomInfoDisplay').style.display = 'block';
            saveGameSession();  // ✅ 追加: セッション保存
            connectWebSocket(currentPlayerName);
        }
    } catch (error) {
        console.error('ルーム作成エラー:', error);
        alert('ルーム作成に失敗しました');
    }
}

async function joinRoom() {
    const roomId = document.getElementById('joinRoomIdInput').value.toUpperCase();

    if (!roomId || roomId.length !== 8) {
        showJoinError('ルームIDを正しく入力してください');
        return;
    }

    try {
        currentPlayerName = document.getElementById('joinPlayerNameInput').value || "プレイヤー2";  // ✅ 保存
        const response = await fetch(`/api/join-room/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerNumber: 2, playerName: currentPlayerName }),
        });

        const data = await response.json();

        if (data.success) {
            currentRoomId = data.roomId;
            currentPlayerNumber = data.playerNumber;
            playerData = data.playerData;
            gameState = data.gameState;
            gameLog = data.gameLog;

            // ✅ 修正: 入力された名前を allPlayers に追加
            allPlayers[currentPlayerNumber] = { playerNumber: currentPlayerNumber, name: currentPlayerName };

            saveGameSession();  // ✅ 追加: セッション保存
            document.getElementById('joinRoomScreen').style.display = 'none';
            document.getElementById('gameScreen').style.display = 'block';
            document.getElementById('displayRoomId').textContent = currentRoomId;

            connectWebSocket(currentPlayerName);
            updateGameUI();
        } else {
            showJoinError(data.message);
        }
    } catch (error) {
        console.error('ルーム参加エラー:', error);
        showJoinError('ルーム参加に失敗しました');
    }
}

function showJoinError(message) {
    const errorDiv = document.getElementById('joinErrorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function copyRoomId() {
    const roomId = document.getElementById('roomIdText').textContent;
    navigator.clipboard.writeText(roomId).then(() => {
        alert('ルームIDをコピーしました！');
    });
}

// ===== WebSocket 接続 =====

function connectWebSocket(playerName) {
    // ✅ 修正: playerName を保存して再接続時に使用
    if (playerName) {
        currentPlayerName = playerName;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        ws.send(JSON.stringify({
            type: 'join',
            roomId: currentRoomId,
            playerNumber: currentPlayerNumber,
            playerName: currentPlayerName,   // ✅ 保存された名前を使用
        }));
    };


    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
    };

    ws.onerror = (error) => {
        console.error('WebSocketエラー:', error);
    };

    ws.onclose = () => {
    console.log("WebSocket切断。1秒後に再接続します…");

    // ✅ 修正: currentPlayerName を渡して再接続
    setTimeout(() => {
        connectWebSocket(currentPlayerName);
    }, 1000);
    };
}

function handleWebSocketMessage(message) {
    const { type } = message;

    switch (type) {
        case 'player-joined':
            console.log(message.message);
            document.getElementById('player2Status').textContent = 'プレイヤー2 ✓';
            document.getElementById('healthSettingDisplay').style.display = 'block';
            document.getElementById('startGameBtn').style.display = 'block';
            break;

        case 'game-started':
            document.getElementById('createRoomScreen').style.display = 'none';
            document.getElementById('gameScreen').style.display = 'block';
            document.getElementById('displayRoomId').textContent = currentRoomId;
            gameState = message.gameState;
            playerData = message.playerData;
            gameLog = message.gameLog;
            saveGameSession();  // ✅ 追加: ゲーム開始時にセッション保存
            updateGameUI();
            break;

        case 'card-played':
            playerData = message.playerData;
            gameState = message.gameState;
            gameLog = message.gameLog;
            saveGameSession();  // ✅ 追加: ゲーム状態更新時にセッション保存
            updateGameUI();
            break;

        case 'turn-ended':
            playerData = message.playerData;
            gameState = message.gameState;
            gameLog = message.gameLog;
            saveGameSession();  // ✅ 追加: ゲーム状態更新時にセッション保存
            updateGameUI();
            break;

        case 'game-over':
            gameState.gameActive = false;
            gameLog = message.gameLog;
            document.getElementById('statusMessage').textContent = `プレイヤー${message.winner}が勝利しました！`;
            clearGameSession();  // ✅ 追加: ゲーム終了時にセッション削除
            updateGameUI();
            break;

        case 'game-abandoned':
            gameState.gameActive = false;
            gameLog = message.gameLog;
            document.getElementById('statusMessage').textContent = 
                `プレイヤー${message.abandoner}がゲームを放棄しました。プレイヤー${message.winner}の勝利！`;
            clearGameSession();  // ✅ 追加: セッション削除
            updateGameUI();
            
            // 数秒後にルーム選択に戻す
            setTimeout(() => {
                document.getElementById('gameScreen').style.display = 'none';
                document.getElementById('roomSelectScreen').style.display = 'block';
                location.reload(); // 確実にリセット
            }, 3000);
            break;

        case 'joined':
            currentPlayerNumber = message.role;
            currentPlayerName = message.name;
            allPlayers = message.players;
            // ✅ 修正: allPlayers に入力された名前が含まれていない場合は追加
            if (!allPlayers[currentPlayerNumber] || !allPlayers[currentPlayerNumber].name) {
                if (!allPlayers[currentPlayerNumber]) {
                    allPlayers[currentPlayerNumber] = {};
                }
                allPlayers[currentPlayerNumber].name = currentPlayerName;
            }
            // 観戦者なら操作不可にする
            if (currentPlayerNumber === 'spectator') {
                document.getElementById('statusMessage').textContent = '観戦モード';
                document.getElementById('endTurnBtn').style.display = 'none';
                document.getElementById('abandonGameBtn').style.display = 'none';
            }
            updateGameUI();
            break;
    }
}

function startGame() {
    const input = document.getElementById('initialHealthInput');
    let initialHealth = parseInt(input.value);
    if (isNaN(initialHealth) || initialHealth < 10) initialHealth = 10;
    if (initialHealth > 9999) initialHealth = 9999;

    ws.send(JSON.stringify({
        type: 'start-game',
        roomId: currentRoomId,
        initialHealth: initialHealth,
    }));
}

// ===== ゲーム放棄機能 =====

function abandonGame() {
    if (!confirm('本当にゲームを放棄しますか？')) return;
    
    ws.send(JSON.stringify({
        type: 'abandon-game',
        roomId: currentRoomId,
        playerNumber: currentPlayerNumber,
    }));
    
    // ゲーム情報をクリア
    clearGameSession();
    
    // ルーム選択画面に戻る
    setTimeout(() => {
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('roomSelectScreen').style.display = 'block';
        location.reload(); // 確実にリセット
    }, 500);
}

// ===== ゲームロジック =====

function updateGameUI() {
    updatePlayerUI(1);
    updatePlayerUI(2);
    
    document.getElementById('player1Name').textContent =
    allPlayers?.[1]?.name || "プレイヤー1";
    document.getElementById('player2Name').textContent =
    allPlayers?.[2]?.name || "プレイヤー2";

    document.getElementById('turnNumber').textContent = `ターン: ${gameState.currentTurn}`;
    document.getElementById('turnIndicator').textContent = `現在: プレイヤー${gameState.currentPlayer}のターン`;
    document.getElementById('statusMessage').textContent =
        gameState.gameActive ? `プレイヤー${gameState.currentPlayer}のターンです` : 'ゲーム開始待機中...';

    const logContent = document.getElementById('gameLog');
    logContent.innerHTML = '';
    gameLog.forEach(log => {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.textContent = log;
        logContent.appendChild(entry);
    });
    logContent.scrollTop = logContent.scrollHeight;

    updateFieldClickHandlers();
}

function updatePlayerUI(playerId) {
    const player = playerData[playerId];
    if (!player) return;

    const prefix = `player${playerId}`;

    // ヘルスバー更新
    const healthPercent = (player.health / player.maxHealth) * 100;
    const healthBar = document.getElementById(`${prefix}Health`);
    healthBar.style.width = Math.max(healthPercent, 0) + '%';
    document.getElementById(`${prefix}HealthText`).textContent = `${player.health}/${player.maxHealth}`;

    if (player.health <= player.maxHealth * 0.3) {
        healthBar.classList.add('low');
    } else {
        healthBar.classList.remove('low');
    }

    // マナ表示
    document.getElementById(`${prefix}ManaText`).textContent = `${player.mana}/${player.maxMana}`;

    // 手札表示（自分のみ）
    const handElement = document.getElementById(`${prefix}Hand`);
    handElement.innerHTML = '';
    if (playerId === currentPlayerNumber) {
        player.hand.forEach(card => {
            const cardElement = createCardElement(card, playerId, 'hand');
            handElement.appendChild(cardElement);
        });
    }

    // フィールド表示
    const fieldElement = document.getElementById(`${prefix}Field`);
    fieldElement.innerHTML = '';
    player.field.forEach(card => {
        const cardElement = createCardElement(card, playerId, 'field');
        fieldElement.appendChild(cardElement);
    });
}

function createCardElement(card, playerId, location) {
    const cardElement = document.createElement('div');
    cardElement.className = 'card';
    cardElement.dataset.instanceId = card.instanceId;
    cardElement.dataset.playerId = playerId;
    cardElement.dataset.location = location;

    if (gameState.currentPlayer !== playerId) {
        cardElement.classList.add('disabled');
    } else if (location === 'hand') {
        const currentMana = playerData[playerId] ? playerData[playerId].mana : 0;
        if (currentMana >= card.cost) {
            cardElement.classList.add('selectable');
        } else {
            cardElement.classList.add('disabled');
        }
    }

    if (gameState.selectedCard?.instanceId === card.instanceId && location === 'hand') {
        cardElement.classList.add('selected');
    }

    cardElement.innerHTML = `
        <div class="card-cost">${card.cost}</div>
        <div class="card-name">${card.name}</div>
        <div class="card-icon">${card.icon}</div>
        <div class="card-stats">
            <div class="card-stat">⚔️${card.attack}</div>
        </div>
    `;

    cardElement.addEventListener('click', () => handleCardClick(card, playerId, location, cardElement));
    return cardElement;
}

function handleCardClick(card, playerId, location, cardElement) {
    if (gameState.currentPlayer !== playerId || !gameState.gameActive || playerId !== currentPlayerNumber) return;

    if (location === 'hand') {
        selectCard(card, cardElement);
    }
}

function selectCard(card, cardElement) {
    document.querySelectorAll('.card.selected').forEach(el => el.classList.remove('selected'));

    if (gameState.selectedCard?.instanceId === card.instanceId) {
        gameState.selectedCard = null;
    } else {
        if (playerData[currentPlayerNumber].mana >= card.cost) {
            gameState.selectedCard = card;
            cardElement.classList.add('selected');
        } else {
            alert(`マナが足りません！必要: ${card.cost}, 所持: ${playerData[currentPlayerNumber].mana}`);
        }
    }
    updateGameUI();
}

function updateFieldClickHandlers() {
    document.querySelectorAll('.field').forEach(field => {
        const playerId = parseInt(field.id.replace('player', '').replace('Field', ''));
        field.onclick = (e) => {
            if (e.target === field) {
                handleFieldClick(playerId);
            }
        };
    });
}

function handleFieldClick(playerId) {
    if (gameState.currentPlayer !== playerId || !gameState.gameActive || playerId !== currentPlayerNumber) return;
    if (!gameState.selectedCard) return;

    placeCard();
}

function placeCard() {
    const player = playerData[currentPlayerNumber];
    const opponentId = currentPlayerNumber === 1 ? 2 : 1;
    const opponent = playerData[opponentId];
    const selectedCard = gameState.selectedCard;

    if (player.mana < selectedCard.cost) return;

    player.hand = player.hand.filter(c => c.instanceId !== selectedCard.instanceId);
    player.field.push({
        ...selectedCard,
        instanceId: Math.random(),
        canAttack: true,
    });

    player.mana -= selectedCard.cost;
    opponent.health -= selectedCard.attack;
    if (opponent.health < 0) opponent.health = 0;

    const logMessage = `プレイヤー${currentPlayerNumber}が${selectedCard.name}を配置し、${selectedCard.attack}ダメージを与えました！（残りマナ: ${player.mana}）`;
    gameLog.push(logMessage);

    gameState.selectedCard = null;

    if (opponent.health <= 0) {
        gameState.gameActive = false;
        const winLog = `🎉 プレイヤー${currentPlayerNumber}が勝利しました！🎉`;
        gameLog.push(winLog);
        ws.send(JSON.stringify({
            type: 'game-over',
            roomId: currentRoomId,
            winner: currentPlayerNumber,
            logMessage: winLog,
        }));
    } else {
        ws.send(JSON.stringify({
            type: 'play-card',
            roomId: currentRoomId,
            playerNumber: currentPlayerNumber,
            payload: {
                playerData,
                gameState,
                logMessage,
            },
        }));
    }

    updateGameUI();
}

function endTurn() {
    if (!gameState.gameActive || gameState.currentPlayer !== currentPlayerNumber) return;

    const opponentId = gameState.currentPlayer === 1 ? 2 : 1;
    gameState.currentPlayer = opponentId;
    gameState.currentTurn += 1;

    playerData[opponentId].mana = playerData[opponentId].maxMana;

    if (playerData[opponentId].deck && playerData[opponentId].deck.length > 0) {
        const card = playerData[opponentId].deck.pop();
        playerData[opponentId].hand.push({ ...card, instanceId: Math.random() });
    }

    const logMessage = `ターン終了 → プレイヤー${opponentId}のターン開始`;
    gameLog.push(logMessage);

    ws.send(JSON.stringify({
        type: 'end-turn',
        roomId: currentRoomId,
        playerNumber: currentPlayerNumber,
        payload: {
            playerData,
            gameState,
            logMessage,
        },
    }));

    updateGameUI();
}

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
    // ✅ 追加: ページロード時にセッション復帰を試みる
    const savedSession = loadGameSession();
    
    if (savedSession) {
        // セッションが存在する場合は復帰処理を実行
        currentRoomId = savedSession.roomId;
        currentPlayerNumber = savedSession.playerNumber;
        currentPlayerName = savedSession.playerName;
        
        console.log(`セッション復帰: ルーム ${currentRoomId}, プレイヤー ${currentPlayerNumber}`);
        
        // REST API でゲーム状態を取得
        fetch(`/api/game-state/${currentRoomId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    gameState = data.gameState;
                    playerData = data.playerData;
                    gameLog = data.gameLog;
                    
                    // ゲーム画面を表示
                    document.getElementById('roomSelectScreen').style.display = 'none';
                    document.getElementById('createRoomScreen').style.display = 'none';
                    document.getElementById('joinRoomScreen').style.display = 'none';
                    document.getElementById('gameScreen').style.display = 'block';
                    document.getElementById('displayRoomId').textContent = currentRoomId;
                    
                    // WebSocket に接続して復帰を告知
                    connectWebSocket(currentPlayerName);
                    updateGameUI();
                } else {
                    // ルームが存在しない場合はセッションクリア
                    clearGameSession();
                    document.getElementById('roomSelectScreen').style.display = 'block';
                }
            })
            .catch(error => {
                console.error('セッション復帰エラー:', error);
                clearGameSession();
                document.getElementById('roomSelectScreen').style.display = 'block';
            });
    } else {
        // セッションがない場合は通常のルーム選択画面を表示
        document.getElementById('roomSelectScreen').style.display = 'block';
    }
});
