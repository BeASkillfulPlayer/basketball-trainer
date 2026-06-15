/**
 * 篮球训练管理 App
 * 核心逻辑：数据管理、页面导航、CRUD 操作
 */

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

  // 训练模板
  getTemplate() {
    const saved = this.get('template');
    if (saved) return saved;
    const defaults = [
      '热身运动', '运球训练', '投篮训练', '传球训练',
      '防守脚步', '体能训练', '对抗练习', '拉伸放松'
    ];
    this.set('template', defaults);
    return defaults;
  }
};

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

const navStack = [];   // 导航栈，用于返回
let currentPage = 'home';

function navigateTo(pageId, data) {
  const oldPage = document.getElementById('page-' + currentPage);
  const newPage = document.getElementById('page-' + pageId);

  // 隐藏旧页面
  oldPage.classList.remove('active');
  oldPage.classList.add('slide-back');

  // 显示新页面
  newPage.classList.add('active');
  newPage.classList.remove('slide-back');

  // 推入导航栈
  navStack.push(currentPage);
  currentPage = pageId;

  // 控制 Tab 栏显示
  updateTabBar(pageId);

  // 滚动到顶部
  newPage.scrollTop = 0;
  const content = newPage.querySelector('.page-content');
  if (content) content.scrollTop = 0;

  // 根据目标页面加载数据
  if (pageId === 'detail' && data) renderDetail(data.id);
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

  // 切换页面
  const oldPage = document.getElementById('page-' + currentPage);
  const newPage = document.getElementById('page-' + page);

  oldPage.classList.remove('active');
  newPage.classList.add('active');
  newPage.classList.remove('slide-back');

  // 清空导航栈
  navStack.length = 0;
  currentPage = page;
  updateTabBar(page);

  if (page === 'home') renderHome();
  if (page === 'add') resetAddForm();
}

function updateTabBar(page) {
  const tabBar = document.getElementById('tab-bar');
  const tabs = tabBar.querySelectorAll('.tab-btn');

  // 只有 home 和 add 显示 tab
  if (page === 'home' || page === 'add') {
    tabBar.style.display = 'flex';
    tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.page === page);
    });
  } else {
    tabBar.style.display = 'none';
  }
}

// ==================== 首页 ====================

function renderHome() {
  const students = DB.getStudents();
  const records = DB.getRecords();
  const today = todayStr();

  // 统计
  const todayIds = new Set(records.filter(r => r.date === today).map(r => r.studentId));

  document.getElementById('stat-total').textContent = students.length;
  document.getElementById('stat-today').textContent = todayIds.size;
  document.getElementById('stat-hours').textContent = students.reduce((s, st) => s + st.remainingHours, 0);
  document.getElementById('student-count').textContent = '共 ' + students.length + ' 人';

  // 学员列表
  const listEl = document.getElementById('student-list');
  const emptyEl = document.getElementById('empty-state');

  if (students.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'flex';
    return;
  }

  emptyEl.style.display = 'none';

  // 为每个学员计算最近训练日期
  students.forEach(s => {
    const sRecords = records.filter(r => r.studentId === s.id).sort((a,b) => b.date.localeCompare(a.date));
    s.lastDate = sRecords.length > 0 ? sRecords[0].date : null;
  });

  listEl.innerHTML = students.map(s => `
    <div class="student-card" onclick="openDetail('${s.id}')">
      <div class="student-card-top">
        <div class="avatar-sm">${(s.name||'?')[0]}</div>
        <div class="student-info">
          <div class="student-name">${escHtml(s.name)}</div>
          <div class="student-meta">${s.age ? s.age+'岁 · ' : ''}${s.gender || ''}</div>
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
    const studentId = card.onclick.toString().match(/openDetail\('([^']+)'/)?.[1];
    if (!studentId) return;
    longPressTimer = setTimeout(() => {
      showDeleteStudentModal(studentId);
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
  document.getElementById('modal-confirm-btn').onclick = function() {
    deleteStudent(id);
    closeModal();
  };
}

function deleteStudent(id) {
  const students = DB.getStudents().filter(s => s.id !== id);
  const records = DB.getRecords().filter(r => r.studentId !== id);
  DB.saveStudents(students);
  DB.saveRecords(records);
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
  // 性别默认男
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
    // 编辑模式
    const students = DB.getStudents();
    const idx = students.findIndex(s => s.id === editingStudentId);
    if (idx !== -1) {
      const old = students[idx];
      const used = old.totalHours - old.remainingHours;
      students[idx] = {
        ...old,
        name, phone, age, gender,
        totalHours: totalHours,
        remainingHours: Math.max(0, totalHours - used),
        startDate, notes
      };
      DB.saveStudents(students);
    }
    editingStudentId = null;
    showToast('修改成功');
  } else {
    // 新增模式
    const students = DB.getStudents();
    students.push({
      id: genId(),
      name, phone, age, gender,
      totalHours: totalHours,
      remainingHours: totalHours,
      startDate, notes,
      createTime: new Date().toISOString()
    });
    DB.saveStudents(students);
    showToast('添加成功');
  }

  resetAddForm();
  switchTab('home');
}

// 性别选择器事件
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

  const used = student.totalHours - student.remainingHours;
  const pct = student.totalHours > 0 ? Math.round(used / student.totalHours * 100) : 0;

  document.getElementById('detail-name').textContent = student.name;
  document.getElementById('detail-avatar').textContent = (student.name || '?')[0];
  document.getElementById('detail-info-name').textContent = student.name;
  document.getElementById('detail-info-meta').textContent =
    (student.age ? student.age + '岁 · ' : '') + (student.gender || '');
  document.getElementById('detail-info-date').textContent =
    student.startDate ? '📅 入学：' + student.startDate : '';

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

  // 训练记录
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
        ${(r.checkedItems.length > 0 || r.customItems.length > 0) ? `
        <div class="record-tags">
          ${r.checkedItems.map(i => '<span class="tag">✅ '+escHtml(i)+'</span>').join('')}
          ${r.customItems.map(i => '<span class="tag tag-custom">✨ '+escHtml(i)+'</span>').join('')}
        </div>` : '<div style="font-size:13px;color:#CCC;font-style:italic;">未记录训练项目</div>'}
        ${r.notes ? '<div class="record-notes-text">💬 '+escHtml(r.notes)+'</div>' : ''}
      </div>
    `).join('');
  }
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
      // 恢复课时
      const students = DB.getStudents();
      const s = students.find(st => st.id === target.studentId);
      if (s) s.remainingHours += target.duration;
      DB.saveStudents(students);
    }
    DB.saveRecords(records.filter(r => r.id !== recordId));
    renderDetail(currentDetailId);
    closeModal();
    showToast('已删除并恢复课时');
  };
}

// ==================== 训练记录（清单勾选） ====================

let currentTrainingStudentId = null;

function initTraining(studentId) {
  currentTrainingStudentId = studentId;
  const student = DB.getStudents().find(s => s.id === studentId);
  if (!student) { goBack(); return; }

  document.getElementById('training-student-name').textContent = '🏀 ' + student.name + ' 的训练课';
  document.getElementById('training-date').value = todayStr();
  document.getElementById('training-duration').value = 1;
  document.getElementById('training-notes').value = '';

  // 生成清单
  const template = DB.getTemplate();
  const container = document.getElementById('checklist-container');
  container.innerHTML = template.map((name, i) => `
    <div class="checklist-item" data-name="${escAttr(name)}" data-index="${i}" onclick="toggleCheck(this)">
      <div class="checkbox-icon"></div>
      <span class="checklist-text">${escHtml(name)}</span>
    </div>
  `).join('');

  // 清除自定义项
  trainingCustomItems = [];
  document.getElementById('add-custom-row').style.display = 'block';
  document.getElementById('custom-input-row').style.display = 'none';
  document.getElementById('custom-input').value = '';

  updateCheckCount();

  // 设置今天日期
  if (!document.getElementById('training-date').value) {
    document.getElementById('training-date').value = todayStr();
  }
}

let trainingCustomItems = [];  // { name: string, checked: bool }

function toggleCheck(el) {
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

  // 检查重复
  const allNames = [];
  document.querySelectorAll('#checklist-container .checklist-text').forEach(el => allNames.push(el.textContent));
  if (allNames.includes(name)) { showToast('该项目已存在'); return; }

  const container = document.getElementById('checklist-container');
  const div = document.createElement('div');
  div.className = 'checklist-item checked';
  div.innerHTML = `
    <div class="checkbox-icon checked"></div>
    <span class="checklist-text">✨ ${escHtml(name)}</span>
    <span class="checklist-del" onclick="removeCustomItem(event, this)">✕</span>
  `;
  div.onclick = function(e) {
    if (e.target.classList.contains('checklist-del')) return;
    toggleCheck(div);
  };
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

function saveTrainingRecord() {
  const date = document.getElementById('training-date').value || todayStr();
  const duration = parseInt(document.getElementById('training-duration').value) || 0;
  const notes = document.getElementById('training-notes').value.trim();

  if (duration <= 0) { showToast('请设置训练时长'); return; }

  const student = DB.getStudents().find(s => s.id === currentTrainingStudentId);
  if (!student) { showToast('学员不存在'); return; }

  if (duration > student.remainingHours) {
    if (!confirm('该学员仅剩 ' + student.remainingHours + ' 课时，是否按剩余课时记录？按"取消"返回修改。')) return;
    document.getElementById('training-duration').value = student.remainingHours;
    // 递归重新验证
    saveTrainingRecord();
    return;
  }

  // 收集勾选项目
  const checkedItems = [];
  const customChecked = [];
  document.querySelectorAll('#checklist-container .checklist-item').forEach(el => {
    const isChecked = el.querySelector('.checkbox-icon').classList.contains('checked');
    const text = el.querySelector('.checklist-text').textContent;
    if (!isChecked) return;
    if (text.startsWith('✨ ')) {
      customChecked.push(text.replace('✨ ', ''));
    } else {
      checkedItems.push(text);
    }
  });

  // 保存记录
  const records = DB.getRecords();
  records.push({
    id: genId(),
    studentId: currentTrainingStudentId,
    date, duration,
    checkedItems, customItems: customChecked,
    notes,
    createTime: new Date().toISOString()
  });
  DB.saveRecords(records);

  // 扣减课时
  const students = DB.getStudents();
  const s = students.find(st => st.id === currentTrainingStudentId);
  if (s) s.remainingHours = Math.max(0, s.remainingHours - duration);
  DB.saveStudents(students);

  showToast('保存成功！');

  // 返回详情页
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
  // 设置今天日期
  document.getElementById('input-date').value = todayStr();
  document.getElementById('training-date').value = todayStr();

  // 初始化首页
  renderHome();

  // 点击弹窗遮罩关闭
  document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
});
