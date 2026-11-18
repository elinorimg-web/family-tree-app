function buildSteppedCardHTML(p) {
    const isDeceased = p.is_living === false;
    let statusClass = '';
    let suffix = '';
    if (isDeceased) {
        if (p.death_type === 'holocaust') { statusClass = 'holocaust'; suffix = ' (הי״ד)'; }
        else if (p.death_type === 'idf') { statusClass = 'idf'; suffix = ' (חלל צה״ל ז״ל)'; }
        else { statusClass = 'deceased'; suffix = ' (ז״ל)'; }
    }
    let dates = p.birth_date_approx || '';
    if (isDeceased) dates += p.death_date_approx ? ' - ' + p.death_date_approx : ' - נפטר/ה';

    let linksHtml = '';
    if (p.link_1) linksHtml += '<a href="' + p.link_1 + '" target="_blank" class="ext-link">🔗 קישור 1</a>';
    if (p.link_2) linksHtml += '<a href="' + p.link_2 + '" target="_blank" class="ext-link">🔗 קישור 2</a>';
    if (p.notes) linksHtml += '<button type="button" onclick="showBio(\'' + p.person_id + '\')" class="ext-link no-print" style="background:#fef3c7; color:#92400e;">📖 סיפור חיים</button>';

    const actionsHtml = '<div class="card-actions" style="margin-top:5px;border-top:1px solid #cbd5e1;padding-top:4px;display:flex;justify-content:center;gap:6px;">' +
        '<button type="button" onclick="startEditPerson(\'' + p.person_id + '\')" style="padding:2px 6px;font-size:10px;background:#475569;">✏️ ערוך</button>' +
        '<button type="button" onclick="deletePerson(\'' + p.person_id + '\')" style="padding:2px 6px;font-size:10px;background:#dc2626;">🗑️ מחק</button></div>';

    return '<div oncontextmenu="openContextMenu(event, \'' + p.person_id + '\')" class="step-card ' + (p.gender === 'female' ? 'female' : '') + ' ' + statusClass + '">' +
        '<div class="node-name">' + formatFullName(p) + suffix + '</div>' +
        (p.occupation ? '<div class="node-occ">' + p.occupation + '</div>' : '') +
        (dates || p.birth_place ? '<div class="node-dates">' + dates + (p.birth_place ? ' (' + p.birth_place + ')' : '') + '</div>' : '') +
        (linksHtml ? '<div class="node-links">' + linksHtml + '</div>' : '') + actionsHtml + '</div>';
}

function renderSteppedBranch(personId, peopleMap, childrenMap, unionsList, rendered) {
    if (rendered.has(personId) || !peopleMap[personId]) return '';
    rendered.add(personId);
    const person = peopleMap[personId];

    const myUnions = unionsList.filter(u => u.partner_1_id === personId || u.partner_2_id === personId);
    const personKids = childrenMap[personId] || [];

    let rowHtml = '<div class="step-row">' + buildSteppedCardHTML(person);
    let branchesHtml = '';

    // טיפול בכל בן/בת זוג (נשואים או גרושים) וילדיהם המשותפים
    const handledKids = new Set();

    myUnions.forEach(u => {
        const spouseId = u.partner_1_id === personId ? u.partner_2_id : u.partner_1_id;
        const spouse = peopleMap[spouseId];
        if (!spouse) return;
        rendered.add(spouseId);

        const isDiv = u.union_status === 'divorced';
        if (isDiv) {
            rowHtml += '<div class="step-divorced-line" title="גרושים"></div>' + buildSteppedCardHTML(spouse);
        } else {
            rowHtml += '<div class="step-married-join">💍</div>' + buildSteppedCardHTML(spouse);
        }

        const spouseKids = childrenMap[spouseId] || [];
        const shared = personKids.filter(cid => spouseKids.includes(cid) && !rendered.has(cid));
        shared.forEach(cid => handledKids.add(cid));

        if (shared.length > 0) {
            branchesHtml += '<div class="step-children">' +
                shared.map(cid => '<div class="step-child-item">' + renderSteppedBranch(cid, peopleMap, childrenMap, unionsList, rendered) + '</div>').join('') +
            '</div>';
        }
    });

    rowHtml += '</div>';

    // ילדים של האדם ללא בן זוג משותף
    const soloKids = personKids.filter(cid => !handledKids.has(cid) && !rendered.has(cid));
    if (soloKids.length > 0) {
        branchesHtml += '<div class="step-children">' +
            soloKids.map(cid => '<div class="step-child-item">' + renderSteppedBranch(cid, peopleMap, childrenMap, unionsList, rendered) + '</div>').join('') +
        '</div>';
    }

    return '<div class="step-node">' + rowHtml + branchesHtml + '</div>';
}

function drawSteppedTree(peopleMap, relationships, unionsList) {
    const people = Object.values(peopleMap);
    if (people.length === 0) return '<p>אין אנשים באילן.</p>';

    const childrenMap = {};
    const hasParent = new Set();
    people.forEach(p => { childrenMap[p.person_id] = []; });
    relationships.forEach(r => {
        if (childrenMap[r.parent_id] && !childrenMap[r.parent_id].includes(r.child_id)) {
            childrenMap[r.parent_id].push(r.child_id);
            hasParent.add(r.child_id);
        }
    });

    const rendered = new Set();
    const roots = people.filter(p => !hasParent.has(p.person_id));
    let html = '<div class="stepped-container">';

    roots.forEach(r => {
        if (rendered.has(r.person_id)) return;
        // אם לאדם אין הורים, אבל לבן/בת זוגו יש הורים - נדלג עליו כאן כדי שיצויר ליד בן זוגו בדור הנכון
        const u = unionsList.find(un => un.partner_1_id === r.person_id || un.partner_2_id === r.person_id);
        const spouseId = u ? (u.partner_1_id === r.person_id ? u.partner_2_id : u.partner_1_id) : null;
        if (spouseId && hasParent.has(spouseId)) return;
        html += renderSteppedBranch(r.person_id, peopleMap, childrenMap, unionsList, rendered);
    });

    people.forEach(p => {
        if (!rendered.has(p.person_id)) {
            html += renderSteppedBranch(p.person_id, peopleMap, childrenMap, unionsList, rendered);
        }
    });

    return html + '</div>';
}
