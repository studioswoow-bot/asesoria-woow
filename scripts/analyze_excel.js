const xlsx = require('xlsx');
const fs = require('fs');

const fileName = process.argv[2];
if (!fileName) {
  console.error("Please provide a file name");
  process.exit(1);
}

try {
  const workbook = xlsx.readFile(fileName);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  // Clean data: only rows with 'Fecha' or rows that look like chat but belong to a transaction
  // Actually, we want to summarize: 
  // 1. Total tokens
  // 2. Top tippers
  // 3. Peak hours
  // 4. Activity types (Tipping vs Private)
  
  let totalTokens = 0;
  const tippers = {};
  const hours = {};
  const types = {};
  
  data.forEach(row => {
    if (row.Fichas && typeof row.Fichas === 'number') {
      const tokens = row.Fichas;
      if (tokens > 0) {
        totalTokens += tokens;
        
        // Extract tipper
        const accion = row.Acción || "";
        let tipper = "Unknown";
        let type = "Other";
        
        if (accion.includes("Propina de:")) {
          tipper = accion.split("Propina de:")[1].trim().replace(/\u00a0/g, ' ');
          type = "Tip";
        } else if (accion.includes("Emisión privada:")) {
          tipper = accion.split("Emisión privada:")[1].trim().replace(/\u00a0/g, ' ');
          type = "Private";
        } else if (accion.includes("Espía en privada:")) {
          tipper = accion.split("Espía en privada:")[1].trim().replace(/\u00a0/g, ' ');
          type = "Spy";
        }
        
        tippers[tipper] = (tippers[tipper] || 0) + tokens;
        types[type] = (types[type] || 0) + tokens;
        
        // Extract hour
        if (row.Fecha) {
          const timeMatch = row.Fecha.match(/(\d+):\d+/);
          if (timeMatch) {
            const hour = timeMatch[1].padStart(2, '0') + ":00";
            hours[hour] = (hours[hour] || 0) + tokens;
          }
        }
      }
    }
  });
  
  // Sort results
  const sortedTippers = Object.entries(tippers).sort((a,b) => b[1] - a[1]);
  const sortedHours = Object.entries(hours).sort((a,b) => b[1] - a[1]);
  
  console.log("=== SUMMARY FOR SILACITEX_EFFYS ===");
  console.log(`Total Tokens: ${totalTokens}`);
  console.log("\nTop Tippers:");
  sortedTippers.slice(0, 10).forEach(([t, v]) => console.log(`- ${t}: ${v} tokens`));
  
  console.log("\nTokens by Type:");
  Object.entries(types).forEach(([t, v]) => console.log(`- ${t}: ${v} tokens`));
  
  console.log("\nPeak Activity Hours:");
  sortedHours.slice(0, 10).forEach(([h, v]) => console.log(`- ${h}: ${v} tokens`));

} catch (err) {
  console.error("Error processing Excel:", err);
}
