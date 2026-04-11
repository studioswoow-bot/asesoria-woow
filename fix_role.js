const admin = require("firebase-admin");

// Credenciales directas desde .env.local
const projectId = "estudioswoow-7288e";
const clientEmail = "firebase-adminsdk-fbsvc@estudioswoow-7288e.iam.gserviceaccount.com";
const privateKey = "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDDp9zCxAMP1WMg\nSrpuNa8Agg7vPpwkLdiuQwZ8vcE9TrK7qb6v7KN4HWb31zyRtdlyMIWlGg/vWS8z\nEgXKXCh0/QhR0CTxn80+6+CXKtEtLJ13rZlOCKXcesuujh2pmlLnqAgHPPjm49iS\nYgf+KUxm5uXaK7qvgnnPLqYsxKh/95n0XYTeuB65HeVYpPoa4CZ/XJSeVVVlGyC7\nlOmFEbBeC7NPrzaoJQ8CKGPTS8JcfixCemWTHk5lyfmomnzzb/hQa88d0/VSEnCm\nib4c8C2nKoXxQv+ixFwscX5idvAQazS2y9PsntCFKfZejVtLKBmCN/apfhMzK6+8\nYmb2dyCpAgMBAAECggEABC02KjYy9oiQmCTgO/ALb1BXb0X/4UnVQUsO/WSzllJy\nwEzMVEcR6kN+ajX/BgFCxgxBHhgjVPGrb0SoOPykpHKuVcjCsSG/KOOyJKf2VSeJ\nqP9csWy/1agNZwmDmpY/xNAyc60ahxtACUfsccGB7wRozbJ3Rr3bSc/uHjCIhErE\nLZHZ8Gzwbk9cSLuipGDVff4+Q9eLiSd30CsprQB9dQgo11ZVkEu2+Rts+VsynIhi\nzaG4nUHtIVCWuenpwoRuHqCnsUnoTdggc2BKETLcOUbttcWZAH/6PwokmZRbMn9G\nbDTdnzHWNoYRDA+D+xPCCZ+hMtOqT2yTuYVBh0bCHQKBgQD+O1d6PPEOXpI7WxNB\nVVmUeS97ZEJSEaahQ4G3NRXgb/keJ0u7vtFFwiqGEf7BPCYNM6xwyId9CagtUHEY\nNiDw/SNfrOmuGmwlsO5JQzO3eOI8Ae2NwmP2bbvWCqoF23TX2dz0enwzL/dPaOUS\ntlw+cr36N3mcFaiko3h6xzgBYwKBgQDFBDnqvcwH5AHyzXVKPpOWFN0V6uASwIPf\n+FqXG80/0rHOKLj0HfoSqSL/dvnvD1OrClEdDXa5WChg1qwbSFg+k7xkGyrDsc5/\nBNfC5aTHZvsR/tTYg8nYSs6cIjFqghjHdPF3UJCEA7eUdF1vFU01BUpCQ2Fl5ed5\n+FhwNFFZgwKBgE0hXdHVKWEtqfneEMJyjYHxHkm2SjSx7DbizzjxHxj/f7n5PA3S\nv5UFandQgFTJ1dWNhtSU0h5KTr6ouBcbXPUgJ5pAUIkktQjeX/zYKZmRUDnab+Lh\nRgielC1FAP5T7WgLTfDSNFonREXQUidSMjwz/ZUrPXbwT0Db45KEXGZ3AoGAQSZs\noJuy5MkZe9lFeA/Jbk/n7F+HSawv79iI3H9tGDXsZmhBATkIgTM9R41oiQ1gdacr\nu5fAMvpcH/ndcAg0Zj0kh1YUhjI+PvKzBtg57Va4n/LNH+w0yzmxqSAFh1sOJqcd\nUn9pyr4P7x+r5hf9OBNPwynVA4VLTqI5XKFwZVECgYB6A4BXWon/EQyeotM8LaVV\ntWPHPDB4hwGiRFtJP6Z7zYuEVNGungkAb/CGQrSXXfw0SVCTGSLxzqrnz8G9iJQw\nXp1ajoU9yqsVe12mUeXPfzCjbxmUitOP8/MEOylAdnFDuI/StvRBHVaio4viNcHI\nolSrwZPrxsWOu7xSK6x3SA==\n-----END PRIVATE KEY-----\n";

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  projectId
});

async function auditAndRepair() {
  const db = admin.firestore();
  
  console.log("=== AUDITORIA DE USUARIOS EN FIRESTORE ===\n");
  
  try {
    const snap = await db.collection("users").get();
    console.log(`Total usuarios: ${snap.size}\n`);
    
    const byRole = {};
    snap.docs.forEach(doc => {
      const d = doc.data();
      const role = d.role || "SIN ROL";
      if (!byRole[role]) byRole[role] = [];
      byRole[role].push({ uid: doc.id, email: d.email, username: d.username });
    });
    
    Object.entries(byRole).forEach(([role, users]) => {
      console.log(`[${role}] (${users.length} usuarios):`);
      users.forEach(u => console.log(`  - ${u.email || u.username} (${u.uid})`));
      console.log();
    });
    
    // Verificar si existe el usuario studioswoow (admin)
    const adminSnap = await db.collection("users")
      .where("role", "==", "admin").get();
    
    console.log(`\n=== VERIFICACIÓN ADMIN ===`);
    console.log(`Usuarios con rol 'admin': ${adminSnap.size}`);
    adminSnap.docs.forEach(d => {
      const data = d.data();
      console.log(`  UID: ${d.id}`);
      console.log(`  Email: ${data.email}`);
      console.log(`  Role: ${data.role}`);
    });
    
    // Verificar si existe algún monitor
    const monitorSnap = await db.collection("users")
      .where("role", "==", "monitor").get();
    console.log(`\nUsuarios con rol 'monitor': ${monitorSnap.size}`);
    monitorSnap.docs.forEach(d => {
      const data = d.data();
      console.log(`  UID: ${d.id} | Email: ${data.email}`);
    });
    
  } catch (err) {
    console.error("Error auditando usuarios:", err.message);
  }
  
  process.exit(0);
}

auditAndRepair();
