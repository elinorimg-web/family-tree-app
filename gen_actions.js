async function shiftAllDownExcept(topPersonId) {
    const allPeople = Object.values(currentPeopleMap);
    for (const other of allPeople) {
        if (other.person_id === topPersonId) continue;
        const otherG = lastComputedGen[other.person_id] !== undefined ? lastComputedGen[other.person_id] : 0;
        await fetch('/api/individuals/' + other.person_id + '/gen', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manual_gen: otherG + 1 })
        });
    }
    if (topPersonId) {
        await fetch('/api/individuals/' + topPersonId + '/gen', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manual_gen: 0 })
        });
    }
}

async function movePersonGeneration(delta) {
    const pid = contextTargetPersonId;
    if (!currentPeopleMap[pid]) return;

    if (delta === 0) {
        await fetch('/api/individuals/' + pid + '/gen', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manual_gen: null })
        });
        loadTreeData();
        return;
    }

    const currentGen = lastComputedGen[pid] !== undefined ? lastComputedGen[pid] : 0;
    if (delta < 0 && currentGen === 0) {
        await shiftAllDownExcept(pid);
        loadTreeData();
        return;
    }

    await fetch('/api/individuals/' + pid + '/gen', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual_gen: Math.max(0, currentGen + delta) })
    });
    loadTreeData();
}

async function setDirectGeneration(pid, val) {
    await fetch('/api/individuals/' + pid + '/gen', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual_gen: val === '' ? null : Number(val) })
    });
    document.getElementById('bioModal').style.display = 'none';
    loadTreeData();
}

function openDisconnectModal() {
    const pid = contextTargetPersonId;
    const person = currentPeopleMap[pid];
    if (!person) return;
    document.getElementById('discTitle').textContent = '✂️ ניתוק קשרים עבור: ' + formatFullName(person);
    const list = document.getElementById('discList');
    list.innerHTML = '';

    currentUnions.filter(u => u.partner_1_id === pid || u.partner_2_id === pid).forEach(u => {
        const otherId = u.partner_1_id === pid ? u.partner_2_id : u.partner_1_id;
        const other = currentPeopleMap[otherId];
        if (other) {
            list.innerHTML += '<div class="rel-row"><span>💍/💔 זוגיות עם: <strong>' + formatFullName(other) + '</strong></span>' +
                '<button type="button" onclick="removeUnion(' + u.union_id + ')" style="background:#dc2626; padding:4px 10px; font-size:12px;">נתק</button></div>';
        }
    });

    currentRelationships.filter(r => r.child_id === pid).forEach(r => {
        const parent = currentPeopleMap[r.parent_id];
        if (parent) {
            list.innerHTML += '<div class="rel-row"><span>⬆️ הורה: <strong>' + formatFullName(parent) + '</strong></span>' +
                '<button type="button" onclick="removeRel(\'' + r.parent_id + '\', \'' + pid + '\')" style="background:#dc2626; padding:4px 10px; font-size:12px;">נתק</button></div>';
        }
    });

    currentRelationships.filter(r => r.parent_id === pid).forEach(r => {
        const child = currentPeopleMap[r.child_id];
        if (child) {
            list.innerHTML += '<div class="rel-row"><span>⬇️ ילד/ה: <strong>' + formatFullName(child) + '</strong></span>' +
                '<button type="button" onclick="removeRel(\'' + pid + '\', \'' + r.child_id + '\')" style="background:#dc2626; padding:4px 10px; font-size:12px;">נתק</button></div>';
        }
    });

    if (!list.innerHTML) list.innerHTML = '<p>אין קשרים מחוברים לאדם זה.</p>';
    document.getElementById('disconnectModal').style.display = 'flex';
}

async function removeUnion(unionId) {
    await fetch('/api/unions/' + unionId, { method: 'DELETE' });
    document.getElementById('disconnectModal').style.display = 'none';
    loadTreeData();
}

async function removeRel(parentId, childId) {
    await fetch('/api/trees/' + currentTreeId + '/relationships', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_id: parentId, child_id: childId })
    });
    document.getElementById('disconnectModal').style.display = 'none';
    loadTreeData();
}
