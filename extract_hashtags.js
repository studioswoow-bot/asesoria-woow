const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = path.resolve('c:/Users/WooW Estudios/Documents/Antigravity/Asesoria WooW Estudios/Sexionario_con_marketing.xlsx');
const outputPath = path.resolve('c:/Users/WooW Estudios/Documents/Antigravity/Asesoria WooW Estudios/stitch_registro_de_modelo/nextjs-manual/src/data/hashtags.json');

try {
  const workbook = xlsx.readFile(excelPath);
  const sheetName = '#Hashtag';
  const worksheet = workbook.Sheets[sheetName];
  
  if (!worksheet) {
    console.error(`Sheet "${sheetName}" not found.`);
    process.exit(1);
  }

  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  
  // Looking at the data pattern: Column 0 is hashtag, Column 1 is Description
  const hashtags = data.slice(1)
    .filter(row => {
        const val = row[0] ? row[0].toString().trim() : '';
        if (!val) return false;
        if (['#Hashtag', '#Descripción', '#Espectadores', '#Rango', '#Recomendado Colombia'].includes(val)) return false;
        if (val.match(/^#\d+$/)) return false; 
        if (val === '#⭐⭐⭐⭐⭐') return false;
        return true;
    })
    .map(row => {
        let tag = row[0].toString().trim();
        tag = tag.startsWith('#') ? tag : '#' + tag;
        const description = row[1] ? row[1].toString().trim().replace(/^#/, '') : 'Sin descripción disponible';
        return { tag, description };
    });

  // Get unique by tag name
  const uniqueHashtags = [];
  const seen = new Set();
  hashtags.forEach(h => {
    if (!seen.has(h.tag)) {
        seen.add(h.tag);
        uniqueHashtags.push(h);
    }
  });

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(uniqueHashtags, null, 2));
  console.log(`Hashtags with descriptions extracted successfully to ${outputPath}`);
} catch (error) {
  console.error('Error processing hashtags:', error);
}
