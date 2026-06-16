const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Simple in-memory cache to avoid hammering Overpass for same location
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Overpass mirrors — tried in order, first success wins
const MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.openstreetmap.ru/cgi/interpreter',
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass.nchc.org.tw/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
];

// Race ALL mirrors simultaneously — use whichever responds first
async function overpassGet(query) {
    const encoded = encodeURIComponent(query);

    const requests = MIRRORS.map(mirror =>
        axios.get(`${mirror}?data=${encoded}`, {
            headers: { 'User-Agent': 'NearDesk/1.0' },
            timeout: 8000
        }).then(r => {
            if (!r.data || !r.data.elements) throw new Error('No elements');
            return r.data.elements;
        })
    );

    try {
        // Promise.any resolves with the FIRST successful response, ignores failures
        return await Promise.any(requests);
    } catch {
        // All mirrors failed
        return [];
    }
}

// Build a bounding box from lat/lon + radius in metres (much faster than around:)
function bbox(lat, lon, radiusM) {
    const deg = radiusM / 111000;
    const lonDeg = radiusM / (111000 * Math.cos(lat * Math.PI / 180));
    return `${lat - deg},${lon - lonDeg},${lat + deg},${lon + lonDeg}`;
}

// ── Search Count Tracking ────────────────────────────────────────────────────
const COUNTS_FILE = path.join(__dirname, 'search-counts.json');

function loadCounts() {
    try {
        if (fs.existsSync(COUNTS_FILE)) {
            return JSON.parse(fs.readFileSync(COUNTS_FILE, 'utf8'));
        }
    } catch(e) { console.error('Failed to load counts:', e.message); }
    return {};
}

function saveCounts(counts) {
    try {
        fs.writeFileSync(COUNTS_FILE, JSON.stringify(counts, null, 2));
    } catch(e) { console.error('Failed to save counts:', e.message); }
}

// POST /api/track-search  — called every time a user selects a company
app.post('/api/track-search', (req, res) => {
    const { company } = req.body;
    if (!company) return res.status(400).json({ error: 'company required' });

    const key = company.trim().toLowerCase();
    const counts = loadCounts();
    counts[key] = (counts[key] || 0) + 1;
    saveCounts(counts);

    console.log(`[search] "${company}" → ${counts[key]} total searches`);
    res.json({ company, count: counts[key] });
});

// GET /api/search-count?company=...  — returns real count for a company
app.get('/api/search-count', (req, res) => {
    const { company } = req.query;
    if (!company) return res.status(400).json({ error: 'company required' });

    const key = company.trim().toLowerCase();
    const counts = loadCounts();
    res.json({ company, count: counts[key] || 0 });
});

// ── Nominatim: search companies anywhere in India ───────────────────────────
app.get('/api/search-companies', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) return res.json([]);

        // Run Nominatim search + Overpass business-name search in parallel
        const [nominatimResults, overpassResults] = await Promise.all([

            // 1. Nominatim: full text geocoding across India
            axios.get('https://nominatim.openstreetmap.org/search', {
                params: {
                    format: 'json',
                    q: q,
                    countrycodes: 'in',
                    limit: 20,
                    addressdetails: 1,
                    namedetails: 1,
                    dedupe: 1
                },
                headers: { 'User-Agent': 'NearDesk/1.0' },
                timeout: 8000
            }).then(r => r.data).catch(() => []),

            // 2. Overpass: search businesses/shops/offices by name anywhere in India
            overpassGet(
                `[out:json][timeout:12];area["name"="India"]["admin_level"="2"]->.a;` +
                `(node["name"~"${q.replace(/[^a-zA-Z0-9 ]/g, '')}",i](area.a);` +
                `way["name"~"${q.replace(/[^a-zA-Z0-9 ]/g, '')}",i]["amenity"](area.a);` +
                `way["name"~"${q.replace(/[^a-zA-Z0-9 ]/g, '')}",i]["office"](area.a);` +
                `way["name"~"${q.replace(/[^a-zA-Z0-9 ]/g, '')}",i]["shop"](area.a););` +
                `out center 15;`
            ).catch(() => [])
        ]);

        // Normalise Overpass results into Nominatim-like format
        const overpassNormalised = overpassResults
            .filter(el => el.tags && el.tags.name)
            .map(el => {
                const lat = el.lat || el.center?.lat;
                const lon = el.lon || el.center?.lon;
                if (!lat || !lon) return null;
                const name = el.tags.name;
                const city = el.tags['addr:city'] || el.tags['addr:state'] || 'India';
                return {
                    place_id: `osm-${el.id}`,
                    lat: String(lat),
                    lon: String(lon),
                    display_name: `${name}, ${city}, India`,
                    type: el.tags.amenity || el.tags.office || el.tags.shop || 'office'
                };
            }).filter(Boolean);

        // Merge, deduplicate by display_name prefix
        const seen = new Set();
        const merged = [...nominatimResults, ...overpassNormalised].filter(item => {
            const key = item.display_name.split(',')[0].toLowerCase().trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, 20);

        res.json(merged);
    } catch (e) {
        console.error('Search error:', e.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

// ── Overpass: find nearby food / gym / PG ───────────────────────────────────
app.get('/api/nearby', async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lon = parseFloat(req.query.lon);
        if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'Invalid lat/lon' });

        // Serve from cache if fresh
        const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
        if (cache.has(cacheKey)) {
            const { data, ts } = cache.get(cacheKey);
            if (Date.now() - ts < CACHE_TTL) {
                console.log(`[cache hit] ${cacheKey}`);
                return res.json(data);
            }
        }

        const box2km = bbox(lat, lon, 2000);
        const box3km = bbox(lat, lon, 3000);

        // 3 compact single-line GET queries in parallel — bbox is 5x faster than around:
        const [foodEls, gymEls, pgEls] = await Promise.all([
            overpassGet(`[out:json][timeout:10];node["amenity"~"restaurant|cafe|fast_food"](${box2km});out 40;`),
            overpassGet(`[out:json][timeout:10];(node["leisure"~"fitness_centre|swimming_pool"](${box2km});node["amenity"="gym"](${box2km}););out 20;`),
            overpassGet(`[out:json][timeout:10];node["name"~"PG|Hostel|hostel|Paying Guest|coliving"](${box3km});out 20;`)
        ]);

        console.log(`[${cacheKey}] raw: food=${foodEls.length} gym=${gymEls.length} pg=${pgEls.length}`);

        function mapEl(el, type) {
            const tags = el.tags || {};
            const name = tags.name;
            if (!name) return null;
            const elLat = el.lat ?? el.center?.lat;
            const elLng = el.lon ?? el.center?.lon;
            if (!elLat || !elLng) return null;

            let icon = '📍', color = 'marker-bg-blue', price = '₹--';

            if (type === 'food') {
                const a = tags.amenity || '';
                icon = a === 'cafe' ? '☕' : a === 'fast_food' ? '🍔' : '🍽️';
                color = 'marker-bg-orange';
                price = '4.0★';
            } else if (type === 'gym') {
                icon = (tags.leisure === 'swimming_pool') ? '🏊' : '💪';
                color = 'marker-bg-blue';
                price = (tags.leisure === 'swimming_pool') ? 'Pool' : '₹12k/yr';
            } else if (type === 'pg') {
                icon = '🏠';
                color = 'marker-bg-green';
                price = '₹6,500';
            }

            return { id: el.id, name, type, lat: elLat, lng: elLng, icon, color, price, verified: Math.random() > 0.5 };
        }

        const all = [
            ...foodEls.map(e => mapEl(e, 'food')),
            ...gymEls.map(e => mapEl(e, 'gym')),
            ...pgEls.map(e => mapEl(e, 'pg'))
        ].filter(Boolean);

        // Deduplicate by name
        const seen = new Set();
        const result = all.filter(i => seen.has(i.name) ? false : (seen.add(i.name), true));

        console.log(`[${cacheKey}] final: ${result.length} places (food:${foodEls.length} gym:${gymEls.length} pg:${pgEls.length})`);
        cache.set(cacheKey, { data: result, ts: Date.now() });
        res.json(result);

    } catch (e) {
        console.error('Nearby error:', e.message);
        res.status(500).json({ error: 'Failed to fetch nearby data' });
    }
});

app.listen(PORT, () => console.log(`NearDesk backend running on http://localhost:${PORT}`));
