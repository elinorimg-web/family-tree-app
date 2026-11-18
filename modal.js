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
