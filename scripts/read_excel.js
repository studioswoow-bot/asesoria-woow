const xlsx = require('xlsx');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.error("Please provide a file path");
  process.exit(1);
}

try {
  const workbook = xlsx.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  console.log("Sheets:", sheetNames);
  
  sheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    console.log(JSON.stringify(data.slice(0, 10), null, 2)); // Show first 10 rows
  });
} catch (err) {
  console.error("Error reading Excel:", err.message);
}
