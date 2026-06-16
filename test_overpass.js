const axios = require('axios');
const lat = 12.9352, lon = 77.6245, radius = 3000;
const query = `[out:json][timeout:30];(node["amenity"~"restaurant|cafe"](around:${radius},${lat},${lon}););out center 10;`;

console.log('Query:', query.substring(0, 100));

axios.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(query)}`, {
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'NearDesk/1.0' }
}).then(r => {
  console.log('Elements found:', r.data.elements.length);
  if(r.data.elements[0]) console.log('Sample:', JSON.stringify(r.data.elements[0].tags));
}).catch(e => {
  if (e.response) {
    console.error('HTTP Error:', e.response.status);
    console.error('Body:', e.response.data.substring ? e.response.data.substring(0,500) : JSON.stringify(e.response.data));
  } else {
    console.error('Error:', e.message);
  }
});
