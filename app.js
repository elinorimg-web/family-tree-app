let currentTreeId = null;
let editingPersonId = null;
let currentPeopleMap = {};

document.getElementById('isDeceased').addEventListener('change', function() {
    document.getElementById('deathFieldContainer').style.display = this.checked ? 'block' : 'none';
    if (!this.checked) document.getElementById('deathApprox').value = '';
});

async function loadTrees() {
    const res = await fetch('/api/trees');
    const trees = await res.json();
    const select = document.getElementById('treeSelect');
    select.innerHTML = '<option value="">-- בחרי אילן קיים --</option>';
    trees.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.tree_id;
        opt.textContent = t.title;
        select.appendChild(opt);
    });
    if (currentTreeId) select.value = currentTreeId;
}

async function createTree() {
    const email = document.getElementById('userEmail').value || 'admin@family.com';
    const title = document.getElementById('treeTitle').value;
    if (!title) return alert('נא להזין שם לאילן');
    const res = await fetch('/api/trees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, title })
    });
    const tree = await res.json();
    if (tree.error) return alert('שגיאה: ' + tree.error);
    currentTreeId = tree.tree_id;
    document.getElementById('treeTitle').value = '';
    await loadTrees();
    loadTreeData();
}

async function deleteCurrentTree() {
    if (!currentTreeId) return;
    const select = document.getElementById('treeSelect');
    const treeName = select.options[select.selectedIndex].text;
    if (!confirm('האם את בטוחה שברצונך למחוק לצמיתות את האילן "' + treeName + '"?')) return;
    await fetch('/api/trees/' + currentTreeId, { method: 'DELETE' });
    currentTreeId = null;
    document.getElementById('workspace').style.display = 'none';
    document.getElementById('btnDeleteTree').style.display = 'none';
    await loadTrees();
}

function formatFullName(p) {
    let lastNames = '';
    if (p.maiden_name && p.last_name) {
        lastNames = p.maiden_name + ' - ' + p.last_name;
    } else if (p.maiden_name) {
        lastNames = p.maiden_name;
    } else if (p.last_name) {
        lastNames = p.last_name;
    }
    return [lastNames, p.first_name].filter(Boolean).join(' ').trim();
}

function startEditPerson(personId) {
    const p = currentPeopleMap[personId];
    if (!p) return;
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

    document.getElementById('formTitle').textContent = '✏️ עריכת פרטי אדם: ' + formatFullName(p);
    document.getElementById('btnAddPerson').textContent = '💾 שמור שינויים';
    document.getElementById('btnAddPerson').style.background = '#059669';
    document.getElementById('btnCancelEdit').style.display = 'inline-block';
    document.getElementById('personFormBox').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
    editingPersonId = null;
    document.getElementById('firstName').value = '';
    document.getElementById('lastName').value = '';
    document.getElementById('maidenName').value = '';
    document.getElementById('occupation').value = '';
    document.getElementById('birthApprox').value = '';
    document.getElementById('birthPlace').value = '';
    document.getElementById('link1').value = '';
    document.getElementById('link2').value = '';
    document.getElementById('isDeceased').checked = false;
    document.getElementById('deathFieldContainer').style.display = 'none';
    document.getElementById('deathApprox').value = '';

    document.getElementById('formTitle').textContent = '2. הוספת אדם לאילן';
    document.getElementById('btnAddPerson').textContent = '+ הוסף אדם לאילן';
    document.getElementById('btnAddPerson').style.background = '#1a56db';
    document.getElementById('btnCancelEdit').style.display = 'none';
}

async function deletePerson(personId) {
    const p = currentPeopleMap[personId];
    if (!p) return;
    if (!confirm('למחוק את "' + formatFullName(p) + '" מהאילן?')) return;
    await fetch('/api/individuals/' + personId, { method: 'DELETE' });
    if (editingPersonId === personId) cancelEdit();
    loadTreeData();
}

function buildPersonCardHTML(p) {
    const isDeceased = p.is_living === false;
    const genderClass = p.gender === 'female' ? 'female' : '';
    const deceasedClass = isDeceased ? 'deceased' : '';
    const zalTag = isDeceased ? ' (ז״ל)' : '';

    let dates = p.birth_date_approx || '';
    if (isDeceased) dates += p.death_date_approx ? ' - ' + p.death_date_approx : ' - נפטר/ה';

    let linksHtml = '';
    if (p.link_1) linksHtml += '<a href="' + p.link_1 + '" target="_blank" class="ext-link">🔗 קישור 1</a>';
    if (p.link_2) linksHtml += '<a href="' + p.link_2 + '" target="_blank" class="ext-link">🔗 קישור 2</a>';

    const actionsHtml = '<div style="margin-top: 8px; border-top: 1px solid #cbd5e1; padding-top: 5px; display: flex; justify-content: center; gap: 8px;">' +
        '<button type="button" onclick="startEditPerson(\'' + p.person_id + '\')" style="padding: 2px 8px; font-size: 11px; background: #475569;">✏️ ערוך</button>' +
        '<button type="button" onclick="deletePerson(\'' + p.person_id + '\')" style="padding: 2px 8px; font-size: 11px; background: #dc2626;">🗑️ מחק</button>' +
    '</div>';

    return '<div class="node-card ' + genderClass + ' ' + deceasedClass + '">' +
        '<div class="node-name">' + formatFullName(p) + zalTag + '</div>' +
        (p.occupation ? '<div class="node-occ">' + p.occupation + '</div>' : '') +
        (dates || p.birth_place ? '<div class="node-dates">' + dates + ' ' + (p.birth_place ? '(' + p.birth_place + ')' : '') + '</div>' : '') +
        (linksHtml ? '<div class="node-links">' + linksHtml + '</div>' : '') +
        actionsHtml +
    '</div>';
}

function renderTreeRecursive(personId, peopleMap, childrenMap, visited = new Set()) {
    if (visited.has(personId)) return '';
    visited.add(personId);
    const person = peopleMap[personId];
    if (!person) return '';
    const childrenIds = childrenMap[personId] || [];
    let html = '<li>' + buildPersonCardHTML(person);
    if (childrenIds.length > 0) {
        html += '<ul>';
        childrenIds.forEach(cid => { html += renderTreeRecursive(cid, peopleMap, childrenMap, new Set(visited)); });
        html += '</ul>';
    }
    html += '</li>';
    return html;
}

async function loadTreeData() {
    currentTreeId = document.getElementById('treeSelect').value;
    const deleteBtn = document.getElementById('btnDeleteTree');
    if (!currentTreeId) {
        document.getElementById('workspace').style.display = 'none';
        deleteBtn.style.display = 'none';
        return;
    }
    document.getElementById('workspace').style.display = 'block';
    deleteBtn.style.display = 'inline-block';

    const res = await fetch('/api/trees/' + currentTreeId + '/full');
    const data = await res.json();
    const pSel = document.getElementById('parentSelect');
    const cSel = document.getElementById('childSelect');
    pSel.innerHTML = ''; cSel.innerHTML = '';

    currentPeopleMap = {};
    const childrenMap = {};
    const hasParent = new Set();

    data.people.forEach(p => {
        currentPeopleMap[p.person_id] = p;
        childrenMap[p.person_id] = [];
        const fullName = formatFullName(p);
        pSel.innerHTML += '<option value="' + p.person_id + '">' + fullName + '</option>';
        cSel.innerHTML += '<option value="' + p.person_id + '">' + fullName + '</option>';
    });

    data.relationships.forEach(r => {
        if (childrenMap[r.parent_id]) {
            childrenMap[r.parent_id].push(r.child_id);
            hasParent.add(r.child_id);
        }
    });

    const roots = data.people.filter(p => !hasParent.has(p.person_id));
    const diagramDiv = document.getElementById('treeDiagram');
    if (data.people.length === 0) {
        diagramDiv.innerHTML = '<p>עדיין אין אנשים באילן זה.</p>';
    } else {
        let treeHtml = '<ul>';
        roots.forEach(root => { treeHtml += renderTreeRecursive(root.person_id, currentPeopleMap, childrenMap); });
        treeHtml += '</ul>';
        diagramDiv.innerHTML = treeHtml;
    }
}

async function savePerson() {
    const isDeceased = document.getElementById('isDeceased').checked;
    const body = {
        first_name: document.getElementById('firstName').value,
        last_name: document.getElementById('lastName').value,
        maiden_name: document.getElementById('maidenName').value,
        gender: document.getElementById('gender').value,
        occupation: document.getElementById('occupation').value,
        birth_date_approx: document.getElementById('birthApprox').value,
        birth_place: document.getElementById('birthPlace').value,
        is_living: !isDeceased,
        death_date_approx: isDeceased ? document.getElementById('deathApprox').value : null,
        link_1: document.getElementById('link1').value,
        link_2: document.getElementById('link2').value
    };
