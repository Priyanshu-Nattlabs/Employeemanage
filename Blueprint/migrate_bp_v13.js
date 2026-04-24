const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('BP content.xlsx');

const TASK1_SHEET = 'Education Streams - Task 1';
const TASK2_SHEET = 'Roles-Industry Mapping - Task 2';
const TASK3_SHEET = 'JD, Role Detail - Task 3';
const TASK4_SHEET = 'List of Skills, Level - Task 4';

function getSheetData(n) { const s = workbook.Sheets[n]; return s ? XLSX.utils.sheet_to_json(s, { header: 1 }) : []; }

// UPDATED NORMALIZE: Replaces slashes with spaces
function normalize(n) {
    return n ? n.toString().replace(/\//g, ' ').trim().replace(/\s+/g, ' ') : "";
}

function getCleanKey(name) {
    if (!name) return "";
    let n = normalize(name).toLowerCase().replace(/[^a-z0-9]/g, '');
    const bridges = {
        "medicalsupritendents": "medicalofficer",
        "academicresearch": "academicresearcher",
        "academicandresearch": "academicresearcher",
        "professor": "academicresearcher",
        "qualitycontroller": "qualitycontrolengineer",
        "datascientistanalyst": "datascientist",
        "laboratorytechnician": "labtechnician",
        "knitweardesigne": "knitweardesigner",
        "broadcastproduce": "broadcastproducer",
        "machinelearningmlengineer": "machinelearningengineer",
        "diagnosticlabtechnician": "diagnosticlabtechnician",
        "diagnostictechnologist": "diagnostictechnologist",
        "semiconductortechnologist": "semiconductortechnologist",
        "textiletechnologist": "textiletechnologist",
        "agronomist": "agronomist"
    };
    return bridges[n] || n;
}

function parseDuration(val) {
    if (!val) return 0;
    const s = val.toString().toLowerCase();
    const rangeMatch = s.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (rangeMatch) return Math.ceil((parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2);
    const m = s.match(/(\d+(\.\d+)?)/);
    return m ? Math.ceil(parseFloat(m[1])) : 0;
}

const t1 = getSheetData(TASK1_SHEET), t2 = getSheetData(TASK2_SHEET), t3 = getSheetData(TASK3_SHEET), t4 = getSheetData(TASK4_SHEET);

const blueprints = new Map();

function getRoleBP(n) {
    const norm = normalize(n); if (!norm) return null;
    if (!blueprints.has(norm)) {
        blueprints.set(norm, { name: norm, type: 'role', description: '', category: 'Role', isActive: 'true', industries: new Set(), educations: new Set(), specializations: new Set(), keyResponsibilities: '', expectedSalary: '' });
    }
    return blueprints.get(norm);
}

// Pass 1: Discover ALL Roles from T1, T2, T3
for (let i = 2; i < t2.length; i++) if (t2[i][1]) getRoleBP(t2[i][1]);
for (let i = 1; i < t1.length; i++) {
    for (let j = 4; j < t1[i].length; j++) if (t1[i][j]) getRoleBP(t1[i][j]);
}
for (let i = 3; i < t3.length; i++) if (t3[i][1]) getRoleBP(t3[i][1]);

// Pass 2: Map industries & details
const indHeaders = t2[1], industriesMap = new Map();
// UPDATE: Added educations Set to Industry entry
for (let i = 2; i < t2.length; i++) {
    const rn = normalize(t2[i][1]); if (!rn) continue;
    const bp = getRoleBP(rn); bp.expectedSalary = (t2[i][2] || "").toString();
    for (let j = 3; j < t2[i].length; j++) {
        const iname = normalize(indHeaders[j]); if (!iname) continue;
        if (normalize(t2[i][j]).toLowerCase() !== 'no') {
            bp.industries.add(iname);
            if (!industriesMap.has(iname)) industriesMap.set(iname, { name: iname, type: 'industry', description: `Industry: ${iname}`, roles: new Set(), educations: new Set() });
            industriesMap.get(iname).roles.add(rn);
        }
    }
}

// Pass 3: Map Educations & Specializations
const eduMap = new Map(), specMap = new Map();
for (let i = 1; i < t1.length; i++) {
    const cat = normalize(t1[i][1]), deg = normalize(t1[i][2]), sp = normalize(t1[i][3]); if (!deg) continue;
    if (!eduMap.has(deg)) eduMap.set(deg, { name: deg, type: 'education', description: cat, roles: new Set(), industries: new Set(), specializations: new Set() });
    const eEntry = eduMap.get(deg);
    for (let j = 4; j < t1[i].length; j++) {
        const rn = normalize(t1[i][j]); if (!rn) continue;
        const bp = getRoleBP(rn); bp.educations.add(deg); eEntry.roles.add(rn);
        bp.industries.forEach(ind => {
            eEntry.industries.add(ind);
            // UPDATE: Add Education to Industry's list (Bi-directional)
            if (industriesMap.has(ind)) {
                industriesMap.get(ind).educations.add(deg);
            }
        });
        if (sp) {
            eEntry.specializations.add(sp); bp.specializations.add(sp);
            if (!specMap.has(sp)) specMap.set(sp, { name: sp, type: 'specialization', description: `Specialization: ${sp}`, category: cat, roles: new Set(), industries: new Set() });
            const sEntry = specMap.get(sp); sEntry.roles.add(rn);
            bp.industries.forEach(ind => sEntry.industries.add(ind));
        }
    }
}

// Pass 4: Skills & JDs
const skillDur = new Map();
for (let i = 2; i < t4.length; i++) if (t4[i][1]) skillDur.set(normalize(t4[i][1]), { b: parseDuration(t4[i][2]), i: parseDuration(t4[i][3]), a: parseDuration(t4[i][4]) });
function getD(s, l) {
    const e = skillDur.get(s); if (!e) return 0;
    const lv = (l || 'i').toLowerCase();
    if (lv.includes('begin')) return e.b || e.i || e.a; if (lv.includes('inter')) return e.i || e.a || e.b; if (lv.includes('advanc')) return e.a || e.i || e.b;
    return e.i || 0;
}

const skillsArr = []; let cKey = null;
for (let i = 3; i < t3.length; i++) {
    if (t3[i][1] && normalize(t3[i][1]) !== "" && normalize(t3[i][1]).toLowerCase() !== 'role') cKey = getCleanKey(t3[i][1]);
    if (!cKey) continue;
    const tgts = Array.from(blueprints.values()).filter(bp => getCleanKey(bp.name) === cKey);
    tgts.forEach(bp => {
        if (t3[i][8]) bp.description = normalize(t3[i][8]);
        if (t3[i][9]) {
            const items = normalize(t3[i][9]).split(/[\n,]+/).map(normalize).filter(x => x);
            const cr = bp.keyResponsibilities ? bp.keyResponsibilities.split(', ') : [];
            items.forEach(it => { if (!cr.includes(it)) cr.push(it); }); bp.keyResponsibilities = cr.join(', ');
        }
        const ps = (n, l, p, ty) => {
            if (!n) return; const nn = normalize(n);
            skillsArr.push({ blueprintName: bp.name, skillName: nn, type: ty, time: getD(nn, l), difficulty: l ? l.toLowerCase() : 'intermediate', importance: p || 'Essential', description: `Required ${ty} skill`, prerequisites: '', isOptional: 'false' });
        };
        ps(t3[i][2], t3[i][3], t3[i][4], 'technical'); ps(t3[i][5], t3[i][6], t3[i][7], 'soft');
    });
}

const wb = XLSX.utils.book_new();
const addS = (n, h, d) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([h, ...d]), n);
addS("Roles", ["Name", "Type", "Description", "Category", "IsActive", "Expected Salary", "Key Responsibilities (comma-separated)", "Industries (comma-separated)", "Educations (comma-separated)", "Specializations (comma-separated)"], Array.from(blueprints.values()).map(bp => [bp.name, 'role', bp.description, bp.category, bp.isActive, bp.expectedSalary, bp.keyResponsibilities, Array.from(bp.industries).join(', '), Array.from(bp.educations).join(', '), Array.from(bp.specializations).join(', ')]));
// UPDATE: Added "Educations (comma-separated)" to Industries sheet
addS("Industries", ["Name", "Type", "Description", "Roles (comma-separated)", "Educations (comma-separated)"], Array.from(industriesMap.values()).map(ind => [ind.name, 'industry', ind.description, Array.from(ind.roles).join(', '), Array.from(ind.educations).join(', ')]));
addS("Educations", ["Name", "Type", "Description", "Specializations (comma-separated)", "Roles (comma-separated)", "Industries (comma-separated)"], Array.from(eduMap.values()).map(edu => [edu.name, 'education', edu.description, Array.from(edu.specializations).join(', '), Array.from(edu.roles).join(', '), Array.from(edu.industries).join(', ')]));
addS("Specializations", ["Name", "Type", "Description", "Category", "Roles (comma-separated)", "Industries (comma-separated)"], Array.from(specMap.values()).map(spec => [spec.name, 'specialization', spec.description, spec.category, Array.from(spec.roles).join(', '), Array.from(spec.industries).join(', ')]));
addS("Skills", ["Blueprint Name", "Skill Name", "Type", "Time (Months)", "Difficulty", "Importance", "Description", "Prerequisites (comma-separated)", "Is Optional"], skillsArr.map(s => [s.blueprintName, s.skillName, s.type, s.time, s.difficulty, s.importance, s.description, s.prerequisites, s.isOptional]));
XLSX.writeFile(wb, 'Job_Blueprint_Final_Phase13.xlsx');
console.log('Final Phase 13 Generated');
