/**
 * BASP v5.1 — Dashboard Home + Profile
 * 无底部Tab · 首页总览 · 「我的」个人中心
 */

// ==================== Curriculum & Packages ====================
const DEFAULT_CURRICULUM = (typeof CURRICULUM_DATA !== 'undefined') ? CURRICULUM_DATA : [];
const DEFAULT_PACKAGES = [
  { id: 'pkg1', name: '单次体验', hours: 1 }, { id: 'pkg2', name: '10节课', hours: 10 },
  { id: 'pkg3', name: '20节课', hours: 20 }, { id: 'pkg4', name: '30节课', hours: 30 },
  { id: 'pkg5', name: '包月', hours: 30 }, { id: 'pkg6', name: '包季', hours: 90 }
];

// ==================== Data Layer ====================
const DB = {
  _prefix: '',
  setTrainer(tid) { this._prefix = tid ? tid + '_' : ''; localStorage.setItem('currentTrainerId', tid || ''); },
  getCurrentTrainerId() { return localStorage.getItem('currentTrainerId') || ''; },
  get(key) { try { return JSON.parse(localStorage.getItem(this._prefix + key)) || null; } catch(e) { return null; } },
  set(key, val) { localStorage.setItem(this._prefix + key, JSON.stringify(val)); },
  getTrainers() { return JSON.parse(localStorage.getItem('trainers') || '[]'); },
  saveTrainers(arr) { localStorage.setItem('trainers', JSON.stringify(arr)); },
  getTrainerById(id) { return this.getTrainers().find(t => t.id === id) || null; },
  updateTrainer(id, data) { const t = this.getTrainers(); const i = t.findIndex(x => x.id === id); if (i !== -1) { t[i] = { ...t[i], ...data }; this.saveTrainers(t); return t[i]; } return null; },
  addTrainer(name, phone, password) { const t = this.getTrainers(); const n = { id: genId(), name, phone, password, bio: '', createTime: new Date().toISOString() }; t.push(n); this.saveTrainers(t); return n; },
  getStudents() { return this.get('students') || []; }, saveStudents(arr) { this.set('students', arr); },
  getRecords() { return this.get('records') || []; }, saveRecords(arr) { this.set('records', arr); },
  getCurriculum() { const s = this.get('curriculum'); if (s && s.length > 0 && s[0].icon) return s; this.set('curriculum', DEFAULT_CURRICULUM); return DEFAULT_CURRICULUM; },
  getProgress() { return this.get('progress') || {}; }, saveProgress(data) { this.set('progress', data); },
  getStudentProgress(sid) { const a = this.getProgress(); return a[sid] || {}; },
  setStudentProgress(sid, data) { const a = this.getProgress(); a[sid] = data; this.saveProgress(a); },
  getPayments() { return this.get('payments') || []; }, savePayments(arr) { this.set('payments', arr); },
  getStudentPayments(sid) { return this.getPayments().filter(p => p.studentId === sid).sort((a,b) => b.date.localeCompare(a.date)); },
  getPackages() { const s = this.get('packages'); return (s && s.length > 0) ? s : DEFAULT_PACKAGES; }, savePackages(arr) { this.set('packages', arr); },
  getSchedule() { return this.get('schedule') || []; }, saveSchedule(arr) { this.set('schedule', arr); },
  getJournals() { return this.get('journals') || []; }, saveJournals(arr) { this.set('journals', arr); },
  getExpenses() { return this.get('expenses') || []; }, saveExpenses(arr) { this.set('expenses', arr); },
  migrateOldData(tid) {
    const old = localStorage.getItem('students');
    if (old) { const p = tid + '_'; ['students','records','progress','curriculum','payments','schedule','journals','expenses'].forEach(k => { const v = localStorage.getItem(k); if (v && !localStorage.getItem(p + k)) localStorage.setItem(p + k, v); }); ['students','records','progress','curriculum','template','payments','schedule','journals','expenses'].forEach(k => localStorage.removeItem(k)); }
  }
};

// ==================== Utils ====================
function getAllLeafIds(c) { const ids = []; function w(n) { n.forEach(x => { if (x.children && x.children.length > 0) w(x.children); else ids.push(x.id); }); } w(c); return ids; }
function countLeafItems(c) { return getAllLeafIds(c).length; }
function countCompletedItems(c, p) { let n = 0; function w(nodes) { nodes.forEach(x => { if (x.children && x.children.length > 0) w(x.children); else { if (p[x.id] && p[x.id].done) n++; } }); } w(c); return n; }
function countNodeProgress(node, p) { let t = 0, c = 0; function w(n) { if (n.children && n.children.length > 0) n.children.forEach(w); else { t++; if (p[n.id] && p[n.id].done) c++; } } w(node); return { total: t, completed: c }; }
function genId() { return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function thisMonth() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); }
function hashColor(str) { let h = 0; for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i); return Math.abs(h) % 8; }
function showToast(msg) { const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(el._timeout); el._timeout = setTimeout(() => el.classList.remove('show'), 1800); }
function escHtml(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ==================== Navigation ====================
const navStack = [];
let currentPage = 'login';
let currentDetailId = null, currentTrainingStudentId = null, editingStudentId = null, editingJournalId = null, progressStudentId = null, scheduleDate = todayStr(), weekStart = getWeekStart(new Date()), selectedPackage = null, trainingCustomItems = [];
function getWeekStart(d) { const dt = new Date(d); dt.setDate(dt.getDate() - dt.getDay()); dt.setHours(0,0,0,0); return dt; }

function navigateTo(pageId, data) {
  const old = document.getElementById('page-' + currentPage), np = document.getElementById('page-' + pageId);
  if (!np) return;
  old.classList.remove('active'); old.classList.add('slide-back');
  np.classList.add('active'); np.classList.remove('slide-back');
  navStack.push(currentPage); currentPage = pageId;
  np.scrollTop = 0; const c = np.querySelector('.page-content'); if (c) c.scrollTop = 0;
  if (pageId === 'dashboard') renderDashboard();
  if (pageId === 'profile') renderProfile();
  if (pageId === 'students') renderStudentsPage();
  if (pageId === 'detail' && data) renderDetail(data.id);
  if (pageId === 'progress' && data) renderProgressTree(data.studentId);
  if (pageId === 'training' && data) initTraining(data.studentId);
  if (pageId === 'report' && data) renderReport(data.studentId);
  if (pageId === 'schedule') renderSchedule();
  if (pageId === 'schedule-tab') renderWeekSchedule();
  if (pageId === 'finance') renderFinance();
  if (pageId === 'journal') renderJournal();
  if (pageId === 'stats') renderStats();
}

function goBack() {
  if (navStack.length === 0) return;
  const prev = navStack.pop();
  document.getElementById('page-' + currentPage).classList.remove('active');
  document.getElementById('page-' + prev).classList.add('active');
  document.getElementById('page-' + prev).classList.remove('slide-back');
  currentPage = prev;
  if (prev === 'dashboard') renderDashboard();
  if (prev === 'profile') renderProfile();
  if (prev === 'students') renderStudentsPage();
  if (prev === 'detail') renderDetail(currentDetailId);
  if (prev === 'schedule-tab') renderWeekSchedule();
  if (prev === 'finance') renderFinance();
  if (prev === 'journal') renderJournal();
}

// ==================== Splash ====================
function showSplash() {
  var splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('show');

  var canvas = document.getElementById('splash-canvas');
  if (canvas) {
    canvas.width = Math.min(window.innerWidth, 500);
    canvas.height = Math.min(window.innerHeight, 1000);
    var ctx = canvas.getContext('2d');
    var particles = [];
    var count = 30;
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6 - 0.3,
        size: Math.random() * 2 + 0.8,
        alpha: Math.random() * 0.5 + 0.15,
        life: 1
      });
    }
    var stop = false;
    function draw() {
      if (stop) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (var i = 0; i < count; i++) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.002;
        if (p.life <= 0 || p.x < -10 || p.x > canvas.width + 10 || p.y < -10 || p.y > canvas.height + 10) {
          p.x = Math.random() * canvas.width;
          p.y = canvas.height + 10;
          p.vx = (Math.random() - 0.5) * 0.6;
          p.vy = -(Math.random() * 0.8 + 0.3);
          p.life = 1;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,59,48,' + (p.alpha * p.life) + ')';
        ctx.fill();
      }
      if (!stop) requestAnimationFrame(draw);
    }
    draw();
    setTimeout(function() { stop = true; }, 2000);
  }

  setTimeout(function() { splash.classList.remove('show'); }, 2200);
}

// ==================== Login ====================
function renderLogin() {
  currentPage = 'login';
  var t = DB.getTrainers();
  var l = document.getElementById('trainer-list');
  var f = document.getElementById('login-footer');
  if (t.length === 0) {
    l.innerHTML = '<div style="padding:20px 0;"><button class="btn btn-primary" onclick="showRegister()" style="background:var(--red);">创建新账号</button></div>';
    f.style.display = 'none';
  } else {
    l.innerHTML = t.map(function(x){
      var av = x.avatar ? '<img src="'+x.avatar+'" alt="">' : (x.name||'?')[0];
      return '<div class="trainer-card card-enter" onclick="loginTrainer(\''+x.id+'\')"><div class="trainer-avatar avatar-c'+hashColor(x.id)+'">'+av+'</div><div class="trainer-info"><div class="trainer-name">'+escHtml(x.name)+'</div><div class="trainer-phone">'+escHtml(x.phone||'')+'</div></div></div>';
    }).join('');
    f.style.display = 'block';
  }
}
function loginTrainer(id) {
  var t = DB.getTrainerById(id);
  if (!t) return;
  DB.setTrainer(id);
  DB.migrateOldData(id);
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-dashboard').classList.add('active');
  renderDashboard();
}
function showRegister() { document.getElementById('page-login').classList.remove('active'); document.getElementById('page-register').classList.add('active'); }
function registerTrainer() {
  var n = document.getElementById('reg-name').value.trim();
  if (!n) { showToast('请输入姓名'); return; }
  DB.addTrainer(n, document.getElementById('reg-phone').value.trim(), document.getElementById('reg-password').value.trim());
  document.getElementById('reg-name').value = '';
  document.getElementById('reg-phone').value = '';
  document.getElementById('reg-password').value = '';
  document.getElementById('page-register').classList.remove('active');
  document.getElementById('page-login').classList.add('active');
  renderLogin();
  showToast('注册成功！');
}
function backToLogin() { document.getElementById('page-register').classList.remove('active'); document.getElementById('page-login').classList.add('active'); }
function switchAccount() { if (!confirm('切换到登录页选择其他账号？')) return; DB.setTrainer(''); document.getElementById('page-profile').classList.remove('active'); document.getElementById('page-login').classList.add('active'); renderLogin(); }
function exitApp() { if (!confirm('确定退出登录？将清除当前登录状态。')) return; DB.setTrainer(''); localStorage.removeItem('currentTrainerId'); window.location.reload(); }

// ==================== Dashboard Home ====================
function renderDashboard() {
  const ss = DB.getStudents(), rs = DB.getRecords(), ps = DB.getPayments(), exps = DB.getExpenses(), today = todayStr(), month = thisMonth(), trainer = DB.getTrainerById(DB.getCurrentTrainerId());
  const monthIncome = ps.filter(p => p.date.startsWith(month)).reduce((s,p) => s + p.amount, 0);
  const todayIds = new Set(rs.filter(r => r.date === today).map(r => r.studentId));
  const journalCount = DB.getJournals().length;

  // Avatar
  var avatarEl = document.getElementById('dash-avatar');
  if (trainer && trainer.avatar) {
    avatarEl.innerHTML = '<img src="'+trainer.avatar+'" alt="">';
  } else {
    avatarEl.textContent = trainer ? (trainer.name||'?')[0] : '?';
    avatarEl.innerHTML = avatarEl.textContent;
  }
  document.getElementById('dash-trainer-name').textContent = trainer ? trainer.name : '教练';

  // 4 card stats
  document.getElementById('dash-students-stat').textContent = ss.length + ' 位学员';
  document.getElementById('dash-schedule-stat').textContent = '今日 ' + todayIds.size + ' 节课';
  document.getElementById('dash-finance-stat').textContent = '本月 ¥' + monthIncome;
  document.getElementById('dash-journal-stat').textContent = journalCount + ' 条记录';

  // Alerts
  var alerts = []; ss.forEach(function(s){ if (s.remainingHours <= 0) alerts.push({ text: s.name + ' 课时已用完', type: 'danger', sid: s.id }); else if (s.remainingHours <= 2) alerts.push({ text: s.name + ' 仅剩' + s.remainingHours + '课时', type: 'warn', sid: s.id }); });
  var d3 = new Date(); d3.setDate(d3.getDate()-3); var d3s = d3.toISOString().slice(0,10); ss.forEach(function(s){ var sr = rs.filter(function(r){return r.studentId===s.id;}).sort(function(a,b){return b.date.localeCompare(a.date);}); if (sr.length > 0 && sr[0].date < d3s) alerts.push({ text: s.name + ' ' + Math.floor((new Date() - new Date(sr[0].date)) / 86400000) + '天未上课', type: 'info', sid: s.id }); });
  var alertSec = document.getElementById('dash-alerts-section');
  if (alerts.length > 0) { alertSec.style.display = 'block'; document.getElementById('dash-alerts-list').innerHTML = alerts.slice(0, 5).map(function(a){ return '<div class="alert-item '+a.type+'" onclick="openDetailFromDash(\''+a.sid+'\')"><span class="alert-item-dot"></span>'+escHtml(a.text)+'</div>'; }).join(''); } else alertSec.style.display = 'none';

  // Today schedule
  var sched = DB.getSchedule(), todaySched = sched.filter(function(s){return s.date===today;}).sort(function(a,b){return (a.time||'').localeCompare(b.time||'');});
  var schedSec = document.getElementById('dash-schedule-section');
  if (todaySched.length > 0) { schedSec.style.display = 'block'; document.getElementById('dash-schedule-list').innerHTML = todaySched.map(function(sc){ var st = ss.find(function(s){return s.id===sc.studentId;}); return '<div class="sched-item" onclick="openDetailFromDash(\''+sc.studentId+'\')"><span class="sched-mini-time">'+(sc.time||'--:--')+'</span><span class="sched-mini-name">'+(st?escHtml(st.name):'未知')+'</span><span class="sched-mini-note">'+escHtml(sc.notes||'')+'</span></div>'; }).join(''); } else schedSec.style.display = 'none';
}
function openDetailFromDash(id) { navigateTo('detail', { id }); }

// ==================== Profile (我的) ====================
function renderProfile() {
  const trainer = DB.getTrainerById(DB.getCurrentTrainerId()); if (!trainer) return;
  var profAvatar = document.getElementById('prof-avatar');
  if (trainer.avatar) {
    profAvatar.innerHTML = '<img src="'+trainer.avatar+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">';
  } else {
    profAvatar.textContent = (trainer.name||'?')[0];
    profAvatar.innerHTML = profAvatar.textContent;
  }
  document.getElementById('prof-name').textContent = trainer.name;
  document.getElementById('prof-phone').textContent = trainer.phone || '未设置手机号';
  document.getElementById('prof-bio').textContent = trainer.bio || '点击编辑添加个人简介...';
  const ss = DB.getStudents(), rs = DB.getRecords(), ps = DB.getPayments();
  document.getElementById('prof-stat-students').textContent = ss.length;
  document.getElementById('prof-stat-records').textContent = rs.length;
  document.getElementById('prof-stat-income').textContent = '¥' + ps.reduce((s,p) => s + p.amount, 0);
}
function editProfile() { const t = DB.getTrainerById(DB.getCurrentTrainerId()); if (!t) return; document.getElementById('prof-edit-name').value = t.name || ''; document.getElementById('prof-edit-phone').value = t.phone || ''; document.getElementById('prof-edit-bio').value = t.bio || ''; document.getElementById('profile-modal').style.display = 'flex'; }
function confirmProfileEdit() { const n = document.getElementById('prof-edit-name').value.trim(); if (!n) { showToast('姓名不能为空'); return; } DB.updateTrainer(DB.getCurrentTrainerId(), { name: n, phone: document.getElementById('prof-edit-phone').value.trim(), bio: document.getElementById('prof-edit-bio').value.trim() }); closeProfileModal(); renderProfile(); renderDashboard(); showToast('资料已更新'); }
function closeProfileModal() { document.getElementById('profile-modal').style.display = 'none'; }
function uploadAvatar(event) { var file = event.target.files[0]; if (!file) return; if (file.size > 3 * 1024 * 1024) { showToast('图片不能超过3MB'); return; } var reader = new FileReader(); reader.onload = function(e) { DB.updateTrainer(DB.getCurrentTrainerId(), { avatar: e.target.result }); renderProfile(); renderDashboard(); showToast('头像已更新'); }; reader.readAsDataURL(file); }

// ==================== Students Page ====================
function renderStudentsPage() {
  const ss = DB.getStudents(), rs = DB.getRecords(), progress = DB.getProgress(), curriculum = DB.getCurriculum();
  const groups = new Set(['全部']); ss.forEach(s => { if (s.group) groups.add(s.group); });
  const activeGroup = document.querySelector('#students-group-tags .group-tag.active')?.dataset.group || '全部';
  document.getElementById('students-group-tags').innerHTML = Array.from(groups).map(g => '<span class="group-tag '+(g===activeGroup?'active':'')+'" data-group="'+escAttr(g)+'" onclick="filterStudents(this,\''+escAttr(g)+'\')">'+escHtml(g)+'</span>').join('');
  const sv = (document.getElementById('students-search').value || '').toLowerCase();
  let filtered = ss;
  if (activeGroup !== '全部') filtered = filtered.filter(s => s.group === activeGroup);
  if (sv) filtered = filtered.filter(s => s.name.toLowerCase().includes(sv) || (s.phone||'').includes(sv));
  document.getElementById('students-count').textContent = '共 ' + filtered.length + ' 人';
  filtered.forEach(s => { const sr = rs.filter(r => r.studentId === s.id).sort((a,b) => b.date.localeCompare(a.date)); s.lastDate = sr.length > 0 ? sr[0].date : null; const ti = countLeafItems(curriculum), ci = countCompletedItems(curriculum, progress[s.id] || {}); s.progressPct = ti > 0 ? Math.round(ci / ti * 100) : 0; });
  const l = document.getElementById('students-list'), e = document.getElementById('students-empty');
  if (filtered.length === 0) { l.innerHTML = ''; e.style.display = 'flex'; return; }
  e.style.display = 'none';
  l.innerHTML = filtered.map((s,i) => '<div class="student-card card-enter" style="animation-delay:'+(i*0.03)+'s" onclick="openDetailFromStudents(\''+s.id+'\')"><div class="student-card-top"><div class="avatar-sm avatar-c'+hashColor(s.id)+'">'+(s.name||'?')[0]+'</div><div class="student-info"><div class="student-name">'+escHtml(s.name)+'</div><div class="student-meta">'+(s.group?'<span class="group-badge">'+escHtml(s.group)+'</span> ':'')+(s.age?s.age+'岁 · ':'')+(s.gender||'')+'<span style="color:#34C759;font-weight:500;"> · '+s.progressPct+'%</span></div></div><div class="student-hours-badge"><div class="hours-num">'+s.remainingHours+'</div><div class="hours-unit">剩余课时</div></div></div>'+(s.phone||s.lastDate?'<div class="student-card-bottom">'+(s.phone?'<span>📱 '+escHtml(s.phone)+'</span>':'')+(s.lastDate?'<span>最近: '+s.lastDate+'</span>':'')+'</div>':'')+'</div>').join('');
  // Long press
  l.ontouchstart = function(e) { const c = e.target.closest('.student-card'); if (!c) return; window._pressTimer = setTimeout(() => { const m = c.onclick.toString().match(/openDetailFromStudents\('([^']+)'/); if (m && m[1]) showDeleteStudentModal(m[1]); }, 600); };
  l.ontouchend = () => clearTimeout(window._pressTimer);
  l.ontouchmove = () => clearTimeout(window._pressTimer);
}
function filterStudents(el, g) { document.querySelectorAll('#students-group-tags .group-tag').forEach(t => t.classList.remove('active')); el.classList.add('active'); renderStudentsPage(); }
function onStudentsSearch(e) { const v = e.target.value; e.target._v = v; clearTimeout(e.target._t); e.target._t = setTimeout(() => { document.getElementById('students-search').value = e.target._v; renderStudentsPage(); }, 200); }
function openDetailFromStudents(id) { navigateTo('detail', { id }); }
function showDeleteStudentModal(id) { const s = DB.getStudents().find(x => x.id === id); if (!s) return; document.getElementById('modal-body').textContent = '确定删除「' + s.name + '」吗？所有记录将被删除。'; document.getElementById('modal-overlay').style.display = 'flex'; document.getElementById('modal-confirm-btn').onclick = function() { deleteStudent(id); closeModal(); }; }
function deleteStudent(id) { DB.saveStudents(DB.getStudents().filter(s => s.id !== id)); DB.saveRecords(DB.getRecords().filter(r => r.studentId !== id)); DB.savePayments(DB.getPayments().filter(p => p.studentId !== id)); const prog = DB.getProgress(); delete prog[id]; DB.saveProgress(prog); goBack(); showToast('已删除'); }

// ==================== Add/Edit Student ====================
function resetAddForm() { editingStudentId = null; document.getElementById('add-title').textContent = '添加学员'; document.getElementById('input-name').value=''; document.getElementById('input-phone').value=''; document.getElementById('input-age').value=''; document.getElementById('input-group').value=''; document.getElementById('input-parent-name').value=''; document.getElementById('input-parent-phone').value=''; document.getElementById('input-hours').value=''; document.getElementById('input-date').value=todayStr(); document.getElementById('input-notes').value=''; document.getElementById('btn-save').textContent='添加学员'; document.querySelectorAll('#gender-picker .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === '男')); }
function editStudent() { const s = DB.getStudents().find(x => x.id === currentDetailId); if (!s) return; editingStudentId = s.id; document.getElementById('add-title').textContent='编辑学员'; document.getElementById('input-name').value=s.name||''; document.getElementById('input-phone').value=s.phone||''; document.getElementById('input-age').value=s.age||''; document.getElementById('input-group').value=s.group||''; document.getElementById('input-parent-name').value=s.parentName||''; document.getElementById('input-parent-phone').value=s.parentPhone||''; document.getElementById('input-hours').value=s.totalHours||''; document.getElementById('input-date').value=s.startDate||todayStr(); document.getElementById('input-notes').value=s.notes||''; document.getElementById('btn-save').textContent='保存修改'; document.querySelectorAll('#gender-picker .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === s.gender)); navigateTo('add'); }
function getGender() { const a = document.querySelector('#gender-picker .seg-btn.active'); return a ? a.dataset.value : '男'; }
function saveStudent() {
  const name = document.getElementById('input-name').value.trim(), phone = document.getElementById('input-phone').value.trim(), age = document.getElementById('input-age').value.trim(), gender = getGender(), group = document.getElementById('input-group').value.trim(), parentName = document.getElementById('input-parent-name').value.trim(), parentPhone = document.getElementById('input-parent-phone').value.trim(), totalHours = parseInt(document.getElementById('input-hours').value) || 0, startDate = document.getElementById('input-date').value || todayStr(), notes = document.getElementById('input-notes').value.trim();
  if (!name) { showToast('请输入姓名'); return; } if (totalHours <= 0) { showToast('请输入有效课时'); return; }
  if (editingStudentId) { const ss = DB.getStudents(); const i = ss.findIndex(s => s.id === editingStudentId); if (i !== -1) { const o = ss[i], used = o.totalHours - o.remainingHours; ss[i] = { ...o, name, phone, age, gender, group, parentName, parentPhone, totalHours, remainingHours: Math.max(0, totalHours - used), startDate, notes }; DB.saveStudents(ss); } editingStudentId = null; showToast('修改成功'); }
  else { const ss = DB.getStudents(); ss.push({ id: genId(), name, phone, age, gender, group, parentName, parentPhone, totalHours, remainingHours: totalHours, startDate, notes, createTime: new Date().toISOString() }); DB.saveStudents(ss); showToast('添加成功'); }
  resetAddForm(); goBack();
}
document.addEventListener('DOMContentLoaded', () => { document.getElementById('gender-picker').addEventListener('click', function(e) { const btn = e.target.closest('.seg-btn'); if (!btn) return; this.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }); });

// ==================== Student Detail ====================
function renderDetail(id) {
  currentDetailId = id; const s = DB.getStudents().find(x => x.id === id); if (!s) { goBack(); return; }
  const c = DB.getCurriculum(), prog = DB.getStudentProgress(id), used = s.totalHours - s.remainingHours, pct = s.totalHours > 0 ? Math.round(used / s.totalHours * 100) : 0, ti = countLeafItems(c), ci = countCompletedItems(c, prog), ip = ti > 0 ? Math.round(ci / ti * 100) : 0;
  document.getElementById('detail-name').textContent = s.name; document.getElementById('detail-avatar').textContent = (s.name||'?')[0]; document.getElementById('detail-avatar').className = 'avatar avatar-c' + hashColor(s.id);
  document.getElementById('detail-info-name').textContent = s.name; document.getElementById('detail-info-meta').textContent = (s.age?s.age+'岁 · ':'')+(s.gender||'')+(s.group?' · '+s.group:''); document.getElementById('detail-info-date').textContent = s.startDate ? '入学: ' + s.startDate : '';
  document.getElementById('detail-notes').style.display = s.notes ? 'block' : 'none'; if (s.notes) document.getElementById('detail-notes').innerHTML = '<strong>备注：</strong>' + escHtml(s.notes);
  document.getElementById('detail-parent-info').style.display = (s.parentName||s.parentPhone) ? 'block' : 'none'; if (s.parentName||s.parentPhone) document.getElementById('detail-parent-text').textContent = '家长: ' + (s.parentName||'') + (s.parentPhone ? ' ('+s.parentPhone+')' : '');
  document.getElementById('detail-total').textContent = s.totalHours; document.getElementById('detail-used').textContent = used; document.getElementById('detail-remain').textContent = s.remainingHours; document.getElementById('detail-progress').style.width = pct + '%'; document.getElementById('detail-progress-text').textContent = '已使用 ' + pct + '%';
  document.getElementById('progress-pct').textContent = '已完成 ' + ip + '%'; document.getElementById('progress-pct-bar').style.width = ip + '%'; document.getElementById('progress-nums').textContent = ci + ' / ' + ti + ' 项';
  const pays = DB.getStudentPayments(id); document.getElementById('total-paid').textContent = '¥' + pays.reduce((t,p) => t + p.amount, 0); document.getElementById('payment-count').textContent = '共 ' + pays.length + ' 笔';
  document.getElementById('payment-list').innerHTML = pays.length === 0 ? '<div class="payment-empty">暂无缴费记录</div>' : pays.map(p => '<div class="payment-item"><span class="pay-date">'+p.date+'</span><span class="pay-pkg">'+escHtml(p.packageName)+'</span><span class="pay-hours">+'+p.hoursAdded+'课时</span><span class="pay-amount">¥'+p.amount+'</span></div>').join('');
  const records = DB.getRecords().filter(r => r.studentId === id).sort((a,b) => b.date.localeCompare(a.date)); document.getElementById('record-count').textContent = '共 ' + records.length + ' 次';
  document.getElementById('record-list').innerHTML = records.length === 0 ? '' : records.map(r => '<div class="record-card"><div class="record-header"><span class="record-date">'+r.date+'</span><span class="record-dur">'+r.duration+'课时</span><span class="record-del" onclick="deleteRecord(event,\''+r.id+'\')"></span></div>'+(r.checkedItems&&r.checkedItems.length>0||r.customItems&&r.customItems.length>0?'<div class="tag-list">'+(r.checkedItems||[]).filter(function(i){return i;}).map(function(i){return '<span class="tag-item">'+escHtml(i)+'</span>';}).join('')+(r.customItems||[]).filter(function(i){return i;}).map(function(i){return '<span class="tag-item-custom">'+escHtml(i)+'</span>';}).join('')+'</div>':'<div class="record-no-items">未记录训练项目</div>')+(r.notes?'<div class="record-note">'+escHtml(r.notes)+'</div>':'')+'</div>').join('');
  document.getElementById('record-empty').style.display = records.length === 0 ? 'flex' : 'none';
}
function openProgressPage(sid) { navigateTo('progress', { studentId: sid }); }
function startTraining() { navigateTo('training', { studentId: currentDetailId }); }
function showAddPayment() { const s = DB.getStudents().find(x => x.id === currentDetailId); if (!s) return; document.getElementById('pay-student-name').textContent = '为 ' + s.name + ' 添加缴费'; document.getElementById('pay-amount').value = ''; document.getElementById('pay-date').value = todayStr(); document.getElementById('pay-notes').value = ''; document.getElementById('pay-packages').innerHTML = DB.getPackages().map(p => '<div class="pay-pkg-option" data-id="'+p.id+'" data-hours="'+p.hours+'" onclick="selectPackage(this,\''+p.id+'\','+p.hours+')"><span class="pay-pkg-name">'+escHtml(p.name)+'</span><span class="pay-pkg-hours">'+p.hours+'课时</span></div>').join(''); selectedPackage = null; document.getElementById('payment-modal').style.display = 'flex'; }
function selectPackage(el, id, hours) { document.querySelectorAll('.pay-pkg-option').forEach(e => e.classList.remove('selected')); el.classList.add('selected'); selectedPackage = { id, hours, name: el.querySelector('.pay-pkg-name').textContent }; }
function confirmPayment() { const amount = parseInt(document.getElementById('pay-amount').value) || 0; if (!selectedPackage) { showToast('请选套餐'); return; } if (amount <= 0) { showToast('请输入金额'); return; } const pays = DB.getPayments(); pays.push({ id: genId(), studentId: currentDetailId, amount, packageName: selectedPackage.name, hoursAdded: selectedPackage.hours, date: document.getElementById('pay-date').value || todayStr(), notes: document.getElementById('pay-notes').value.trim(), createTime: new Date().toISOString() }); DB.savePayments(pays); const ss = DB.getStudents(); const s = ss.find(st => st.id === currentDetailId); if (s) { s.totalHours += selectedPackage.hours; s.remainingHours += selectedPackage.hours; DB.saveStudents(ss); } closePaymentModal(); renderDetail(currentDetailId); showToast('缴费已保存'); }
function closePaymentModal() { document.getElementById('payment-modal').style.display = 'none'; }
function deleteRecord(event, id) { event.stopPropagation(); document.getElementById('modal-body').textContent = '删除此训练记录将恢复对应课时。'; document.getElementById('modal-overlay').style.display = 'flex'; document.getElementById('modal-confirm-btn').onclick = function() { const records = DB.getRecords(); const t = records.find(r => r.id === id); if (t) { const ss = DB.getStudents(); const s = ss.find(st => st.id === t.studentId); if (s) s.remainingHours += t.duration; DB.saveStudents(ss); if (t.checkedIds && t.checkedIds.length > 0) { const prog = DB.getStudentProgress(t.studentId); t.checkedIds.forEach(i => { if (prog[i]) { prog[i].count--; if (prog[i].count <= 0) { prog[i].done = false; prog[i].count = 0; prog[i].firstAt = null; } } }); DB.setStudentProgress(t.studentId, prog); } } DB.saveRecords(records.filter(r => r.id !== id)); renderDetail(currentDetailId); closeModal(); showToast('已删除并恢复课时'); }; }

// ==================== Progress Tree ====================
function renderProgressTree(sid) { progressStudentId = sid; const s = DB.getStudents().find(x => x.id === sid); if (!s) { goBack(); return; } document.getElementById('prog-title').textContent = s.name + ' · 训练进程'; document.getElementById('prog-avatar').textContent = (s.name||'?')[0]; document.getElementById('prog-avatar').className = 'avatar avatar-c' + hashColor(s.id); const c = DB.getCurriculum(), prog = DB.getStudentProgress(sid), ti = countLeafItems(c), ci = countCompletedItems(c, prog), ip = ti > 0 ? Math.round(ci / ti * 100) : 0; document.getElementById('prog-overall').textContent = '总进度: ' + ci + '/' + ti + ' (' + ip + '%)'; document.getElementById('prog-overall-bar').style.width = ip + '%'; document.getElementById('progress-tree').innerHTML = buildTreeHTML(c, prog, 0); }
function buildTreeHTML(nodes, p, d) { let h = ''; nodes.forEach(n => { if (n.children && n.children.length > 0) { const r = countNodeProgress(n, p), p2 = r.total > 0 ? Math.round(r.completed / r.total * 100) : 0; h += '<div class="tree-group'+(r.completed===r.total?' all-done':'')+'" onclick="event.stopPropagation();toggleTreeGroup(this)" data-expanded="'+(d<2)+'"><div class="tree-group-header" style="padding-left:'+(d*16)+'px"><span class="tree-arrow">'+(d<2?'▼':'▶')+'</span><span class="tree-group-icon">'+(n.icon||'📌')+'</span><span class="tree-group-name">'+escHtml(n.name)+'</span><span class="tree-group-stat">'+r.completed+'/'+r.total+'</span><div class="tree-mini-bar"><div class="tree-mini-fill" style="width:'+p2+'%"></div></div></div><div class="tree-group-body" style="display:'+(d<2?'block':'none')+'">'+buildTreeHTML(n.children, p, d+1)+'</div></div>'; } else { const pr = p[n.id], done = !!(pr && pr.done), cnt = (pr && typeof pr.count === 'number') ? pr.count : 0, date = (pr && pr.firstAt) ? pr.firstAt : ''; h += '<div class="tree-item '+(done?'done':'undone')+'" style="padding-left:'+(d*16+8)+'px"><span class="tree-check">'+(done?'&#10003;':'&#9675;')+'</span><span class="tree-item-name">'+escHtml(n.name)+'</span>'+(done?'<span class="tree-item-count">'+cnt+'次</span>':'<span class="tree-item-count undone">未练</span>')+(date?'<span class="tree-item-date">'+date+'</span>':'')+'</div>'; } }); return h; }
function toggleTreeGroup(el) { var ex = el.dataset.expanded === 'true'; el.dataset.expanded = ex ? 'false' : 'true'; var arrow = el.querySelector('.tree-arrow'); if (arrow) arrow.textContent = ex ? '▶' : '▼'; var body = el.querySelector('.tree-group-body'); if (body) body.style.display = ex ? 'none' : 'block'; el.style.cursor = 'pointer'; }

// ==================== Training ====================
function initTraining(sid) { currentTrainingStudentId = sid; const s = DB.getStudents().find(x => x.id === sid); if (!s) { goBack(); return; } document.getElementById('training-student-name').textContent = '🏀 ' + s.name + ' 的训练课'; document.getElementById('training-date').value = todayStr(); document.getElementById('training-duration').value = 1; document.getElementById('training-notes').value = ''; document.getElementById('checklist-container').innerHTML = buildChecklistHTML(DB.getCurriculum(), DB.getStudentProgress(sid), 0); trainingCustomItems = []; document.getElementById('add-custom-row').style.display = 'block'; document.getElementById('custom-input-row').style.display = 'none'; document.getElementById('custom-input').value = ''; updateCheckCount(); }
function buildChecklistHTML(nodes, p, d) { let h = ''; nodes.forEach(n => { if (n.children && n.children.length > 0) { const r = countNodeProgress(n, p), p2 = r.total > 0 ? Math.round(r.completed / r.total * 100) : 0; h += '<div class="checklist-group" data-expanded="'+(d===0)+'"><div class="checklist-group-header" onclick="event.stopPropagation();toggleCheckGroup(this)" style="padding-left:'+(d*10)+'px"><span class="group-arrow">'+(d===0?'▼':'▶')+'</span><span class="group-icon">'+(n.icon||'📌')+'</span><span class="group-name">'+escHtml(n.name)+'</span><span class="group-stat">'+r.completed+'/'+r.total+'</span><div class="group-mini-bar"><div class="group-mini-fill" style="width:'+p2+'%"></div></div></div><div class="checklist-group-body" style="display:'+(d===0?'block':'none')+'">'+buildChecklistHTML(n.children, p, d+1)+'</div></div>'; } else { const pr = p[n.id], isDone = !!(pr && pr.done), cnt = (pr && typeof pr.count === 'number') ? pr.count : 0; h += '<div class="checklist-item '+(isDone?'checked':'')+'" data-id="'+escAttr(n.id)+'" data-name="'+escAttr(n.name)+'" onclick="toggleCheckItem(this)" style="padding-left:'+(d*10+10)+'px"><div class="checkbox-icon '+(isDone?'checked':'')+'"></div><span class="checklist-text">'+escHtml(n.name)+'</span>'+(isDone?'<span class="checklist-badge">'+cnt+'次</span>':'')+'</div>'; } }); return h; }
function toggleCheckGroup(hdr) { var g = hdr.parentElement; var ex = g.dataset.expanded === 'true'; g.dataset.expanded = ex ? 'false' : 'true'; var arrow = hdr.querySelector('.group-arrow'); if (arrow) arrow.textContent = ex ? '▶' : '▼'; var body = g.querySelector('.checklist-group-body'); if (body) body.style.display = ex ? 'none' : 'block'; }
function toggleCheckItem(el) { el.querySelector('.checkbox-icon').classList.toggle('checked'); el.classList.toggle('checked'); updateCheckCount(); }
function updateCheckCount() { const c = document.querySelectorAll('#checklist-container .checkbox-icon.checked').length, t = document.querySelectorAll('#checklist-container .checklist-item').length; document.getElementById('check-count').textContent = '勾选 ' + c + ' / ' + t; }
function changeDuration(delta) { const i = document.getElementById('training-duration'); i.value = Math.max(1, (parseInt(i.value)||0) + delta); }
function showCustomInput() { document.getElementById('add-custom-row').style.display='none'; document.getElementById('custom-input-row').style.display='flex'; document.getElementById('custom-input').focus(); }
function confirmCustom() { const name = document.getElementById('custom-input').value.trim(); if (!name) { showToast('请输入项目'); return; } const ns = []; document.querySelectorAll('#checklist-container .checklist-text').forEach(e => ns.push(e.textContent)); if (ns.includes(name)) { showToast('已存在'); return; } const c = document.getElementById('checklist-container'), d = document.createElement('div'); d.className='checklist-item checked'; d.style.paddingLeft='10px'; d.dataset.name=name; d.dataset.custom='true'; d.innerHTML='<div class="checkbox-icon checked"></div><span class="checklist-text">'+escHtml(name)+'</span><span class="checklist-del" onclick="removeCustomItem(event,this)">✕</span>'; d.onclick=function(e){if(e.target.classList.contains('checklist-del'))return;toggleCheckItem(d);}; c.appendChild(d); document.getElementById('add-custom-row').style.display='block'; document.getElementById('custom-input-row').style.display='none'; document.getElementById('custom-input').value=''; updateCheckCount(); }
function cancelCustom() { document.getElementById('add-custom-row').style.display='block'; document.getElementById('custom-input-row').style.display='none'; document.getElementById('custom-input').value=''; }
function removeCustomItem(e, el) { e.stopPropagation(); el.closest('.checklist-item').remove(); updateCheckCount(); }
function saveTrainingRecord() {
  const date = document.getElementById('training-date').value || todayStr(), duration = parseInt(document.getElementById('training-duration').value) || 0, notes = document.getElementById('training-notes').value.trim(); if (duration <= 0) { showToast('请设置时长'); return; }
  const s = DB.getStudents().find(x => x.id === currentTrainingStudentId); if (!s) { showToast('学员不存在'); return; }
  if (duration > s.remainingHours) { if (!confirm('仅剩 ' + s.remainingHours + ' 课时，按剩余记录？')) return; document.getElementById('training-duration').value = s.remainingHours; saveTrainingRecord(); return; }
  const checkedIds = [], checkedItems = [], customChecked = [];
  document.querySelectorAll('#checklist-container .checklist-item').forEach(el => { if (!el.querySelector('.checkbox-icon').classList.contains('checked')) return; const id = el.dataset.id, name = el.dataset.name; if (!name) return; if (el.dataset.custom === 'true') customChecked.push(name); else { if (id) checkedIds.push(id); checkedItems.push(name); } });
  const records = DB.getRecords(); records.push({ id: genId(), studentId: currentTrainingStudentId, date, duration, checkedItems: checkedItems.filter(function(i){return i;}), customItems: customChecked.filter(function(i){return i;}), checkedIds: checkedIds.filter(function(i){return i;}), notes, createTime: new Date().toISOString() }); DB.saveRecords(records);
  const prog = DB.getStudentProgress(currentTrainingStudentId), today = todayStr(); checkedIds.forEach(id => { if (!prog[id]) prog[id] = { done: true, firstAt: today, count: 1 }; else { prog[id].done = true; if (!prog[id].firstAt) prog[id].firstAt = today; prog[id].count = (prog[id].count || 0) + 1; } }); DB.setStudentProgress(currentTrainingStudentId, prog);
  const ss = DB.getStudents(); const st = ss.find(x => x.id === currentTrainingStudentId); if (st) st.remainingHours = Math.max(0, st.remainingHours - duration); DB.saveStudents(ss);
  const j = DB.getJournals(); j.push({ id: genId(), date: today, title: s.name + ' 训练记录', content: '训练项目：' + (checkedItems.join('、') || '无') + (notes ? '\n备注：' + notes : ''), studentIds: [currentTrainingStudentId], tags: ['自动'], createTime: new Date().toISOString() }); DB.saveJournals(j);
  showToast('保存成功！'); setTimeout(() => goBack(), 800);
}

// ==================== Schedule ====================
function renderSchedule() { document.getElementById('sched-month-label').textContent = formatMonth(scheduleDate); renderCalendarDays(); renderDaySchedule(); }
function formatMonth(d) { const [y,m] = d.split('-'); return y + '年' + parseInt(m) + '月'; }
function changeMonth(delta) { const [y,m] = scheduleDate.split('-').map(Number); scheduleDate = new Date(y, m-1+delta, 1).toISOString().slice(0,10); document.getElementById('sched-month-label').textContent = formatMonth(scheduleDate); renderCalendarDays(); }
function renderCalendarDays() { const [y,m] = scheduleDate.split('-').map(Number), fd = new Date(y, m-1, 1).getDay(), dim = new Date(y, m, 0).getDate(), sched = DB.getSchedule(), today = todayStr(); let h = ''; ['日','一','二','三','四','五','六'].forEach(d => h += '<div class="cal-day-header">'+d+'</div>'); for (let i=0;i<fd;i++) h += '<div class="cal-day empty"></div>'; for (let d=1;d<=dim;d++) { const ds = y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'), hc = sched.some(s => s.date === ds); h += '<div class="cal-day'+(hc?' has-class':'')+(ds===today?' today':'')+(ds===scheduleDate?' selected':'')+'" onclick="selectCalDay(\''+ds+'\')">'+d+'</div>'; } document.getElementById('cal-grid').innerHTML = h; }
function selectCalDay(d) { scheduleDate = d; renderCalendarDays(); renderDaySchedule(); }
function renderDaySchedule() { const ds = DB.getSchedule().filter(s => s.date === scheduleDate).sort((a,b) => (a.time||'').localeCompare(b.time||'')), ss = DB.getStudents(); document.getElementById('day-schedule-date').textContent = scheduleDate; document.getElementById('day-schedule-list').innerHTML = ds.length === 0 ? '<div class="day-empty">当天没有排课</div>' : ds.map(sc => { const st = ss.find(s => s.id === sc.studentId); return '<div class="day-sched-item"><span class="day-sched-time">'+(sc.time||'--:--')+'</span><span class="day-sched-name">'+(st?escHtml(st.name):'未知')+'</span><span class="day-sched-note">'+escHtml(sc.notes||'')+'</span><span class="day-sched-del" onclick="deleteSchedule(event,\''+sc.id+'\')">✕</span></div>'; }).join(''); }
function showAddSchedule() { const s = DB.getStudents().find(x => x.id === currentDetailId); if (!s) return; document.getElementById('sched-modal-student').textContent = '为 ' + s.name + ' 排课'; document.getElementById('sched-modal-date').value = todayStr(); document.getElementById('sched-modal-time').value = ''; document.getElementById('sched-modal-note').value = ''; document.getElementById('schedule-modal').style.display = 'flex'; }
function confirmSchedule() { const date = document.getElementById('sched-modal-date').value || todayStr(), time = document.getElementById('sched-modal-time').value; if (!time) { showToast('请选择时间'); return; } const sc = DB.getSchedule(); sc.push({ id: genId(), studentId: currentDetailId, date, time, notes: document.getElementById('sched-modal-note').value.trim(), createTime: new Date().toISOString() }); DB.saveSchedule(sc); closeScheduleModal(); showToast('排课成功'); renderDetail(currentDetailId); }
function deleteSchedule(e, id) { e.stopPropagation(); if (!confirm('删除这节排课？')) return; DB.saveSchedule(DB.getSchedule().filter(s => s.id !== id)); renderDaySchedule(); showToast('已删除'); }
function closeScheduleModal() { document.getElementById('schedule-modal').style.display = 'none'; }

// ==================== Weekly Schedule ====================
function renderWeekSchedule() { document.getElementById('week-label').textContent = formatWeekLabel(weekStart); document.getElementById('quick-sched-date').value = todayStr(); document.getElementById('quick-sched-student').innerHTML = '<option value="">选择学员</option>' + DB.getStudents().map(s => '<option value="'+s.id+'">'+escHtml(s.name)+'</option>').join(''); renderWeekGrid(); }
function formatWeekLabel(ws) { const end = new Date(ws); end.setDate(end.getDate()+6); return (ws.getMonth()+1)+'月'+ws.getDate()+'日 - '+(end.getMonth()+1)+'月'+end.getDate()+'日'; }
function changeWeek(delta) { weekStart.setDate(weekStart.getDate() + delta * 7); document.getElementById('week-label').textContent = formatWeekLabel(weekStart); renderWeekGrid(); }
function renderWeekGrid() { const sched = DB.getSchedule(), ss = DB.getStudents(), today = todayStr(), dn = ['日','一','二','三','四','五','六']; let h = ''; for (let i=0;i<7;i++) { const d = new Date(weekStart); d.setDate(d.getDate()+i); const ds = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'), isToday = ds === today, daySched = sched.filter(s => s.date === ds).sort((a,b) => (a.time||'').localeCompare(b.time||'')); h += '<div class="week-day-col"><div class="week-day-name">'+dn[i]+'</div><div class="week-day-num'+(isToday?' today':'')+'">'+d.getDate()+'</div><div class="week-day-slots">'; daySched.forEach(sc => { const st = ss.find(s => s.id === sc.studentId); h += '<div class="week-slot" onclick="openDetailFromDash(\''+sc.studentId+'\')">'+(sc.time||'')+' '+(st?st.name:'')+'</div>'; }); h += '<button class="week-add-btn" onclick="quickScheduleDay(\''+ds+'\')">+</button></div></div>'; } document.getElementById('week-grid').innerHTML = h; }
function quickScheduleDay(ds) { document.getElementById('quick-sched-date').value = ds; document.getElementById('quick-sched-time').focus(); }
function quickSchedule() { const sid = document.getElementById('quick-sched-student').value; if (!sid) { showToast('请选择学员'); return; } const date = document.getElementById('quick-sched-date').value || todayStr(), time = document.getElementById('quick-sched-time').value; if (!time) { showToast('请选择时间'); return; } const sc = DB.getSchedule(), exists = sc.find(s => s.date === date && s.time === time && s.studentId !== sid); if (exists && !confirm('该时段已有排课，仍要添加？')) return; sc.push({ id: genId(), studentId: sid, date, time, notes: '', createTime: new Date().toISOString() }); DB.saveSchedule(sc); document.getElementById('quick-sched-time').value = ''; renderWeekGrid(); showToast('排课成功'); }
function exportWeekSchedule() { const sched = DB.getSchedule(), ss = DB.getStudents(), dn = ['日','一','二','三','四','五','六']; let text = '本周课表\n'+formatWeekLabel(weekStart)+'\n\n'; for (let i=0;i<7;i++) { const d=new Date(weekStart);d.setDate(d.getDate()+i);const ds=d.toISOString().slice(0,10),daySched=sched.filter(s=>s.date===ds).sort((a,b)=>(a.time||'').localeCompare(b.time||'')); text+=dn[i]+' '+(d.getMonth()+1)+'/'+d.getDate(); if(daySched.length===0)text+='\n  无排课\n'; else daySched.forEach(sc=>{const st=ss.find(s=>s.id===sc.studentId);text+='\n  '+(sc.time||'')+' '+(st?st.name:'')+'\n';});text+='\n'; } text+='\n—— BASP 篮球训练管理平台'; if(navigator.share)navigator.share({title:'本周课表',text:text}).catch(()=>{});else{navigator.clipboard?.writeText(text).then(()=>showToast('已复制')).catch(()=>{});} }

// ==================== Journal ====================
function renderJournal() { const js = DB.getJournals().sort((a,b) => b.date.localeCompare(a.date)), sv = (document.getElementById('journal-search').value||'').toLowerCase(), f = sv ? js.filter(j => j.title.toLowerCase().includes(sv) || j.content.toLowerCase().includes(sv)) : js; const l = document.getElementById('journal-list'); l.innerHTML = f.length === 0 ? '<div class="journal-empty"><div class="empty-icon" style="font-size:48px;">📝</div><div class="empty-title">暂无纪要</div><div class="empty-desc">训练后自动生成 · 也可手动添加</div></div>' : f.map(j => '<div class="journal-item card-enter" onclick="editJournal(\''+j.id+'\')"><div class="journal-item-header"><span class="journal-item-date">'+j.date+'</span><span class="journal-item-date" style="cursor:pointer;color:var(--red);" onclick="event.stopPropagation();deleteJournal(\''+j.id+'\')"></span></div><div class="journal-item-title">'+escHtml(j.title)+'</div><div class="journal-item-preview">'+escHtml(j.content)+'</div>'+(j.tags&&j.tags.length>0?'<div class="journal-item-tags">'+j.tags.map(t=>'<span class="journal-tag">'+escHtml(t)+'</span>').join('')+'</div>':'')+'</div>').join(''); }
function showAddJournal() { editingJournalId = null; document.getElementById('journal-modal-title').textContent = '写纪要'; document.getElementById('journal-title-input').value = ''; document.getElementById('journal-content-input').value = ''; document.getElementById('journal-date-input').value = todayStr(); document.getElementById('journal-modal').style.display = 'flex'; }
function editJournal(id) { const j = DB.getJournals().find(x => x.id === id); if (!j) return; editingJournalId = id; document.getElementById('journal-modal-title').textContent = '编辑纪要'; document.getElementById('journal-title-input').value = j.title; document.getElementById('journal-content-input').value = j.content; document.getElementById('journal-date-input').value = j.date; document.getElementById('journal-modal').style.display = 'flex'; }
function confirmJournal() { const title = document.getElementById('journal-title-input').value.trim(), content = document.getElementById('journal-content-input').value.trim(); if (!title && !content) { showToast('请输入内容'); return; } const date = document.getElementById('journal-date-input').value || todayStr(); if (editingJournalId) { const js = DB.getJournals(), i = js.findIndex(x => x.id === editingJournalId); if (i !== -1) { js[i].title = title; js[i].content = content; js[i].date = date; DB.saveJournals(js); } editingJournalId = null; } else { const js = DB.getJournals(); js.push({ id: genId(), date, title: title||'无标题', content, studentIds: [], tags: ['手动'], createTime: new Date().toISOString() }); DB.saveJournals(js); } closeJournalModal(); renderJournal(); showToast('纪要已保存'); }
function deleteJournal(id) { if (!confirm('删除这条纪要？')) return; DB.saveJournals(DB.getJournals().filter(x => x.id !== id)); renderJournal(); showToast('已删除'); }
function closeJournalModal() { document.getElementById('journal-modal').style.display = 'none'; }

// ==================== Finance ====================
function renderFinance() { const month = thisMonth(), pays = DB.getPayments(), exps = DB.getExpenses(), mi = pays.filter(p => p.date.startsWith(month)).reduce((s,p) => s + p.amount, 0), me = exps.filter(e => e.date.startsWith(month)).reduce((s,e) => s + e.amount, 0), profit = mi - me; document.getElementById('fin-income').textContent = '¥' + mi; document.getElementById('fin-expense').textContent = '¥' + me; document.getElementById('fin-profit').textContent = (profit >= 0 ? '¥' : '-¥') + Math.abs(profit); const ss = DB.getStudents(), rps = pays.sort((a,b) => b.date.localeCompare(a.date)).slice(0,10); document.getElementById('fin-income-list').innerHTML = rps.length === 0 ? '<div style="font-size:13px;color:var(--text-3);text-align:center;padding:10px;">暂无收入</div>' : rps.map(p => { const st = ss.find(s => s.id === p.studentId); return '<div class="payment-item"><span class="pay-date">'+p.date+'</span><span class="pay-pkg">'+(st?escHtml(st.name):'')+' - '+escHtml(p.packageName)+'</span><span class="pay-hours">+'+p.hoursAdded+'课时</span><span class="pay-amount">¥'+p.amount+'</span></div>'; }).join(''); const re = exps.sort((a,b) => b.date.localeCompare(a.date)).slice(0,20); document.getElementById('expense-list').innerHTML = re.length === 0 ? '<div style="font-size:13px;color:var(--text-3);text-align:center;padding:10px;">暂无支出</div>' : re.map(e => '<div class="expense-item"><span class="expense-date">'+e.date+'</span><span class="expense-cat">'+escHtml(e.category||'其他')+'</span><span class="expense-notes">'+escHtml(e.notes||'')+'</span><span class="expense-amount">-¥'+e.amount+'</span><span class="expense-del" onclick="deleteExpense(event,\''+e.id+'\')">✕</span></div>').join(''); const months = []; for (let i=5;i>=0;i--) { const d=new Date();d.setMonth(d.getMonth()-i);months.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')); } const mv = Math.max(1,...months.map(m=>{const inc=pays.filter(p=>p.date.startsWith(m)).reduce((s,p)=>s+p.amount,0),exp=exps.filter(e=>e.date.startsWith(m)).reduce((s,e)=>s+e.amount,0);return Math.max(inc,exp);})); let ch = ''; months.forEach(m=>{const inc=pays.filter(p=>p.date.startsWith(m)).reduce((s,p)=>s+p.amount,0),exp=exps.filter(e=>e.date.startsWith(m)).reduce((s,e)=>s+e.amount,0);ch+='<div class="stats-bar-row"><span class="stats-bar-label">'+m+'</span><span class="stats-bar-count" style="color:#34C759;">+'+inc+'</span><div class="stats-bar"><div class="stats-bar-fill" style="width:'+Math.round(inc/mv*100)+'%;background:#34C759;"></div></div></div><div class="stats-bar-row"><span class="stats-bar-label"></span><span class="stats-bar-count" style="color:#FF3B30;">-'+exp+'</span><div class="stats-bar"><div class="stats-bar-fill" style="width:'+Math.round(exp/mv*100)+'%;background:#FF3B30;"></div></div></div>';}); document.getElementById('fin-month-chart').innerHTML = ch; }
function showAddExpense() { document.getElementById('exp-amount').value='';document.getElementById('exp-date').value=todayStr();document.getElementById('exp-notes').value='';document.getElementById('expense-modal').style.display='flex'; }
function confirmExpense() { const amt=parseInt(document.getElementById('exp-amount').value)||0;if(amt<=0){showToast('请输入金额');return;}const exps=DB.getExpenses();exps.push({id:genId(),date:document.getElementById('exp-date').value||todayStr(),amount:amt,category:document.getElementById('exp-category').value,notes:document.getElementById('exp-notes').value.trim()});DB.saveExpenses(exps);closeExpenseModal();renderFinance();showToast('支出已记录');}
function deleteExpense(e,id){e.stopPropagation();if(!confirm('删除？'))return;DB.saveExpenses(DB.getExpenses().filter(x=>x.id!==id));renderFinance();showToast('已删除');}
function closeExpenseModal(){document.getElementById('expense-modal').style.display='none';}

// ==================== Report ====================
function renderReport(sid){const s=DB.getStudents().find(x=>x.id===sid);if(!s){goBack();return;}const c=DB.getCurriculum(),prog=DB.getStudentProgress(sid),records=DB.getRecords().filter(r=>r.studentId===sid).sort((a,b)=>b.date.localeCompare(a.date)),pays=DB.getStudentPayments(sid),tp=pays.reduce((t,p)=>t+p.amount,0),ti=countLeafItems(c),ci=countCompletedItems(c,prog),pct=ti>0?Math.round(ci/ti*100):0,mastered=[];function fm(nodes){nodes.forEach(n=>{if(n.children&&n.children.length>0)fm(n.children);else if(prog[n.id]&&prog[n.id].count>=3)mastered.push(n.name);});}fm(c);
  document.getElementById('report-content').innerHTML='<div class="report-header"><div class="avatar avatar-c'+hashColor(s.id)+'">'+(s.name||'?')[0]+'</div><div class="report-header-info"><div class="report-name">'+escHtml(s.name)+'</div><div class="report-meta">'+(s.age||'--')+'岁 | '+(s.gender||'')+' | '+(s.group||'未分组')+'</div></div></div><div class="report-stats"><div class="report-stat-item"><div class="report-stat-val">'+s.totalHours+' / '+s.remainingHours+'</div><div style="font-size:11px;color:var(--text-2);">总课时 / 剩余</div></div><div class="report-stat-item"><div class="report-stat-val">'+pct+'%</div><div style="font-size:11px;color:var(--text-2);">训练进度</div></div><div class="report-stat-item"><div class="report-stat-val">¥'+tp+'</div><div style="font-size:11px;color:var(--text-2);">累计缴费</div></div><div class="report-stat-item"><div class="report-stat-val">'+records.length+'次</div><div style="font-size:11px;color:var(--text-2);">累计训练</div></div></div><div class="report-section"><div class="report-section-title">📋 最近训练</div>'+(records.slice(0,5).map(r=>'<div class="report-record">'+r.date+' '+r.duration+'课时 '+(r.checkedItems||[]).slice(0,3).map(i=>'#'+i).join(' ')+'</div>').join('')||'<div class="report-record">暂无</div>')+'</div><div class="report-section"><div class="report-section-title">⭐ 熟练掌握（3次以上）</div><div class="tag-list" style="padding:0;">'+(mastered.length>0?mastered.slice(0,20).map(m=>'<span class="tag-item">'+escHtml(m)+'</span>').join(''):'<span style="color:var(--text-3);">暂无</span>')+'</div></div><div class="report-footer"><span>入学: '+(s.startDate||'--')+'</span> · <span>生成: '+todayStr()+'</span><div style="margin-top:4px;font-size:11px;color:var(--text-3);">BASP 篮球训练管理平台</div></div>';
}
function shareReport(){const s=DB.getStudents().find(x=>x.id===currentDetailId);if(!s)return;const c=DB.getCurriculum(),prog=DB.getStudentProgress(currentDetailId),records=DB.getRecords().filter(r=>r.studentId===currentDetailId),ti=countLeafItems(c),ci=countCompletedItems(c,prog),pct=ti>0?Math.round(ci/ti*100):0;const text='🏀 '+s.name+' 训练报告\n进度: '+pct+'% ('+ci+'/'+ti+')\n训练: '+records.length+'次 | 剩余: '+s.remainingHours+'课时\n—— BASP篮球训练管理平台';if(navigator.share)navigator.share({title:s.name+' 训练报告',text:text}).catch(()=>{});else{navigator.clipboard?.writeText(text).then(()=>showToast('已复制')).catch(()=>{});}}

// ==================== Stats ====================
function renderStats(){const ss=DB.getStudents(),rs=DB.getRecords(),ps=DB.getPayments(),c=DB.getCurriculum(),prog=DB.getProgress(),ti=countLeafItems(c);const gc={};ss.forEach(s=>{const g=s.group||'未分组';gc[g]=(gc[g]||0)+1;});document.getElementById('stats-group-chart').innerHTML=Object.entries(gc).map(([g,n])=>'<div class="stats-bar-row"><span class="stats-bar-label">'+escHtml(g)+'</span><span class="stats-bar-count">'+n+'人</span><div class="stats-bar"><div class="stats-bar-fill" style="width:'+Math.round(n/ss.length*100)+'%"></div></div></div>').join('')||'<div style="color:var(--text-3);text-align:center;padding:20px;">暂无数据</div>';const dc=[0,0,0,0,0,0,0],dn=['日','一','二','三','四','五','六'];rs.forEach(r=>{dc[new Date(r.date).getDay()]++;});const md=Math.max(1,...dc);document.getElementById('stats-week-chart').innerHTML=dn.map((d,i)=>'<div class="stats-bar-row"><span class="stats-bar-label">周'+d+'</span><span class="stats-bar-count">'+dc[i]+'次</span><div class="stats-bar"><div class="stats-bar-fill" style="width:'+Math.round(dc[i]/md*100)+'%;background:#007AFF;"></div></div></div>').join('');const ms=[];for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);ms.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));}const mh={};ms.forEach(m=>mh[m]=0);rs.forEach(r=>{const m=r.date.slice(0,7);if(mh[m]!==undefined)mh[m]+=r.duration;});document.getElementById('stats-month-chart').innerHTML=ms.map(m=>'<div class="stats-bar-row"><span class="stats-bar-label">'+m+'</span><span class="stats-bar-count">'+mh[m]+'课时</span><div class="stats-bar"><div class="stats-bar-fill" style="width:'+Math.round(mh[m]/Math.max(1,...Object.values(mh))*100)+'%;background:#34C759;"></div></div></div>').join('');document.getElementById('stats-overview').textContent=ss.length+'学员 | '+rs.length+'条记录 | ¥'+ps.reduce((s,p)=>s+p.amount,0)+'总收入';}
function exportCSV(){const ss=DB.getStudents(),rs=DB.getRecords(),ps=DB.getPayments();let csv='学员姓名,电话,年龄,性别,分组,总课时,剩余课时,入学日期,备注\n';ss.forEach(s=>{csv+=[s.name,s.phone,s.age,s.gender,s.group,s.totalHours,s.remainingHours,s.startDate,s.notes].map(v=>'"'+(v||'')+'"').join(',')+'\n';});csv+='\n训练记录\n日期,学员,课时,项目,备注\n';rs.forEach(r=>{const st=ss.find(s=>s.id===r.studentId);csv+=[r.date,st?st.name:'',r.duration,(r.checkedItems||[]).join('/'),r.notes].map(v=>'"'+(v||'')+'"').join(',')+'\n';});csv+='\n缴费记录\n日期,学员,套餐,金额,课时,备注\n';ps.forEach(p=>{const st=ss.find(s=>s.id===p.studentId);csv+=[p.date,st?st.name:'',p.packageName,p.amount,p.hoursAdded,p.notes].map(v=>'"'+(v||'')+'"').join(',')+'\n';});const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='BASP数据_'+todayStr()+'.csv';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);showToast('导出成功');}

// ==================== Modal ====================
function closeModal(){document.getElementById('modal-overlay').style.display='none';}

// ==================== Init ====================
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('input-date').value=todayStr();document.getElementById('training-date').value=todayStr();
  const ct=DB.getCurrentTrainerId();
  showSplash();
  if(ct&&DB.getTrainerById(ct)){DB.setTrainer(ct);document.getElementById('page-login').classList.remove('active');document.getElementById('page-dashboard').classList.add('active');renderDashboard();}
  else{renderLogin();}
  document.getElementById('modal-overlay').addEventListener('click',function(e){if(e.target===this)closeModal();});
  document.getElementById('payment-modal').addEventListener('click',function(e){if(e.target===this)closePaymentModal();});
  document.getElementById('schedule-modal').addEventListener('click',function(e){if(e.target===this)closeScheduleModal();});
  document.getElementById('expense-modal').addEventListener('click',function(e){if(e.target===this)closeExpenseModal();});
  document.getElementById('journal-modal').addEventListener('click',function(e){if(e.target===this)closeJournalModal();});
  document.getElementById('profile-modal').addEventListener('click',function(e){if(e.target===this)closeProfileModal();});
});
