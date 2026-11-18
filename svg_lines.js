function buildHorizontalWithHops(x1, x2, y, verticalSegments) {
    if (Math.abs(x1 - x2) < 1) return 'M ' + x1 + ' ' + y + ' ';
    const dir = x2 > x1 ? 1 : -1;
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const r = 7;

    const crossings = verticalSegments
        .filter(v => v.x > minX + r && v.x < maxX - r && y > v.y1 && y < v.y2)
        .map(v => v.x)
        .sort((a, b) => dir === 1 ? a - b : b - a);

    let d = 'M ' + x1 + ' ' + y + ' ';
    crossings.forEach(cx => {
        d += 'L ' + (cx - dir * r) + ' ' + y + ' ';
        d += 'A ' + r + ' ' + r + ' 0 0 ' + (dir === 1 ? 1 : 0) + ' ' + (cx + dir * r) + ' ' + y + ' ';
    });
    d += 'L ' + x2 + ' ' + y + ' ';
    return d;
}

function renderTreeSvg(maxW, totalH, pos, cardW, cardH, unionsList, parentsByChild) {
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
    const groupsArr = Object.values(familyGroups);
    const verticalSegments = [];

    groupsArr.forEach((group, idx) => {
        const pIds = group.pIds;
        let startX, startY;
        if (pIds.length >= 2) {
            const p1 = pos[pIds.at(0)], p2 = pos[pIds.at(1)];
            startX = (p1.x + p2.x + cardW) / 2; startY = p1.y + cardH / 2;
        } else {
            const p1 = pos[pIds.at(0)];
            startX = p1.x + cardW / 2; startY = p1.y + cardH;
        }
        const baseTop = (pIds.length >= 2 ? (pos[pIds.at(0)].y + cardH) : startY) + 14;
        const laneY = baseTop + (idx % 6) * 13;
        group._geom = { startX, startY, laneY };
        verticalSegments.push({ x: startX, y1: startY, y2: laneY });
        group.children.forEach(childId => {
            const cPos = pos[childId];
            verticalSegments.push({ x: cPos.x + cardW / 2, y1: laneY, y2: cPos.y });
        });
    });

    groupsArr.forEach((group, idx) => {
        const color = branchColors[idx % branchColors.length];
        const { startX, startY, laneY } = group._geom;
        const pIds = group.pIds;
        const allNodes = [...pIds, ...group.children].join(',');

        svg += '<line class="tree-edge" data-nodes="' + allNodes + '" x1="' + startX + '" y1="' + startY + '" x2="' + startX + '" y2="' + laneY + '" stroke="' + color + '" stroke-width="2.2" opacity="0.9"/>';
        if (group.children.length > 1) {
            svg += '<circle class="tree-edge" data-nodes="' + allNodes + '" cx="' + startX + '" cy="' + laneY + '" r="4" fill="' + color + '"/>';
        }

        group.children.forEach(childId => {
            const cPos = pos[childId], endX = cPos.x + cardW / 2, endY = cPos.y;
            const edgeNodes = [...pIds, childId].join(',');
            const horizPath = buildHorizontalWithHops(startX, endX, laneY, verticalSegments);
            const fullPath = horizPath + 'L ' + endX + ' ' + (endY - 5);
            svg += '<path class="tree-edge" data-nodes="' + edgeNodes + '" d="' + fullPath + '" fill="none" stroke="' + color + '" stroke-width="2.2" opacity="0.9"/>';
            svg += '<polygon class="tree-edge" data-nodes="' + edgeNodes + '" points="' + endX + ',' + endY + ' ' + (endX - 4) + ',' + (endY - 6) + ' ' + (endX + 4) + ',' + (endY - 6) + '" fill="' + color + '" opacity="0.9"/>';
        });
    });

    return svg + '</svg>';
}
