let focusedPersonId = null;

function focusOnBranch() {
    focusedPersonId = contextTargetPersonId;
    document.getElementById('btnResetFocus').style.display = 'inline-block';
    renderCurrentTree();
}

function resetBranchFocus() {
    focusedPersonId = null;
    document.getElementById('btnResetFocus').style.display = 'none';
    renderCurrentTree();
}

function highlightConnections(personId) {
    document.querySelectorAll('.tree-edge').forEach(el => {
        const linked = (el.dataset.nodes || '').split(',');
        el.style.opacity = linked.includes(personId) ? '1' : '0.12';
        if (linked.includes(personId)) el.setAttribute('stroke-width', '3.5');
    });
}

function clearHighlights() {
    document.querySelectorAll('.tree-edge').forEach(el => {
        el.style.opacity = '0.85';
        el.setAttribute('stroke-width', '2.2');
    });
}

function getBranchSubset(rootId, peopleMap, relationships, unionsList) {
    const keep = new Set([rootId]);
    // הורים של האדם
    relationships.forEach(r => { if (r.child_id === rootId) keep.add(r.parent_id); });
    // בני זוג של האדם
    unionsList.forEach(u => {
        if (u.partner_1_id === rootId) keep.add(u.partner_2_id);
        if (u.partner_2_id === rootId) keep.add(u.partner_1_id);
    });
    // כל הצאצאים ובני זוגם כלפי מטה
    let added = true;
    while (added) {
        added = false;
        relationships.forEach(r => {
            if (keep.has(r.parent_id) && !keep.has(r.child_id)) { keep.add(r.child_id); added = true; }
        });
        unionsList.forEach(u => {
            if (keep.has(u.partner_1_id) && !keep.has(u.partner_2_id)) { keep.add(u.partner_2_id); added = true; }
            if (keep.has(u.partner_2_id) && !keep.has(u.partner_1_id)) { keep.add(u.partner_1_id); added = true; }
        });
    }
    const subMap = {};
    keep.forEach(id => { if (peopleMap[id]) subMap[id] = peopleMap[id]; });
    return subMap;
}

function buildPersonCardHTML(p, x, y) {
    const isDeceased = p.is_living === false;
    let statusClass = '';
    if (isDeceased) {
        if (p.death_type === 'holocaust') statusClass = 'holocaust';
        else if (p.death_type === 'idf') statusClass = 'idf';
        else statusClass = 'deceased';
    }
    const focusRing = p.person_id === focusedPersonId ? 'outline: 3px solid #d97706;' : '';
    return '<div onmouseenter="highlightConnections(\'' + p.person_id + '\')" onmouseleave="clearHighlights()" onclick="showPersonDetails(\'' + p.person_id + '\')" oncontextmenu="openContextMenu(event, \'' + p.person_id + '\')" class="node-card ' + (p.gender === 'female' ? 'female' : '') + ' ' + statusClass + '" style="left:' + x + 'px; top:' + y + 'px;' + focusRing + '">' +
        '<div class="node-name">' + formatFullName(p) + '</div></div>';
}

function drawExactTree(allPeopleMap, relationships, unionsList) {
    const peopleMap = (focusedPersonId && allPeopleMap[focusedPersonId])
        ? getBranchSubset(focusedPersonId, allPeopleMap, relationships, unionsList)
        : allPeopleMap;

    const people = Object.values(peopleMap);
    if (people.length === 0) return '<p style="direction:rtl;">אין אנשים להצגה.</p>';

    const gen = {};
    people.forEach(p => gen[p.person_id] = 0);
    for (let step = 0; step < people.length + 2; step++) {
        relationships.forEach(r => {
            if (gen[r.parent_id] !== undefined && gen[r.child_id] !== undefined && gen[r.child_id] <= gen[r.parent_id]) {
                gen[r.child_id] = gen[r.parent_id] + 1;
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
        if (!peopleMap[r.parent_id] || !peopleMap[r.child_id]) return;
        if (!parentsByChild[r.child_id]) parentsByChild[r.child_id] = [];
        if (!parentsByChild[r.child_id].includes(r.parent_id)) parentsByChild[r.child_id].push(r.parent_id);
    });

    const cardW = 165, cardH = 58, gapX = 75, gapY = 105;
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
            return unionsList.filter(u => u.partner_1_id === b || u.partner_2_id === b).length - unionsList.filter(u => u.partner_1_id === a || u.partner_2_id === a).length;
        });

        sortedIds.forEach(id => {
            if (globalPlaced.has(id)) return;
            const myUnions = unionsList.filter(u => (u.partner_1_id === id || u.partner_2_id === id) && peopleMap[u.partner_1_id] && peopleMap[u.partner_2_id]);
            const divorced = [...new Set(myUnions.filter(u => u.union_status === 'divorced').map(u => u.partner_1_id === id ? u.partner_2_id : u.partner_1_id))];
            const married = [...new Set(myUnions.filter(u => u.union_status !== 'divorced').map(u => u.partner_1_id === id ? u.partner_2_id : u.partner_1_id))];
            divorced.forEach(did => { if (ids.includes(did) && !globalPlaced.has(did)) { ordered.push(did); globalPlaced.add(did); } });
            if (!globalPlaced.has(id)) { ordered.push(id); globalPlaced.add(id); }
            married.forEach(mid => { if (ids.includes(mid) && !globalPlaced.has(mid)) { ordered.push(mid); globalPlaced.add(mid); } });
        });

        const rowW = ordered.length * cardW + (ordered.length - 1) * gapX;
        if (rowW + 80 > maxW) maxW = rowW + 80;
        ordered.forEach((id, idx) => { pos[id] = { x: 40 + idx * (cardW + gapX), y: 20 + g * (cardH + gapY), rowW }; });
    });

    Object.values(pos).forEach(p => { p.x += (maxW - p.rowW - 80) / 2; });
    const totalH = (Object.keys(byGen).length) * (cardH + gapY) + 40;
    let svg = '<svg class="svg-lines" width="' + maxW + '" height="' + totalH + '" style="z-index:1;">';

    unionsList.forEach(u => {
        const p1 = pos[u.partner_1_id], p2 = pos[u.partner_2_id];
        if (!p1 || !p2) return;
        const left = p1.x < p2.x ? p1 : p2, right = p1.x < p2.x ? p2 : p1;
        const x1 = left.x + cardW, x2 = right.x, y = left.y + cardH / 2;
        const nodesAttr = u.partner_1_id + ',' + u.partner_2_id;
        if (u.union_status === 'divorced') {
            svg += '<line class="tree-edge" data-nodes="' + nodesAttr + '" x1="' + (x1 + 6) + '" y1="' + y + '" x2="' + (x2 - 6) + '" y2="' + y + '" stroke="#000000" stroke-width="2.5" stroke-dasharray="6,6"/>';
        } else {
            svg += '<line class="tree-edge" data-nodes="' + nodesAttr + '" x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="#000000" stroke-width="2.5"/>';
            svg += '<text x="' + ((x1 + x2) / 2) + '" y="' + (y - 8) + '" text-anchor="middle" font-size="15">💍</text>';
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

    const branchColors = ['#1d4ed8', '#047857', '#b45309', '#6d28d9', '#be123c', '#0f766e'];
    Object.values(familyGroups).forEach((group, idx) => {
        const color = branchColors[idx % branchColors.length];
        const pIds = group.pIds;
        let startX, startY;
        if (pIds.length >= 2) {
            const p1 = pos[pIds.at(0)], p2 = pos[pIds.at(1)];
            startX = (p1.x + p2.x + cardW) / 2; startY = p1.y + cardH / 2;
        } else {
            const p1 = pos[pIds.at(0)];
            startX = p1.x + cardW / 2; startY = p1.y + cardH;
        }

        // נתיב גובה ייחודי לכל משפחה (laneY) למניעת התמזגות קווים
        const baseTop = (pIds.length >= 2 ? (pos[pIds.at(0)].y + cardH) : startY) + 12;
        const laneY = baseTop + (idx % 6) * 11;
        const allNodes = [...pIds, ...group.children].join(',');

        svg += '<line class="tree-edge" data-nodes="' + allNodes + '" x1="' + startX + '" y1="' + startY + '" x2="' + startX + '" y2="' + laneY + '" stroke="' + color + '" stroke-width="2.2" opacity="0.85"/>';
        svg += '<circle cx="' + startX + '" cy="' + laneY + '" r="3.5" fill="' + color + '"/>';

        group.children.forEach(childId => {
            const cPos = pos[childId], endX = cPos.x + cardW / 2, endY = cPos.y;
            const edgeNodes = [...pIds, childId].join(',');
            svg += '<path class="tree-edge" data-nodes="' + edgeNodes + '" d="M ' + startX + ' ' + laneY + ' L ' + endX + ' ' + laneY + ' L ' + endX + ' ' + endY + '" fill="none" stroke="' + color + '" stroke-width="2.2" opacity="0.85"/>';
        });
    });

    svg += '</svg>';
    return '<div class="svg-board" style="width:' + maxW + 'px; height:' + totalH + 'px;">' + svg + people.filter(p => pos[p.person_id]).map(p => buildPersonCardHTML(p, pos[p.person_id].x, pos[p.person_id].y)).join('') + '</div>';
}
