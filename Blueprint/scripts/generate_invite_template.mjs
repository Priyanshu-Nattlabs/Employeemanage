import * as XLSX from "xlsx";

/**
 * Generates `Employee_Invite_Template.xlsx` compatible with backend parser:
 * - Email (required)
 * - Name (required)
 * - Department (required only when HR uploads)
 */
const OUT = "Employee_Invite_Template.xlsx";

const rows = [
  ["Employee Invite Template"],
  ["Fill rows below, then upload in Manager portal → Invite employees from Excel."],
  [],
  ["Email", "Name", "Department"],
  ["alice@yourcompany.com", "Alice Sharma", "Software"],
  ["bob@yourcompany.com", "Bob Singh", "Software"],
];

const ws = XLSX.utils.aoa_to_sheet(rows);
ws["!cols"] = [{ wch: 34 }, { wch: 24 }, { wch: 20 }];
ws["!merges"] = [
  { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, // A1:C1
  { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, // A2:C2
];

const notesRows = [
  ["Column rules"],
  [],
  ["Email", "Required. Must be a company email ending with the same domain as the logged-in Manager/HR."],
  ["Name", "Required. Employee full name."],
  ["Department", "Required ONLY when HR uploads. For Managers, department is taken from the manager profile."],
];
const notes = XLSX.utils.aoa_to_sheet(notesRows);
notes["!cols"] = [{ wch: 16 }, { wch: 90 }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Invite Employees");
XLSX.utils.book_append_sheet(wb, notes, "Notes");
XLSX.writeFile(wb, OUT);

console.log(OUT);

