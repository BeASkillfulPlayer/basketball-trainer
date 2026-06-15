/**
 * 篮球训练管理平台 v3.0
 * 多训练师 + 工作台 + 财务管理 + 学员分组 + BASP训练体系
 */

// ==================== 训练大纲 ====================
const DEFAULT_CURRICULUM = (typeof CURRICULUM_DATA !== 'undefined') ? CURRICULUM_DATA : [];

// 默认课程套餐
const DEFAULT_PACKAGES = [
  { id: 'pkg1', name: '单次体验', hours: 1, price: 0 },
  { id: 'pkg2', name: '10节课', hours: 10, price: 0 },
  { id: 'pkg3', name: '20节课', hours: 20, price: 0 },
  { id: 'pkg4', name: '30节课', hours: 30, price: 0 },
  { id: 'pkg5', name: '包月', hours: 30, price: 0 },
  { id: 'pkg6', name: '包季', hours: 90, price: 0 }
];

// ==================== 数据层 ====================

const DB = {
  _prefix: '',

  /** 设置当前训练师ID */
  setTrainer(tid) {
    this._prefix = tid ? tid + '_' : '';
    localStorage.setItem('currentTrainerId', tid || '');
  },

  /** 获取当前训练师ID */
  getCurrentTrainerId() {
    return localStorage.getItem('currentTrainerId') || '';
  },

  // 基础读写
  get(key) {
    try { return JSON.parse(localStorage.getItem(this._prefix + key)) || null; }
    catch(e) { return null; }
  },
  set(key, val) {
    localStorage.setItem(this._prefix + key, JSON.stringify(val));
  },

  // === 训练师 ===
  getTrainers() { return JSON.parse(localStorage.getItem('trainers') || '[]'); },
  saveTrainers(arr) { localStorage.setItem('trainers', JSON.stringify(arr)); },
  getTrainerById(id) { return this.getTrainers().find(t => t.id === id) || null; },

  addTrainer(name, phone, password) {
    const trainers = this.getTrainers();
    const t = { id: genId(), name, phone, password, createTime: new Date().toISOString() };
    trainers.push(t);
    this.saveTrainers(trainers);
    return t;
  },

  // === 学员 ===
  getStudents() { return this.get('students') || []; },
  saveStudents(arr) { this.set('students', arr); },

  // === 训练记录 ===
  getRecords() { return this.get('records') || []; },
  saveRecords(arr) { this.set('records', arr); },

  // === 训练大纲 ===
  getCurriculum() {
    const saved = this.get('curriculum');
    if (saved) return saved;
    this.set('curriculum', DEFAULT_CURRICULUM);
    return DEFAULT_CURRICULUM;
  },

  // === 训练进度 ===
  getProgress() { return this.get('progress') || {}; },
  saveProgress(data) { this.set('progress', data); },
  getStudentProgress(sid) { const all = this.getProgress(); return all[sid] || {}; },
  setStudentProgress(sid, data) { const all = this.getProgress(); all[sid] = data; this.saveProgress(all); },

  // === 缴费记录 ===
  getPayments() { return this.get('payments') || []; },
  savePayments(arr) { this.set('payments', arr); },
  getStudentPayments(sid) { return this.getPayments().filter(p => p.studentId === sid).sort((a,b) => b.date.localeCompare(a.date)); },

  // === 课程套餐 ===
  getPackages() {
    const saved = this.get('packages');
    if (saved && saved.length > 0) return saved;
    return DEFAULT_PACKAGES;
  },
  savePackages(arr) { this.set('packages', arr); },

  // === 排课 ===
  getSchedule() { return this.get('schedule') || []; },
  saveSchedule(arr) { this.set('schedule', arr); },

  // === 数据迁移：旧版本无前缀数据 → 迁移到默认训练师 ===
  migrateOldData(trainerId) {
    const oldStudents = localStorage.getItem('students');
    const oldRecords = localStorage.getItem('records');
    const oldProgress = localStorage.getItem('progress');
    const oldCurriculum = localStorage.getItem('curriculum');

    if (oldStudents) {
      const prefix = trainerId + '_';
      if (!localStorage.getItem(prefix + 'students')) {
        localStorage.setItem(prefix + 'students', oldStudents);
        localStorage.setItem(prefix + 'records', oldRecords || '[]');
        localStorage.setItem(prefix + 'progress', oldProgress || '{}');
        if (oldCurriculum) localStorage.setItem(prefix + 'curriculum', oldCurriculum);
      }
      // 清除旧数据
      localStorage.removeItem('students');
      localStorage.removeItem('records');
      localStorage.removeItem('progress');
      localStorage.removeItem('curriculum');
      localStorage.removeItem('template');
    }
  }
};

// ==================== 大纲工具函数 ====================

function getAllLeafIds(curriculum) {
  const ids = [];
  function walk(nodes) { nodes.forEach(n => { if (n.children && n.children.length > 0) walk(n.children); else ids.push(n.id); }); }
  walk(curriculum);
  return ids;
}

function countLeafItems(curriculum) { return getAllLeafIds(curriculum).length; }

function countCompletedItems(curriculum, progress) {
  let count = 0;
  function walk(nodes) { nodes.forEach(n => { if (n.children && n.children.length > 0) walk(n.children); else { if (progress[n.id] && progress[n.id].done) count++; } }); }
  walk(curriculum);
  return count;
}

function countNodeProgress(node, progress) {
  let total = 0, completed = 0;
  function walk(n) { if (n.children && n.children.length > 0) n.children.forEach(walk); else { total++; if (progress[n.id] && progress[n.id].done) completed++; } }
  walk(node);
  return { total, completed };
}

// ==================== 工具函数 ====================

function genId() { return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function thisMonth() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); }
function hashColor(str) { let h=0; for(let i=0;i<str.length;i++) h=((h<<5)-h)+str.charCodeAt(i); return Math.abs(h)%8; }

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => el.classList.remove('show'), 1500);
}

// ==================== 页面导航 ====================

const navStack = [];
let currentPage = 'login';
let currentDetailId = null;
let currentTrainingStudentId = null;
let editingStudentId = null;
let progressStudentId = null;
let trainingCustomItems = [];

function navigateTo(pageId, data) {
  const oldPage = document.getElementById('page-' + currentPage);
  const newPage = document.getElementById('page-' + pageId);
  oldPage.classList.remove('active'); oldPage.classList.add('slide-back');
  newPage.classList.add('active'); newPage.classList.remove('slide-back');
  navStack.push(currentPage); currentPage = pageId;
  updateTabBar(pageId);
  newPage.scrollTop = 0;
  const content = newPage.querySelector('.page-content');
  if (content) content.scrollTop = 0;
  if (pageId === 'detail' && data) renderDetail(data.id);
  if (pageId === 'progress' && data) renderProgressTree(data.studentId);
  if (pageId === 'training' && data) initTraining(data.studentId);
  if (pageId === 'report' && data) renderReport(data.studentId);
  if (pageId === 'schedule') renderSchedule();
  if (pageId === 'stats') renderStats();
  if (pageId === 'home') renderHome();
}

function goBack() {
  if (navStack.length === 0) return;
  const prevPage = navStack.pop();
  document.getElementById('page-' + currentPage).classList.remove('active');
  document.getElementById('page-' + prevPage).classList.add('active');
  document.getElementById('page-' + prevPage).classList.remove('slide-back');
  currentPage = prevPage; updateTabBar(prevPage);
  if (prevPage === 'home') renderHome();
  if (prevPage === 'add') resetAddForm();
  if (prevPage === 'detail') renderDetail(currentDetailId);
}

function switchTab(tab) {
  const pages = { home:'home', add:'add', settings:'settings' };
  const page = pages[tab] || 'home';
  if (currentPage === page) return;
  document.getElementById('page-' + currentPage).classList.remove('active');
  document.getElementById('page-' + page).classList.add('active');
  document.getElementById('page-' + page).classList.remove('slide-back');
  navStack.length = 0; currentPage = page;
  updateTabBar(page);
  if (page === 'home') renderHome();
}

function updateTabBar(page) {
  const tabBar = document.getElementById('tab-bar');
  const tabs = tabBar.querySelectorAll('.tab-btn');
  if (['home', 'add', 'settings'].includes(page)) {
    tabBar.style.display = 'flex';
    tabs.forEach(t => t.classList.toggle('active', t.dataset.page === page));
  } else {
    tabBar.style.display = 'none';
  }
}

// ==================== 登录系统 ====================

function renderLogin() {
  currentPage = 'login';
  const trainers = DB.getTrainers();
  const listEl = document.getElementById('trainer-list');
  if (trainers.length === 0) {
    listEl.innerHTML = '<div class="empty-state" style="padding:40px 0;"><div class="empty-icon">🏀</div><div class="empty-title">欢迎使用篮球训练管理平台</div><div class="empty-desc">点击下方按钮注册你的教练账号</div></div>';
  } else {
    listEl.innerHTML = trainers.map(t => `
      <div class="trainer-card" onclick="loginTrainer('${t.id}')">
        <div class="avatar-sm avatar-c${hashColor(t.id)}">${(t.name||'?')[0]}</div>
        <div class="trainer-info">
          <div class="trainer-name">${escHtml(t.name)}</div>
          <div class="trainer-phone">${escHtml(t.phone||'')}</div>
        </div>
        <span class="trainer-arrow">›</span>
      </div>
    `).join('');
  }
}

function loginTrainer(id) {
  const trainer = DB.getTrainerById(id);
  if (!trainer) return;
  // 简单密码验证（如果设置了密码）
  if (trainer.password && trainer.password.trim()) {
    const pw = prompt('请输入密码：');
    if (pw !== trainer.password) { showToast('密码错误'); return; }
  }
  DB.setTrainer(id);
  DB.migrateOldData(id);
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-home').classList.add('active');
  updateTabBar('home');
  renderHome();
}

function showRegister() {
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('page-register').classList.add('active');
}

function registerTrainer() {
  const name = document.getElementById('reg-name').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value.trim();
  if (!name) { showToast('请输入姓名'); return; }
  const t = DB.addTrainer(name, phone, password);
  document.getElementById('reg-name').value = '';
  document.getElementById('reg-phone').value = '';
  document.getElementById('reg-password').value = '';
  document.getElementById('page-register').classList.remove('active');
  document.getElementById('page-login').classList.add('active');
  renderLogin();
  showToast('注册成功！点击登录');
}

function backToLogin() {
  document.getElementById('page-register').classList.remove('active');
  document.getElementById('page-login').classList.add('active');
}

function logoutTrainer() {
  if (!confirm('确定要退出当前账号吗？')) return;
  DB.setTrainer('');
  document.getElementById('page-settings').classList.remove('active');
  document.getElementById('page-login').classList.add('active');
  updateTabBar('login');
  renderLogin();
}

// ==================== 工作台（首页） ====================

function renderHome() {
  const students = DB.getStudents();
  const records = DB.getRecords();
  const payments = DB.getPayments();
  const today = todayStr();
  const month = thisMonth();

  // 统计
  const todayIds = new Set(records.filter(r => r.date === today).map(r => r.studentId));
  const monthPayments = payments.filter(p => p.date.startsWith(month));
  const monthIncome = monthPayments.reduce((s, p) => s + p.amount, 0);

  document.getElementById('stat-total').textContent = students.length;
  document.getElementById('stat-today').textContent = todayIds.size;
  document.getElementById('stat-income').textContent = '¥' + monthIncome;

  const trainer = DB.getTrainerById(DB.getCurrentTrainerId());
  document.getElementById('greeting-name').textContent = trainer ? trainer.name : '教练';
  // 导航栏头像和日期
  document.getElementById('nav-avatar').textContent = trainer ? (trainer.name||'?')[0] : '?';
  const days = ['日','一','二','三','四','五','六'];
  const now = new Date();
  document.getElementById('nav-date').textContent = now.getFullYear()+'年'+(now.getMonth()+1)+'月'+now.getDate()+'日 星期'+days[now.getDay()];

  // 提醒
  const alerts = [];
  students.forEach(s => {
    if (s.remainingHours <= 0) alerts.push({ text: s.name + ' 课时已用完，需要续费', type: 'danger', studentId: s.id });
    else if (s.remainingHours <= 2) alerts.push({ text: s.name + ' 仅剩 ' + s.remainingHours + ' 课时', type: 'warn', studentId: s.id });
  });
  // 3天未上课提醒
  const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysStr = threeDaysAgo.toISOString().slice(0,10);
  students.forEach(s => {
    const sRecords = records.filter(r => r.studentId === s.id).sort((a,b) => b.date.localeCompare(a.date));
    if (sRecords.length > 0 && sRecords[0].date < threeDaysStr) {
      alerts.push({ text: s.name + ' 已 ' + Math.floor((new Date() - new Date(sRecords[0].date)) / 86400000) + ' 天未上课', type: 'info', studentId: s.id });
    } else if (sRecords.length === 0 && s.createTime && new Date(s.createTime) < threeDaysAgo) {
      alerts.push({ text: s.name + ' 添加后还未上过课', type: 'info', studentId: s.id });
    }
  });

  const alertEl = document.getElementById('alerts-list');
  const alertSection = document.getElementById('alerts-section');
  if (alerts.length > 0) {
    alertSection.style.display = 'block';
    alertEl.innerHTML = alerts.slice(0, 5).map(a => `
      <div class="alert-item ${a.type}" onclick="openDetail('${a.studentId}')">
        <span class="alert-dot"></span>${escHtml(a.text)}
      </div>
    `).join('');
  } else {
    alertSection.style.display = 'none';
  }

  // 今日课程
  const schedule = DB.getSchedule();
  const todaySchedule = schedule.filter(s => s.date === today).sort((a,b) => (a.time||'').localeCompare(b.time||''));
  const schedSection = document.getElementById('today-schedule-section');
  const schedList = document.getElementById('today-schedule-list');
  if (todaySchedule.length > 0) {
    schedSection.style.display = 'block';
    schedList.innerHTML = todaySchedule.map(sc => {
      const st = students.find(s => s.id === sc.studentId);
      return `<div class="schedule-item" onclick="openDetail('${sc.studentId}')"><span class="sched-time">${sc.time||'--:--'}</span><span class="sched-student">${st?escHtml(st.name):'未知'}</span><span class="sched-note">${escHtml(sc.notes||'')}</span></div>`;
    }).join('');
  } else {
    schedSection.style.display = 'none';
  }

  // 分组标签
  const groups = new Set(['全部']);
  students.forEach(s => { if (s.group) groups.add(s.group); });
  const activeGroup = document.querySelector('.group-tag.active')?.dataset.group || '全部';
  document.getElementById('group-tags').innerHTML = Array.from(groups).map(g => `
    <span class="group-tag ${g === activeGroup ? 'active' : ''}" data-group="${escAttr(g)}" onclick="filterByGroup(this, '${escAttr(g)}')">${escHtml(g)}</span>
  `).join('');

  // 搜索
  const searchVal = (document.getElementById('search-input').value || '').toLowerCase();

  // 筛选学员
  let filteredStudents = students;
  if (activeGroup !== '全部') filteredStudents = filteredStudents.filter(s => s.group === activeGroup);
  if (searchVal) filteredStudents = filteredStudents.filter(s => s.name.toLowerCase().includes(searchVal) || (s.phone||'').includes(searchVal));

  document.getElementById('student-count').textContent = '共 ' + filteredStudents.length + ' 人';

  // 计算进度
  const progress = DB.getProgress();
  const curriculum = DB.getCurriculum();
  filteredStudents.forEach(s => {
    const sRecords = records.filter(r => r.studentId === s.id).sort((a,b) => b.date.localeCompare(a.date));
    s.lastDate = sRecords.length > 0 ? sRecords[0].date : null;
    const totalItems = countLeafItems(curriculum);
    const completed = countCompletedItems(curriculum, progress[s.id] || {});
    s.progressPct = totalItems > 0 ? Math.round(completed / totalItems * 100) : 0;
  });

  const listEl = document.getElementById('student-list');
  const emptyEl = document.getElementById('empty-state');
  if (filteredStudents.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';
  listEl.innerHTML = filteredStudents.map(s => `
    <div class="student-card" onclick="openDetail('${s.id}')">
      <div class="student-card-top">
        <div class="avatar-sm avatar-c${hashColor(s.id)}">${(s.name||'?')[0]}</div>
        <div class="student-info">
          <div class="student-name">${escHtml(s.name)}</div>
          <div class="student-meta">
            ${s.group ? '<span class="group-badge">'+escHtml(s.group)+'</span> ' : ''}
            ${s.age ? s.age+'岁 · ' : ''}${s.gender || ''}
            <span style="color:#34C759;font-weight:500;"> · ${s.progressPct}%</span>
          </div>
        </div>
        <div class="student-hours-badge">
          <div class="hours-num">${s.remainingHours}</div>
          <div class="hours-unit">剩余课时</div>
        </div>
      </div>
      ${(s.phone || s.lastDate) ? `
      <div class="student-card-bottom">
        ${s.phone ? '<span>📱 '+escHtml(s.phone)+'</span>' : ''}
        ${s.lastDate ? '<span>📅 最近: '+s.lastDate+'</span>' : ''}
      </div>` : ''}
    </div>
  `).join('');
}

function filterByGroup(el, group) {
  document.querySelectorAll('.group-tag').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderHome();
}

function onSearchInput(e) {
  document.getElementById('search-input')._value = e.target.value;
  clearTimeout(document.getElementById('search-input')._timer);
  document.getElementById('search-input')._timer = setTimeout(() => {
    document.getElementById('search-input').value = document.getElementById('search-input')._value;
    renderHome();
  }, 200);
}

function openDetail(id) { navigateTo('detail', { id }); }

// 删除学员（长按）
document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('student-list');
  let pressTimer;
  listEl.addEventListener('touchstart', function(e) {
    const card = e.target.closest('.student-card');
    if (!card) return;
    pressTimer = setTimeout(() => {
      const match = card.onclick.toString().match(/openDetail\('([^']+)'/);
      if (match && match[1]) showDeleteStudentModal(match[1]);
    }, 600);
  }, { passive: true });
  listEl.addEventListener('touchend', () => clearTimeout(pressTimer));
  listEl.addEventListener('touchmove', () => clearTimeout(pressTimer));
});

function showDeleteStudentModal(id) {
  const student = DB.getStudents().find(s => s.id === id);
  if (!student) return;
  document.getElementById('modal-body').textContent = '确定删除「' + student.name + '」吗？该学员的所有训练记录和缴费记录也会被删除。此操作不可恢复。';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-confirm-btn').onclick = function() { deleteStudent(id); closeModal(); };
}

function deleteStudent(id) {
  const students = DB.getStudents().filter(s => s.id !== id);
  const records = DB.getRecords().filter(r => r.studentId !== id);
  const payments = DB.getPayments().filter(p => p.studentId !== id);
  const progress = DB.getProgress(); delete progress[id];
  DB.saveStudents(students); DB.saveRecords(records); DB.savePayments(payments); DB.saveProgress(progress);
  renderHome(); showToast('已删除');
}

// ==================== 添加/编辑学员 ====================

function resetAddForm() {
  editingStudentId = null;
  document.getElementById('add-title').textContent = '添加学员';
  document.getElementById('add-back-btn').style.display = 'none';
  document.getElementById('input-name').value = '';
  document.getElementById('input-phone').value = '';
  document.getElementById('input-age').value = '';
  document.getElementById('input-group').value = '';
  document.getElementById('input-parent-name').value = '';
  document.getElementById('input-parent-phone').value = '';
  document.getElementById('input-hours').value = '';
  document.getElementById('input-date').value = todayStr();
  document.getElementById('input-notes').value = '';
  document.getElementById('btn-save').textContent = '添加学员';
  document.querySelectorAll('#gender-picker .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === '男'));
}

function editStudent() {
  const student = DB.getStudents().find(s => s.id === currentDetailId);
  if (!student) return;
  editingStudentId = student.id;
  document.getElementById('add-title').textContent = '编辑学员';
  document.getElementById('add-back-btn').style.display = 'flex';
  document.getElementById('input-name').value = student.name || '';
  document.getElementById('input-phone').value = student.phone || '';
  document.getElementById('input-age').value = student.age || '';
  document.getElementById('input-group').value = student.group || '';
  document.getElementById('input-parent-name').value = student.parentName || '';
  document.getElementById('input-parent-phone').value = student.parentPhone || '';
  document.getElementById('input-hours').value = student.totalHours || '';
  document.getElementById('input-date').value = student.startDate || todayStr();
  document.getElementById('input-notes').value = student.notes || '';
  document.getElementById('btn-save').textContent = '保存修改';
  document.querySelectorAll('#gender-picker .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === student.gender));
  navigateTo('add');
}

function getGender() { const a = document.querySelector('#gender-picker .seg-btn.active'); return a ? a.dataset.value : '男'; }

function saveStudent() {
  const name = document.getElementById('input-name').value.trim();
  const phone = document.getElementById('input-phone').value.trim();
  const age = document.getElementById('input-age').value.trim();
  const gender = getGender();
  const group = document.getElementById('input-group').value.trim();
  const parentName = document.getElementById('input-parent-name').value.trim();
  const parentPhone = document.getElementById('input-parent-phone').value.trim();
  const totalHours = parseInt(document.getElementById('input-hours').value) || 0;
  const startDate = document.getElementById('input-date').value || todayStr();
  const notes = document.getElementById('input-notes').value.trim();
  if (!name) { showToast('请输入姓名'); return; }
  if (totalHours <= 0) { showToast('请输入有效的课时数'); return; }
  if (editingStudentId) {
    const students = DB.getStudents(); const idx = students.findIndex(s => s.id === editingStudentId);
    if (idx !== -1) {
      const old = students[idx]; const used = old.totalHours - old.remainingHours;
      students[idx] = { ...old, name, phone, age, gender, group, parentName, parentPhone, totalHours, remainingHours: Math.max(0, totalHours - used), startDate, notes };
      DB.saveStudents(students);
    }
    editingStudentId = null; showToast('修改成功');
  } else {
    const students = DB.getStudents();
    students.push({ id: genId(), name, phone, age, gender, group, parentName, parentPhone, totalHours, remainingHours: totalHours, startDate, notes, createTime: new Date().toISOString() });
    DB.saveStudents(students); showToast('添加成功');
  }
  resetAddForm(); switchTab('home');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('gender-picker').addEventListener('click', function(e) {
    const btn = e.target.closest('.seg-btn'); if (!btn) return;
    this.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ==================== 学员详情 ====================

function renderDetail(id) {
  currentDetailId = id;
  const student = DB.getStudents().find(s => s.id === id);
  if (!student) { goBack(); return; }
  const curriculum = DB.getCurriculum();
  const progress = DB.getStudentProgress(id);
  const used = student.totalHours - student.remainingHours;
  const pct = student.totalHours > 0 ? Math.round(used / student.totalHours * 100) : 0;
  const totalItems = countLeafItems(curriculum);
  const completed = countCompletedItems(curriculum, progress);
  const itemPct = totalItems > 0 ? Math.round(completed / totalItems * 100) : 0;

  document.getElementById('detail-name').textContent = student.name;
  document.getElementById('detail-avatar').textContent = (student.name || '?')[0];
  document.getElementById('detail-avatar').className = 'avatar avatar-c' + hashColor(student.id);
  document.getElementById('detail-info-name').textContent = student.name;
  document.getElementById('detail-info-meta').textContent = (student.age ? student.age + '岁 · ' : '') + (student.gender || '') + (student.group ? ' · ' + student.group : '');
  document.getElementById('detail-info-date').textContent = student.startDate ? '📅 入学：' + student.startDate : '';

  const notesEl = document.getElementById('detail-notes');
  notesEl.style.display = student.notes ? 'block' : 'none';
  if (student.notes) notesEl.innerHTML = '<strong>备注：</strong>' + escHtml(student.notes);

  // 家长信息
  const parentEl = document.getElementById('detail-parent-info');
  parentEl.style.display = (student.parentName || student.parentPhone) ? 'block' : 'none';
  if (student.parentName || student.parentPhone) {
    document.getElementById('detail-parent-text').textContent = '👨‍👩‍👧 家长：' + (student.parentName||'') + (student.parentPhone ? ' (' + student.parentPhone + ')' : '');
  }

  document.getElementById('detail-total').textContent = student.totalHours;
  document.getElementById('detail-used').textContent = used;
  document.getElementById('detail-remain').textContent = student.remainingHours;
  document.getElementById('detail-progress').style.width = pct + '%';
  document.getElementById('detail-progress-text').textContent = '已使用 ' + pct + '%';

  // 训练进程概览
  document.getElementById('progress-pct').textContent = '完成 ' + itemPct + '%';
  document.getElementById('progress-pct-bar').style.width = itemPct + '%';
  document.getElementById('progress-nums').textContent = completed + ' / ' + totalItems + ' 项';
  const catList = document.getElementById('progress-cat-list');
  catList.innerHTML = curriculum.map(g => {
    const p = countNodeProgress(g, progress); const pct2 = p.total > 0 ? Math.round(p.completed / p.total * 100) : 0;
    return `<div class="progress-cat-item" onclick="openProgressPage('${id}')"><span class="cat-icon">${g.icon||'📌'}</span><span class="cat-name">${escHtml(g.name)}</span><span class="cat-stat">${p.completed}/${p.total}</span><span class="cat-pct">${pct2}%</span><span class="cat-arrow">›</span></div>`;
  }).join('');

  // 缴费记录
  const payments = DB.getStudentPayments(id);
  const totalPaid = payments.reduce((s,p) => s + p.amount, 0);
  document.getElementById('total-paid').textContent = '¥' + totalPaid;
  document.getElementById('payment-count').textContent = '共 ' + payments.length + ' 笔';
  const payList = document.getElementById('payment-list');
  if (payments.length === 0) {
    payList.innerHTML = '<div class="payment-empty">暂无缴费记录</div>';
  } else {
    payList.innerHTML = payments.map(p => `<div class="payment-item"><span class="pay-date">${p.date}</span><span class="pay-pkg">${escHtml(p.packageName)}</span><span class="pay-hours">+${p.hoursAdded}课时</span><span class="pay-amount">¥${p.amount}</span></div>`).join('');
  }

  // 训练记录
  const records = DB.getRecords().filter(r => r.studentId === id).sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById('record-count').textContent = '共 ' + records.length + ' 次';
  const listEl = document.getElementById('record-list');
  const emptyEl = document.getElementById('record-empty');
  if (records.length === 0) { listEl.innerHTML = ''; emptyEl.style.display = 'flex'; }
  else {
    emptyEl.style.display = 'none';
    listEl.innerHTML = records.map(r => `
      <div class="record-card"><div class="record-header"><span class="record-date">📅 ${r.date}</span><span class="record-dur">⏱ ${r.duration}课时</span><span class="record-del" onclick="deleteRecord(event,'${r.id}')">🗑</span></div>
      ${(r.checkedItems&&r.checkedItems.length>0||r.customItems&&r.customItems.length>0)?`<div class="record-tags">${(r.checkedItems||[]).map(i=>'<span class="tag">✅ '+escHtml(i)+'</span>').join('')}${(r.customItems||[]).map(i=>'<span class="tag tag-custom">✨ '+escHtml(i)+'</span>').join('')}</div>`:'<div class="record-no-items">未记录训练项目</div>'}
      ${r.notes?'<div class="record-notes-text">💬 '+escHtml(r.notes)+'</div>':''}</div>
    `).join('');
  }
}

function openProgressPage(studentId) { navigateTo('progress', { studentId }); }
function startTraining() { navigateTo('training', { studentId: currentDetailId }); }

function showAddPayment() {
  const student = DB.getStudents().find(s => s.id === currentDetailId);
  if (!student) return;
  const packages = DB.getPackages();
  document.getElementById('pay-student-name').textContent = '为 ' + student.name + ' 添加缴费';
  document.getElementById('pay-amount').value = '';
  document.getElementById('pay-date').value = todayStr();
  document.getElementById('pay-notes').value = '';
  // 套餐选择
  const pkgEl = document.getElementById('pay-packages');
  pkgEl.innerHTML = packages.map(p => `
    <div class="pay-pkg-option" data-id="${p.id}" data-hours="${p.hours}" onclick="selectPackage(this, '${p.id}', ${p.hours})">
      <span class="pay-pkg-name">${escHtml(p.name)}</span><span class="pay-pkg-hours">${p.hours}课时</span>
    </div>
  `).join('');
  selectedPackage = null;
  document.getElementById('payment-modal').style.display = 'flex';
}

let selectedPackage = null;
function selectPackage(el, id, hours) {
  document.querySelectorAll('.pay-pkg-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  selectedPackage = { id, hours, name: el.querySelector('.pay-pkg-name').textContent };
}

function confirmPayment() {
  const amount = parseInt(document.getElementById('pay-amount').value) || 0;
  const date = document.getElementById('pay-date').value || todayStr();
  const notes = document.getElementById('pay-notes').value.trim();
  if (!selectedPackage) { showToast('请选择课程套餐'); return; }
  if (amount <= 0) { showToast('请输入金额'); return; }

  const payments = DB.getPayments();
  payments.push({ id: genId(), studentId: currentDetailId, amount, packageName: selectedPackage.name, hoursAdded: selectedPackage.hours, date, notes, createTime: new Date().toISOString() });
  DB.savePayments(payments);

  // 增加学员课时
  const students = DB.getStudents(); const s = students.find(st => st.id === currentDetailId);
  if (s) { s.totalHours += selectedPackage.hours; s.remainingHours += selectedPackage.hours; DB.saveStudents(students); }

  closePaymentModal(); renderDetail(currentDetailId); showToast('缴费记录已保存，课时已增加');
}

function closePaymentModal() { document.getElementById('payment-modal').style.display = 'none'; }

function deleteRecord(event, recordId) {
  event.stopPropagation();
  document.getElementById('modal-body').textContent = '删除此训练记录将恢复对应课时，确定删除吗？';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-confirm-btn').onclick = function() {
    const records = DB.getRecords(); const target = records.find(r => r.id === recordId);
    if (target) {
      const students = DB.getStudents(); const s = students.find(st => st.id === target.studentId);
      if (s) s.remainingHours += target.duration; DB.saveStudents(students);
      if (target.checkedIds && target.checkedIds.length > 0) {
        const progress = DB.getStudentProgress(target.studentId);
        target.checkedIds.forEach(id => { if (progress[id]) { progress[id].count--; if (progress[id].count <= 0) { progress[id].done = false; progress[id].count = 0; progress[id].firstAt = null; } } });
        DB.setStudentProgress(target.studentId, progress);
      }
    }
    DB.saveRecords(records.filter(r => r.id !== recordId));
    renderDetail(currentDetailId); closeModal(); showToast('已删除并恢复课时');
  };
}

// ==================== 训练进程详情 ====================

function renderProgressTree(studentId) {
  progressStudentId = studentId;
  const student = DB.getStudents().find(s => s.id === studentId);
  if (!student) { goBack(); return; }
  document.getElementById('prog-title').textContent = student.name + ' · 训练进程';
  document.getElementById('prog-avatar').textContent = (student.name || '?')[0];
  document.getElementById('prog-avatar').className = 'avatar avatar-c' + hashColor(student.id);
  const curriculum = DB.getCurriculum();
  const progress = DB.getStudentProgress(studentId);
  const totalItems = countLeafItems(curriculum), completed = countCompletedItems(curriculum, progress);
  const itemPct = totalItems > 0 ? Math.round(completed / totalItems * 100) : 0;
  document.getElementById('prog-overall').textContent = '📊 总进度: ' + completed + '/' + totalItems + ' (' + itemPct + '%)';
  document.getElementById('prog-overall-bar').style.width = itemPct + '%';
  document.getElementById('progress-tree').innerHTML = buildTreeHTML(curriculum, progress, 0);
}

function buildTreeHTML(nodes, progress, depth) {
  let html = '';
  nodes.forEach(node => {
    if (node.children && node.children.length > 0) {
      const p = countNodeProgress(node, progress); const pct2 = p.total > 0 ? Math.round(p.completed / p.total * 100) : 0;
      const doneClass = p.completed === p.total ? ' all-done' : '';
      html += `<div class="tree-group${doneClass}" onclick="toggleTreeGroup(this)" data-expanded="${depth<2?'true':'false'}"><div class="tree-group-header" style="padding-left:${depth*16}px"><span class="tree-arrow">${depth<2?'▼':'▶'}</span><span class="tree-group-icon">${node.icon||'📌'}</span><span class="tree-group-name">${escHtml(node.name)}</span><span class="tree-group-stat">${p.completed}/${p.total}</span><div class="tree-mini-bar"><div class="tree-mini-fill" style="width:${pct2}%"></div></div></div><div class="tree-group-body" style="display:${depth<2?'block':'none'}">${buildTreeHTML(node.children, progress, depth+1)}</div></div>`;
    } else {
      const pro = progress[node.id]; const done = pro && pro.done; const count = pro ? pro.count : 0; const date = pro && pro.firstAt ? pro.firstAt : '';
      html += `<div class="tree-item ${done?'done':'undone'}" style="padding-left:${depth*16+8}px"><span class="tree-check">${done?'✅':'⬜'}</span><span class="tree-item-name">${escHtml(node.name)}</span>${done?'<span class="tree-item-count">'+count+'次</span>':'<span class="tree-item-count undone">未练</span>'}${date?'<span class="tree-item-date">'+date+'</span>':''}</div>`;
    }
  });
  return html;
}

function toggleTreeGroup(el) {
  const expanded = el.dataset.expanded === 'true';
  el.dataset.expanded = expanded ? 'false' : 'true';
  el.querySelector('.tree-arrow').textContent = expanded ? '▶' : '▼';
  el.querySelector('.tree-group-body').style.display = expanded ? 'none' : 'block';
}

// ==================== 训练记录页 ====================

function initTraining(studentId) {
  currentTrainingStudentId = studentId;
  const student = DB.getStudents().find(s => s.id === studentId);
  if (!student) { goBack(); return; }
  document.getElementById('training-student-name').textContent = '🏀 ' + student.name + ' 的训练课';
  document.getElementById('training-date').value = todayStr();
  document.getElementById('training-duration').value = 1;
  document.getElementById('training-notes').value = '';
  const curriculum = DB.getCurriculum();
  const progress = DB.getStudentProgress(studentId);
  document.getElementById('checklist-container').innerHTML = buildChecklistHTML(curriculum, progress, 0);
  trainingCustomItems = [];
  document.getElementById('add-custom-row').style.display = 'block';
  document.getElementById('custom-input-row').style.display = 'none';
  document.getElementById('custom-input').value = '';
  updateCheckCount();
}

function buildChecklistHTML(nodes, progress, depth) {
  let html = '';
  nodes.forEach(node => {
    if (node.children && node.children.length > 0) {
      const p = countNodeProgress(node, progress); const pct2 = p.total > 0 ? Math.round(p.completed / p.total * 100) : 0;
      html += `<div class="checklist-group" data-expanded="${depth===0?'true':'false'}"><div class="checklist-group-header" onclick="toggleCheckGroup(this)" style="padding-left:${depth*10}px"><span class="group-arrow">${depth===0?'▼':'▶'}</span><span class="group-icon">${node.icon||'📌'}</span><span class="group-name">${escHtml(node.name)}</span><span class="group-stat">${p.completed}/${p.total}</span><div class="group-mini-bar"><div class="group-mini-fill" style="width:${pct2}%"></div></div></div><div class="checklist-group-body" style="display:${depth===0?'block':'none'}">${buildChecklistHTML(node.children, progress, depth+1)}</div></div>`;
    } else {
      const pro = progress[node.id]; const isDone = pro && pro.done; const count = pro ? pro.count : 0;
      html += `<div class="checklist-item ${isDone?'checked':''}" data-id="${escAttr(node.id)}" data-name="${escAttr(node.name)}" onclick="toggleCheckItem(this)" style="padding-left:${depth*10+10}px"><div class="checkbox-icon ${isDone?'checked':''}"></div><span class="checklist-text">${escHtml(node.name)}</span>${isDone?'<span class="checklist-badge">'+count+'次</span>':''}</div>`;
    }
  });
  return html;
}

function toggleCheckGroup(headerEl) {
  const group = headerEl.parentElement;
  const expanded = group.dataset.expanded === 'true';
  group.dataset.expanded = expanded ? 'false' : 'true';
  headerEl.querySelector('.group-arrow').textContent = expanded ? '▶' : '▼';
  group.querySelector('.checklist-group-body').style.display = expanded ? 'none' : 'block';
}

function toggleCheckItem(el) { el.querySelector('.checkbox-icon').classList.toggle('checked'); el.classList.toggle('checked'); updateCheckCount(); }

function updateCheckCount() {
  const checked = document.querySelectorAll('#checklist-container .checkbox-icon.checked').length;
  const total = document.querySelectorAll('#checklist-container .checklist-item').length;
  document.getElementById('check-count').textContent = '勾选 ' + checked + ' / ' + total;
}

function changeDuration(delta) { const input = document.getElementById('training-duration'); input.value = Math.max(1, (parseInt(input.value)||0) + delta); }

function showCustomInput() { document.getElementById('add-custom-row').style.display='none'; document.getElementById('custom-input-row').style.display='flex'; document.getElementById('custom-input').focus(); }
function confirmCustom() {
  const name = document.getElementById('custom-input').value.trim();
  if (!name) { showToast('请输入项目名称'); return; }
  const allNames = []; document.querySelectorAll('#checklist-container .checklist-text').forEach(el=>allNames.push(el.textContent));
  if (allNames.includes(name)) { showToast('该项目已存在'); return; }
  const container = document.getElementById('checklist-container');
  const div = document.createElement('div'); div.className='checklist-item checked'; div.style.paddingLeft='10px'; div.dataset.name=name; div.dataset.custom='true';
  div.innerHTML=`<div class="checkbox-icon checked"></div><span class="checklist-text">✨ ${escHtml(name)}</span><span class="checklist-del" onclick="removeCustomItem(event,this)">✕</span>`;
  div.onclick=function(e){if(e.target.classList.contains('checklist-del'))return;toggleCheckItem(div);};
  container.appendChild(div);
  document.getElementById('add-custom-row').style.display='block'; document.getElementById('custom-input-row').style.display='none'; document.getElementById('custom-input').value=''; updateCheckCount();
}
function cancelCustom() { document.getElementById('add-custom-row').style.display='block'; document.getElementById('custom-input-row').style.display='none'; document.getElementById('custom-input').value=''; }
function removeCustomItem(event,el){event.stopPropagation();el.closest('.checklist-item').remove();updateCheckCount();}

function saveTrainingRecord() {
  const date = document.getElementById('training-date').value || todayStr();
  const duration = parseInt(document.getElementById('training-duration').value) || 0;
  const notes = document.getElementById('training-notes').value.trim();
  if (duration <= 0) { showToast('请设置训练时长'); return; }
  const student = DB.getStudents().find(s => s.id === currentTrainingStudentId);
  if (!student) { showToast('学员不存在'); return; }
  if (duration > student.remainingHours) { if(!confirm('仅剩 '+student.remainingHours+' 课时，按剩余课时记录？'))return; document.getElementById('training-duration').value=student.remainingHours; saveTrainingRecord(); return; }
  const checkedIds=[], checkedItems=[], customChecked=[];
  document.querySelectorAll('#checklist-container .checklist-item').forEach(el=>{
    if(!el.querySelector('.checkbox-icon').classList.contains('checked'))return;
    const id=el.dataset.id, name=el.dataset.name;
    if(el.dataset.custom==='true') customChecked.push(name); else { if(id)checkedIds.push(id); checkedItems.push(name); }
  });
  const records=DB.getRecords();
  records.push({id:genId(),studentId:currentTrainingStudentId,date,duration,checkedItems,customItems:customChecked,checkedIds,notes,createTime:new Date().toISOString()});
  DB.saveRecords(records);
  const progress=DB.getStudentProgress(currentTrainingStudentId); const today=todayStr();
  checkedIds.forEach(id=>{ if(!progress[id]) progress[id]={done:true,firstAt:today,count:1}; else { progress[id].done=true; if(!progress[id].firstAt)progress[id].firstAt=today; progress[id].count=(progress[id].count||0)+1; } });
  DB.setStudentProgress(currentTrainingStudentId,progress);
  const students=DB.getStudents(); const s=students.find(st=>st.id===currentTrainingStudentId);
  if(s)s.remainingHours=Math.max(0,s.remainingHours-duration); DB.saveStudents(students);
  showToast('保存成功！'); setTimeout(()=>goBack(),800);
}

// ==================== 排课系统 ====================

let scheduleDate = todayStr();

function renderSchedule() {
  scheduleDate = todayStr();
  document.getElementById('sched-month-label').textContent = formatMonth(scheduleDate);
  renderCalendarDays();
  renderDaySchedule();
}

function formatMonth(dateStr) {
  const [y,m] = dateStr.split('-');
  return y + '年' + parseInt(m) + '月';
}

function changeMonth(delta) {
  const [y,m,d] = scheduleDate.split('-').map(Number);
  const dt = new Date(y, m-1 + delta, 1);
  scheduleDate = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-01';
  document.getElementById('sched-month-label').textContent = formatMonth(scheduleDate);
  renderCalendarDays();
}

function renderCalendarDays() {
  const [y,m] = scheduleDate.split('-').map(Number);
  const firstDay = new Date(y, m-1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const schedule = DB.getSchedule();
  const today = todayStr();

  let html = '';
  // Day headers
  ['日','一','二','三','四','五','六'].forEach(d => html += '<div class="cal-day-header">'+d+'</div>');

  // Empty cells before first day
  for (let i=0; i<firstDay; i++) html += '<div class="cal-day empty"></div>';

  // Days
  for (let d=1; d<=daysInMonth; d++) {
    const ds = y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const hasClass = schedule.some(s => s.date === ds);
    const isToday = ds === today;
    const isSelected = ds === scheduleDate;
    html += '<div class="cal-day'+(hasClass?' has-class':'')+(isToday?' today':'')+(isSelected?' selected':'')+'" onclick="selectCalDay(\''+ds+'\')">'+d+'</div>';
  }

  document.getElementById('cal-grid').innerHTML = html;
}

function selectCalDay(dateStr) {
  scheduleDate = dateStr;
  renderCalendarDays();
  renderDaySchedule();
}

function renderDaySchedule() {
  const schedule = DB.getSchedule();
  const students = DB.getStudents();
  const daySchedule = schedule.filter(s => s.date === scheduleDate).sort((a,b) => (a.time||'').localeCompare(b.time||''));
  const listEl = document.getElementById('day-schedule-list');
  document.getElementById('day-schedule-date').textContent = scheduleDate;

  if (daySchedule.length === 0) {
    listEl.innerHTML = '<div class="day-empty">当天没有排课</div>';
  } else {
    listEl.innerHTML = daySchedule.map(sc => {
      const st = students.find(s => s.id === sc.studentId);
      return '<div class="day-sched-item"><span class="day-sched-time">'+(sc.time||'--:--')+'</span><span class="day-sched-name">'+(st?escHtml(st.name):'未知')+'</span><span class="day-sched-note">'+escHtml(sc.notes||'')+'</span><span class="day-sched-del" onclick="deleteSchedule(event,\''+sc.id+'\')">✕</span></div>';
    }).join('');
  }
}

function showAddSchedule() {
  const student = DB.getStudents().find(s => s.id === currentDetailId);
  if (!student) return;
  document.getElementById('sched-modal-student').textContent = '为 ' + student.name + ' 排课';
  document.getElementById('sched-modal-date').value = todayStr();
  document.getElementById('sched-modal-time').value = '';
  document.getElementById('sched-modal-note').value = '';
  document.getElementById('schedule-modal').style.display = 'flex';
}

function confirmSchedule() {
  const date = document.getElementById('sched-modal-date').value || todayStr();
  const time = document.getElementById('sched-modal-time').value;
  const notes = document.getElementById('sched-modal-note').value.trim();
  if (!time) { showToast('请选择时间'); return; }
  const sched = DB.getSchedule();
  sched.push({ id: genId(), studentId: currentDetailId, date, time, notes, createTime: new Date().toISOString() });
  DB.saveSchedule(sched);
  closeScheduleModal();
  showToast('排课成功');
  renderDetail(currentDetailId);
}

function deleteSchedule(event, id) {
  event.stopPropagation();
  if (!confirm('确定删除这节排课吗？')) return;
  const sched = DB.getSchedule().filter(s => s.id !== id);
  DB.saveSchedule(sched);
  renderDaySchedule();
  showToast('已删除');
}

function closeScheduleModal() { document.getElementById('schedule-modal').style.display = 'none'; }

// ==================== 报告系统 ====================

function renderReport(studentId) {
  const student = DB.getStudents().find(s => s.id === studentId);
  if (!student) { goBack(); return; }
  const curriculum = DB.getCurriculum();
  const progress = DB.getStudentProgress(studentId);
  const records = DB.getRecords().filter(r => r.studentId === studentId).sort((a,b) => b.date.localeCompare(a.date));
  const payments = DB.getStudentPayments(studentId);
  const totalPaid = payments.reduce((s,p) => s + p.amount, 0);
  const totalItems = countLeafItems(curriculum);
  const completed = countCompletedItems(curriculum, progress);
  const pct = totalItems > 0 ? Math.round(completed / totalItems * 100) : 0;

  document.getElementById('report-name').textContent = student.name;
  document.getElementById('report-meta').textContent = (student.age||'--')+'岁 | '+(student.gender||'')+' | '+(student.group||'未分组');
  document.getElementById('report-hours').textContent = student.totalHours + ' 总课时 / ' + student.remainingHours + ' 剩余';
  document.getElementById('report-progress').textContent = '训练进度: ' + pct + '% (' + completed + '/' + totalItems + ')';
  document.getElementById('report-paid').textContent = '累计缴费: ¥' + totalPaid;
  document.getElementById('report-trainings').textContent = '累计训练: ' + records.length + ' 次';

  // 最近训练
  document.getElementById('report-recent').innerHTML = records.slice(0, 5).map(r =>
    '<div class="report-record">📅 '+r.date+' ⏱ '+r.duration+'课时 '+(r.checkedItems||[]).slice(0,3).map(i=>'#'+i).join(' ')+'</div>'
  ).join('') || '<div class="report-record">暂无训练记录</div>';

  // 已掌握技能（完成3次以上的项目）
  const mastered = [];
  function findMastered(nodes) {
    nodes.forEach(n => {
      if (n.children && n.children.length > 0) findMastered(n.children);
      else if (progress[n.id] && progress[n.id].count >= 3) mastered.push(n.name);
    });
  }
  findMastered(curriculum);
  document.getElementById('report-mastered').innerHTML = mastered.length > 0
    ? mastered.slice(0, 20).map(m => '<span class="tag">✅ '+escHtml(m)+'</span>').join('')
    : '<span style="color:#999;">暂无（完成3次以上训练会显示）</span>';

  // 入学日期
  document.getElementById('report-start-date').textContent = '入学: ' + (student.startDate || '--');
  document.getElementById('report-gen-date').textContent = '报告生成: ' + todayStr();
}

function shareReport() {
  const student = DB.getStudents().find(s => s.id === currentDetailId);
  if (!student) return;
  const curriculum = DB.getCurriculum();
  const progress = DB.getStudentProgress(currentDetailId);
  const records = DB.getRecords().filter(r => r.studentId === currentDetailId);
  const totalItems = countLeafItems(curriculum);
  const completed = countCompletedItems(curriculum, progress);
  const pct = totalItems > 0 ? Math.round(completed / totalItems * 100) : 0;

  const text = '🏀 '+student.name+' 训练报告\n'+
    '进度: '+pct+'% ('+completed+'/'+totalItems+')\n'+
    '训练: '+records.length+'次 | 剩余: '+student.remainingHours+'课时\n'+
    '—— BASP篮球训练管理平台';

  if (navigator.share) {
    navigator.share({ title: student.name+' 训练报告', text: text }).catch(() => {});
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard?.writeText(text).then(() => showToast('已复制到剪贴板')).catch(() => showToast('分享功能不可用'));
  }
}

// ==================== 统计系统 ====================

function renderStats() {
  const students = DB.getStudents();
  const records = DB.getRecords();
  const payments = DB.getPayments();
  const curriculum = DB.getCurriculum();
  const progress = DB.getProgress();
  const totalItems = countLeafItems(curriculum);

  // 学员分布（分组）
  const groupCounts = {};
  students.forEach(s => { const g = s.group || '未分组'; groupCounts[g] = (groupCounts[g]||0) + 1; });

  document.getElementById('stats-group-chart').innerHTML = Object.entries(groupCounts).map(([g,c]) =>
    '<div class="stats-bar-row"><span class="stats-bar-label">'+escHtml(g)+'</span><span class="stats-bar-count">'+c+'人</span><div class="stats-bar"><div class="stats-bar-fill" style="width:'+Math.round(c/students.length*100)+'%"></div></div></div>'
  ).join('') || '<div style="color:#999;text-align:center;padding:20px;">暂无数据</div>';

  // 训练频率（每周哪几天）
  const dayCounts = [0,0,0,0,0,0,0];
  const dayNames = ['日','一','二','三','四','五','六'];
  records.forEach(r => { const d = new Date(r.date).getDay(); dayCounts[d]++; });
  const maxDay = Math.max(1, ...dayCounts);

  document.getElementById('stats-week-chart').innerHTML = dayNames.map((dn,i) =>
    '<div class="stats-bar-row"><span class="stats-bar-label">周'+dn+'</span><span class="stats-bar-count">'+dayCounts[i]+'次</span><div class="stats-bar"><div class="stats-bar-fill" style="width:'+Math.round(dayCounts[i]/maxDay*100)+'%;background:#007AFF;"></div></div></div>'
  ).join('');

  // 课时消耗趋势（近6个月）
  const months = [];
  for (let i=5; i>=0; i--) {
    const d = new Date(); d.setMonth(d.getMonth()-i);
    months.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));
  }
  const monthHours = {};
  months.forEach(m => monthHours[m]=0);
  records.forEach(r => { const m = r.date.slice(0,7); if (monthHours[m] !== undefined) monthHours[m] += r.duration; });

  document.getElementById('stats-month-chart').innerHTML = months.map(m =>
    '<div class="stats-bar-row"><span class="stats-bar-label">'+m+'</span><span class="stats-bar-count">'+monthHours[m]+'课时</span><div class="stats-bar"><div class="stats-bar-fill" style="width:'+Math.round(monthHours[m]/Math.max(1,...Object.values(monthHours))*100)+'%;background:#34C759;"></div></div></div>'
  ).join('');

  // 全局概览
  document.getElementById('stats-overview').textContent =
    students.length+'学员 | '+records.length+'条记录 | ¥'+payments.reduce((s,p)=>s+p.amount,0)+'总收入 | '+
    Math.round(Object.values(progress).reduce((s,p)=>{const c=countCompletedItems(curriculum,p);return s+(c/totalItems*100);},0)/Math.max(1,students.length))+'% 平均进度';
}

function exportCSV() {
  const students = DB.getStudents();
  const records = DB.getRecords();
  const payments = DB.getPayments();

  let csv = '学员姓名,电话,年龄,性别,分组,总课时,剩余课时,入学日期,备注\n';
  students.forEach(s => {
    csv += [s.name,s.phone,s.age,s.gender,s.group,s.totalHours,s.remainingHours,s.startDate,s.notes].map(v=>'"'+(v||'')+'"').join(',') + '\n';
  });

  csv += '\n\n训练记录\n日期,学员,课时,训练项目,备注\n';
  records.forEach(r => {
    const st = students.find(s=>s.id===r.studentId);
    csv += [r.date,st?st.name:'',r.duration,(r.checkedItems||[]).join('/'),r.notes].map(v=>'"'+(v||'')+'"').join(',') + '\n';
  });

  csv += '\n\n缴费记录\n日期,学员,套餐,金额,增加课时,备注\n';
  payments.forEach(p => {
    const st = students.find(s=>s.id===p.studentId);
    csv += [p.date,st?st.name:'',p.packageName,p.amount,p.hoursAdded,p.notes].map(v=>'"'+(v||'')+'"').join(',') + '\n';
  });

  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = '篮球训练数据_' + todayStr() + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('导出成功');
}

// ==================== 设置页 ====================

function renderSettings() {
  const trainer = DB.getTrainerById(DB.getCurrentTrainerId());
  if (!trainer) return;
  document.getElementById('settings-name').textContent = trainer.name;
  document.getElementById('settings-phone').textContent = trainer.phone || '未设置';
  document.getElementById('settings-id').textContent = 'ID: ' + trainer.id.slice(0,12) + '...';
  document.getElementById('settings-avatar').textContent = (trainer.name||'?')[0];

  // 统计
  const students = DB.getStudents();
  const records = DB.getRecords();
  const payments = DB.getPayments();
  const month = thisMonth();
  const monthIncome = payments.filter(p => p.date.startsWith(month)).reduce((s,p) => s + p.amount, 0);
  document.getElementById('settings-stats').textContent = students.length + ' 学员 | ' + records.length + ' 条记录 | ¥' + monthIncome + ' 本月';
}

// ==================== 弹窗 ====================

function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }

// ==================== HTML 转义 ====================

function escHtml(str) { if(!str)return''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(str) { if(!str)return''; return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('input-date').value = todayStr();
  document.getElementById('training-date').value = todayStr();

  const currentTid = DB.getCurrentTrainerId();
  if (currentTid && DB.getTrainerById(currentTid)) {
    // 已登录，直接进入首页
    DB.setTrainer(currentTid);
    document.getElementById('page-login').classList.remove('active');
    document.getElementById('page-home').classList.add('active');
    updateTabBar('home');
    renderHome();
  } else {
    // 未登录，显示登录页
    renderLogin();
  }

  // 弹窗关闭
  document.getElementById('modal-overlay').addEventListener('click', function(e) { if (e.target === this) closeModal(); });
  document.getElementById('payment-modal').addEventListener('click', function(e) { if (e.target === this) closePaymentModal(); });
  document.getElementById('schedule-modal').addEventListener('click', function(e) { if (e.target === this) closeScheduleModal(); });
});
