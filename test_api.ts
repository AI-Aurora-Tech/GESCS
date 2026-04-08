import http from 'http';

http.get('http://localhost:3000/api/users/profile/798ad93e-eb50-4f7a-85c4-5b598f37a01a', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    console.log('Body:', data);
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});
