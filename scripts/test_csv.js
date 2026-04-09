const fs = require('fs');
const xlsx = require('xlsx');

const filePath = 'c:\\Users\\WooW Estudios\\Documents\\Antigravity\\Asesoria WooW Estudios\\natalia_kiss01_2026-01-01_to_2026-02-28.csv';
const buffer = fs.readFileSync(filePath);

const workbook = xlsx.read(buffer, { type: 'buffer' });
const sheetName = workbook.SheetNames[0];
const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

console.log("Testing with first row...");
const row = rawData[0];
console.dir(row);

const tokens = Math.abs(Number(row["Token change"] || row["Fichas"] || 0));
const rawUser = row["User"] || row["tipper"] || row["Usuario"] || "Unknown";
const username = rawUser.replace(/\u00A0/g, '').trim(); 
const rawTimestamp = row["Timestamp"] || row["timestamp"] || row["Fecha"];

let hour = null;
if (typeof rawTimestamp === "string") {
  const timePart = rawTimestamp.includes(" ") ? rawTimestamp.split(" ")[1] : rawTimestamp;
  if (timePart && timePart.includes(":")) {
     hour = timePart.split(":")[0].padStart(2, "0");
  }
} else if (typeof rawTimestamp === "number") {
   const fraction = rawTimestamp % 1;
   const totalSeconds = Math.round(fraction * 24 * 60 * 60);
   hour = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
}

console.log(`Tokens: ${tokens}`);
console.log(`Username: '${username}'`);
console.log(`Hour: ${hour}`);
