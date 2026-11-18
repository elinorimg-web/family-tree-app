function formatFullName(p) {
    let lastNames = '';
    if (p.maiden_name && p.last_name) lastNames = p.maiden_name + ' - ' + p.last_name;
    else if (p.maiden_name) lastNames = p.maiden_name;
    else if (p.last_name) lastNames = p.last_name;
    return [lastNames, p.first_name].filter(Boolean).join(' ').trim();
}

function showPersonDetails(personId) {
    const p = currentPeopleMap[personId];
    if (!p) return;

    const isDeceased = p.is_living === false;
    let statusText = 'בחיים';
    if (isDeceased) {
        if (p.death_type === 'holocaust') statusText = 'נספה בשואה (הי״ד)';
        else if (p.death_type === 'idf') statusText = 'חלל צה״ל (ז״ל)';
        else statusText = 'נפטר/ה (ז״ל)';
    }

    const genderLabels = { male: 'זכר', female: 'נקבה', unknown: 'לא ידוע' };
    document.getElementById('bioTitle').textContent = formatFullName(p);

    let html = '<div class="detail-line"><strong>מגדר:</strong> ' + (genderLabels[p.gender] || 'לא ידוע') + '</div>';
    if (p.occupation) html += '<div class="detail-line"><strong>עיסוק:</strong> ' + p.occupation + '</div>';
    if (p.birth_date_approx || p.birth_place) {
        html += '<div class="detail-line"><strong>לידה:</strong> ' + [p.birth_date_approx, p.birth_place].filter(Boolean).join(', ') + '</div>';
    }
    if (isDeceased) {
        html += '<div class="detail-line"><strong>פטירה:</strong> ' + statusText + (p.death_date_approx ? ' (' + p.death_date_approx + ')' : '') + '</div>';
    }

    if (p.link_1 || p.link_2) {
        html += '<div class="detail-line" style="margin-top:10px;">';
        if (p.link_1) html += '<a href="' + p.link_1 + '" target="_blank" class="ext-link">🔗 קישור 1</a>';
        if (p.link_2) html += '<a href="' + p.link_2 + '" target="_blank" class="ext-link">🔗 קישור 2</a>';
        html += '</div>';
    }

    if (p.notes) {
        html += '<div style="margin-top:12px;"><strong>📖 סיפור חיים והערות:</strong>' +
            '<div style="margin-top:6px; white-space:pre-wrap; background:#ffffff; padding:10px; border-radius:6px; border:1px solid #cbd5e1;">' + p.notes + '</div></div>';
    }

    html += '<div style="margin-top:16px; padding-top:12px; border-top:1px solid #cbd5e1; display:flex; gap:10px;">' +
        '<button type="button" onclick="document.getElementById(\'bioModal\').style.display=\'none\'; startEditPerson(\'' + p.person_id + '\');" style="background:#475569;">✏️ ערוך פרטים</button>' +
        '<button type="button" onclick="document.getElementById(\'bioModal\').style.display=\'none\'; deletePerson(\'' + p.person_id + '\');" style="background:#dc2626;">🗑️ מחק אדם</button>' +
    '</div>';

    const contentEl = document.getElementById('bioContent');
    contentEl.style.whiteSpace = 'normal';
    contentEl.innerHTML = html;
    document.getElementById('bioModal').style.display = 'flex';
}

function buildPersonCardHTML(p, x, y) {
    const isDeceased = p.is_living === false;
    let statusClass = '';
    if (isDeceased) {
        if (p.death_type === 'holocaust') statusClass = 'holocaust';
        else if (p.death_type === 'idf') statusClass = 'idf';
        else statusClass = 'deceased';
    }

    return '<div onclick="showPersonDetails(\'' + p.person_id + '\')" oncontextmenu="openContextMenu(event, \'' + p.person_id + '\')" class="node-card ' + (p.gender === 'female' ? 'female' : '') + ' ' + statusClass + '" style="left:' + x + 'px; top:' + y + 'px;" title="קליק שמאלי לפרטים מלאים | קליק ימני להוספת קרובים">' +
        '<div class="node-name">' + formatFullName(p) + '</div>' +
    '</div>';
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

    const parentsByChild = {};
    relationships.forEach(r => {
        if (!parentsByChild[r.child_id]) parentsByChild[r.child_id] = [];
        if (!parentsByChild[r.child_id].includes(r.parent_id)) parentsByChild[r.child_id].push(r.parent_id);
    });

    const cardW = 165, cardH = 58, gapX = 70, gapY = 85;
    const pos = {};
    let maxW = 600;
    const globalPlaced = new Set();

    function getAnchorX(childId) {
        const pIds = (parentsByChild[childId] || []).filter(pid => pos[pid]);
        if (pIds.length === 0) return 999999;
        if (pIds.length >= 2) return (pos[pIds.at(0)].x + pos[pIds.at(1)].x + cardW) / 2;
        return pos[pIds.at(0)].x + cardW / 2;
    }

    Object.keys(byGen).sort((a, b) => a - b).forEach(g => {
        const ids = byGen[g];
        const ordered = [];

        const sortedIds = [...ids].sort((a, b) => {
            const ax = getAnchorX(a), bx = getAnchorX(b);
            if (ax !== bx) return ax - bx;
            const countA = unionsList.filter(u => u.partner_1_id === a || u.partner_2_id === a).length;
            const countB = unionsList.filter(u => u.partner_1_id === b || u.partner_2_id === b).length;
            return countB - countA;
        });

        sortedIds.forEach(id => {
            if (globalPlaced.has(id)) return;
            const myUnions = unionsList.filter(u => u.partner_1_id === id || u.partner_2_id === id);
            const divorced = [...new Set(myUnions.filter(u => u.union_status === 'divorced').map(u => u.partner_1_id === id ? u.partner_2_id : u.partner_1_id))];
            const married = [...new Set(myUnions.filter(u => u.union_status !== 'divorced').map(u => u.partner_1_id === id ? u.partner_2_id : u.partner_1_id))];

            divorced.forEach(did => {
                if (ids.includes(did) && !globalPlaced.has(did)) { ordered.push(did); globalPlaced.add(did); }
            });
            if (!globalPlaced.has(id)) { ordered.push(id); globalPlaced.add(id); }
            married.forEach(mid => {
                if (ids.includes(mid) && !globalPlaced.has(mid)) { ordered.push(mid); globalPlaced.add(mid); }
            });
        });

        const rowW = ordered.length * cardW + (ordered.length - 1) * gapX;
        if (rowW + 80 > maxW) maxW = rowW + 80;
        ordered.forEach((id, idx) => {
            pos[id] = { x: 40 + idx * (cardW + gapX), y: 20 + g * (cardH + gapY), rowW };
        });
    });

    Object.values(pos).forEach(p => { p.x += (maxW - p.rowW - 80) / 2; });
    const totalH = (Object.keys(byGen).length) * (cardH + gapY) + 40;

    let svg = '<svg class="svg-lines" width="' + maxW + '" height="' + totalH + '" style="z-index:1;">';

    unionsList.forEach(u => {
        const p1 = pos[u.partner_1_id], p2 = pos[u.partner_2_id];
        if (!p1 || !p2) return;
        const left = p1.x < p2.x ? p1 : p2;
        const right = p1.x < p2.x ? p2 : p1;
        const x1 = left.x + cardW;
        const x2 = right.x;
        const y = left.y + cardH / 2;
        const midX = (x1 + x2) / 2;
        const isDiv = u.union_status === 'divorced';

        if (isDiv) {
            svg += '<line x1="' + (x1 + 6) + '" y1="' + y + '" x2="' + (x2 - 6) + '" y2="' + y + '" stroke="#000000" stroke-width="3" stroke-dasharray="6,6"/>';
        } else {
            svg += '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="#000000" stroke-width="3"/>';
            svg += '<text x="' + midX + '" y="' + (y - 8) + '" text-anchor="middle" font-size="15">💍</text>';
        }
    });

    const familyGroups = {};
    Object.keys(parentsByChild).forEach(childId => {
        if (!pos[childId]) return;
        const pIds = parentsByChild[childId].filter(pid => pos[pid]).sort();
        if (pIds.length === 0) return;
        const key = pIds.join('_');
        if (!familyGroups[key]) familyGroups[key] = { pIds, children: [] };
        familyGroups[key].children.push(childId);
    });

    const branchColors = ['#1e3a8a', '#065f46', '#7c2d12', '#581c87', '#0f766e'];
    Object.values(familyGroups).forEach((group, idx) => {
        const color = branchColors[idx % branchColors.length];
        const pIds = group.pIds;

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

        const forkY = (pIds.length >= 2 ? (pos[pIds.at(0)].y + cardH) : startY) + 14;
        svg += '<line x1="' + startX + '" y1="' + startY + '" x2="' + startX + '" y2="' + forkY + '" stroke="' + color + '" stroke-width="2.5"/>';
        svg += '<circle cx="' + startX + '" cy="' + forkY + '" r="3.5" fill="' + color + '"/>';

        group.children.forEach(childId => {
            const cPos = pos[childId];
            const endX = cPos.x + cardW / 2;
            const endY = cPos.y;
            const ctrlY1 = forkY + (endY - forkY) * 0.45;
            const ctrlY2 = forkY + (endY - forkY) * 0.55;
            svg += '<path d="M ' + startX + ' ' + forkY + ' C ' + startX + ' ' + ctrlY1 + ', ' + endX + ' ' + ctrlY2 + ', ' + endX + ' ' + endY + '" fill="none" stroke="' + color + '" stroke-width="2.5"/>';
        });
    });

    svg += '</svg>';
