function formatFullName(p) {
    let lastNames = '';
    if (p.maiden_name && p.last_name) lastNames = p.maiden_name + ' - ' + p.last_name;
    else if (p.maiden_name) lastNames = p.maiden_name;
    else if (p.last_name) lastNames = p.last_name;
    return [lastNames, p.first_name].filter(Boolean).join(' ').trim();
}

function buildPersonCardHTML(p) {
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
    const actionsHtml = '<div style="margin-top:8px;border-top:1px solid #cbd5e1;padding-top:5px;display:flex;justify-content:center;gap:6px;">' +
        '<button type="button" onclick="startEditPerson(\'' + p.person_id + '\')" style="padding:2px 7px;font-size:11px;background:#475569;">✏️ ערוך</button>' +
        '<button type="button" onclick="deletePerson(\'' + p.person_id + '\')" style="padding:2px 7px;font-size:11px;background:#dc2626;">🗑️ מחק</button></div>';

    return '<div oncontextmenu="openContextMenu(event, \'' + p.person_id + '\')" class="node-card ' + (p.gender === 'female' ? 'female' : '') + ' ' + statusClass + '" title="קליק ימני להוספת/חיבור קרובים">' +
        '<div class="node-name">' + formatFullName(p) + suffix + '</div>' +
        (p.occupation ? '<div class="node-occ">' + p.occupation + '</div>' : '') +
        (dates || p.birth_place ? '<div class="node-dates">' + dates + (p.birth_place ? ' (' + p.birth_place + ')' : '') + '</div>' : '') +
        (linksHtml ? '<div class="node-links">' + linksHtml + '</div>' : '') + actionsHtml + '</div>';
}

function renderFamilyUnit(personId, peopleMap, childrenMap, unionsList, renderedPeople) {
    if (renderedPeople.has(personId) || !peopleMap[personId]) return '';
    renderedPeople.add(personId);
    const person = peopleMap[personId];

    const myUnions = unionsList.filter(u => u.partner_1_id === personId || u.partner_2_id === personId);
    let nodeHtml = '';
    const allChildren = new Set(childrenMap[personId] || []);

    if (myUnions.length > 0) {
        nodeHtml += '<div class="couple-wrap">' + buildPersonCardHTML(person);
        myUnions.forEach(u => {
            const spouseId = u.partner_1_id === personId ? u.partner_2_id : u.partner_1_id;
            const spouse = peopleMap[spouseId];
            if (spouse) {
                renderedPeople.add(spouseId);
                (childrenMap[spouseId] || []).forEach(c => allChildren.add(c));
                const isDivorced = u.union_status === 'divorced';
                const badgeHtml = isDivorced ? '' : '<span class="spouse-badge">💍</span>';
                nodeHtml += '<div class="spouse-line ' + (isDivorced ? 'divorced' : '') + '">' + badgeHtml + '</div>' +
                    buildPersonCardHTML(spouse);
            }
        });
        nodeHtml += '</div>';
    } else {
        nodeHtml = buildPersonCardHTML(person);
    }

    const childrenArr = Array.from(allChildren);
    let html = '<li>' + nodeHtml;
    if (childrenArr.length > 0) {
        html += '<ul>' + childrenArr.map(cid => renderFamilyUnit(cid, peopleMap, childrenMap, unionsList, renderedPeople)).join('') + '</ul>';
    }
    return html + '</li>';
}
