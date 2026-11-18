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

function renderSteppedBranch(personId, peopleMap, childrenMap, parentsMap, unionsList, rendered) {
    if (rendered.has(personId) || !peopleMap[personId]) return '';
    rendered.add(personId);
    const person = peopleMap[personId];

    const myUnions = unionsList.filter(u => u.partner_1_id === personId || u.partner_2_id === personId);
    const personKids = childrenMap[personId] || [];

    // אם אין בני זוג - מציגים כרטיס בודד ומתחתיו ילדים (אם יש)
    if (myUnions.length === 0) {
        const kids = personKids.filter(cid => !rendered.has(cid));
        let html = '<div class="step-node"><div class="step-row">' + buildSteppedCardHTML(person) + '</div>';
        if (kids.length > 0) {
            html += '<div class="step-children single-parent">' +
                kids.map(cid => '<div class="step-child-item">' + renderSteppedBranch(cid, peopleMap, childrenMap, parentsMap, unionsList, rendered) + '</div>').join('') +
            '</div>';
        }
        return html + '</div>';
    }

    // סידור זוגיות: גרושים קודם, נשואים אחריהם
    const sortedUnions = [...myUnions].sort((a, b) => (a.union_status === 'divorced' ? -1 : 1));
    let fullHtml = '';

    sortedUnions.forEach((u, idx) => {
        const spouseId = u.partner_1_id === personId ? u.partner_2_id : u.partner_1_id;
        const spouse = peopleMap[spouseId];
        if (spouse) rendered.add(spouseId);

        const isDiv = u.union_status === 'divorced';
        const joinHtml = isDiv ? '<div class="step-divorced-line" title="גרושים"></div>' : '<div class="step-married-join">💍</div>';

        const spouseKids = spouse ? (childrenMap[spouseId] || []) : [];
        let branchKids = personKids.filter(cid => spouseKids.includes(cid));

        // בזוגיות האחרונה נצרף גם ילדים שרשומים רק על האדם עצמו ללא הורה שני
        if (idx === sortedUnions.length - 1) {
            const soloKids = personKids.filter(cid => (parentsMap[cid] || []).length === 1);
            soloKids.forEach(cid => { if (!branchKids.includes(cid)) branchKids.push(cid); });
        }
        branchKids = branchKids.filter(cid => !rendered.has(cid));

        fullHtml += '<div class="step-node"><div class="step-row">' +
            buildSteppedCardHTML(person) + (spouse ? joinHtml + buildSteppedCardHTML(spouse) : '') +
        '</div>';

        if (branchKids.length > 0) {
            fullHtml += '<div class="step-children">' +
                branchKids.map(cid => '<div class="step-child-item">' + renderSteppedBranch(cid, peopleMap, childrenMap, parentsMap, unionsList, rendered) + '</div>').join('') +
            '</div>';
        }
        fullHtml += '</div>';
    });

    return fullHtml;
}

function drawSteppedTree(peopleMap, relationships, unionsList) {
    const people = Object.values(peopleMap);
    if (people.length === 0) return '<p>אין אנשים באילן.</p>';

    const childrenMap = {};
    const parentsMap = {};
    people.forEach(p => { childrenMap[p.person_id] = []; parentsMap[p.person_id] = []; });

    relationships.forEach(r => {
        if (childrenMap[r.parent_id] && !childrenMap[r.parent_id].includes(r.child_id)) {
            childrenMap[r.parent_id].push(r.child_id);
        }
        if (parentsMap[r.child_id] && !parentsMap[r.child_id].includes(r.parent_id)) {
            parentsMap[r.child_id].push(r.parent_id);
        }
    });

    const rendered = new Set();
    const roots = people.filter(p => {
        if ((parentsMap[p.person_id] || []).length > 0) return false;
        const myUnions = unionsList.filter(u => u.partner_1_id === p.person_id || u.partner_2_id === p.person_id);
        const spouseHasParents = myUnions.some(u => {
            const sid = u.partner_1_id === p.person_id ? u.partner_2_id : u.partner_1_id;
            return (parentsMap[sid] || []).length > 0;
        });
        return !spouseHasParents;
    });

    let html = '<div class="stepped-container">';
    roots.forEach(r => {
        if (!rendered.has(r.person_id)) {
            html += renderSteppedBranch(r.person_id, peopleMap, childrenMap, parentsMap, unionsList, rendered);
        }
    });
    people.forEach(p => {
        if (!rendered.has(p.person_id)) {
            html += renderSteppedBranch(p.person_id, peopleMap, childrenMap, parentsMap, unionsList, rendered);
        }
    });

    return html + '</div>';
}
