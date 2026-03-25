const https = require('https');

function get(url) {
    return new Promise((resolve, reject) => {
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };
        https.get(url, { headers }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        }).on('error', reject);
    });
}

async function scanDetailed(nickname) {
    const lowNickname = nickname.toLowerCase();
    const res = await get(`https://chaturbate.com/${lowNickname}/`);
    if (res.status === 200) {
        const html = res.body;
        
        const keywords = ['private', 'public', 'away', 'offline', 'password', 'hidden', 'spy', 'show', 'status'];
        keywords.forEach(kw => {
            const count = (html.toLowerCase().split(kw).length - 1);
            console.log(`'${kw}': ${count}`);
        });

        // Buscar JSON
        const startIdx = html.indexOf("\u0022broadcaster_gender\u0022");
        if (startIdx !== -1) {
            console.log("\nJSON del Broadcaster:");
            console.log(html.substring(startIdx - 100, startIdx + 800));
        } else {
            console.log("\nNO se encontró el JSON habitual de broadcaster");
        }
    }
}

scanDetailed("hotcakes_uwu");
