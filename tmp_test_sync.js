const http = require('http');

const data = JSON.stringify({
  modelId: "hotcakes_uwu", // or whatever id we want
  nickname: "hotcakes_uwu",
  period: "2026-03-01_to_2026-03-31",
  platform: "Stripchat"
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/analytics/sync-drive',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
    // NO auth initially to see error or we can bypass auth for test but we can't do that easily
  }
};

const req = http.request(options, (res) => {
  let resData = '';
  res.on('data', d => resData += d);
  res.on('end', () => console.log('Status:', res.statusCode, resData));
});

req.on('error', console.error);
req.write(data);
req.end();
