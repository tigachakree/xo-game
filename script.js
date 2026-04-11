/*
  Tic-Tac-Toe (XO) - Vanilla JS
  ฟีเจอร์:
  - เลือกโหมด: ผู้เล่น vs ผู้เล่น / ผู้เล่น vs บอท
  - แสดงตาเดิน, ตรวจชนะ/เสมอ
  - ไฮไลต์ช่องที่ชนะ
  - บอทมี delay เล็กน้อย และใช้ logic พื้นฐาน (ชนะได้ก็ชนะ, ไม่งั้นบล็อก, ไม่งั้นเลือกกลาง/สุ่ม)
*/

// ===== DOM =====
const menuEl = document.getElementById("menu");
const gameEl = document.getElementById("game");
const boardEl = document.getElementById("board");
const statusEl = document.getElementById("statusText");
const modeLabelEl = document.getElementById("modeLabel");

const btnPvp = document.getElementById("btnPvp");
const btnBot = document.getElementById("btnBot");
const btnNew = document.getElementById("btnNew");
const btnBack = document.getElementById("btnBack");

// ===== ค่าคงที่ =====
const PLAYER_X = "X";
const PLAYER_O = "O";
const BOT_DELAY_MS = 500;

// รูปแบบเส้นที่ชนะ (index ของช่อง 0..8)
const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

// ===== สถานะเกม =====
let mode = null; // "pvp" | "bot"
let board = Array(9).fill(null); // null | "X" | "O"
let currentPlayer = PLAYER_X;
let gameActive = false;
let botThinking = false;
let audioContext = null;

function getAudioContext() {
  if (!window.AudioContext && !window.webkitAudioContext) return null;

  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

function playTone(options) {
  const context = getAudioContext();
  if (!context) return;

  const {
    frequency,
    duration = 0.14,
    startTime = 0,
    type = "sine",
    volume = 0.03,
    attack = 0.01,
    release = 0.08,
  } = options;

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const noteStart = context.currentTime + startTime;
  const noteEnd = noteStart + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, noteStart);
  gainNode.gain.setValueAtTime(0.0001, noteStart);
  gainNode.gain.exponentialRampToValueAtTime(volume, noteStart + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd + release);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(noteStart);
  oscillator.stop(noteEnd + release);
}

function playUiTap() {
  playTone({ frequency: 520, duration: 0.05, type: "triangle", volume: 0.02, release: 0.05 });
  playTone({ frequency: 700, duration: 0.04, startTime: 0.025, type: "triangle", volume: 0.015, release: 0.04 });
}

function playMoveSound(player) {
  if (player === PLAYER_X) {
    playTone({ frequency: 320, duration: 0.08, type: "triangle", volume: 0.035, release: 0.06 });
    playTone({ frequency: 430, duration: 0.07, startTime: 0.05, type: "triangle", volume: 0.025, release: 0.05 });
    return;
  }

  playTone({ frequency: 540, duration: 0.08, type: "sine", volume: 0.03, release: 0.06 });
  playTone({ frequency: 680, duration: 0.08, startTime: 0.05, type: "sine", volume: 0.024, release: 0.05 });
}

function playWinSound() {
  playTone({ frequency: 523.25, duration: 0.12, type: "triangle", volume: 0.03, release: 0.08 });
  playTone({ frequency: 659.25, duration: 0.14, startTime: 0.09, type: "triangle", volume: 0.034, release: 0.08 });
  playTone({ frequency: 783.99, duration: 0.18, startTime: 0.18, type: "triangle", volume: 0.038, release: 0.12 });
}

function playDrawSound() {
  playTone({ frequency: 392, duration: 0.12, type: "sine", volume: 0.022, release: 0.08 });
  playTone({ frequency: 349.23, duration: 0.14, startTime: 0.1, type: "sine", volume: 0.02, release: 0.08 });
  playTone({ frequency: 329.63, duration: 0.16, startTime: 0.2, type: "sine", volume: 0.018, release: 0.1 });
}

// ===== สร้างช่องกระดาน =====
function buildBoardUI() {
  boardEl.innerHTML = "";

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `ช่องที่ ${i + 1}`);
    cell.dataset.index = String(i);
    cell.addEventListener("click", onCellClick);
    boardEl.appendChild(cell);
  }
}

function showMenu() {
  menuEl.classList.remove("hidden");
  gameEl.classList.add("hidden");
  mode = null;

  // Restore the default split red/blue background on the menu screen.
  document.body.classList.remove("turn-x", "turn-o");
}

function showGame() {
  menuEl.classList.add("hidden");
  gameEl.classList.remove("hidden");
}

// ===== เริ่ม/รีเซ็ตเกม =====
function startGame(selectedMode) {
  playUiTap();
  mode = selectedMode;
  modeLabelEl.textContent = mode === "bot" ? "Mode: Play vs Bot" : "Mode: Two Players";

  resetGameState();
  showGame();
  render();

  // โหมดบอทกำหนดให้ผู้เล่นเป็น X เสมอ
  if (mode === "bot") currentPlayer = PLAYER_X;
  
  // Set initial background color
  document.body.classList.remove("turn-x", "turn-o");
  document.body.classList.add("turn-x");
  
  updateStatus();
}

function resetGameState() {
  board = Array(9).fill(null);
  currentPlayer = PLAYER_X;
  gameActive = true;
  botThinking = false;
  clearWinHighlight();
}

// ===== เรนเดอร์ UI =====
function render() {
  const cells = boardEl.querySelectorAll(".cell");
  cells.forEach((cell, idx) => {
    const value = board[idx];
    cell.textContent = value ?? "";
    cell.classList.toggle("used", value !== null);
    cell.classList.toggle("x", value === PLAYER_X);
    cell.classList.toggle("o", value === PLAYER_O);
    cell.disabled = !gameActive || botThinking || value !== null;
  });
}

function updateStatus(messageOverride) {
  if (messageOverride) {
    statusEl.textContent = messageOverride;
    return;
  }

  if (!gameActive) return;

  // Update background color based on current player
  document.body.classList.remove("turn-x", "turn-o");
  document.body.classList.add(currentPlayer === PLAYER_X ? "turn-x" : "turn-o");

  if (mode === "bot") {
    statusEl.textContent = currentPlayer === PLAYER_X ? "Your Turn (X)" : "Bot's Turn (O)";
  } else {
    statusEl.textContent = `Player ${currentPlayer}'s Turn`;
  }
}

function clearWinHighlight() {
  boardEl.querySelectorAll(".cell.win").forEach((c) => c.classList.remove("win"));
}

function highlightWin(line) {
  line.forEach((idx) => {
    const cell = boardEl.querySelector(`.cell[data-index="${idx}"]`);
    if (cell) cell.classList.add("win");
  });
}

// ===== กติกา: ตรวจชนะ/เสมอ =====
function getWinnerInfo(b) {
  for (const line of WIN_LINES) {
    const [a, c, d] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) {
      return { winner: b[a], line };
    }
  }
  return null;
}

function isDraw(b) {
  return b.every((v) => v !== null);
}

function endGame(message, winLine = null) {
  gameActive = false;
  botThinking = false;
  if (winLine) highlightWin(winLine);
  updateStatus(message);
  render();

  if (winLine) {
    playWinSound();
  } else {
    playDrawSound();
  }
}

// ===== การเล่น: คลิกช่อง =====
function onCellClick(e) {
  const cell = e.currentTarget;
  const index = Number(cell.dataset.index);

  if (!gameActive) return;
  if (botThinking) return; // กันผู้เล่นกดระหว่างบอทคิด
  if (board[index] !== null) return; // กันการกดช่องซ้ำ

  // โหมดบอท: ผู้เล่นเดินได้เฉพาะตอนเป็น X
  if (mode === "bot" && currentPlayer !== PLAYER_X) return;

  placeMark(index, currentPlayer);
  playMoveSound(currentPlayer);

  const winnerInfo = getWinnerInfo(board);
  if (winnerInfo) {
    const label = mode === "bot" ? (winnerInfo.winner === PLAYER_X ? "You Win!" : "Bot Wins!") : `Player ${winnerInfo.winner} Wins!`;
    endGame(label, winnerInfo.line);
    return;
  }

  if (isDraw(board)) {
    endGame("Draw!");
    return;
  }

  // สลับตา
  currentPlayer = currentPlayer === PLAYER_X ? PLAYER_O : PLAYER_X;
  
  // Update background color based on new player
  document.body.classList.remove("turn-x", "turn-o");
  document.body.classList.add(currentPlayer === PLAYER_X ? "turn-x" : "turn-o");
  
  updateStatus();
  render();

  // ถ้าเป็นโหมดบอท และถึงตา O -> ให้บอทเดิน
  if (mode === "bot" && currentPlayer === PLAYER_O) {
    botMoveWithDelay();
  }
}

function placeMark(index, player) {
  board[index] = player;
}

// ===== บอท (AI แบบง่าย) =====
function botMoveWithDelay() {
  botThinking = true;
  updateStatus("Bot is thinking...");
  render();

  window.setTimeout(() => {
    if (!gameActive) return;

    const index = chooseBotMove(board);
    if (index === -1) return;

    placeMark(index, PLAYER_O);
    playMoveSound(PLAYER_O);

    const winnerInfo = getWinnerInfo(board);
    if (winnerInfo) {
      endGame("Bot Wins!", winnerInfo.line);
      return;
    }

    if (isDraw(board)) {
      endGame("Draw!");
      return;
    }

    currentPlayer = PLAYER_X;
    
    // Update background color
    document.body.classList.remove("turn-x", "turn-o");
    document.body.classList.add("turn-x");
    
    botThinking = false;
    updateStatus();
    render();
  }, BOT_DELAY_MS);
}

function chooseBotMove(b) {
  const empty = getEmptyIndices(b);
  if (empty.length === 0) return -1;

  // 1) ถ้าบอทชนะได้ทันที -> เดินช่องนั้น
  const winNow = findWinningMove(b, PLAYER_O);
  if (winNow !== -1) return winNow;

  // 2) ถ้าผู้เล่นกำลังจะชนะ -> บล็อก
  const block = findWinningMove(b, PLAYER_X);
  if (block !== -1) return block;

  // 3) ถ้ากลางว่าง -> เลือกกลาง
  if (b[4] === null) return 4;

  // 4) ไม่งั้นสุ่มจากช่องว่าง
  return empty[Math.floor(Math.random() * empty.length)];
}

function getEmptyIndices(b) {
  const result = [];
  for (let i = 0; i < b.length; i++) {
    if (b[i] === null) result.push(i);
  }
  return result;
}

function findWinningMove(b, player) {
  // ลองใส่ player ลงในช่องว่างแต่ละช่อง แล้วเช็คว่าชนะไหม
  const empty = getEmptyIndices(b);
  for (const idx of empty) {
    const copy = b.slice();
    copy[idx] = player;
    if (getWinnerInfo(copy)) return idx;
  }
  return -1;
}

// ===== ปุ่มและการนำทาง =====
btnPvp.addEventListener("click", () => startGame("pvp"));
btnBot.addEventListener("click", () => startGame("bot"));

btnNew.addEventListener("click", () => {
  if (!mode) return;
  playUiTap();
  resetGameState();
  
  // Set initial background color
  document.body.classList.remove("turn-x", "turn-o");
  document.body.classList.add("turn-x");
  
  updateStatus();
  render();

  // ถ้าอยู่โหมดบอท ให้เริ่มที่ผู้เล่น X เสมอ
  if (mode === "bot") currentPlayer = PLAYER_X;
  updateStatus();
});

btnBack.addEventListener("click", () => {
  playUiTap();
  // กลับเมนูและหยุดเกมปัจจุบัน
  gameActive = false;
  botThinking = false;
  showMenu();
});

// ===== เริ่มต้นเมื่อเปิดหน้าเว็บ =====
buildBoardUI();
showMenu();
