let currentTreeId = null;

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

    return '<div class="node-card ' + genderClass + ' ' + deceasedClass + '">' +
        '<div class="node-name">' + p.first_name + ' ' + (p.last_name || '') + zalTag + '</div>' +
        (p.occupation ? '<div class="node-occ">' + p.occupation + '</div>' : '') +
        (dates || p.birth_place ? '<div class="node-dates">' + dates + ' ' + (p.birth_place ? '(' + p.birth_place + ')' : '') + '</div>' : '') +
        (linksHtml ? '<div class="node-links">' + linksHtml + '</div>' : '') +
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
    if (!currentTreeId) { document.getElementById('workspace').style.display = 'none'; return; }
    document.getElementById('workspace').style.display = 'block';

    const res = await fetch('/api/trees/' + currentTreeId + '/full');
    const data = await res.json();
    const pSel = document.getElementById('parentSelect');
    const cSel = document.getElementById('childSelect');
    pSel.innerHTML = ''; cSel.innerHTML = '';

    const peopleMap = {};
    const childrenMap = {};
    const hasParent = new Set();

    data.people.forEach(p => {
        peopleMap[p.person_id] = p;
        childrenMap[p.person_id] = [];
        const fullName = p.first_name + ' ' + (p.last_name || '');
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
        roots.forEach(root => { treeHtml += renderTreeRecursive(root.person_id, peopleMap, childrenMap); });
        treeHtml += '</ul>';
        diagramDiv.innerHTML = treeHtml;
    }
}

async function addPerson() {
    const isDeceased = document.getElementById('isDeceased').checked;
    const body = {
        first_name: document.getElementById('firstName').value,
        last_name: document.getElementById('lastName').value,
        gender: document.getElementById('gender').value,
        occupation: document.getElementById('occupation').value,
        birth_date_approx: document.getElementById('birthApprox').value,
        birth_place: document.getElementById('birthPlace').value,
        is_living: !isDeceased,
        death_date_approx: isDeceased ? document.getElementById('deathApprox').value : null,
        link_1: document.getElementById('link1').value,
        link_2: document.getElementById('link2').value
    };
    if (!body.first_name) return alert('חובה להזין שם פרטי');
    await fetch('/api/trees/' + currentTreeId + '/individuals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    document.getElementById('firstName').value = '';
    document.getElementById('occupation').value = '';
    document.getElementById('birthApprox').value = '';
    document.getElementById('link1').value = '';
    document.getElementById('link2').value = '';
    document.getElementById('isDeceased').checked = false;
    document.getElementById('deathFieldContainer').style.display = 'none';
    loadTreeData();
}

async function addRelationship() {
    const parent_id = document.getElementById('parentSelect').value;
    const child_id = document.getElementById('childSelect').value;
    if (parent_id === child_id) return alert('אדם לא יכול להיות הורה של עצמו');
    await fetch('/api/trees/' + currentTreeId + '/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id, child_id })
    });
    loadTreeData();
}

document.getElementById('treeSelect').addEventListener('change', loadTreeData);
document.getElementById('btnCreateTree').addEventListener('click', createTree);
document.getElementById('btnAddPerson').addEventListener('click', addPerson);
document.getElementById('btnAddRel').addEventListener('click', addRelationship);

loadTrees();
