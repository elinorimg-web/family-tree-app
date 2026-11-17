function openContextMenu(e, personId) {
    e.preventDefault();
    contextTargetPersonId = personId;
    const p = currentPeopleMap[personId];
    document.getElementById('ctxHeader').textContent = 'קרובים עבור: ' + (p ? p.first_name : '');
    const menu = document.getElementById('contextMenu');
    menu.style.display = 'block';
    menu.style.left = Math.min(e.clientX, window.innerWidth - 220) + 'px';
    menu.style.top = e.clientY + 'px';
}

function startRelativeAdd(relType) {
    const target = currentPeopleMap[contextTargetPersonId];
    if (!target) return;
    cancelEdit();
    pendingRelation = { type: relType, targetId: contextTargetPersonId };

    const sel = document.getElementById('existingPersonSelect');
    sel.innerHTML = '<option value="">-- בחרי אדם קיים מהאילן --</option>';
    Object.values(currentPeopleMap).forEach(p => {
        if (p.person_id !== contextTargetPersonId) {
            sel.innerHTML += '<option value="' + p.person_id + '">' + formatFullName(p) + '</option>';
        }
    });
    document.getElementById('existingPersonBox').style.display = 'block';

    if (['father', 'brother', 'son'].includes(relType)) document.getElementById('gender').value = 'male';
    else if (['mother', 'sister', 'daughter'].includes(relType)) document.getElementById('gender').value = 'female';
    else document.getElementById('gender').value = target.gender === 'male' ? 'female' : 'male';

    if (target.last_name && !['mother', 'spouse_married', 'spouse_divorced'].includes(relType)) {
        document.getElementById('lastName').value = target.last_name;
    }

    const labels = {
        spouse_married: '💍 הוספת/חיבור בן/בת זוג', spouse_divorced: '💔 הוספת/חיבור גרוש/ה',
        father: '👨 הוספת/חיבור אבא', mother: '👩 הוספת/חבר אמא',
        brother: '👦 הוספת/חבר אח', sister: '👧 הוספת/חבר אחות',
        son: '👶 הוספת/חבר בן', daughter: '👧 הוספת/חבר בת'
    };
    document.getElementById('formTitle').textContent = labels[relType] + ' עבור: ' + formatFullName(target);
    document.getElementById('btnAddPerson').textContent = '💾 שמור אדם חדש וחבר';
    document.getElementById('btnAddPerson').style.background = '#059669';
    document.getElementById('btnCancelEdit').style.display = 'inline-block';
    document.getElementById('personFormBox').scrollIntoView({ behavior: 'smooth' });
}

async function applyRelationBetween(relType, targetId, otherPersonId) {
    if (relType === 'father' || relType === 'mother') {
        await fetch('/api/trees/' + currentTreeId + '/relationships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_id: otherPersonId, child_id: targetId }) });
    } else if (relType === 'son' || relType === 'daughter') {
        await fetch('/api/trees/' + currentTreeId + '/relationships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_id: targetId, child_id: otherPersonId }) });
    } else if (relType === 'brother' || relType === 'sister') {
        const parents = currentRelationships.filter(r => r.child_id === targetId).map(r => r.parent_id);
        if (parents.length === 0) {
            alert('לאדם זה עדיין לא הוגדרו הורים, ולכן לא ניתן לקשר אחים אוטומטית.');
        } else if (parents.length === 1) {
            await fetch('/api/trees/' + currentTreeId + '/relationships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_id: parents.at(0), child_id: otherPersonId }) });
        } else {
            const p1 = currentPeopleMap[parents.at(0)];
            const p2 = currentPeopleMap[parents.at(1)];
            const choice = prompt(
                'למי מהורי ' + currentPeopleMap[targetId].first_name + ' לשייך את האח/ות החדשים?\n' +
                'הקלידי 1 עבור: ' + formatFullName(p1) + '\n' +
                'הקלידי 2 עבור: ' + formatFullName(p2) + '\n' +
                'הקלידי 3 עבור: שניהם (אחים מלאים)', '3'
            );
            let selectedParents = [];
            if (choice === '1') selectedParents = [parents.at(0)];
            else if (choice === '2') selectedParents = [parents.at(1)];
            else selectedParents = parents;

            for (const pid of selectedParents) {
                await fetch('/api/trees/' + currentTreeId + '/relationships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_id: pid, child_id: otherPersonId }) });
            }
        }
    } else if (relType === 'spouse_married' || relType === 'spouse_divorced') {
        const status = relType === 'spouse_divorced' ? 'divorced' : 'married';
        await fetch('/api/trees/' + currentTreeId + '/unions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partner_1_id: targetId, partner_2_id: otherPersonId, union_status: status }) });
    }
}

async function linkExistingPerson() {
    const existingId = document.getElementById('existingPersonSelect').value;
    if (!existingId || !pendingRelation) return alert('נא לבחור אדם מהרשימה');
    await applyRelationBetween(pendingRelation.type, pendingRelation.targetId, existingId);
    cancelEdit(); loadTreeData();
}

function openDisconnectModal() {
    const pid = contextTargetPersonId;
    const person = currentPeopleMap[pid];
    if (!person) return;
    document.getElementById('discTitle').textContent = '✂️ ניתוק קשרים עבור: ' + formatFullName(person);
    const list = document.getElementById('discList');
    list.innerHTML = '';

    const myUnions = currentUnions.filter(u => u.partner_1_id === pid || u.partner_2_id === pid);
    myUnions.forEach(u => {
        const otherId = u.partner_1_id === pid ? u.partner_2_id : u.partner_1_id;
        const other = currentPeopleMap[otherId];
        if (other) {
            list.innerHTML += '<div class="rel-row"><span>💍/💔 זוגיות עם: <strong>' + formatFullName(other) + '</strong></span>' +
                '<button type="button" onclick="removeUnion(' + u.union_id + ')" style="background:#dc2626; padding:4px 10px; font-size:12px;">נתק</button></div>';
        }
    });

    const myParents = currentRelationships.filter(r => r.child_id === pid);
    myParents.forEach(r => {
        const parent = currentPeopleMap[r.parent_id];
        if (parent) {
            list.innerHTML += '<div class="rel-row"><span>⬆️ הורה: <strong>' + formatFullName(parent) + '</strong></span>' +
                '<button type="button" onclick="removeRel(\'' + r.parent_id + '\', \'' + pid + '\')" style="background:#dc2626; padding:4px 10px; font-size:12px;">נתק</button></div>';
        }
    });

    const myChildren = currentRelationships.filter(r => r.parent_id === pid);
    myChildren.forEach(r => {
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
