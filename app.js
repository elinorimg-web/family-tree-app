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
    const roots = data.people.filter(p => !hasParent.has(p.person_id));
    let treeHtml = '<ul>';
    roots.forEach(r => {
        const u = currentUnions.find(un => un.partner_1_id === r.person_id || un.partner_2_id === r.person_id);
        const spouseId = u ? (u.partner_1_id === r.person_id ? u.partner_2_id : u.partner_1_id) : null;
        if (spouseId && hasParent.has(spouseId)) return;
        treeHtml += renderFamilyUnit(r.person_id, currentPeopleMap, childrenMap, currentUnions, renderedPeople);
    });
    data.people.forEach(p => { if (!renderedPeople.has(p.person_id)) treeHtml += renderFamilyUnit(p.person_id, currentPeopleMap, childrenMap, currentUnions, renderedPeople); });
    treeHtml += '</ul>';
    document.getElementById('treeDiagram').innerHTML = data.people.length === 0 ? '<p>אין אנשים באילן.</p>' : treeHtml;
}

async function savePerson() {
    const isDeceased = document.getElementById('isDeceased').checked;
    const body = {
        first_name: document.getElementById('firstName').value, last_name: document.getElementById('lastName').value,
        maiden_name: document.getElementById('maidenName').value, gender: document.getElementById('gender').value,
        occupation: document.getElementById('occupation').value, birth_date_approx: document.getElementById('birthApprox').value,
        birth_place: document.getElementById('birthPlace').value, is_living: !isDeceased,
        death_type: isDeceased ? document.getElementById('deathType').value : 'regular',
        death_date_approx: isDeceased ? document.getElementById('deathApprox').value : null,
        link_1: document.getElementById('link1').value, link_2: document.getElementById('link2').value
    };
    if (!body.first_name) return alert('חובה להזין שם פרטי');
    const url = editingPersonId ? '/api/individuals/' + editingPersonId : '/api/trees/' + currentTreeId + '/individuals';
    const res = await fetch(url, { method: editingPersonId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const savedPerson = await res.json();
    if (pendingRelation && savedPerson.person_id) await applyRelationBetween(pendingRelation.type, pendingRelation.targetId, savedPerson.person_id);
    cancelEdit(); loadTreeData();
}

document.getElementById('treeSelect').addEventListener('change', () => { cancelEdit(); loadTreeData(); });
document.getElementById('btnCreateTree').addEventListener('click', createTree);
document.getElementById('btnDeleteTree').addEventListener('click', deleteCurrentTree);
document.getElementById('btnAddPerson').addEventListener('click', savePerson);
document.getElementById('btnLinkExisting').addEventListener('click', linkExistingPerson);
document.getElementById('btnCancelEdit').addEventListener('click', cancelEdit);
loadTrees();
