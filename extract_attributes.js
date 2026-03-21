const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = path.resolve('c:/Users/WooW Estudios/Documents/Antigravity/Asesoria WooW Estudios/Sexionario_con_marketing.xlsx');
const outputPath = path.resolve('c:/Users/WooW Estudios/Documents/Antigravity/Asesoria WooW Estudios/stitch_registro_de_modelo/nextjs-manual/src/data/attributes.json');

try {
  console.log('Reading from:', excelPath);
  if (!fs.existsSync(excelPath)) {
    console.error('File does not exist!');
    process.exit(1);
  }
  
  const workbook = xlsx.readFile(excelPath);
  const sheetName = 'Atributos fisicos';
  const worksheet = workbook.Sheets[sheetName];
  
  if (!worksheet) {
    console.error(`Sheet "${sheetName}" not found.`);
    process.exit(1);
  }

  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  const attributes = data.map(row => {
    if (!row || row.length === 0) return null;
    const category = row[0] ? row[0].toString().trim() : '';
    const options = row.slice(1)
      .map(opt => opt ? opt.toString().trim() : '')
      .filter(opt => opt !== '');
    
    if (category === '' || options.length === 0) return null;
    
    return { category, options };
  }).filter(item => item !== null);

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(attributes, null, 2));
  console.log(`Attributes data extracted successfully to ${outputPath}`);
} catch (error) {
  console.error('Error processing attributes:', error);
}
