
const admin = require('firebase-admin');
const fs = require('fs');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')),
    projectId: 'estudioswoow-7288e'
  });
}

async function listAllUsers() {
  const users = [];
  let nextPageToken;
  
  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    result.users.forEach(u => users.push({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      customClaims: u.customClaims
    }));
    nextPageToken = result.pageToken;
  } while (nextPageToken);
  
  console.log(JSON.stringify(users, null, 2));
}

listAllUsers().catch(console.error);
