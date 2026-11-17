function openContextMenu(e, personId) {
    e.preventDefault();
    contextTargetPersonId = personId;
    const p = currentPeopleMap[personId];
    document.getElementById('ctxHeader').textContent = 'קרובים עבור: ' + (p ? p.first_name : '');
    const menu = document.getElementById('contextMenu');
    menu.style.display = 'block';
    menu.style.left = Math.min(e.clientX, window.innerWidth - 210) + 'px';
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
        father: '👨 הוספת/חיבור אבא', mother: '👩 הוספת/חיבור אמא',
        brother: '👦 הוספת/חיבור אח', sister: '👧 הוספת/חיבור אחות',
        son: '👶 הוספת/חיבור בן', daughter: '👧 הוספת/חיבור בת'
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
        if (parents.length === 0) alert('לאדם זה עדיין לא הוגדרו הורים, ולכן לא ניתן לקשר אחים אוטומטית. הוסיפי הורה קודם.');
        for (const pid of parents) {
            await fetch('/api/trees/' + currentTreeId + '/relationships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_id: pid, child_id: otherPersonId }) });
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
