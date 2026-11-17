function formatFullName(p) {
    let lastNames = '';
    if (p.maiden_name && p.last_name) lastNames = p.maiden_name + ' - ' + p.last_name;
    else if (p.maiden_name) lastNames = p.maiden_name;
    else if (p.last_name) lastNames = p.last_name;
    return [lastNames, p.first_name].filter(Boolean).join(' ').trim();
}

function buildPersonCardHTML(p) {
    const isDeceased = p.is_living === false;
    const zalTag = isDeceased ? ' (ז״ל)' : '';
    let dates = p.birth_date_approx || '';
    if (isDeceased) dates += p.death_date_approx ? ' - ' + p.death_date_approx : ' - נפטר/ה';
    let linksHtml = '';
    if (p.link_1) linksHtml += '<a href="' + p.link_1 + '" target="_blank" class="ext-link">🔗 קישור 1</a>';
    if (p.link_2) linksHtml += '<a href="' + p.link_2 + '" target="_blank" class="ext-link">🔗 קישור 2</a>';
    const actionsHtml = '<div style="margin-top:8px;border-top:1px solid #cbd5e1;padding-top:5px;display:flex;justify-content:center;gap:8px;">' +
        '<button type="button" onclick="startEditPerson(\'' + p.person_id + '\')" style="padding:2px 8px;font-size:11px;background:#475569;">✏️ ערוך</button>' +
        '<button type="button" onclick="deletePerson(\'' + p.person_id + '\')" style="padding:2px 8px;font-size:11px;background:#dc2626;">🗑️ מחק</button></div>';
    return '<div class="node-card ' + (p.gender === 'female' ? 'female' : '') + ' ' + (isDeceased ? 'deceased' : '') + '">' +
        '<div class="node-name">' + formatFullName(p) + zalTag + '</div>' +
        (p.occupation ? '<div class="node-occ">' + p.occupation + '</div>' : '') +
        (dates || p.birth_place ? '<div class="node-dates">' + dates + (p.birth_place ? ' (' + p.birth_place + ')' : '') + '</div>' : '') +
        (linksHtml ? '<div class="node-links">' + linksHtml + '</div>' : '') + actionsHtml + '</div>';
}

function renderTreeRecursive(personId, peopleMap, childrenMap, visited = new Set()) {
    if (visited.has(personId) || !peopleMap[personId]) return '';
    visited.add(personId);
    const childrenIds = childrenMap[personId] || [];
    let html = '<li>' + buildPersonCardHTML(peopleMap[personId]);
    if (childrenIds.length > 0) {
        html += '<ul>' + childrenIds.map(cid => renderTreeRecursive(cid, peopleMap, childrenMap, new Set(visited))).join('') + '</ul>';
    }
    return html + '</li>';
}
