const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = path.resolve('c:/Users/WooW Estudios/Documents/Antigravity/Asesoria WooW Estudios/Sexionario_con_marketing.xlsx');
const outputPath = path.resolve('c:/Users/WooW Estudios/Documents/Antigravity/Asesoria WooW Estudios/stitch_registro_de_modelo/nextjs-manual/src/data/outfits.json');

try {
  const workbook = xlsx.readFile(excelPath);
  const sheetName = 'Trajes';
  const worksheet = workbook.Sheets[sheetName];
  
  if (!worksheet) {
    console.error(`Sheet "${sheetName}" not found.`);
    process.exit(1);
  }

  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  // Clean outfits data
  // Column 1: Tipo, Column 2: Descripción
  const outfits = data.slice(1).map(row => ({
    name: row[1] ? row[1].toString().trim() : '',
    description: row[2] ? row[2].toString().trim() : ''
  })).filter(item => item.name);

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(outfits, null, 2));
  console.log(`Outfits data extracted to ${outputPath}`);
} catch (error) {
  console.error('Error processing outfits:', error);
}
