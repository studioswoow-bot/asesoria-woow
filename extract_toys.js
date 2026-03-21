const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = 'c:/Users/WooW Estudios/Documents/Antigravity/Asesoria WooW Estudios/Sexionario_con_marketing.xlsx';
const outputPath = 'c:/Users/WooW Estudios/Documents/Antigravity/Asesoria WooW Estudios/stitch_registro_de_modelo/nextjs-manual/src/data/toys.json';

try {
  const workbook = xlsx.readFile(excelPath);
  const sheetName = 'Juguetes';
  const worksheet = workbook.Sheets[sheetName];
  
  if (!worksheet) {
    console.error(`Sheet "${sheetName}" not found.`);
    process.exit(1);
  }

  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  // Clean toys data
  // Column 0: Name, Column 1: Use, Column 3: Category, Column 4: Brand
  const toys = data.slice(1).map(row => ({
    name: row[0] ? row[0].toString().trim() : '',
    use: row[1] ? row[1].toString().trim() : '',
    category: row[3] ? row[3].toString().trim() : '',
    brand: row[4] ? row[4].toString().trim() : 'Genérico'
  })).filter(item => item.name && item.use);

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(toys, null, 2));
  console.log(`Toys data extracted to ${outputPath}`);
} catch (error) {
  console.error('Error processing toys:', error);
}
