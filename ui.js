function formatFullName(p) {
    let lastNames = '';
    if (p.maiden_name && p.last_name) lastNames = p.maiden_name + ' - ' + p.last_name;
    else if (p.maiden_name) lastNames = p.maiden_name;
    else if (p.last_name) lastNames = p.last_name;
    return [lastNames, p.first_name].filter(Boolean).join(' ').trim();
}

function buildPersonCardHTML(p, x, y) {
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
    const actionsHtml = '<div style="margin-top:6px;border-top:1px solid #cbd5e1;padding-top:4px;display:flex;justify-content:center;gap:6px;">' +
        '<button type="button" onclick="startEditPerson(\'' + p.person_id + '\')" style="padding:2px 6px;font-size:10px;background:#475569;">✏️ ערוך</button>' +
        '<button type="button" onclick="deletePerson(\'' + p.person_id + '\')" style="padding:2px 6px;font-size:10px;background:#dc2626;">🗑️ מחק</button></div>';

    return '<div oncontextmenu="openContextMenu(event, \'' + p.person_id + '\')" class="node-card ' + (p.gender === 'female' ? 'female' : '') + ' ' + statusClass + '" style="left:' + x + 'px; top:' + y + 'px;">' +
        '<div class="node-name">' + formatFullName(p) + suffix + '</div>' +
        (p.occupation ? '<div class="node-occ">' + p.occupation + '</div>' : '') +
        (dates || p.birth_place ? '<div class="node-dates">' + dates + (p.birth_place ? ' (' + p.birth_place + ')' : '') + '</div>' : '') +
        (linksHtml ? '<div class="node-links">' + linksHtml + '</div>' : '') + actionsHtml + '</div>';
}

function drawExactTree(peopleMap, relationships, unionsList) {
    const people = Object.values(peopleMap);
    if (people.length === 0) return '<p style="direction:rtl;">אין אנשים באילן.</p>';

    const gen = {};
    people.forEach(p => gen[p.person_id] = 0);
    for (let step = 0; step < people.length + 2; step++) {
        relationships.forEach(r => {
            if (gen[r.parent_id] !== undefined && gen[r.child_id] !== undefined) {
                if (gen[r.child_id] <= gen[r.parent_id]) gen[r.child_id] = gen[r.parent_id] + 1;
            }
        });
        unionsList.forEach(u => {
            const g1 = gen[u.partner_1_id], g2 = gen[u.partner_2_id];
            if (g1 !== undefined && g2 !== undefined && g1 !== g2) {
                const maxG = Math.max(g1, g2);
                gen[u.partner_1_id] = maxG; gen[u.partner_2_id] = maxG;
            }
        });
    }

    const byGen = {};
    people.forEach(p => { const g = gen[p.person_id]; if (!byGen[g]) byGen[g] = []; byGen[g].push(p.person_id); });

    const cardW = 170, cardH = 135, gapX = 65, gapY = 75;
    const pos = {};
    let maxW = 600;

    Object.keys(byGen).sort((a, b) => a - b).forEach(g => {
        const ids = byGen[g];
        const ordered = [];
        const placed = new Set();

        ids.forEach(id => {
            if (placed.has(id)) return;
            const myUnions = unionsList.filter(u => u.partner_1_id === id || u.partner_2_id === id);
            const divorced = myUnions.filter(u => u.union_status === 'divorced').map(u => u.partner_1_id === id ? u.partner_2_id : u.partner_1_id);
            const married = myUnions.filter(u => u.union_status !== 'divorced').map(u => u.partner_1_id === id ? u.partner_2_id : u.partner_1_id);

            divorced.forEach(did => { if (ids.includes(did) && !placed.has(did)) { ordered.push(did); placed.add(did); } });
            ordered.push(id); placed.add(id);
            married.forEach(mid => { if (ids.includes(mid) && !placed.has(mid)) { ordered.push(mid); placed.add(mid); } });
        });

        const rowW = ordered.length * cardW + (ordered.length - 1) * gapX;
        if (rowW + 80 > maxW) maxW = rowW + 80;
        ordered.forEach((id, idx) => {
            pos[id] = { x: 40 + idx * (cardW + gapX), y: 20 + g * (cardH + gapY), rowW };
        });
    });

    Object.values(pos).forEach(p => { p.x += (maxW - p.rowW - 80) / 2; });
    const totalH = (Object.keys(byGen).length) * (cardH + gapY) + 40;

    let svg = '<svg class="svg-lines" width="' + maxW + '" height="' + totalH + '">';
    let ringsHtml = '';

    unionsList.forEach(u => {
        const p1 = pos[u.partner_1_id], p2 = pos[u.partner_2_id];
        if (!p1 || !p2) return;
        const left = p1.x < p2.x ? p1 : p2;
        const right = p1.x < p2.x ? p2 : p1;
        const x1 = left.x + cardW, x2 = right.x, y = left.y + cardH / 2;
        const midX = (x1 + x2) / 2;
        const isDiv = u.union_status === 'divorced';

        if (isDiv) {
            svg += '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="#000000" stroke-width="3" stroke-dasharray="7,6"/>';
            svg += '<line x1="' + (midX - 5) + '" y1="' + (y + 8) + '" x2="' + (midX + 1) + '" y2="' + (y - 8) + '" stroke="#000000" stroke-width="2.5"/>';
            svg += '<line x1="' + (midX + 1) + '" y1="' + (y + 8) + '" x2="' + (midX + 7) + '" y2="' + (y - 8) + '" stroke="#000000" stroke-width="2.5"/>';
        } else {
            svg += '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="#000000" stroke-width="3"/>';
            ringsHtml += '<div class="ring-icon" style="left:' + midX + 'px; top:' + (y - 16) + 'px;">💍</div>';
        }
    });

    const parentsByChild = {};
    relationships.forEach(r => { if (!parentsByChild[r.child_id]) parentsByChild[r.child_id] = []; parentsByChild[r.child_id].push(r.parent_id); });

    Object.keys(parentsByChild).forEach(childId => {
        const cPos = pos[childId];
        if (!cPos) return;
        const pIds = parentsByChild[childId].filter(pid => pos[pid]);
        if (pIds.length === 0) return;

        let startX, startY;
        if (pIds.length >= 2) {
            const p1 = pos[pIds.at(0)], p2 = pos[pIds.at(1)];
            startX = (p1.x + p2.x + cardW) / 2;
            startY = p1.y + cardH / 2;
        } else {
            const p1 = pos[pIds.at(0)];
            startX = p1.x + cardW / 2;
            startY = p1.y + cardH;
        }
        const endX = cPos.x + cardW / 2;
        const endY = cPos.y;
        const midY = startY + (endY - startY) * 0.55;
        svg += '<path d="M ' + startX + ' ' + startY + ' L ' + startX + ' ' + midY + ' L ' + endX + ' ' + midY + ' L ' + endX + ' ' + endY + '" fill="none" stroke="#475569" stroke-width="2.5"/>';
    });

    svg += '</svg>';
    let cardsHtml = people.map(p => buildPersonCardHTML(p, pos[p.person_id].x, pos[p.person_id].y)).join('');
    return '<div class="svg-board" style="width:' + maxW + 'px; height:' + totalH + 'px;">' + svg + ringsHtml + cardsHtml + '</div>';
}
