let lastComputedGen = {};

function computeExactGenerations(people, relationships, unionsList) {
    const ids = new Set(people.map(p => p.person_id));
    const validRels = relationships.filter(r => ids.has(r.parent_id) && ids.has(r.child_id));
    const validUnions = unionsList.filter(u => ids.has(u.partner_1_id) && ids.has(u.partner_2_id));

    const gen = {};
    people.forEach(p => gen[p.person_id] = 0);

    for (let i = 0; i < people.length * 4; i++) {
        let changed = false;
        validRels.forEach(r => {
            if (gen[r.child_id] <= gen[r.parent_id]) {
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

    for (let i = 0; i < people.length * 2; i++) {
        let pulled = false;
        people.forEach(p => {
            const pid = p.person_id;
            const hasParents = validRels.some(r => r.child_id === pid);
            if (hasParents) return;

            const myKids = validRels.filter(r => r.parent_id === pid).map(r => r.child_id);
            if (myKids.length > 0) {
                const targetG = Math.min(...myKids.map(cid => gen[cid])) - 1;
                if (gen[pid] < targetG) {
                    gen[pid] = targetG;
                    pulled = true;
                }
            }
        });
        validUnions.forEach(u => {
            const maxG = Math.max(gen[u.partner_1_id], gen[u.partner_2_id]);
            if (gen[u.partner_1_id] !== maxG || gen[u.partner_2_id] !== maxG) {
                gen[u.partner_1_id] = maxG;
                gen[u.partner_2_id] = maxG;
            }
        });
        if (!pulled) break;
    }

    const minAutoG = Math.min(...Object.values(gen));
    Object.keys(gen).forEach(id => { gen[id] -= minAutoG; });

    // החלת דור ידני קבוע ללא הזזת שאר האילן
    people.forEach(p => {
        if (p.manual_gen !== null && p.manual_gen !== undefined) {
            gen[p.person_id] = Math.max(0, Number(p.manual_gen));
        }
    });

    lastComputedGen = { ...gen };
    return gen;
}
