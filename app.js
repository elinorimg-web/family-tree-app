let currentTreeId = null;
let editingPersonId = null;
let currentPeopleMap = {};
let currentRelationships = [];
let contextTargetPersonId = null;
let pendingRelation = null;

document.addEventListener('click', () => { document.getElementById('contextMenu').style.display = 'none'; });

document.getElementById('isDeceased').addEventListener('change', function() {
    document.getElementById('deathFieldContainer').style.display = this.checked ? 'block' : 'none';
    if (!this.checked) document.getElementById('deathApprox').value = '';
});

function openContextMenu(e, personId) {
    e.preventDefault();
    contextTargetPersonId = personId;
    const p = currentPeopleMap[personId];
    document.getElementById('ctxHeader').textContent = 'קרובים עבור: ' + (p ? p.first_name : '');
    const menu = document.getElementById('contextMenu');
    menu.style.display = 'block';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
}

function startRelativeAdd(relType) {
    const target = currentPeopleMap[contextTargetPersonId];
    if (!target) return;
    cancelEdit();
    pendingRelation = { type: relType, targetId: contextTargetPersonId };

    const isMale = ['father', 'brother', 'son'].includes(relType);
    document.getElementById('gender').value = isMale ? 'male' : 'female';
    if (target.last_name && relType !== 'mother') document.getElementById('lastName').value = target.last_name;

    const labels = { father: '👨 הוספת אבא', mother: '👩 הוספת אמא', brother: '👦 הוספת אח', sister: '👧 הוספת אחות', son: '👶 הוספת בן', daughter: '👧 הוספת בת' };
    document.getElementById('formTitle').textContent = labels[relType] + ' עבור: ' + formatFullName(target);
    document.getElementById('btnAddPerson').textContent = '💾 שמור וחבר לעץ';
    document.getElementById('btnAddPerson').style.background = '#059669';
    document.getElementById('btnCancelEdit').style.display = 'inline-block';
    document.getElementById('personFormBox').scrollIntoView({ behavior: 'smooth' });
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
    const res = await fetch('/api/trees', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, title })
    });
    const tree = await res.json();
    if (tree.error) return alert('שגיאה: ' + tree.error);
    currentTreeId = tree.tree_id;
    document.getElementById('treeTitle').value = '';
    await loadTrees(); loadTreeData();
}

async function deleteCurrentTree() {
    if (!currentTreeId) return;
    const select = document.getElementById('treeSelect');
    if (!confirm('למחוק את "' + select.options[select.selectedIndex].text + '"?')) return;
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
    editingPersonId = null;
    pendingRelation = null;
    ['firstName','lastName','maidenName','occupation','birthApprox','birthPlace','link1','link2','deathApprox'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('isDeceased').checked = false;
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
    const childrenMap = {};
    const hasParent = new Set();
    data.people.forEach(p => { currentPeopleMap[p.person_id] = p; childrenMap[p.person_id] = []; });
    data.relationships.forEach(r => { if (childrenMap[r.parent_id]) { childrenMap[r.parent_id].push(r.child_id); hasParent.add(r.child_id); } });
    const roots = data.people.filter(p => !hasParent.has(p.person_id));
    document.getElementById('treeDiagram').innerHTML = data.people.length === 0 ? '<p>אין אנשים באילן.</p>' :
        '<ul>' + roots.map(r => renderTreeRecursive(r.person_id, currentPeopleMap, childrenMap)).join('') + '</ul>';
}

async function linkParentChild(parent_id, child_id) {
    await fetch('/api/trees/' + currentTreeId + '/relationships', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_id, child_id })
    });
}

async function savePerson() {
    const isDeceased = document.getElementById('isDeceased').checked;
    const body = {
        first_name: document.getElementById('firstName').value, last_name: document.getElementById('lastName').value,
        maiden_name: document.getElementById('maidenName').value, gender: document.getElementById('gender').value,
        occupation: document.getElementById('occupation').value, birth_date_approx: document.getElementById('birthApprox').value,
        birth_place: document.getElementById('birthPlace').value, is_living: !isDeceased,
        death_date_approx: isDeceased ? document.getElementById('deathApprox').value : null,
        link_1: document.getElementById('link1').value, link_2: document.getElementById('link2').value
    };
    if (!body.first_name) return alert('חובה להזין שם פרטי');
    const url = editingPersonId ? '/api/individuals/' + editingPersonId : '/api/trees/' + currentTreeId + '/individuals';
    const res = await fetch(url, { method: editingPersonId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const savedPerson = await res.json();

    if (pendingRelation && savedPerson.person_id) {
        const { type, targetId } = pendingRelation;
        if (type === 'father' || type === 'mother') {
            await linkParentChild(savedPerson.person_id, targetId);
        } else if (type === 'son' || type === 'daughter') {
            await linkParentChild(targetId, savedPerson.person_id);
        } else if (type === 'brother' || type === 'sister') {
            const parents = currentRelationships.filter(r => r.child_id === targetId).map(r => r.parent_id);
            if (parents.length === 0) alert('לתשומת לבך: לאדם זה עדיין לא מוגדרים הורים, ולכן האח/ות נוספו ללא הורה משותף. הוסיפי להם אבא או אמא והם יתחברו.');
            for (const pid of parents) await linkParentChild(pid, savedPerson.person_id);
        }
    }
    cancelEdit(); loadTreeData();
}

document.getElementById('treeSelect').addEventListener('change', () => { cancelEdit(); loadTreeData(); });
document.getElementById('btnCreateTree').addEventListener('click', createTree);
document.getElementById('btnDeleteTree').addEventListener('click', deleteCurrentTree);
document.getElementById('btnAddPerson').addEventListener('click', savePerson);
document.getElementById('btnCancelEdit').addEventListener('click', cancelEdit);
loadTrees();
