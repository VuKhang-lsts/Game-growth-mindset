/* ===================== BOOTSTRAP & GLOBALS ===================== */
let lastDtForBg = 1;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// HUD / Dialog refs
const winDlg       = document.getElementById("win");
const winSummaryEl = document.getElementById("winSummary");
const winRestart   = document.getElementById("winRestart");
let state = "intro";   // "intro" | "ready" | "playing" | "paused" | "victory" | "gameover"

const scoreEl  = document.getElementById("score");
const bestEl   = document.getElementById("best");
const msgEl    = document.getElementById("msg");
const livesEl  = document.getElementById("lives");
const playerEl = document.getElementById("player");
const qbanner  = document.getElementById("qbanner");
const helpBtn  = document.getElementById("helpBtn");
const timerEl  = document.getElementById("timer");
const toastEl  = document.getElementById("toast");
const qstatsEl = document.getElementById("qstats");

/* ===================== INTRO FORM ===================== */
const intro       = document.getElementById("intro");
const startBtn    = document.getElementById("startBtn");
const playerNameI = document.getElementById("playerName");
const dogStyleI   = document.getElementById("dogStyle");
let playerName    = "Player";

/* ===================== SPRITES ===================== */
const SPRITE_PATH = "assets/mrgold.png";
const spriteMrGold = new Image();
spriteMrGold.decoding = "async";
spriteMrGold.src = SPRITE_PATH;

let spriteReady = false;
if (spriteMrGold.decode) {
  spriteMrGold.decode().then(() => { spriteReady = true; })
    .catch(() => { spriteMrGold.onload = () => spriteReady = true; });
} else {
  spriteMrGold.onload = () => spriteReady = true;
}

ctx.imageSmoothingEnabled = true;

/* === EXCITER (overlay) === */
const EXCITER_PATH = "assets/exciter.png";
const exciterImg = new Image();
exciterImg.decoding = "async";
exciterImg.src = EXCITER_PATH;

let exciterReady = false;
if (exciterImg.decode) {
  exciterImg.decode().then(()=> exciterReady = true)
    .catch(()=> { exciterImg.onload = ()=> exciterReady = true; });
} else {
  exciterImg.onload = ()=> exciterReady = true;
}

const EXCITER_SHOW = true;
const EXCITER_ALPHA = 0.95;
const EXCITER_TOP_SCALE = 1.15;
const EXCITER_TOP_Y = 65;
const EXCITER_TOP_OFFSET_X = 0;

const DOG_SPRITE_W = 110;
const DOG_SPRITE_H = 62;

const EXCITER_ATTACK_MS = 1500;
const EXCITER_ATTACK_EASE = t => 1 - Math.pow(1 - t, 3);

let exciterMode = "followTop"; // "followTop" | "attack"
let exciterCX = 0, exciterCY = 0;
let exciterFrom = { x: 0, y: 0 };
let exciterTo   = { x: 0, y: 0 };
let exciterT0   = 0;

/* ===================== BACKGROUND ===================== */
const BG_PATH = "assets/bg.png";
const bgImg = new Image();
bgImg.decoding = "async";
bgImg.src = BG_PATH;

let bgReady = false;
if (bgImg.decode) {
  bgImg.decode().then(() => bgReady = true)
                .catch(() => { bgImg.onload = () => bgReady = true; });
} else {
  bgImg.onload = () => bgReady = true;
}

const BG_SCROLL_SPEED = 1.2;
let bgScrollX = 0;
ctx.imageSmoothingEnabled = true;

/* ===================== CONSTANTS ===================== */
const GRAVITY = 0.45;
const JUMP_VY = -8.5;
const PIPE_GAP = 150;
const PIPE_W = 60;
const PIPE_SPEED = 2.4;
const SPAWN_MS = 2100;
const INVINCIBLE_MS = 1000;

const START_LIVES = 5;
const MAX_LIVES_CAP = 10;

const BONE_R = 14;
const BONE_SCALE = 3;

// Q&A timing
const QUESTION_EVERY = 3;
const MAX_QUESTIONS = 20;
const QUESTION_LEAD_MS = 20000;       // 20s hiển thị câu hỏi
const AFTER_QUESTION_DELAY_MS = 5000; // 5s chờ sang màn
const SPEED_PX_PER_MS = PIPE_SPEED / 16.67;

// Heart giữa 2 ống
const HEART_R = 12;
const HEARTS_TOTAL = 20;
const MIN_HEART_GAP_X = 160;

// Q-items trong khoảng trống
const QITEM_R = 16;
const ICON_FONT = 'bold 26px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
const QITEM_Q_PHASE_MAX_PAIRS   = 3;
const QITEM_GAP_PHASE_MAX_PAIRS = 2;
const QITEM_SPAWN_MS_BASE_Q   = 1600;
const QITEM_SPAWN_MS_BASE_GAP = 1200;
const QITEM_SPAWN_JITTER      = 0.35;
const QITEM_MIN_Y = 60;
const QITEM_Y_GAP = 60;

/* ===================== STATE ===================== */
let dog, pipes, bones, hearts, qItems;
let score, best = 0, spawnTimer, lastTs;
let lives, invincibleUntil = 0;

// Q&A state
let questionPending = false;
let questionActive  = false;
let questionIndex   = 0;
let nextQuestionScore = QUESTION_EVERY;
let questionCountdownUntil = 0;
let QUESTIONS_RT = [];
let askedQuestions = []; // lưu các câu đã hiển thị (để recap)

// Sau Q&A
let afterQuestionUntil = 0;
let postCountdownUntil = 0;
let correctCount = 0, wrongCount = 0;
let resumeState = null;

// Heart giữa 2 ống
let currentStage = 1;
let heartPendingStage = 1;
let stageFirstPipeForHeart = null;
const heartSpawnedForStage = Array(HEARTS_TOTAL).fill(false);

// QItems quota
let nextQItemAt = 0;
let qPairsSpawnedInPhase = 0;
let gapPairsSpawnedInPhase = 0;

/* ===================== ENTITIES ===================== */
class Dog {
  constructor(x, y) { this.x = x; this.y = y; this.vy = 0; this.r = 18; }
  flap(){ this.vy = JUMP_VY; }
  update(dt){ this.vy += GRAVITY * dt; this.y += this.vy * dt; }
  draw(){
    const angle = Math.max(-0.6, Math.min(0.6, this.vy / 12));
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);
    if (spriteReady) {
      ctx.drawImage(spriteMrGold, -DOG_SPRITE_W/2, -DOG_SPRITE_H/2, DOG_SPRITE_W, DOG_SPRITE_H);
    } else {
      ctx.fillStyle = "#f4b400";
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}

class Bone {
  constructor(x, y, label, isCorrect){
    this.x = x; this.y = y; this.label = label; this.isCorrect = isCorrect; this.hit = false;
    this.r = BONE_R * BONE_SCALE;
  }
  update(dt){ this.x -= PIPE_SPEED * dt; }
  draw(){
    const s = BONE_SCALE;
    ctx.fillStyle = "#fffde7";
    ctx.beginPath(); ctx.arc(this.x-10*s, this.y-6*s, 6*s, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(this.x-10*s, this.y+6*s, 6*s, 0, Math.PI*2); ctx.fill();
    ctx.fillRect(this.x-10*s, this.y-6*s, 20*s, 12*s);
    ctx.beginPath(); ctx.arc(this.x+10*s, this.y-6*s, 6*s, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(this.x+10*s, this.y+6*s, 6*s, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = "#0b3d91";
    ctx.textAlign = "center";
    ctx.font = `bold ${Math.round(12*s)}px system-ui, Arial`;
    ctx.fillText(this.label, this.x, this.y + 4*s);
  }
}

class Heart {
  constructor(x,y){ this.x=x; this.y=y; this.r=HEART_R; this.hit=false; }
  update(dt){ this.x -= PIPE_SPEED * dt; }
  draw(){
    ctx.fillStyle="#e53935";
    ctx.beginPath();
    ctx.moveTo(this.x, this.y+4);
    ctx.bezierCurveTo(this.x+12, this.y-10, this.x+22, this.y+6, this.x, this.y+18);
    ctx.bezierCurveTo(this.x-22, this.y+6, this.x-12, this.y-10, this.x, this.y+4);
    ctx.fill();
  }
}

class QItem {
  constructor(x,y,type){ this.x=x; this.y=y; this.type=type; this.r=QITEM_R; this.hit=false; }
  update(dt){ this.x -= PIPE_SPEED * dt; }
  draw(){
    ctx.font = ICON_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const ch = (this.type==="pho") ? "🍜" : "💩";
    ctx.fillText(ch, this.x, this.y);
  }
}

/* ===================== HELPERS ===================== */
function updateLivesHUD(){
  livesEl.textContent = "❤".repeat(lives);
}
function updateQStats(){ qstatsEl.textContent = `Đúng: ${correctCount} | Sai: ${wrongCount}`; }

function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, m => (
    { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[m]
  ));
}
function formatMultiline(s){ return escapeHTML(s).replace(/\n/g, "<br>"); }

function showQBanner(html){
  qbanner.style.display = "block";
  qbanner.style.whiteSpace = "normal";
  qbanner.style.lineHeight = "1.25";
  qbanner.innerHTML = html;
}
function hideQBanner(){ qbanner.style.display="none"; }

function showToast(t, good=true){
  toastEl.style.display="block";
  toastEl.style.background = good ? "rgba(6,128,67,.9)" : "rgba(183,28,28,.9)";
  toastEl.textContent = t;
  clearTimeout(showToast._t); showToast._t = setTimeout(()=>toastEl.style.display="none", 1600);
}
function setTimerText(t){ timerEl.textContent = t || ""; }

function nearestPipeAhead(){
  let minX = Infinity, tgt = null;
  for (const p of pipes){ if (p.x + p.w > dog.x && p.x < minX){ minX = p.x; tgt = p; } }
  return tgt;
}
function canSpawnPipes(nowMs){ return !questionActive && !questionPending && nowMs >= afterQuestionUntil; }
function randJitter(base, pct){ const d = base * pct; return base + (Math.random()*2-1)*d; }

/* ===================== GROWTH RECAP ===================== */
const GROWTH_TIPS = [
  "Sai = dữ liệu học; ghi lại, tìm nguyên nhân gốc và sửa ở lần sau.",
  "Nói: “Chưa làm được… CHƯA” để mở cánh cửa tiến bộ.",
  "Tập trung vào quá trình: đặt mục tiêu nhỏ + đo tiến độ từng bước.",
  "Thử chiến lược mới khi dữ liệu báo xấu, đừng cố chấp.",
  "Xin phản hồi cụ thể, chọn phần hữu ích để áp dụng ngay.",
  "So sánh với chính mình của hôm qua, không phải với người khác.",
  "Luyện tập có chủ đích: mục tiêu rõ, phản hồi nhanh, lặp lại có chủ tâm.",
  "Ôn theo khoảng cách (spaced repetition) thay vì nhồi nhét một đêm.",
  "Dùng checklist/Pomodoro để tự giám sát sự tập trung.",
  "Chấp nhận thách thức; lỗi là bậc thang để giỏi hơn."
];
function pickRandomTips(n=6){
  const arr = [...GROWTH_TIPS];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr.slice(0, n);
}

function showRecapDialog(outcome){
  // cập nhật header/subtitle của dialog theo outcome
  const h2 = winDlg.querySelector("header h2");
  const sub = winDlg.querySelector("header p");
  if (outcome === "victory"){
    if (h2)  h2.textContent = "🎉 CHÚC MỪNG!";
    if (sub) sub.innerHTML = 'Bạn đã thoát khỏi <b>anh Exciter</b> và hoàn thành 20 câu hỏi!';
  } else {
    if (h2)  h2.textContent = "💡 BÀI HỌC SAU THẤT BẠI";
    if (sub) sub.innerHTML = 'Bạn đã bị <b>anh Exciter</b> bắt 🤣 — nhưng <b>thất bại = dữ liệu học</b>. Cùng tổng kết rồi chơi lại nhé!';
  }

  // thống kê
  const answered = correctCount + wrongCount;
  const acc = answered ? Math.round((correctCount/answered)*100) : 0;

  // 6 tip ngẫu nhiên vào <ul id="gmList">
  const gmList = winDlg.querySelector("#gmList");
  if (gmList){
    gmList.innerHTML = pickRandomTips(6).map(t=>`<li>${escapeHTML(t)}</li>`).join("");
  }

  // 3 câu gần nhất đã gặp
  const lastQs = askedQuestions.slice(-3).map(q =>
    `<li style="margin-bottom:6px">${formatMultiline(q.q)}<br><small>Đáp án đúng: <b>${q.correct}</b> — A) ${escapeHTML(q.a)} • B) ${escapeHTML(q.b)}</small></li>`
  ).join("");

  // phần summary
  winSummaryEl.innerHTML =
    `<div><b>Người chơi:</b> ${escapeHTML(playerName)}</div>
     <div><b>Điểm:</b> ${score}</div>
     <div><b>Đúng/Sai:</b> ${correctCount} / ${wrongCount} (Độ chính xác: ${acc}%)</div>
     <div><b>Mạng còn lại:</b> ${lives}</div>
     <details style="margin-top:8px">
       <summary><b>Xem lại 3 câu gần nhất</b></summary>
       <ul style="margin:6px 0 0 18px">${lastQs || "<li>(Chưa có câu hỏi nào)</li>"}</ul>
     </details>`;

  if (winDlg?.showModal) winDlg.showModal();
  else winDlg?.setAttribute("open","");
}

/* ===================== QUESTIONS (with CONTEXT) ===================== */
// 60 câu gốc (đáp án đúng mặc định A)
const QUESTIONS_POOL = [
  // 1–20 (giữ nguyên nội dung – đáp án đúng mặc định: A)
  { q:"Growth mindset là gì?", a:"Năng lực phát triển", b:"Năng lực cố định", correct:"A" },
  { q:"Khi làm sai, nên…", a:"Xem sai như dữ liệu học", b:"Tránh né, đổ lỗi", correct:"A" },
  { q:"Điểm thấp mình sẽ →", a:"Phân tích lỗi, điều chỉnh", b:"Kết luận mình dở", correct:"A" },
  { q:"Gặp bài khó mình sẽ→", a:"Chia nhỏ, thử chiến lược", b:"Bỏ qua cho đỡ mệt", correct:"A" },
  { q:"Nhận góp ý mình sẽ→", a:"Cảm ơn, áp dụng phần phù hợp", b:"Phản kháng, bào chữa", correct:"A" },
  { q:"Bạn giỏi lên do…", a:"Nỗ lực + chiến lược", b:"Bẩm sinh 100%", correct:"A" },
  { q:"Sai khác thất bại?", a:"Sai = bước học", b:"Sai = vô dụng", correct:"A" },
  { q:"Mục tiêu học:", a:"Tiến bộ từng bước", b:"Chỉ điểm cao ngay", correct:"A" },
  { q:"Thói quen hữu ích:", a:"Nhật ký học/retrospective", b:"Giấu sai, không xem", correct:"A" },
  { q:"Bạn bè giỏi hơn mình sẽ→", a:"Học từ bạn, xin mẹo", b:"Ganh tị, bỏ cuộc", correct:"A" },
  { q:"Bị deadline dí mình sẽ→", a:"Lập kế hoạch, ưu tiên", b:"Khoan đã, lướt mạng", correct:"A" },
  { q:"Tự nói với mình là", a:"Chưa làm được… CHƯA", b:"Không thể làm", correct:"A" },
  { q:"Sau điểm kém mình sẽ→", a:"Hỏi thầy cô, sửa lỗi", b:"Tránh môn đó", correct:"A" },
  { q:"Khi mắc lỗi mình sẽ→", a:"Tạm dừng và sẽ phân tích lỗi sai", b:"Giấu đi", correct:"A" },
  { q:"Nhìn nỗ lực là →", a:"Tập trung quá trình", b:"Chỉ nhìn kết quả", correct:"A" },
  { q:"Feedback khó nghe mình sẽ →", a:"Tách mình khỏi lỗi", b:"Cảm thấy bị xúc phạm", correct:"A" },
  { q:"So sánh đúng cách là", a:"Với chính mình hôm qua", b:"Để tự ti", correct:"A" },
  { q:"Bị từ chối mình sẽ →", a:"Rút kinh nghiệm, thử lại", b:"Không thử nữa", correct:"A" },
  { q:"Nhóm sai mình sẽ →", a:"Cùng kiểm tra giả thuyết", b:"Đổ lỗi cá nhân", correct:"A" },
  { q:"Động lực bền vững là", a:"Nội tại + mục tiêu rõ", b:"Chỉ phần thưởng", correct:"A" },

  // 21–60 (bổ sung)
  { q:"Cải thiện kỹ năng tốt nhất bằng…", a:"Luyện tập có chủ đích", b:"Chờ cảm hứng", correct:"A" },
  { q:"Khi bị phê bình công khai là", a:"Tách bản thân khỏi lỗi", b:"Tự ái rồi bỏ", correct:"A" },
  { q:"Chọn lớp khó hơn sẽ có→", a:"Cơ hội học nhanh hơn", b:"Rủi ro nên né", correct:"A" },
  { q:"Vấp lần 1 mình sẽ", a:"Đổi chiến lược", b:"Làm y chang", correct:"A" },
  { q:"Ghi chép học tập mình sẽ", a:"Theo tuần/retro", b:"Không cần", correct:"A" },
  { q:"Thiếu động lực mình sẽ", a:"Nhớ mục tiêu nội tại", b:"Bỏ qua mục tiêu", correct:"A" },
  { q:"Sai lầm của bạn học mình sẽ", a:"Cùng mổ xẻ để học", b:"Cười chê", correct:"A" },
  { q:"Thầy/cô góp ý mình sẽ", a:"Hỏi lại cho rõ", b:"Phớt lờ", correct:"A" },
  { q:"Đặt mục tiêu SMART là", a:"Cụ thể, đo được", b:"Mơ hồ", correct:"A" },
  { q:"Tài liệu khó hiểu mình sẽ", a:"Tìm ví dụ/diễn giải", b:"Bỏ qua đoạn đó", correct:"A" },
  { q:"Ôn tập hiệu quả mình sẽ", a:"Câu hỏi tự kiểm tra", b:"Chỉ đọc lướt", correct:"A" },
  { q:"Khi so sánh điểm mình sẽ", a:"Rút kinh nghiệm", b:"Tự ti/buông xuôi", correct:"A" },
  { q:"Thiếu thời gian mình sẽ", a:"Ưu tiên & chia nhỏ", b:"Làm ngẫu hứng", correct:"A" },
  { q:"Thử thách mới mình sẽ", a:"Chấp nhận và học", b:"Tránh để an toàn", correct:"A" },
  { q:"Lỗi lặp lại mình sẽ", a:"Tìm nguyên nhân gốc", b:"Đổ cho xui", correct:"A" },
  { q:"Học nhóm là", a:"Vai trò & mục tiêu rõ", b:"Tuỳ hứng", correct:"A" },
  { q:"Tài nguyên online mình sẽ", a:"Dùng có chọn lọc", b:"Tin mọi thứ", correct:"A" },
  { q:"Não có thể phát triển không?", a:"Có, nhờ rèn luyện", b:"Không, cố định", correct:"A" },
  { q:"Chán nản tạm thời thì mình sẽ", a:"Nghỉ ngắn rồi quay lại", b:"Bỏ hẳn", correct:"A" },
  { q:"Sai khác gian lận là ", a:"Sai để học", b:"Sai là xấu hổ", correct:"A" },
  { q:"Đối mặt lo âu thi cử mình sẽ", a:"Chuẩn bị + thực hành", b:"Cầu may", correct:"A" },
  { q:"Không hiểu bài giảng mình sẽ", a:"Hỏi & xem lại", b:"Giấu dốt", correct:"A" },
  { q:"Lịch học dài hạn mình sẽ", a:"Tạo thói quen", b:"Nước tới chân mới nhảy", correct:"A" },
  { q:"Ôn tập cuối kỳ mình sẽ", a:"Bắt đầu sớm, từng bước", b:"Nước rút 1 đêm", correct:"A" },
  { q:"Sử dụng phản hồi bạn bè mình sẽ", a:"Chọn phần hữu ích", b:"Bỏ qua hết", correct:"A" },
  { q:"Khi được khen thông minh mình sẽ", a:"Chuyển sang khen nỗ lực", b:"Tự mãn", correct:"A" },
  { q:"Đặt câu hỏi trên lớp là", a:"Giúp mình & bạn", b:"Sợ mắc cỡ", correct:"A" },
  { q:"Kỹ năng mới mình sẽ", a:"Học từ cơ bản", b:"Nhảy ngay phần khó", correct:"A" },
  { q:"Nhịp tiến bộ là", a:"So với chính mình", b:"Phải hơn tất cả", correct:"A" },
  { q:"Thất bại liên tiếp mình sẽ", a:"Điều chỉnh kế hoạch", b:"Bỏ cuộc", correct:"A" },
  { q:"Đổi chiến lược học ", a:"Khi dữ liệu báo xấu", b:"Cố chấp giữ cũ", correct:"A" },
  { q:"Nhận biết ‘fixed mindset’ là", a:"Tự bắt lỗi suy nghĩ", b:"Phớt lờ", correct:"A" },
  { q:"Quên bài mình sẽ", a:"Cách quãng (spaced)", b:"Nhồi 1 lần", correct:"A" },
  { q:"Tự giám sát tiến độ mình sẽ", a:"Checklists, tracker", b:"Để trí nhớ lo", correct:"A" },
  { q:"Câu hỏi tư duy:", a:"Vì sao? Như thế nào?", b:"Thôi khỏi hỏi", correct:"A" },
  { q:"Thiếu tự tin mình sẽ", a:"Chuẩn bị + thử nhỏ", b:"Không dám làm", correct:"A" },
  { q:"Sai do chủ quan mình sẽ", a:"Đổi thói quen xấu", b:"Đổ cho đề khó", correct:"A" },
  { q:"Nhìn nhận năng lực là", a:"Có thể phát triển", b:"Số phận an bài", correct:"A" },
  { q:"Đào sâu khái niệm là", a:"Ví dụ/đối ví dụ", b:"Học thuộc vẹt", correct:"A" },
  { q:"Mất tập trung mình sẽ áp dụng", a:"Kỹ thuật Pomodoro", b:"Vừa học vừa lướt", correct:"A" },
  { q:"Tự thưởng khi", a:"Sau cột mốc nhỏ", b:"Không cần kỷ luật", correct:"A" },
  { q:"Bài khó quá sức mình sẽ", a:"Xin trợ giúp", b:"Giấu bài", correct:"A" },
];

/* ====== BỐI CẢNH CHO 60 CÂU (1-based) ====== */
const QUESTION_CONTEXTS = {
  1:"Sinh hoạt lớp – đặt mục tiêu học kỳ mới.",
  2:"Sau khi nộp lab, bạn bị góp ý thiếu kiểm thử.",
  3:"Điểm giữa kỳ thấp hơn kỳ vọng dù đã học chăm.",
  4:"Gặp bài lập trình khó, bí ở bước phân tích đề.",
  5:"Feedback thuyết trình: nội dung rườm rà, dài dòng.",
  6:"Bạn tự nghĩ năng lực là ‘bẩm sinh’ nên nản.",
  7:"Hackathon: lỗi dựng môi trường lặp lại nhiều lần.",
  8:"GV nhấn mạnh: quá trình quan trọng không kém kết quả.",
  9:"Bạn muốn tiến bộ nhưng thường bỏ qua việc soi lỗi cũ.",
  10:"Trong nhóm có bạn rất giỏi, bạn mới làm quen.",
  11:"Cận hạn nộp demo, còn nhiều đầu việc tồn.",
  12:"Bạn thấy ‘chưa làm được’ bài tối ưu hoá.",
  13:"Bài trắc nghiệm thiếu 1–2 ý mấu chốt.",
  14:"Debug vội, ít đọc log và không ghi giả thuyết.",
  15:"Bạn nhìn điểm nhiều hơn nhìn tiến bộ cá nhân.",
  16:"Hội đồng phản biện thẳng thắn khiến bạn chạnh lòng.",
  17:"Bạn hay so sánh với người khác rồi nản.",
  18:"Ý tưởng startup bị loại ở vòng đầu.",
  19:"Nhóm tranh cãi do hiểu sai yêu cầu.",
  20:"Bạn muốn xây động lực học bền lâu.",
  21:"Bạn tập một kỹ năng mới (nhạc cụ/kỹ thuật).",
  22:"Bạn bị phê bình công khai trong buổi báo cáo.",
  23:"Phân vân chọn lớp nâng cao khó hơn.",
  24:"Bạn vấp lần đầu ở bài tập chương mới.",
  25:"Bạn dự định duy trì sổ tay/retro hằng tuần.",
  26:"Ôn thi dài hơi nhưng thiếu động lực.",
  27:"Nhìn thấy lỗi của bạn học trong bài demo.",
  28:"Thầy cô góp ý ngắn gọn, bạn chưa rõ ý.",
  29:"Nhóm đang đặt mục tiêu cho đồ án học kỳ.",
  30:"Đọc tài liệu học thuật khá khó hiểu.",
  31:"Chuẩn bị cho kiểm tra chương tuần tới.",
  32:"Xem lại bảng điểm sau bài kiểm tra.",
  33:"Ít thời gian, nhiều môn cần ôn.",
  34:"Bạn đăng ký thử thách hackathon mới.",
  35:"Một lỗi code tái diễn nhiều lần.",
  36:"Học nhóm nhưng dễ lan man.",
  37:"Nguồn tài nguyên online quá nhiều, nhiễu.",
  38:"Bạn đọc bài về tính dẻo của não bộ.",
  39:"Học dài, thấy chán nản tạm thời.",
  40:"Bạn phân vân giữa sai sót và gian lận.",
  41:"Bạn bị lo âu trước kỳ thi.",
  42:"Bạn không hiểu bài giảng hôm nay.",
  43:"Bạn muốn lập lịch học dài hạn.",
  44:"Gần đến mùa thi cuối kỳ.",
  45:"Bạn nhận phản hồi từ bạn bè.",
  46:"Bạn được khen ‘thông minh’.",
  47:"Trong giờ, bạn phân vân có nên hỏi.",
  48:"Bắt đầu học một kỹ năng mới.",
  49:"Bạn muốn theo dõi tiến bộ cá nhân.",
  50:"Thất bại vài lần liên tiếp.",
  51:"Số liệu học tập cho thấy hiệu quả giảm.",
  52:"Bạn nhận ra mình hay nghĩ ‘mình dở sẵn’.",
  53:"Ôn xong nhưng mau quên kiến thức.",
  54:"Bạn muốn tự theo dõi tiến độ học.",
  55:"Bạn đang luyện đặt câu hỏi sâu.",
  56:"Bạn thấy thiếu tự tin khi thuyết trình.",
  57:"Sai sót do chủ quan, ỷ y.",
  58:"Bạn tranh luận về ‘năng lực cố định’.",
  59:"Bạn cần đào sâu một khái niệm khó.",
  60:"Bạn dễ xao nhãng, muốn thử Pomodoro."
};

// ghép bối cảnh vào nội dung q
function combineContextIntoQ(baseQ, ctxStr){
  return ctxStr ? `Tình huống: ${ctxStr}\nCâu hỏi: ${baseQ}` : baseQ;
}

function prepareQuestions(){
  // 1) gắn bối cảnh trực tiếp vào q
  const poolWithCtx = QUESTIONS_POOL.map((q, i) => ({
    ...q,
    q: combineContextIntoQ(q.q, QUESTION_CONTEXTS[i+1] || "")
  }));
  // 2) xáo trộn
  const pool = [...poolWithCtx];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  // 3) chọn MAX_QUESTIONS
  const selected = pool.slice(0, MAX_QUESTIONS);
  // 4) đảo A/B khoảng 1/2 số câu
  const flips = Array(selected.length).fill(false).map((_,i)=> i < Math.floor(selected.length/2));
  for (let i = flips.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [flips[i], flips[j]] = [flips[j], flips[i]]; }
  // 5) áp dụng đảo
  QUESTIONS_RT = selected.map((q, idx) => (!flips[idx])
    ? { ...q }
    : { q: q.q, a: q.b, b: q.a, correct: (q.correct === "A" ? "B" : "A") }
  );
}

/* ===================== GAME FLOW ===================== */
function reset(){
  dog = new Dog(80, canvas.height/2);
  pipes = []; bones = []; hearts = []; qItems = [];
  score = 0; spawnTimer = 0; lastTs = 0;
  lives = START_LIVES; invincibleUntil = 0;

  questionPending=false; questionActive=false; questionIndex=0;
  nextQuestionScore = QUESTION_EVERY; questionCountdownUntil = 0;

  afterQuestionUntil = 0; postCountdownUntil = 0; nextQItemAt = 0;
  qPairsSpawnedInPhase = 0; gapPairsSpawnedInPhase = 0;
  correctCount = 0; wrongCount = 0; resumeState = null;

  heartSpawnedForStage.fill(false);
  currentStage = 1; heartPendingStage = 1; stageFirstPipeForHeart = null;

  askedQuestions = [];
  prepareQuestions();

  exciterMode = "followTop";
  exciterCX = dog.x + EXCITER_TOP_OFFSET_X;
  exciterCY = EXCITER_TOP_Y;

  scoreEl.textContent = score;
  best = Number(localStorage.getItem("flappyDogBest") || 0);
  bestEl.textContent = `Best: ${best}`;
  updateLivesHUD(); updateQStats(); setTimerText(""); hideQBanner();
  msgEl.textContent = "Nhấn Space / Click để bắt đầu";
}

function spawnPipe(){
  const minTop=50, maxTop=canvas.height - PIPE_GAP - 100;
  const top = minTop + Math.random()*(maxTop-minTop);
  const p = { x: canvas.width, top, gap: PIPE_GAP, w: PIPE_W, scored:false };
  pipes.push(p);

  // tim giữa hai ống – mỗi màn 1 tim
  if (heartPendingStage && heartPendingStage <= HEARTS_TOTAL && !heartSpawnedForStage[heartPendingStage-1]){
    if (!stageFirstPipeForHeart){
      stageFirstPipeForHeart = p;
    } else {
      const prev = stageFirstPipeForHeart;
      const gapStart = prev.x + prev.w;
      const gapEnd   = p.x;
      const gapWidth = gapEnd - gapStart;
      if (gapWidth >= MIN_HEART_GAP_X){
        const midX = gapStart + gapWidth/2;
        const y = 80 + Math.random()*(canvas.height - 160);
        hearts.push(new Heart(midX, y));
        heartSpawnedForStage[heartPendingStage-1] = true;
        heartPendingStage = null;
        stageFirstPipeForHeart = null;
      } else {
        stageFirstPipeForHeart = p;
      }
    }
  }
}

function updatePipes(dt){
  const dx = PIPE_SPEED*dt;
  pipes.forEach(p=>p.x-=dx);
  while (pipes.length && pipes[0].x + pipes[0].w < 0) pipes.shift();
}

function drawPipes(){
  ctx.fillStyle="#4caf50";
  pipes.forEach(p=>{
    ctx.fillRect(p.x,0,p.w,p.top);
    const bottomY = p.top + p.gap;
    ctx.fillRect(p.x,bottomY,p.w,canvas.height-bottomY);
  });
}

function collided(){
  if (performance.now() < invincibleUntil) return false;
  if (dog.y - dog.r <= 0 || dog.y + dog.r >= canvas.height) return true;
  for (const p of pipes){
    const inX = dog.x + dog.r > p.x && dog.x - dog.r < p.x + p.w;
    const inGap = dog.y - dog.r >= p.top && dog.y + dog.r <= p.top + p.gap;
    if (inX && !inGap) return true;
  }
  return false;
}

function updateScore(nowMs){
  for (const p of pipes){
    if (!p.scored && p.x + p.w < dog.x){
      p.scored = true; score += 1; scoreEl.textContent = score;
      if (!questionActive && !questionPending && questionIndex < MAX_QUESTIONS && score >= nextQuestionScore){
        questionPending = true;
        nextQuestionScore += QUESTION_EVERY;
      }
    }
  }
}

function loseLife(){
  if (lives > 1){
    lives -= 1; updateLivesHUD();
    dog.y = canvas.height/2; dog.vy = 0;
    invincibleUntil = performance.now() + INVINCIBLE_MS;
    pipes = pipes.filter(p=>p.x + p.w >= dog.x - 10);
    msgEl.textContent = "Cố lên! -1 mạng • Tiếp tục!";
  } else {
    // hết mạng → kích hoạt cutscene Exciter lao xuống, sau đó gameOver()
    lives = 0; updateLivesHUD();
    pipes = []; hearts = []; bones = []; qItems = [];
    dog.vy = 0;

    const nowMs = performance.now();
    exciterFrom = { x: exciterCX || (dog.x + EXCITER_TOP_OFFSET_X), y: EXCITER_TOP_Y };
    exciterTo   = { x: dog.x, y: dog.y };
    exciterT0   = nowMs;
    exciterMode = "attack";
    state = "gameover_attack";
    msgEl.textContent = "";
  }
}

function gameOver(){
  state = "gameover";
  best = Math.max(best, score);
  localStorage.setItem("flappyDogBest", best);
  bestEl.textContent = `Best: ${best}`;
  hideQBanner(); setTimerText("");
  msgEl.textContent = "Mr.Gold đi rồi Ông Giáo ơiiiii😅 — Nhấn Space / Click để chơi lại";
  showRecapDialog("gameover"); // ← đúc kết khi THUA
}

function gameWin(){
  state = "victory";
  hideQBanner(); setTimerText("");
  // dọn bớt vật thể để tập trung dialog
  pipes = []; bones = []; qItems = [];
  dog.vy = 0;
  showRecapDialog("victory");  // ← đúc kết khi THẮNG
}

/* ===================== QUESTION FLOW ===================== */
function questionPointFor(n){ if (n<=5) return 1; if (n<=10) return 2; if (n<=15) return 3; return 4; }

function spawnQuestion(nowMs){
  questionActive = true; questionPending = false;
  spawnTimer = 0;

  const Q = QUESTIONS_RT[questionIndex % QUESTIONS_RT.length];
  const idx = questionIndex + 1;
  const pts = questionPointFor(idx);
  questionCountdownUntil = nowMs + QUESTION_LEAD_MS;

  showQBanner(
    `<div><b>Câu ${idx}/${MAX_QUESTIONS}</b> (±${pts}đ)</div>
     <div style="margin-top:4px">${formatMultiline(Q.q)}</div>
     <div style="margin-top:4px">A) ${escapeHTML(Q.a)} &nbsp;&nbsp; B) ${escapeHTML(Q.b)}</div>`
  );

  const distancePx = SPEED_PX_PER_MS * QUESTION_LEAD_MS;
  const targetX = Math.max(canvas.width + 100, dog.x + distancePx + 40);
  const yMid = canvas.height/2;
  const delta = Math.round(70 * Math.max(1, BONE_SCALE));
  bones = [
    new Bone(targetX, yMid - delta, "A", Q.correct === "A"),
    new Bone(targetX, yMid + delta, "B", Q.correct === "B"),
  ];

  // lưu lại để recap
  askedQuestions.push({ q: Q.q, a: Q.a, b: Q.b, correct: Q.correct });

  // quota Q-items trong phase Q&A
  qPairsSpawnedInPhase = 0;
  nextQItemAt = nowMs + randJitter(QITEM_SPAWN_MS_BASE_Q, QITEM_SPAWN_JITTER);

  questionIndex += 1;
}

function finishQuestion(nowMs, isCorrect){
  const idx = questionIndex;
  const pts = questionPointFor(idx);
  if (isCorrect){ correctCount += 1; score += pts; showToast(`Chính xác! +${pts}đ 🎉`, true); }
  else { wrongCount += 1; score -= pts; showToast(`Sai! -${pts}đ ❌`, false); loseLife(); }
  scoreEl.textContent = score; updateQStats();

  if (questionIndex >= MAX_QUESTIONS){
    return gameWin();
  }

  questionActive = false; bones = []; hideQBanner();
  pipes = [];
  afterQuestionUntil = nowMs + AFTER_QUESTION_DELAY_MS;
  postCountdownUntil = afterQuestionUntil;

  // quota Q-items trong phase 5s chờ
  gapPairsSpawnedInPhase = 0;
  nextQItemAt = nowMs + randJitter(QITEM_SPAWN_MS_BASE_GAP, QITEM_SPAWN_JITTER);

  // chuẩn bị tim cho màn kế
  currentStage = Math.min(questionIndex + 1, HEARTS_TOTAL);
  if (currentStage <= HEARTS_TOTAL){ heartPendingStage = currentStage; stageFirstPipeForHeart = null; }
}

function updateBones(dt, nowMs){
  bones.forEach(b => b.update(dt));
  while (bones.length && bones[0].x + 20 < 0) bones.shift();
  if (questionActive && bones.length === 0) finishQuestion(nowMs, false);
}
function checkBoneCollisions(nowMs){
  if (!questionActive) return;
  for (const b of bones){
    const dx = dog.x - b.x, dy = dog.y - b.y;
    const rr = (dog.r + b.r)*(dog.r + b.r);
    if (dx*dx + dy*dy <= rr && !b.hit){
      b.hit = true; finishQuestion(nowMs, !!b.isCorrect); break;
    }
  }
}

/* ===================== Q-ITEMS IN PHASES ===================== */
function itemsPhaseActive(nowMs){ return questionActive || nowMs < afterQuestionUntil; }
function maybeSpawnQItems(nowMs){
  if (!itemsPhaseActive(nowMs)) return;
  if (nowMs < nextQItemAt) return;

  if (questionActive){
    if (qPairsSpawnedInPhase >= QITEM_Q_PHASE_MAX_PAIRS) return;
    qPairsSpawnedInPhase += 1;
    nextQItemAt = nowMs + randJitter(QITEM_SPAWN_MS_BASE_Q, QITEM_SPAWN_JITTER);
  } else {
    if (gapPairsSpawnedInPhase >= QITEM_GAP_PHASE_MAX_PAIRS) return;
    gapPairsSpawnedInPhase += 1;
    nextQItemAt = nowMs + randJitter(QITEM_SPAWN_MS_BASE_GAP, QITEM_SPAWN_JITTER);
  }

  // sinh "cặp" 🍜/💩 lệch Y
  const y1 = QITEM_MIN_Y + Math.random()*(canvas.height - QITEM_MIN_Y*2);
  let y2 = QITEM_MIN_Y + Math.random()*(canvas.height - QITEM_MIN_Y*2);
  if (Math.abs(y2 - y1) < QITEM_Y_GAP){
    y2 = y1 + (y2 < y1 ? -QITEM_Y_GAP : QITEM_Y_GAP);
    y2 = Math.max(QITEM_MIN_Y, Math.min(canvas.height - QITEM_MIN_Y, y2));
  }
  const x = canvas.width + 60;
  qItems.push(new QItem(x, y1, "pho"));
  qItems.push(new QItem(x + 28, y2, "chem"));
}
function updateQItems(dt){
  qItems.forEach(it => it.update(dt));
  while (qItems.length && qItems[0].x + QITEM_R < 0) qItems.shift();
}
function checkQItemCollisions(){
  for (const it of qItems){
    const dx = dog.x - it.x, dy = dog.y - it.y;
    if (dx*dx + dy*dy <= (dog.r + it.r)*(dog.r + it.r) && !it.hit){
      it.hit = true;
      if (it.type === "pho"){
        if (lives < MAX_LIVES_CAP){ lives += 1; updateLivesHUD(); showToast("🍜 +1 mạng", true); }
        else showToast(`Đã đạt tối đa ${MAX_LIVES_CAP} mạng`, true);
      } else {
        showToast("💩 -1 mạng", false);
        loseLife();
      }
    }
  }
  qItems = qItems.filter(it => !it.hit);
}

/* ===================== HEARTS ===================== */
function updateHearts(dt){
  hearts.forEach(h => h.update(dt));
  while (hearts.length && hearts[0].x + HEART_R < 0) hearts.shift();
}
function checkHeartCollisions(){
  for (const h of hearts){
    const dx = dog.x - h.x, dy = dog.y - h.y;
    if (dx*dx + dy*dy <= (dog.r + h.r)*(dog.r + h.r) && !h.hit){
      h.hit = true;
      if (lives < MAX_LIVES_CAP){ lives += 1; updateLivesHUD(); showToast("Đã nhặt tim! +1 mạng ❤️", true); }
      else showToast(`Đã đạt tối đa ${MAX_LIVES_CAP} mạng`, true);
    }
  }
  hearts = hearts.filter(h => !h.hit);
}

/* ===================== RENDER & LOOP ===================== */
function drawBackground(){
  if (bgReady){
    const scale = Math.max(canvas.width / bgImg.width, canvas.height / bgImg.height);
    const w = bgImg.width  * scale;
    const h = bgImg.height * scale;

    bgScrollX -= BG_SCROLL_SPEED * lastDtForBg;
    let startX = bgScrollX % w;
    if (startX > 0) startX -= w;

    for (let x = startX; x < canvas.width; x += w){
      ctx.drawImage(bgImg, 0, 0, bgImg.width, bgImg.height, x, 0, w, h);
    }
  } else {
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.fillStyle="#009688";
  ctx.fillRect(0, canvas.height-10, canvas.width, 10);
}

function drawTitle(){
  ctx.fillStyle="#08357e";
  ctx.font="bold 28px system-ui, Arial";
  ctx.textAlign="center";
  ctx.fillText("FLAPPY MR.GOLD", canvas.width/2, 80);
}

function updateTimerUI(nowMs){
  if (questionActive){
    const left = Math.max(0, Math.ceil((questionCountdownUntil - nowMs)/1000));
    setTimerText(`⏳ ${left}s`);
  } else if (nowMs < afterQuestionUntil && postCountdownUntil){
    const left = Math.max(0, Math.ceil((postCountdownUntil - nowMs)/1000));
    setTimerText(`Sang màn sau: ${left}s`);
  } else setTimerText("");
}

function drawExciter(nowMs){
  if (!EXCITER_SHOW || !exciterReady) return;
  const ratio = (exciterImg.naturalHeight || 1) / (exciterImg.naturalWidth || 1);
  const eW = DOG_SPRITE_W * EXCITER_TOP_SCALE * 1.6;
  const eH = eW * ratio;

  if (exciterMode === "followTop"){
    const targetX = dog.x + EXCITER_TOP_OFFSET_X;
    exciterCX += (targetX - exciterCX) * 0.18;
    exciterCY  = EXCITER_TOP_Y;
  } else if (exciterMode === "attack"){
    const t  = Math.min(1, (nowMs - exciterT0) / EXCITER_ATTACK_MS);
    const p  = EXCITER_ATTACK_EASE(t);
    exciterCX = exciterFrom.x + (exciterTo.x - exciterFrom.x) * p;
    exciterCY = exciterFrom.y + (exciterTo.y - exciterFrom.y) * p;
    if (t >= 1){ exciterMode = "followTop"; gameOver(); }
  }

  ctx.save();
  ctx.globalAlpha = EXCITER_ALPHA;
  ctx.drawImage(exciterImg, exciterCX - eW/2, exciterCY - eH/2, eW, eH);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function loop(ts){
  const dtMs = lastTs ? ts - lastTs : 16.67; lastTs = ts;
  const dt = dtMs / 16.67;
  lastDtForBg = dt;
  const nowMs = performance.now();

  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawBackground();

  if (state === "playing" && questionPending){
    const ahead = nearestPipeAhead(); if (!ahead) spawnQuestion(nowMs);
  }

  if (state === "intro" || state === "ready" || state === "paused"){
    dog.y = canvas.height/2 + Math.sin(ts/350)*8; dog.draw(); drawTitle();
  } else if (state === "playing"){
    if (canSpawnPipes(nowMs)){ spawnTimer += dtMs; if (spawnTimer > SPAWN_MS){ spawnPipe(); spawnTimer = 0; } }

    // vật phẩm trong phase Q&A / nghỉ 5s
    maybeSpawnQItems(nowMs);

    dog.update(dt);
    updatePipes(dt);
    updateHearts(dt);
    updateQItems(dt);
    updateBones(dt, nowMs);

    drawPipes();
    hearts.forEach(h=>h.draw());
    qItems.forEach(it=>it.draw());
    bones.forEach(b=>b.draw());
    dog.draw();

    updateScore(nowMs);
    checkHeartCollisions();
    checkQItemCollisions();
    checkBoneCollisions(nowMs);

    if (collided()) loseLife();
  } else if (state === "gameover" || state === "victory"){
    drawPipes(); hearts.forEach(h=>h.draw()); qItems.forEach(it=>it.draw()); bones.forEach(b=>b.draw()); dog.draw();
  }

  updateTimerUI(nowMs);
  msgEl.style.opacity = state === "playing" ? 0 : 1;
  requestAnimationFrame(loop);
  drawExciter(nowMs);
}

/* ===================== CONTROLS ===================== */
function isTypingInForm(){
  const a = document.activeElement; if (!a) return false;
  const tag = a.tagName;
  return tag==="INPUT" || tag==="TEXTAREA" || tag==="SELECT" || a.isContentEditable || (intro?.open && intro.contains(a));
}
function startGame(){
  if (state === "intro"){ if (intro?.open) intro.close(); msgEl.textContent=""; state="playing"; dog.flap(); return; }
  if (state === "ready"){ msgEl.textContent=""; state="playing"; dog.flap(); }
  else if (state === "paused"){ if (intro?.open) intro.close(); state = resumeState || "playing"; resumeState=null; }
  else if (state === "gameover"){ reset(); state="ready"; }
  else if (state === "playing"){ dog.flap(); }
}
window.addEventListener("keydown",(e)=>{
  if (isTypingInForm()) return;
  if (e.code==="Space" || e.key===" "){ e.preventDefault(); startGame(); }
  if ((e.key==="Enter" || e.code==="Enter") && (state==="intro" || state==="paused")){ e.preventDefault(); startGame(); }
});
window.addEventListener("mousedown", ()=>{ if (!intro?.open) startGame(); });
window.addEventListener("touchstart", (e)=>{ if (!intro?.open){ e.preventDefault(); startGame(); } }, {passive:false});

function openIntro(){
  const savedName = localStorage.getItem("flappyDogName");
  const savedSkin = localStorage.getItem("flappyDogSkin"); // dự phòng nếu dùng skin
  if (savedName) playerNameI.value = savedName;
  if (savedSkin && dogStyleI.querySelector(`option[value="${savedSkin}"]`)) dogStyleI.value = savedSkin;
  if (intro && typeof intro.showModal==="function") intro.showModal();
  else if (intro) intro.setAttribute("open","");
}
startBtn?.addEventListener("click", ()=>{
  playerName = (playerNameI.value||"").trim() || "Player";
  const currentSkin = dogStyleI.value || "photo";
  localStorage.setItem("flappyDogName", playerName);
  localStorage.setItem("flappyDogSkin", currentSkin);
  playerEl.textContent = `👤 ${playerName}`;
  startGame();
});
helpBtn?.addEventListener("click", ()=>{
  if (state==="playing"){ resumeState="playing"; state="paused"; }
  openIntro();
});

/* ===================== INIT ===================== */
playerEl.textContent = `👤 ${playerName}`;
reset();
openIntro();
requestAnimationFrame(loop);

winRestart?.addEventListener("click", ()=>{
  if (winDlg?.open) winDlg.close();
  reset(); state = "ready";
});



