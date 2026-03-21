const xlsx = require('xlsx');

const excelPath = 'c:/Users/WooW Estudios/Documents/Antigravity/Asesoria WooW Estudios/Sexionario_con_marketing.xlsx';

try {
  const workbook = xlsx.readFile(excelPath);
  const sheetName = 'Atributos fisicos';
  const worksheet = workbook.Sheets[sheetName];
  
  if (!worksheet) {
    console.error(`Sheet "${sheetName}" not found.`);
    // List available sheets just in case names differ slightly
    console.log('Available sheets:', workbook.SheetNames);
    process.exit(1);
  }

  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  console.log('Sample Data from atributos fisicos Sheet:');
  data.slice(0, 10).forEach((row, i) => console.log(`Row ${i}:`, row));
} catch (error) {
  console.error('Error:', error);
}
