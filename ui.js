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
    const marriedUnion = myUnions.find(u => u.union_status !== 'divorced') || myUnions[0];
    const otherUnions = myUnions.filter(u => u !== marriedUnion);

    const personChildren = childrenMap[personId] || [];
    let primarySpouse = null;
    let sharedChildren = [];
    let personOnlyChildren = [...personChildren];
    let spouseOnlyChildren = [];

    if (marriedUnion) {
        const spouseId = marriedUnion.partner_1_id === personId ? marriedUnion.partner_2_id : marriedUnion.partner_1_id;
        primarySpouse = peopleMap[spouseId];
        if (primarySpouse) {
            renderedPeople.add(spouseId);
            const spouseChildren = childrenMap[spouseId] || [];
            sharedChildren = personChildren.filter(cid => spouseChildren.includes(cid));
            personOnlyChildren = personChildren.filter(cid => !sharedChildren.includes(cid));
            spouseOnlyChildren = spouseChildren.filter(cid => !sharedChildren.includes(cid));
        }
    }

    let topHtml = '';
    if (primarySpouse) {
        const isDivorced = marriedUnion.union_status === 'divorced';
        const badgeHtml = isDivorced ? '' : '<span class="spouse-badge">💍</span>';

        let personCol = '<div style="display:flex; flex-direction:column; align-items:center;">' + buildPersonCardHTML(person);
        if (personOnlyChildren.length > 0) {
            personCol += '<ul class="has-children">' + personOnlyChildren.map(cid => renderFamilyUnit(cid, peopleMap, childrenMap, unionsList, renderedPeople)).join('') + '</ul>';
        }
        personCol += '</div>';

        let spouseCol = '<div style="display:flex; flex-direction:column; align-items:center;">' + buildPersonCardHTML(primarySpouse);
        if (spouseOnlyChildren.length > 0) {
            spouseCol += '<ul class="has-children">' + spouseOnlyChildren.map(cid => renderFamilyUnit(cid, peopleMap, childrenMap, unionsList, renderedPeople)).join('') + '</ul>';
        }
        spouseCol += '</div>';

        topHtml = '<div class="couple-wrap" style="align-items:flex-start;">' + personCol +
            '<div class="spouse-line ' + (isDivorced ? 'divorced' : '') + '" style="margin-top:42px;">' + badgeHtml + '</div>' +
            spouseCol + '</div>';
    } else {
        topHtml = buildPersonCardHTML(person);
        sharedChildren = personOnlyChildren;
    }

    // הצגת בני זוג נוספים (גירושין קודמים) לצד היחידה
    let extraSpousesHtml = '';
    otherUnions.forEach(u => {
        const exId = u.partner_1_id === personId ? u.partner_2_id : u.partner_1_id;
        const exSpouse = peopleMap[exId];
        if (exSpouse && !renderedPeople.has(exId)) {
            renderedPeople.add(exId);
            const exChildren = (childrenMap[exId] || []).filter(cid => !sharedChildren.includes(cid) && !personOnlyChildren.includes(cid));
            extraSpousesHtml += '<div class="spouse-line divorced" style="margin-top:42px;"></div>' +
                '<div style="display:flex; flex-direction:column; align-items:center;">' + buildPersonCardHTML(exSpouse) +
                (exChildren.length > 0 ? '<ul class="has-children">' + exChildren.map(cid => renderFamilyUnit(cid, peopleMap, childrenMap, unionsList, renderedPeople)).join('') + '</ul>' : '') +
                '</div>';
        }
    });

    if (extraSpousesHtml) {
        topHtml = '<div style="display:inline-flex; align-items:flex-start; gap:4px;">' + topHtml + extraSpousesHtml + '</div>';
    }

    const validShared = sharedChildren.filter(cid => peopleMap[cid] && !renderedPeople.has(cid));
    let html = '<li>' + topHtml;
    if (validShared.length > 0) {
        html += '<ul class="has-children">' + validShared.map(cid => renderFamilyUnit(cid, peopleMap, childrenMap, unionsList, renderedPeople)).join('') + '</ul>';
    }
    return html + '</li>';
}
