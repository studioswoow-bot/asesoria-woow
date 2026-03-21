const xlsx = require('xlsx');
const fs = require('fs');

const excelPath = 'c:/Users/WooW Estudios/Documents/Antigravity/Asesoria WooW Estudios/Sexionario_con_marketing.xlsx';

try {
  const workbook = xlsx.readFile(excelPath);
  const sheetName = 'Juguetes';
  const worksheet = workbook.Sheets[sheetName];
  
  if (!worksheet) {
    console.error(`Sheet "${sheetName}" not found.`);
    process.exit(1);
  }

  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  console.log('Sample Data from Juguetes Sheet:');
  data.slice(0, 5).forEach((row, i) => console.log(`Row ${i}:`, row));
} catch (error) {
  console.error('Error:', error);
}
