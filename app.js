/**
 * 篮球训练管理 App v2.0
 * 新增：分层级训练清单 + 学员长期进度追踪
 */

// ==================== 训练大纲 ====================
// 从 curriculum-data.js 加载，基于 BASP (Be A Skillful Player) 训练体系
const DEFAULT_CURRICULUM = (typeof CURRICULUM_DATA !== 'undefined') ? CURRICULUM_DATA : [];

// ==================== 数据层 ====================

const DB = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; }
    catch(e) { return null; }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },

  // 学员
  getStudents() { return this.get('students') || []; },
  saveStudents(arr) { this.set('students', arr); },

  // 训练记录
  getRecords() { return this.get('records') || []; },
  saveRecords(arr) { this.set('records', arr); },

  // 训练大纲（层级）
  getCurriculum() {
    const saved = this.get('curriculum');
    if (saved) return saved;
    this.set('curriculum', DEFAULT_CURRICULUM);
    return DEFAULT_CURRICULUM;
  },
  saveCurriculum(data) { this.set('curriculum', data); },

  // 学员训练进度
  getProgress() { return this.get('progress') || {}; },
  saveProgress(data) { this.set('progress', data); },
  getStudentProgress(studentId) {
    const all = this.getProgress();
    return all[studentId] || {};
  },
  setStudentProgress(studentId, data) {
    const all = this.getProgress();
    all[studentId] = data;
    this.saveProgress(all);
  }
};

// ==================== 大纲工具函数 ====================

/** 展平训练大纲，返回所有叶子节点 ID 列表 */
function getAllLeafIds(curriculum) {
  const ids = [];
  function walk(nodes) {
    nodes.forEach(n => {
      if (n.children && n.children.length > 0) {
        walk(n.children);
      } else {
        ids.push(n.id);
      }
    });
  }
  walk(curriculum);
  return ids;
}

/** 统计大纲中的项目数（只算叶子节点） */
function countLeafItems(curriculum) {
  return getAllLeafIds(curriculum).length;
}

/** 统计某学员已完成的叶子项目数 */
function countCompletedItems(curriculum, progress) {
  let count = 0;
  function walk(nodes) {
    nodes.forEach(n => {
      if (n.children && n.children.length > 0) {
        walk(n.children);
      } else {
        if (progress[n.id] && progress[n.id].done) count++;
      }
    });
  }
  walk(curriculum);
  return count;
}

/** 统计某节点及其子节点的完成情况 */
function countNodeProgress(node, progress) {
  let total = 0, completed = 0;
  function walk(n) {
    if (n.children && n.children.length > 0) {
      n.children.forEach(walk);
    } else {
      total++;
      if (progress[n.id] && progress[n.id].done) completed++;
    }
  }
  walk(node);
  return { total, completed };
}

// ==================== 工具函数 ====================

function genId() { return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => el.classList.remove('show'), 1500);
}

// ==================== 页面导航 ====================

const navStack = [];
let currentPage = 'home';

function navigateTo(pageId, data) {
  const oldPage = document.getElementById('page-' + currentPage);
  const newPage = document.getElementById('page-' + pageId);

  oldPage.classList.remove('active');
  oldPage.classList.add('slide-back');
  newPage.classList.add('active');
  newPage.classList.remove('slide-back');

  navStack.push(currentPage);
  currentPage = pageId;
  updateTabBar(pageId);

  newPage.scrollTop = 0;
  const content = newPage.querySelector('.page-content');
  if (content) content.scrollTop = 0;

  if (pageId === 'detail' && data) renderDetail(data.id);
  if (pageId === 'progress' && data) renderProgressTree(data.studentId);
  if (pageId === 'training' && data) initTraining(data.studentId);
  if (pageId === 'home') renderHome();
}

function goBack() {
  if (navStack.length === 0) return;
  const prevPage = navStack.pop();
  const oldPage = document.getElementById('page-' + currentPage);
  const newPage = document.getElementById('page-' + prevPage);

  oldPage.classList.remove('active');
  newPage.classList.add('active');
  newPage.classList.remove('slide-back');

  currentPage = prevPage;
  updateTabBar(prevPage);

  if (prevPage === 'home') renderHome();
  if (prevPage === 'add') resetAddForm();
  if (prevPage === 'detail') renderDetail(currentDetailId);
}

function switchTab(tab) {
  const page = tab === 'home' ? 'home' : 'add';
  if (currentPage === page) return;

  const oldPage = document.getElementById('page-' + currentPage);
  const newPage = document.getElementById('page-' + page);

  oldPage.classList.remove('active');
  newPage.classList.add('active');
  newPage.classList.remove('slide-back');

  navStack.length = 0;
  currentPage = page;
  updateTabBar(page);

  if (page === 'home') renderHome();
  if (page === 'add') resetAddForm();
}

function updateTabBar(page) {
  const tabBar = document.getElementById('tab-bar');
  const tabs = tabBar.querySelectorAll('.tab-btn');
  if (page === 'home' || page === 'add') {
    tabBar.style.display = 'flex';
    tabs.forEach(t => t.classList.toggle('active', t.dataset.page === page));
  } else {
    tabBar.style.display = 'none';
  }
}

// ==================== 首页 ====================

function renderHome() {
  const students = DB.getStudents();
  const records = DB.getRecords();
  const today = todayStr();

  const todayIds = new Set(records.filter(r => r.date === today).map(r => r.studentId));

  document.getElementById('stat-total').textContent = students.length;
  document.getElementById('stat-today').textContent = todayIds.size;
  document.getElementById('stat-hours').textContent = students.reduce((s, st) => s + st.remainingHours, 0);
  document.getElementById('student-count').textContent = '共 ' + students.length + ' 人';

  const listEl = document.getElementById('student-list');
  const emptyEl = document.getElementById('empty-state');

  if (students.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'flex';
    return;
  }

  emptyEl.style.display = 'none';

  const progress = DB.getProgress();

  students.forEach(s => {
    const sRecords = records.filter(r => r.studentId === s.id).sort((a,b) => b.date.localeCompare(a.date));
    s.lastDate = sRecords.length > 0 ? sRecords[0].date : null;
    // 计算该学员的总体训练进度
    const curriculum = DB.getCurriculum();
    const totalItems = countLeafItems(curriculum);
    const completed = countCompletedItems(curriculum, progress[s.id] || {});
    s.progressPct = totalItems > 0 ? Math.round(completed / totalItems * 100) : 0;
  });

  listEl.innerHTML = students.map(s => `
    <div class="student-card" onclick="openDetail('${s.id}')">
      <div class="student-card-top">
        <div class="avatar-sm">${(s.name||'?')[0]}</div>
        <div class="student-info">
          <div class="student-name">${escHtml(s.name)}</div>
          <div class="student-meta">
            ${s.age ? s.age+'岁 · ' : ''}${s.gender || ''}
            <span style="color:#34C759;font-weight:500;"> · 训练 ${s.progressPct}%</span>
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

function openDetail(id) {
  navigateTo('detail', { id });
}

// 删除学员（长按触发）
let longPressTimer;
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('student-list').addEventListener('touchstart', function(e) {
    const card = e.target.closest('.student-card');
    if (!card) return;
    longPressTimer = setTimeout(() => {
      const match = card.onclick.toString().match(/openDetail\('([^']+)'/);
      if (match) showDeleteStudentModal(match[1]);
    }, 600);
  }, { passive: true });
  document.getElementById('student-list').addEventListener('touchend', () => clearTimeout(longPressTimer));
  document.getElementById('student-list').addEventListener('touchmove', () => clearTimeout(longPressTimer));
});

function showDeleteStudentModal(id) {
  const student = DB.getStudents().find(s => s.id === id);
  if (!student) return;
  document.getElementById('modal-body').textContent = '确定删除「' + student.name + '」吗？该学员的所有训练记录也会被删除。此操作不可恢复。';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-confirm-btn').onclick = function() { deleteStudent(id); closeModal(); };
}

function deleteStudent(id) {
  const students = DB.getStudents().filter(s => s.id !== id);
  const records = DB.getRecords().filter(r => r.studentId !== id);
  // 同时删除该学员的进度
  const progress = DB.getProgress();
  delete progress[id];
  DB.saveStudents(students);
  DB.saveRecords(records);
  DB.saveProgress(progress);
  renderHome();
  showToast('已删除');
}

// ==================== 添加/编辑学员 ====================

let editingStudentId = null;

function resetAddForm() {
  editingStudentId = null;
  document.getElementById('add-title').textContent = '添加学员';
  document.getElementById('add-back-btn').style.display = 'none';
  document.getElementById('input-name').value = '';
  document.getElementById('input-phone').value = '';
  document.getElementById('input-age').value = '';
  document.getElementById('input-hours').value = '';
  document.getElementById('input-date').value = todayStr();
  document.getElementById('input-notes').value = '';
  document.getElementById('btn-save').textContent = '添加学员';
  document.querySelectorAll('#gender-picker .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === '男');
  });
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
  document.getElementById('input-hours').value = student.totalHours || '';
  document.getElementById('input-date').value = student.startDate || todayStr();
  document.getElementById('input-notes').value = student.notes || '';
  document.getElementById('btn-save').textContent = '保存修改';
  document.querySelectorAll('#gender-picker .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.value === student.gender);
  });
  navigateTo('add');
}

function getGender() {
  const active = document.querySelector('#gender-picker .seg-btn.active');
  return active ? active.dataset.value : '男';
}

function saveStudent() {
  const name = document.getElementById('input-name').value.trim();
  const phone = document.getElementById('input-phone').value.trim();
  const age = document.getElementById('input-age').value.trim();
  const gender = getGender();
  const totalHours = parseInt(document.getElementById('input-hours').value) || 0;
  const startDate = document.getElementById('input-date').value || todayStr();
  const notes = document.getElementById('input-notes').value.trim();

  if (!name) { showToast('请输入姓名'); return; }
  if (totalHours <= 0) { showToast('请输入有效的课时数'); return; }

  if (editingStudentId) {
    const students = DB.getStudents();
    const idx = students.findIndex(s => s.id === editingStudentId);
    if (idx !== -1) {
      const old = students[idx];
      const used = old.totalHours - old.remainingHours;
      students[idx] = { ...old, name, phone, age, gender, totalHours, remainingHours: Math.max(0, totalHours - used), startDate, notes };
      DB.saveStudents(students);
    }
    editingStudentId = null;
    showToast('修改成功');
  } else {
    const students = DB.getStudents();
    students.push({
      id: genId(), name, phone, age, gender, totalHours, remainingHours: totalHours, startDate, notes,
      createTime: new Date().toISOString()
    });
    DB.saveStudents(students);
    showToast('添加成功');
  }
  resetAddForm();
  switchTab('home');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('gender-picker').addEventListener('click', function(e) {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    this.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ==================== 学员详情 ====================

let currentDetailId = null;

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
  document.getElementById('detail-info-name').textContent = student.name;
  document.getElementById('detail-info-meta').textContent = (student.age ? student.age + '岁 · ' : '') + (student.gender || '');
  document.getElementById('detail-info-date').textContent = student.startDate ? '� 入学：' + student.startDate : '';

  const notesEl = document.getElementById('detail-notes');
  if (student.notes) {
    notesEl.style.display = 'block';
    notesEl.innerHTML = '<strong>备注：</strong>' + escHtml(student.notes);
  } else {
    notesEl.style.display = 'none';
  }

  document.getElementById('detail-total').textContent = student.totalHours;
  document.getElementById('detail-used').textContent = used;
  document.getElementById('detail-remain').textContent = student.remainingHours;
  document.getElementById('detail-progress').style.width = pct + '%';
  document.getElementById('detail-progress-text').textContent = '已使用 ' + pct + '%';

  // ---- 训练进程概览 ----
  document.getElementById('progress-pct').textContent = '完成 ' + itemPct + '%';
  document.getElementById('progress-pct-bar').style.width = itemPct + '%';
  document.getElementById('progress-nums').textContent = completed + ' / ' + totalItems + ' 项';

  // 各大类进度列表
  const catList = document.getElementById('progress-cat-list');
  catList.innerHTML = curriculum.map(g => {
    const p = countNodeProgress(g, progress);
    const pct2 = p.total > 0 ? Math.round(p.completed / p.total * 100) : 0;
    return `
      <div class="progress-cat-item" onclick="openProgressPage('${id}')">
        <span class="cat-icon">${g.icon || '📌'}</span>
        <span class="cat-name">${escHtml(g.name)}</span>
        <span class="cat-stat">${p.completed}/${p.total}</span>
        <span class="cat-pct">${pct2}%</span>
        <span class="cat-arrow">›</span>
      </div>
    `;
  }).join('');

  // ---- 训练记录 ----
  const records = DB.getRecords()
    .filter(r => r.studentId === id)
    .sort((a, b) => b.date.localeCompare(a.date));

  document.getElementById('record-count').textContent = '共 ' + records.length + ' 次';

  const listEl = document.getElementById('record-list');
  const emptyEl = document.getElementById('record-empty');

  if (records.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'flex';
  } else {
    emptyEl.style.display = 'none';
    listEl.innerHTML = records.map(r => `
      <div class="record-card">
        <div class="record-header">
          <span class="record-date">📅 ${r.date}</span>
          <span class="record-dur">⏱ ${r.duration} 课时</span>
          <span class="record-del" onclick="deleteRecord(event, '${r.id}')">🗑</span>
        </div>
        ${(r.checkedItems && r.checkedItems.length > 0 || r.customItems && r.customItems.length > 0) ? `
        <div class="record-tags">
          ${(r.checkedItems || []).map(i => '<span class="tag">✅ '+escHtml(i)+'</span>').join('')}
          ${(r.customItems || []).map(i => '<span class="tag tag-custom">✨ '+escHtml(i)+'</span>').join('')}
        </div>` : '<div class="record-no-items">未记录训练项目</div>'}
        ${r.notes ? '<div class="record-notes-text">💬 '+escHtml(r.notes)+'</div>' : ''}
      </div>
    `).join('');
  }
}

function openProgressPage(studentId) {
  navigateTo('progress', { studentId });
}

function startTraining() {
  navigateTo('training', { studentId: currentDetailId });
}

function deleteRecord(event, recordId) {
  event.stopPropagation();
  document.getElementById('modal-body').textContent = '删除此训练记录将恢复对应课时，确定删除吗？';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-confirm-btn').onclick = function() {
    const records = DB.getRecords();
    const target = records.find(r => r.id === recordId);
    if (target) {
      const students = DB.getStudents();
      const s = students.find(st => st.id === target.studentId);
      if (s) s.remainingHours += target.duration;
      DB.saveStudents(students);
      // 回退进度
      if (target.checkedIds && target.checkedIds.length > 0) {
        const progress = DB.getStudentProgress(target.studentId);
        target.checkedIds.forEach(id => {
          if (progress[id]) {
            progress[id].count--;
            if (progress[id].count <= 0) {
              progress[id].done = false;
              progress[id].count = 0;
              progress[id].firstAt = null;
            }
          }
        });
        DB.setStudentProgress(target.studentId, progress);
      }
    }
    DB.saveRecords(records.filter(r => r.id !== recordId));
    renderDetail(currentDetailId);
    closeModal();
    showToast('已删除并恢复课时');
  };
}

// ==================== 训练进程详情页 ====================

let progressStudentId = null;

function renderProgressTree(studentId) {
  progressStudentId = studentId;
  const student = DB.getStudents().find(s => s.id === studentId);
  if (!student) { goBack(); return; }

  document.getElementById('prog-title').textContent = student.name + ' · 训练进程';
  document.getElementById('prog-avatar').textContent = (student.name || '?')[0];

  const curriculum = DB.getCurriculum();
  const progress = DB.getStudentProgress(studentId);
  const totalItems = countLeafItems(curriculum);
  const completed = countCompletedItems(curriculum, progress);
  const itemPct = totalItems > 0 ? Math.round(completed / totalItems * 100) : 0;

  document.getElementById('prog-overall').textContent = '📊 总进度: ' + completed + '/' + totalItems + ' (' + itemPct + '%)';
  document.getElementById('prog-overall-bar').style.width = itemPct + '%';

  const treeEl = document.getElementById('progress-tree');
  treeEl.innerHTML = buildTreeHTML(curriculum, progress, 0);
}

function buildTreeHTML(nodes, progress, depth) {
  let html = '';
  nodes.forEach(node => {
    if (node.children && node.children.length > 0) {
      // 分组节点
      const p = countNodeProgress(node, progress);
      const pct2 = p.total > 0 ? Math.round(p.completed / p.total * 100) : 0;
      const doneClass = p.completed === p.total ? ' all-done' : '';
      html += `
        <div class="tree-group${doneClass}" onclick="toggleTreeGroup(this)" data-expanded="true">
          <div class="tree-group-header" style="padding-left:${depth * 20}px">
            <span class="tree-arrow">▼</span>
            <span class="tree-group-icon">${node.icon || '📌'}</span>
            <span class="tree-group-name">${escHtml(node.name)}</span>
            <span class="tree-group-stat">${p.completed}/${p.total}</span>
            <div class="tree-mini-bar"><div class="tree-mini-fill" style="width:${pct2}%"></div></div>
          </div>
          <div class="tree-group-body">
            ${buildTreeHTML(node.children, progress, depth + 1)}
          </div>
        </div>`;
    } else {
      // 叶子节点（训练项目）
      const pro = progress[node.id];
      const done = pro && pro.done;
      const count = pro ? pro.count : 0;
      const date = pro && pro.firstAt ? pro.firstAt : '';
      html += `
        <div class="tree-item ${done ? 'done' : 'undone'}" style="padding-left:${depth * 20 + 8}px">
          <span class="tree-check">${done ? '✅' : '⬜'}</span>
          <span class="tree-item-name">${escHtml(node.name)}</span>
          ${done ? '<span class="tree-item-count">' + count + '次</span>' : '<span class="tree-item-count undone">未练</span>'}
          ${date ? '<span class="tree-item-date">' + date + '</span>' : ''}
        </div>`;
    }
  });
  return html;
}

function toggleTreeGroup(el) {
  const expanded = el.dataset.expanded === 'true';
  el.dataset.expanded = expanded ? 'false' : 'true';
  const arrow = el.querySelector('.tree-arrow');
  if (arrow) arrow.textContent = expanded ? '▶' : '▼';
  const body = el.querySelector('.tree-group-body');
  if (body) body.style.display = expanded ? 'none' : 'block';
}

// ==================== 训练记录页（层级清单） ====================

let currentTrainingStudentId = null;

function initTraining(studentId) {
  currentTrainingStudentId = studentId;
  const student = DB.getStudents().find(s => s.id === studentId);
  if (!student) { goBack(); return; }

  document.getElementById('training-student-name').textContent = '🏀 ' + student.name + ' 的训练课';
  document.getElementById('training-date').value = todayStr();
  document.getElementById('training-duration').value = 1;
  document.getElementById('training-notes').value = '';

  // 获取大纲和进度，预填已完成项
  const curriculum = DB.getCurriculum();
  const progress = DB.getStudentProgress(studentId);

  const container = document.getElementById('checklist-container');
  container.innerHTML = buildChecklistHTML(curriculum, progress, 0);

  // 重置自定义项
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
      // 分组
      const p = countNodeProgress(node, progress);
      const pct2 = p.total > 0 ? Math.round(p.completed / p.total * 100) : 0;
      html += `
        <div class="checklist-group" data-expanded="${depth === 0 ? 'true' : 'false'}">
          <div class="checklist-group-header" onclick="toggleCheckGroup(this)" style="padding-left:${depth * 12}px">
            <span class="group-arrow">${depth === 0 ? '▼' : '▶'}</span>
            <span class="group-icon">${node.icon || '📌'}</span>
            <span class="group-name">${escHtml(node.name)}</span>
            <span class="group-stat">${p.completed}/${p.total}</span>
            <div class="group-mini-bar"><div class="group-mini-fill" style="width:${pct2}%"></div></div>
          </div>
          <div class="checklist-group-body" style="display:${depth === 0 ? 'block' : 'none'}">
            ${buildChecklistHTML(node.children, progress, depth + 1)}
          </div>
        </div>`;
    } else {
      // 叶子项
      const pro = progress[node.id];
      const isDone = pro && pro.done;
      const count = pro ? pro.count : 0;
      html += `
        <div class="checklist-item ${isDone ? 'checked' : ''}" data-id="${escAttr(node.id)}" data-name="${escAttr(node.name)}" onclick="toggleCheckItem(this)" style="padding-left:${depth * 12 + 12}px">
          <div class="checkbox-icon ${isDone ? 'checked' : ''}"></div>
          <span class="checklist-text">${escHtml(node.name)}</span>
          ${isDone ? '<span class="checklist-badge">' + count + '次</span>' : ''}
        </div>`;
    }
  });
  return html;
}

function toggleCheckGroup(headerEl) {
  const group = headerEl.parentElement;
  const expanded = group.dataset.expanded === 'true';
  group.dataset.expanded = expanded ? 'false' : 'true';
  const arrow = headerEl.querySelector('.group-arrow');
  if (arrow) arrow.textContent = expanded ? '▶' : '▼';
  const body = group.querySelector('.checklist-group-body');
  if (body) body.style.display = expanded ? 'none' : 'block';
}

function toggleCheckItem(el) {
  // 如果点到了已完成的标记，仍然允许切换
  const checkbox = el.querySelector('.checkbox-icon');
  checkbox.classList.toggle('checked');
  el.classList.toggle('checked');
  updateCheckCount();
}

function updateCheckCount() {
  const checked = document.querySelectorAll('#checklist-container .checkbox-icon.checked').length;
  const total = document.querySelectorAll('#checklist-container .checklist-item').length;
  document.getElementById('check-count').textContent = '勾选 ' + checked + ' / ' + total;
}

function changeDuration(delta) {
  const input = document.getElementById('training-duration');
  let val = parseInt(input.value) || 0;
  val = Math.max(1, val + delta);
  input.value = val;
}

function showCustomInput() {
  document.getElementById('add-custom-row').style.display = 'none';
  document.getElementById('custom-input-row').style.display = 'flex';
  document.getElementById('custom-input').focus();
}

function confirmCustom() {
  const name = document.getElementById('custom-input').value.trim();
  if (!name) { showToast('请输入项目名称'); return; }
  const allNames = [];
  document.querySelectorAll('#checklist-container .checklist-text').forEach(el => allNames.push(el.textContent));
  if (allNames.includes(name)) { showToast('该项目已存在'); return; }
  const container = document.getElementById('checklist-container');
  const div = document.createElement('div');
  div.className = 'checklist-item checked';
  div.style.paddingLeft = '12px';
  div.dataset.name = name;
  div.dataset.custom = 'true';
  div.innerHTML = `<div class="checkbox-icon checked"></div><span class="checklist-text">✨ ${escHtml(name)}</span><span class="checklist-del" onclick="removeCustomItem(event, this)">✕</span>`;
  div.onclick = function(e) { if (e.target.classList.contains('checklist-del')) return; toggleCheckItem(div); };
  container.appendChild(div);
  document.getElementById('add-custom-row').style.display = 'block';
  document.getElementById('custom-input-row').style.display = 'none';
  document.getElementById('custom-input').value = '';
  updateCheckCount();
}

function cancelCustom() {
  document.getElementById('add-custom-row').style.display = 'block';
  document.getElementById('custom-input-row').style.display = 'none';
  document.getElementById('custom-input').value = '';
}

function removeCustomItem(event, el) {
  event.stopPropagation();
  el.closest('.checklist-item').remove();
  updateCheckCount();
}

let trainingCustomItems = [];

function saveTrainingRecord() {
  const date = document.getElementById('training-date').value || todayStr();
  const duration = parseInt(document.getElementById('training-duration').value) || 0;
  const notes = document.getElementById('training-notes').value.trim();

  if (duration <= 0) { showToast('请设置训练时长'); return; }

  const student = DB.getStudents().find(s => s.id === currentTrainingStudentId);
  if (!student) { showToast('学员不存在'); return; }

  if (duration > student.remainingHours) {
    if (!confirm('该学员仅剩 ' + student.remainingHours + ' 课时，是否按剩余课时记录？\n按"取消"返回修改。')) return;
    document.getElementById('training-duration').value = student.remainingHours;
    saveTrainingRecord();
    return;
  }

  // 收集勾选项目
  const checkedIds = [];       // 新：ID 列表
  const checkedItems = [];     // 兼容旧格式
  const customChecked = [];

  document.querySelectorAll('#checklist-container .checklist-item').forEach(el => {
    const isChecked = el.querySelector('.checkbox-icon').classList.contains('checked');
    if (!isChecked) return;
    const id = el.dataset.id;
    const name = el.dataset.name;
    const isCustom = el.dataset.custom === 'true';
    if (isCustom) {
      customChecked.push(name);
    } else {
      if (id) checkedIds.push(id);
      checkedItems.push(name);
    }
  });

  // 保存训练记录
  const records = DB.getRecords();
  records.push({
    id: genId(),
    studentId: currentTrainingStudentId,
    date, duration,
    checkedItems, customItems: customChecked,
    checkedIds,
    notes,
    createTime: new Date().toISOString()
  });
  DB.saveRecords(records);

  // 更新学员长期进度
  const progress = DB.getStudentProgress(currentTrainingStudentId);
  const today = todayStr();
  checkedIds.forEach(id => {
    if (!progress[id]) {
      progress[id] = { done: true, firstAt: today, count: 1 };
    } else {
      progress[id].done = true;
      if (!progress[id].firstAt) progress[id].firstAt = today;
      progress[id].count = (progress[id].count || 0) + 1;
    }
  });
  DB.setStudentProgress(currentTrainingStudentId, progress);

  // 扣减课时
  const students = DB.getStudents();
  const s = students.find(st => st.id === currentTrainingStudentId);
  if (s) s.remainingHours = Math.max(0, s.remainingHours - duration);
  DB.saveStudents(students);

  showToast('保存成功！');
  setTimeout(() => goBack(), 800);
}

// ==================== 弹窗 ====================

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// ==================== HTML 转义 ====================

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('input-date').value = todayStr();
  document.getElementById('training-date').value = todayStr();
  renderHome();
  document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
});
