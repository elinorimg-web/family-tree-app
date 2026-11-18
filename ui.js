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
        el.style.opacity = linked.includes(personId) ? '1' : '0.1';
        if (linked.includes(personId)) el.setAttribute('stroke-width', '3.5');
    });
}

function clearHighlights() {
    document.querySelectorAll('.tree-edge').forEach(el => {
        el.style.opacity = '0.9';
        el.setAttribute('stroke-width', '2.2');
    });
}

function getBranchSubset(rootId, peopleMap, relationships, unionsList) {
    const keep = new Set([rootId]);
    relationships.forEach(r => { if (r.child_id === rootId) keep.add(r.parent_id); });
    unionsList.forEach(u => {
        if (u.partner_1_id === rootId) keep.add(u.partner_2_id);
        if (u.partner_2_id === rootId) keep.add(u.partner_1_id);
    });
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

function computeExactGenerations(people, relationships, unionsList) {
    const ids = new Set(people.map(p => p.person_id));
    const validRels = relationships.filter(r => ids.has(r.parent_id) && ids.has(r.child_id));
    const validUnions = unionsList.filter(u => ids.has(u.partner_1_id) && ids.has(u.partner_2_id));

    const gen = {};
    people.forEach(p => gen[p.person_id] = 0);

    // שלב 1: כל ילד חייב להיות לפחות דור אחד מתחת לכל הוריו
    for (let i = 0; i < people.length * 3; i++) {
        let changed = false;
        validRels.forEach(r => {
            if (gen[r.child_id] < gen[r.parent_id] + 1) {
                gen[r.child_id] = gen[r.parent_id] + 1;
                changed = true;
            }
        });
        validUnions.forEach(u => {
            const maxG = Math.max(gen[u.partner_1_id], gen[u.partner_2_id]);
            if (gen[u.partner_1_id] !== maxG || gen[u.partner_2_id] !== maxG) {
                gen[u.partner_1_id] = maxG;
                gen[u.partner_2_id] = maxG;
                changed = true;
            }
        });
        if (!changed) break;
    }

    // שלב 2: הורים ללא הורים משלהם מתמקמים בדיוק דור אחד מעל הילד הגבוה ביותר שלהם
    for (let i = 0; i < people.length * 2; i++) {
        let adjusted = false;
        people.forEach(p => {
            const pid = p.person_id;
            const hasParents = validRels.some(r => r.child_id === pid);
            if (hasParents) return;

            const childrenGens = validRels.filter(r => r.parent_id === pid).map(r => gen[r.child_id]);
            if (childrenGens.length > 0) {
                const targetParentGen = Math.min(...childrenGens) - 1;
                if (gen[pid] < targetParentGen) {
                    gen[pid] = targetParentGen;
                    adjusted = true;
                }
            }
        });
        validUnions.forEach(u => {
            const maxG = Math.max(gen[u.partner_1_id], gen[u.partner_2_id]);
            if (gen[u.partner_1_id] !== maxG || gen[u.partner_2_id] !== maxG) {
                gen[u.partner_1_id] = maxG;
                gen[u.partner_2_id] = maxG;
                adjusted = true;
            }
        });
        // וידוא שאחרי יישור בני זוג, אף ילד לא נשאר באותו דור כמו הורהו
        validRels.forEach(r => {
            if (gen[r.child_id] < gen[r.parent_id] + 1) {
                gen[r.child_id] = gen[r.parent_id] + 1;
                adjusted = true;
            }
        });
        if (!adjusted) break;
    }

    const minG = Math.min(...Object.values(gen));
    Object.keys(gen).forEach(id => { gen[id] -= minG; });
    return gen;
}

function drawExactTree(allPeopleMap, relationships, unionsList) {
    const peopleMap = (focusedPersonId && allPeopleMap[focusedPersonId])
        ? getBranchSubset(focusedPersonId, allPeopleMap, relationships, unionsList)
        : allPeopleMap;

    const people = Object.values(peopleMap);
    if (people.length === 0) return '<p style="direction:rtl;">אין אנשים להצגה.</p>';

    const gen = computeExactGenerations(people, relationships, unionsList);
    const byGen = {};
    people.forEach(p => { const g = gen[p.person_id]; if (!byGen[g]) byGen[g] = []; byGen[g].push(p.person_id); });

    const parentsByChild = {};
    relationships.forEach(r => {
        if (!peopleMap[r.parent_id] || !peopleMap[r.child_id]) return;
        if (!parentsByChild[r.child_id]) parentsByChild[r.child_id] = [];
        if (!parentsByChild[r.child_id].includes(r.parent_id)) parentsByChild[r.child_id].push(r.parent_id);
    });

    const cardW = 165, cardH = 58, gapX = 75, rowStepY = 185, labelW = 95;
    const pos = {};
    let maxW = 720;
    const globalPlaced = new Set();

    function getAnchorX(childId) {
        const pIds = (parentsByChild[childId] || []).filter(pid => pos[pid]);
        if (pIds.length === 0) return 999999;
        if (pIds.length >= 2) return (pos[pIds.at(0)].x + pos[pIds.at(1)].x + cardW) / 2;
        return pos[pIds.at(0)].x + cardW / 2;
    }

    const genKeys = Object.keys(byGen).map(Number).sort((a, b) => a - b);

    genKeys.forEach((g, rowIdx) => {
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
        if (rowW + labelW + 100 > maxW) maxW = rowW + labelW + 100;
        ordered.forEach((id, idx) => {
            pos[id] = { x: 40 + idx * (cardW + gapX), y: 24 + rowIdx * rowStepY, rowW };
        });
    });

    const contentAreaW = maxW - labelW - 40;
    Object.values(pos).forEach(p => { p.x += (contentAreaW - p.rowW) / 2; });
    const totalH = genKeys.length * rowStepY + 20;

    let bandsHtml = '';
    genKeys.forEach((g, rowIdx) => {
        const bandTop = rowIdx * rowStepY;
        const bg = rowIdx % 2 === 0 ? '#f8fafc' : '#ffffff';
        bandsHtml += '<div class="gen-band" style="top:' + bandTop + 'px; height:' + rowStepY + 'px; width:' + maxW + 'px; background:' + bg + ';">' +
            '<div class="gen-label">דור ' + (rowIdx + 1) + '</div>' +
        '</div>';
    });

    const svg = renderTreeSvg(maxW, totalH, pos, cardW, cardH, unionsList, parentsByChild);
    const cardsHtml = people.filter(p => pos[p.person_id]).map(p => buildPersonCardHTML(p, pos[p.person_id].x, pos[p.person_id].y)).join('');
    return '<div class="svg-board" style="width:' + maxW + 'px; height:' + totalH + 'px;">' + bandsHtml + svg + cardsHtml + '</div>';
}
