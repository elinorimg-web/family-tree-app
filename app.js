let currentTreeId = null;
let editingPersonId = null;
let currentPeopleMap = {};
let currentRelationships = [];
let currentUnions = [];
let contextTargetPersonId = null;
let pendingRelation = null;

document.addEventListener('click', () => { document.getElementById('contextMenu').style.display = 'none'; });

document.getElementById('isDeceased').addEventListener('change', function() {
    document.getElementById('deathFieldContainer').style.display = this.checked ? 'block' : 'none';
    if (!this.checked) { document.getElementById('deathApprox').value = ''; document.getElementById('deathType').value = 'regular'; }
});

function openContextMenu(e, personId) {
    e.preventDefault();
    contextTargetPersonId = personId;
    const p = currentPeopleMap[personId];
    document.getElementById('ctxHeader').textContent = 'קרובים עבור: ' + (p ? p.first_name : '');
    const menu = document.getElementById('contextMenu');
    menu.style.display = 'block';
    menu.style.left = Math.min(e.clientX, window.innerWidth - 210) + 'px';
    menu.style.top = e.clientY + 'px';
}

function startRelativeAdd(relType) {
    const target = currentPeopleMap[contextTargetPersonId];
    if (!target) return;
    cancelEdit();
    pendingRelation = { type: relType, targetId: contextTargetPersonId };

    // מילוי רשימת אנשים קיימים לבחירה מהירה
    const sel = document.getElementById('existingPersonSelect');
    sel.innerHTML = '<option value="">-- בחרי אדם קיים מהאילן --</option>';
    Object.values(currentPeopleMap).forEach(p => {
        if (p.person_id !== contextTargetPersonId) {
            sel.innerHTML += '<option value="' + p.person_id + '">' + formatFullName(p) + '</option>';
        }
    });
    document.getElementById('existingPersonBox').style.display = 'block';

    if (['father', 'brother', 'son'].includes(relType)) document.getElementById('gender').value = 'male';
    else if (['mother', 'sister', 'daughter'].includes(relType)) document.getElementById('gender').value = 'female';
    else document.getElementById('gender').value = target.gender === 'male' ? 'female' : 'male';

    if (target.last_name && !['mother', 'spouse_married', 'spouse_divorced'].includes(relType)) {
        document.getElementById('lastName').value = target.last_name;
    }

    const labels = {
        spouse_married: '💍 הוספת/חיבור בן/בת זוג', spouse_divorced: '💔 הוספת/חיבור גרוש/ה',
        father: '👨 הוספת/חיבור אבא', mother: '👩 הוספת/חיבור אמא',
        brother: '👦 הוספת/חיבור אח', sister: '👧 הוספת/חיבור אחות',
        son: '👶 הוספת/חיבור בן', daughter: '👧 הוספת/חיבור בת'
    };
    document.getElementById('formTitle').textContent = labels[relType] + ' עבור: ' + formatFullName(target);
    document.getElementById('btnAddPerson').textContent = '💾 שמור אדם חדש וחבר';
    document.getElementById('btnAddPerson').style.background = '#059669';
    document.getElementById('btnCancelEdit').style.display = 'inline-block';
    document.getElementById('personFormBox').scrollIntoView({ behavior: 'smooth' });
}

async function applyRelationBetween(relType, targetId, otherPersonId) {
    if (relType === 'father' || relType === 'mother') {
        await fetch('/api/trees/' + currentTreeId + '/relationships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_id: otherPersonId, child_id: targetId }) });
    } else if (relType === 'son' || relType === 'daughter') {
        await fetch('/api/trees/' + currentTreeId + '/relationships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_id: targetId, child_id: otherPersonId }) });
    } else if (relType === 'brother' || relType === 'sister') {
        const parents = currentRelationships.filter(r => r.child_id === targetId).map(r => r.parent_id);
        if (parents.length === 0) alert('לאדם זה עדיין לא הוגדרו הורים, ולכן לא ניתן לקשר אחים אוטומטית. הוסיפי הורה קודם.');
        for (const pid of parents) {
            await fetch('/api/trees/' + currentTreeId + '/relationships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_id: pid, child_id: otherPersonId }) });
        }
    } else if (relType === 'spouse_married' || relType === 'spouse_divorced') {
        const status = relType === 'spouse_divorced' ? 'divorced' : 'married';
        await fetch('/api/trees/' + currentTreeId + '/unions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partner_1_id: targetId, partner_2_id: otherPersonId, union_status: status }) });
    }
}

async function linkExistingPerson() {
    const existingId = document.getElementById('existingPersonSelect').value;
    if (!existingId || !pendingRelation) return alert('נא לבחור אדם מהרשימה');
    await applyRelationBetween(pendingRelation.type, pendingRelation.targetId, existingId);
    cancelEdit(); loadTreeData();
}

async function loadTrees() {
    const res = await fetch('/api/trees');
    const trees = await res.json();
    const select = document.getElementById('treeSelect');
    select.innerHTML = '<option value="">-- בחרי אילן קיים --</option>';
    trees.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.tree_id; opt.textContent = t.title;
        select.appendChild(opt);
    });
    if (currentTreeId) select.value = currentTreeId;
}

async function createTree() {
    const email = document.getElementById('userEmail').value || 'admin@family.com';
    const title = document.getElementById('treeTitle').value;
    if (!title) return alert('נא להזין שם לאילן');
    const res = await fetch('/api/trees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, title }) });
    const tree = await res.json();
    currentTreeId = tree.tree_id;
    document.getElementById('treeTitle').value = '';
    await loadTrees(); loadTreeData();
}

async function deleteCurrentTree() {
    if (!currentTreeId) return;
    if (!confirm('למחוק לצמיתות את האילן הנבחר?')) return;
    await fetch('/api/trees/' + currentTreeId, { method: 'DELETE' });
    currentTreeId = null;
    document.getElementById('workspace').style.display = 'none';
    document.getElementById('btnDeleteTree').style.display = 'none';
    await loadTrees();
}

function startEditPerson(personId) {
    const p = currentPeopleMap[personId];
    if (!p) return;
    cancelEdit();
    editingPersonId = personId;
    document.getElementById('firstName').value = p.first_name || '';
    document.getElementById('lastName').value = p.last_name || '';
    document.getElementById('maidenName').value = p.maiden_name || '';
    document.getElementById('gender').value = p.gender || 'unknown';
    document.getElementById('occupation').value = p.occupation || '';
    document.getElementById('birthApprox').value = p.birth_date_approx || '';
    document.getElementById('birthPlace').value = p.birth_place || '';
    const isDeceased = p.is_living === false;
    document.getElementById('isDeceased').checked = isDeceased;
    document.getElementById('deathFieldContainer').style.display = isDeceased ? 'block' : 'none';
    document.getElementById('deathType').value = p.death_type || 'regular';
    document.getElementById('deathApprox').value = p.death_date_approx || '';
    document.getElementById('link1').value = p.link_1 || '';
    document.getElementById('link2').value = p.link_2 || '';
    document.getElementById('formTitle').textContent = '✏️ עריכת: ' + formatFullName(p);
    document.getElementById('btnAddPerson').textContent = '💾 שמור שינויים';
    document.getElementById('btnAddPerson').style.background = '#059669';
    document.getElementById('btnCancelEdit').style.display = 'inline-block';
    document.getElementById('personFormBox').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
    editingPersonId = null; pendingRelation = null;
    document.getElementById('existingPersonBox').style.display = 'none';
    ['firstName','lastName','maidenName','occupation','birthApprox','birthPlace','link1','link2','deathApprox'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('isDeceased').checked = false;
    document.getElementById('deathType').value = 'regular';
    document.getElementById('deathFieldContainer').style.display = 'none';
    document.getElementById('formTitle').textContent = '2. הוספת אדם לאילן';
    document.getElementById('btnAddPerson').textContent = '+ הוסף אדם לאילן';
    document.getElementById('btnAddPerson').style.background = '#1a56db';
    document.getElementById('btnCancelEdit').style.display = 'none';
}

async function deletePerson(personId) {
    const p = currentPeopleMap[personId];
    if (!p || !confirm('למחוק את "' + formatFullName(p) + '"?')) return;
    await fetch('/api/individuals/' + personId, { method: 'DELETE' });
    if (editingPersonId === personId) cancelEdit();
    loadTreeData();
}

async function loadTreeData() {
    currentTreeId = document.getElementById('treeSelect').value;
    const deleteBtn = document.getElementById('btnDeleteTree');
    if (!currentTreeId) { document.getElementById('workspace').style.display = 'none'; deleteBtn.style.display = 'none'; return; }
    document.getElementById('workspace').style.display = 'block';
    deleteBtn.style.display = 'inline-block';
    const res = await fetch('/api/trees/' + currentTreeId + '/full');
    const data = await res.json();
    currentPeopleMap = {};
    currentRelationships = data.relationships;
    currentUnions = data.unions || [];
    const childrenMap = {};
    const hasParent = new Set();
    data.people.forEach(p => { currentPeopleMap[p.person_id] = p; childrenMap[p.person_id] = []; });
    data.relationships.forEach(r => { if (childrenMap[r.parent_id]) { childrenMap[r.parent_id].push(r.child_id); hasParent.add(r.child_id); } });

    const renderedPeople = new Set();
