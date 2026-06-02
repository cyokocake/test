// ===== ゲーム状態管理 =====
const gameState = {
    currentTurn: 1,
    currentPlayer: 1, // 1 or 2
    gameActive: false,
    selectedCard: null,
    selectedTarget: null,
};

// ===== プレイヤーデータ =====
const players = {
    1: {
        health: 100,
        maxHealth: 100,
        hand: [],
        field: [],
        mana: 0,
        maxMana: 5,
        deck: [],
    },
    2: {
        health: 100,
        maxHealth: 100,
        hand: [],
        field: [],
        mana: 0,
        maxMana: 5,
        deck: [],
    },
};

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

// ===== ユーティリティ関数 =====

// デッキを初期化
function initializeDeck(playerId) {
    players[playerId].deck = [];
    for (let i = 0; i < 5; i++) {
        players[playerId].deck.push(...cardDatabase.slice(0, 5));
    }
    // シャッフル
    players[playerId].deck.sort(() => Math.random() - 0.5);
}

// カードを引く
function drawCard(playerId, count = 1) {
    const player = players[playerId];
    for (let i = 0; i < count; i++) {
        if (player.deck.length > 0) {
            const card = player.deck.pop();
            player.hand.push({
                ...card,
                instanceId: Math.random(),
            });
        }
    }
}

// ゲームログに追加
function addLog(message, playerId = null) {
    const logContent = document.getElementById('gameLog');
    const entry = document.createElement('div');
    entry.className = `log-entry ${playerId ? `player${playerId}` : ''}`;
    entry.textContent = message;
    logContent.appendChild(entry);
    logContent.scrollTop = logContent.scrollHeight;
}

// ゲーム情報を更新
function updateGameUI() {
    // プレイヤー1の情報更新
    updatePlayerUI(1);
    // プレイヤー2の情報更新
    updatePlayerUI(2);

    // ターン情報更新
    document.getElementById('turnNumber').textContent = `ターン: ${gameState.currentTurn}`;
    document.getElementById('turnIndicator').textContent = `現在: プレイヤー${gameState.currentPlayer}のターン`;
    document.getElementById('statusMessage').textContent =
        gameState.gameActive ? `プレイヤー${gameState.currentPlayer}のターンです` : 'ゲーム開始待機中...';
}

// プレイヤー個別の情報を更新
function updatePlayerUI(playerId) {
    const player = players[playerId];
    const prefix = `player${playerId}`;

    // ヘルスバー更新
    const healthPercent = (player.health / player.maxHealth) * 100;
    const healthBar = document.getElementById(`${prefix}Health`);
    healthBar.style.width = healthPercent + '%';
    document.getElementById(`${prefix}HealthText`).textContent = `${player.health}/${player.maxHealth}`;

    // 低ヘルスで色変更
    if (player.health <= 30) {
        healthBar.classList.add('low');
    } else {
        healthBar.classList.remove('low');
    }

    // 手札表示
    const handElement = document.getElementById(`${prefix}Hand`);
    handElement.innerHTML = '';
    player.hand.forEach(card => {
        const cardElement = createCardElement(card, playerId, 'hand');
        handElement.appendChild(cardElement);
    });

    // フィールド表示
    const fieldElement = document.getElementById(`${prefix}Field`);
    fieldElement.innerHTML = '';
    player.field.forEach(card => {
        const cardElement = createCardElement(card, playerId, 'field');
        fieldElement.appendChild(cardElement);
    });
}

// カード要素を作成
function createCardElement(card, playerId, location) {
    const cardElement = document.createElement('div');
    cardElement.className = 'card';
    cardElement.dataset.instanceId = card.instanceId;
    cardElement.dataset.playerId = playerId;
    cardElement.dataset.location = location;

    // 現在のプレイヤーのカード以外は操作不可
    if (gameState.currentPlayer !== playerId) {
        cardElement.classList.add('disabled');
    } else if (location === 'hand') {
        cardElement.classList.add('selectable');
    }

    cardElement.innerHTML = `
        <div class="card-cost">${card.cost}</div>
        <div class="card-name">${card.name}</div>
        <div class="card-icon">${card.icon}</div>
        <div class="card-stats">
            <div class="card-stat">⚔️${card.attack}</div>
            <div class="card-stat">🛡️${card.defense}</div>
        </div>
    `;

    // クリックイベント
    cardElement.addEventListener('click', () => handleCardClick(card, playerId, location, cardElement));

    return cardElement;
}

// カードをクリック
function handleCardClick(card, playerId, location, cardElement) {
    if (gameState.currentPlayer !== playerId || !gameState.gameActive) return;

    if (location === 'hand') {
        // 手札からのカード選択
        selectCard(card, cardElement);
    } else if (location === 'field' && gameState.selectedCard) {
        // フィールドのカードをターゲット選択
        selectTarget(card, cardElement);
    }
}

// カードを選択
function selectCard(card, cardElement) {
    // 既存の選択をクリア
    document.querySelectorAll('.card.selected').forEach(el => el.classList.remove('selected'));

    if (gameState.selectedCard?.instanceId === card.instanceId) {
        // 同じカードをクリックした場合は選択解除
        gameState.selectedCard = null;
    } else {
        // 新しいカードを選択
        if (players[gameState.currentPlayer].mana >= card.cost) {
            gameState.selectedCard = card;
            cardElement.classList.add('selected');
            addLog(`プレイヤー${gameState.currentPlayer}: ${card.name}を選択しました`, gameState.currentPlayer);
        } else {
            addLog(`マナが足りません！必要: ${card.cost}, 所有: ${players[gameState.currentPlayer].mana}`);
        }
    }
}

// ターゲットを選択
function selectTarget(targetCard, targetElement) {
    const player = players[gameState.currentPlayer];
    const opponent = players[gameState.currentPlayer === 1 ? 2 : 1];

    const selectedCard = gameState.selectedCard;

    // マナをチェック
    if (player.mana < selectedCard.cost) {
        addLog(`マナが足りません！`, gameState.currentPlayer);
        return;
    }

    // カードを配置
    player.hand = player.hand.filter(c => c.instanceId !== selectedCard.instanceId);
    player.field.push({
        ...selectedCard,
        instanceId: Math.random(),
        currentAttack: selectedCard.attack,
        canAttack: true,
    });

    // マナを消費
    player.mana -= selectedCard.cost;

    // ダメージ処理
    opponent.health -= selectedCard.attack;

    addLog(
        `プレイヤー${gameState.currentPlayer}: ${selectedCard.name}を配置し、${selectedCard.attack}ダメージを与えました`,
        gameState.currentPlayer
    );

    // ゲーム終了チェック
    if (opponent.health <= 0) {
        endGame(gameState.currentPlayer);
        return;
    }

    // 選択をクリア
    gameState.selectedCard = null;
    updateGameUI();
}

// ターンを終了
function endTurn() {
    if (!gameState.gameActive) return;

    const currentPlayer = gameState.currentPlayer;
    const opponent = gameState.currentPlayer === 1 ? 2 : 1;

    addLog(`プレイヤー${currentPlayer}のターン終了`, currentPlayer);

    // ターンを交代
    gameState.currentPlayer = opponent;
    gameState.currentTurn += 1;

    // マナを回復
    const opponentPlayer = players[opponent];
    opponentPlayer.mana = Math.min(opponentPlayer.maxMana, opponentPlayer.maxMana);

    // カードを引く
    drawCard(opponent, 1);

    // 攻撃フラグをリセット
    players[opponent].field.forEach(card => {
        card.canAttack = true;
    });

    addLog(`プレイヤー${opponent}のターン開始`, opponent);

    // 選択をクリア
    gameState.selectedCard = null;
    updateGameUI();
}

// ゲームを終了
function endGame(winner) {
    gameState.gameActive = false;
    addLog(`🎉 プレイヤー${winner}が勝利しました！🎉`);
    document.getElementById('statusMessage').textContent = `プレイヤー${winner}が勝利しました！`;
}

// ゲームを再スタート
function restartGame() {
    // ゲーム状態をリセット
    gameState.currentTurn = 1;
    gameState.currentPlayer = 1;
    gameState.gameActive = true;
    gameState.selectedCard = null;
    gameState.selectedTarget = null;

    // プレイヤーデータをリセット
    for (let playerId in players) {
        players[playerId].health = 100;
        players[playerId].maxHealth = 100;
        players[playerId].hand = [];
        players[playerId].field = [];
        players[playerId].mana = 5;
        players[playerId].maxMana = 5;
        initializeDeck(playerId);
    }

    // 初期手札を配置
    drawCard(1, 3);
    drawCard(2, 3);

    // ゲームログをクリア
    document.getElementById('gameLog').innerHTML = '';
    addLog('ゲーム開始！');
    addLog('プレイヤー1のターン開始', 1);

    // UI更新
    updateGameUI();
}

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
    restartGame();
});
