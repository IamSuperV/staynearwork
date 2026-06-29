const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve frontend files from public directory

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

// ── Auth and Provider Mocking ────────────────────────────────────────────────
const PROVIDERS_FILE = path.join(__dirname, 'providers.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const BLRFOOD_FILE = path.join(__dirname, 'bangalore_food_db.json');

// ── Bangalore Food DB ─────────────────────────────────────────────────────────
// Loaded once at startup — 100 curated restaurants across all Bengaluru tech hubs
let BANGALORE_FOOD_DB = [];
try {
    BANGALORE_FOOD_DB = JSON.parse(fs.readFileSync(BLRFOOD_FILE, 'utf8'));
    console.log(`[blr-food] Loaded ${BANGALORE_FOOD_DB.length} Bengaluru food places`);
} catch(e) {
    console.error('[blr-food] Failed to load bangalore_food_db.json:', e.message);
}

// Bengaluru bounding box: roughly lat 12.70–13.20, lon 77.40–77.85
function isInBangalore(lat, lon) {
    return lat >= 12.70 && lat <= 13.20 && lon >= 77.40 && lon <= 77.85;
}

// Find all food places in BANGALORE_FOOD_DB within `radiusM` metres of lat/lon
function getBangaloreFood(lat, lon, radiusM = 3000) {
    return BANGALORE_FOOD_DB
        .filter(place => getDistance(lat, lon, place.lat, place.lon) <= radiusM)
        .map(place => ({
            id: place.id,
            lat: place.lat,
            lon: place.lon,
            tags: {
                name: place.name,
                amenity: 'restaurant',
                cuisine: place.cuisine,
                'addr:suburb': place.area,
                neardesk_blr_food: true,
                blr_food_data: place
            }
        }));
}

function loadJSON(filePath) {
    try {
        if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch(e) { console.error(`Failed to load ${filePath}:`, e.message); }
    return [];
}

function saveJSON(filePath, data) {
    try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); }
    catch(e) { console.error(`Failed to save ${filePath}:`, e.message); }
}

// POST /api/auth/signup
app.post('/api/auth/signup', (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'All fields required' });
    
    const users = loadJSON(USERS_FILE);
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already exists' });
    
    const newUser = { id: Date.now().toString(), name, email, password, role };
    users.push(newUser);
    saveJSON(USERS_FILE, users);
    
    // For simplicity, we just return success without a real token
    res.json({ success: true, user: { id: newUser.id, name: newUser.name, role: newUser.role } });
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const users = loadJSON(USERS_FILE);
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
});

// POST /api/provider/register
app.post('/api/provider/register', (req, res) => {
    const data = req.body;
    if (!data.type) return res.status(400).json({ error: 'Provider type required' });
    
    const providers = loadJSON(PROVIDERS_FILE);
    const newProvider = { ...data, id: `prov-${Date.now()}`, createdAt: new Date().toISOString() };
    providers.push(newProvider);
    saveJSON(PROVIDERS_FILE, providers);
    
    console.log(`[provider] New ${data.type} registered: ${data.name || 'Unnamed'} at ${data.lat},${data.lon}`);
    res.json({ success: true, providerId: newProvider.id });
});

// ── Curated YC (Y Combinator) Companies in India ────────────────────────────
const YC_COMPANIES_INDIA = [
    // Fintech
    { name: 'Razorpay', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'W15' },
    { name: 'ClearTax (Clear)', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'W14' },
    { name: 'Groww', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'W18' },
    { name: 'Khatabook', city: 'Bengaluru', lat: '12.9698', lon: '77.7500', type: 'office', batch: 'S19' },
    { name: 'Dukaan', city: 'Bengaluru', lat: '12.9354', lon: '77.6240', type: 'office', batch: 'S20' },
    { name: 'Setu (Pine Labs)', city: 'Bengaluru', lat: '12.9719', lon: '77.6412', type: 'office', batch: 'W21' },
    { name: 'M2P Fintech', city: 'Chennai', lat: '13.0569', lon: '80.2425', type: 'office', batch: 'W21' },
    { name: 'Fampay', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'S19' },
    { name: 'Kaleidofin', city: 'Chennai', lat: '13.0418', lon: '80.2341', type: 'office', batch: 'W18' },
    { name: 'Open Financial', city: 'Bengaluru', lat: '12.9352', lon: '77.6103', type: 'office', batch: 'S17' },
    { name: 'Rupeek', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'W19' },
    { name: 'Recko', city: 'Bengaluru', lat: '12.9716', lon: '77.6412', type: 'office', batch: 'W20' },
    { name: 'BharatX', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'W21' },
    { name: 'Savart', city: 'Bengaluru', lat: '12.9279', lon: '77.5946', type: 'office', batch: 'S22' },
    { name: 'Zeta (Directi)', city: 'Mumbai', lat: '19.1136', lon: '72.8697', type: 'office', batch: 'S15' },
    { name: 'Jupiter (Amica Financial)', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'S19' },
    // SaaS / Dev Tools
    { name: 'Hasura', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'S18' },
    { name: 'Postman', city: 'Bengaluru', lat: '12.9914', lon: '77.7101', type: 'office', batch: 'S14' },
    { name: 'Zerodha', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'partner' },
    { name: 'Meesho', city: 'Bengaluru', lat: '12.9716', lon: '77.6412', type: 'office', batch: 'W15' },
    { name: 'Toplyne', city: 'Mumbai', lat: '19.0760', lon: '72.8777', type: 'office', batch: 'W21' },
    { name: 'Rocketlane', city: 'Chennai', lat: '13.0475', lon: '80.2090', type: 'office', batch: 'W21' },
    { name: 'Supercell (Hevo Data)', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'W18' },
    { name: 'Hevo Data', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'W18' },
    { name: 'Middleware', city: 'Ahmedabad', lat: '23.0225', lon: '72.5714', type: 'office', batch: 'S22' },
    { name: 'MoEngage', city: 'Mumbai', lat: '19.0760', lon: '72.8777', type: 'office', batch: 'W14' },
    { name: 'CleverTap', city: 'Mumbai', lat: '19.1136', lon: '72.8697', type: 'office', batch: 'S15' },
    { name: 'Wingify (VWO)', city: 'New Delhi', lat: '28.6139', lon: '77.2090', type: 'office', batch: 'W11' },
    { name: 'BrowserStack', city: 'Mumbai', lat: '19.1136', lon: '72.8697', type: 'office', batch: 'S11' },
    { name: 'Frappe (ERPNext)', city: 'Mumbai', lat: '19.0760', lon: '72.8777', type: 'office', batch: 'S10' },
    { name: 'Servify', city: 'Mumbai', lat: '19.0760', lon: '72.8777', type: 'office', batch: 'W16' },
    { name: 'LambdaTest', city: 'Noida', lat: '28.5355', lon: '77.3910', type: 'office', batch: 'W22' },
    { name: 'Atlan', city: 'New Delhi', lat: '28.6353', lon: '77.2250', type: 'office', batch: 'W21' },
    { name: 'Investmint', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'W22' },
    // Health / Biotech
    { name: 'Niramai', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'S16' },
    { name: 'Phable Care', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'W21' },
    { name: 'Eka Care', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'S21' },
    { name: 'Clinikally', city: 'Mumbai', lat: '19.0760', lon: '72.8777', type: 'office', batch: 'W22' },
    { name: 'mfine', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'S18' },
    // Logistics / Commerce
    { name: 'Meesho', city: 'Bengaluru', lat: '12.9716', lon: '77.6412', type: 'office', batch: 'W15' },
    { name: 'Zetwerk', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'S18' },
    { name: 'Fashinza', city: 'Gurugram', lat: '28.4595', lon: '77.0266', type: 'office', batch: 'W21' },
    { name: 'Dealshare', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'W19' },
    { name: 'CityMall', city: 'Gurugram', lat: '28.4595', lon: '77.0266', type: 'office', batch: 'W21' },
    { name: 'Bijak', city: 'Gurugram', lat: '28.4595', lon: '77.0266', type: 'office', batch: 'S19' },
    { name: 'SupplyNote', city: 'Gurugram', lat: '28.4595', lon: '77.0266', type: 'office', batch: 'W20' },
    { name: 'ElasticRun', city: 'Pune', lat: '18.5204', lon: '73.8567', type: 'office', batch: 'S17' },
    { name: 'Loadshare Networks', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'W17' },
    { name: 'Shiprocket', city: 'New Delhi', lat: '28.6139', lon: '77.2090', type: 'office', batch: 'W16' },
    // EdTech
    { name: 'Codingal', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'W21' },
    { name: 'Teachmint', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'S20' },
    { name: 'Classplus', city: 'Noida', lat: '28.5355', lon: '77.3910', type: 'office', batch: 'S18' },
    { name: 'Newton School', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'S20' },
    { name: 'Pesto Tech', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'W19' },
    { name: 'Masai School', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'W20' },
    { name: 'Leap Finance', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'W19' },
    // AI / ML
    { name: 'Observe.AI', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'S18' },
    { name: 'SigTuple', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'S16' },
    { name: 'Arya.ai', city: 'Mumbai', lat: '19.0760', lon: '72.8777', type: 'office', batch: 'W18' },
    { name: 'Gan.ai', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'W22' },
    { name: 'Murf AI', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'W22' },
    { name: 'Sarvam AI', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'W24' },
    { name: 'Krutrim', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'partner' },
    // Real Estate / PropTech
    { name: 'NoBroker', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'S14' },
    { name: 'Strata', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'W20' },
    { name: 'ZoloStays', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'S16' },
    // Travel / Mobility
    { name: 'Ola', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'partner' },
    { name: 'Dunzo', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'S16' },
    { name: 'Rapido', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'S16' },
    { name: 'Ixigo', city: 'Gurugram', lat: '28.4595', lon: '77.0266', type: 'office', batch: 'partner' },
    // Insurance
    { name: 'Acko', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'S16' },
    { name: 'Digit Insurance', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'partner' },
    { name: 'Plum (Plum Benefits)', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'W20' },
    { name: 'Pazcare', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'S21' },
    // HR / Payroll
    { name: 'Keka', city: 'Hyderabad', lat: '17.4065', lon: '78.4772', type: 'office', batch: 'S19' },
    { name: 'RazorpayX Payroll', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'W15' },
    { name: 'Belong', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'S14' },
    { name: 'Multiplier', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'S21' },
    // Agritech
    { name: 'DeHaat', city: 'Patna', lat: '25.6120', lon: '85.1440', type: 'office', batch: 'W18' },
    { name: 'Ninjacart', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'S15' },
    { name: 'Fasal', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'W19' },
    { name: 'CropIn', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'S14' },
    // Others
    { name: 'Unacademy', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'W15' },
    { name: 'ShareChat', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'W15' },
    { name: 'Khatabook', city: 'Bengaluru', lat: '12.9698', lon: '77.7500', type: 'office', batch: 'S19' },
    { name: 'Udaan', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'S16' },
    { name: 'Urban Company', city: 'Gurugram', lat: '28.4595', lon: '77.0266', type: 'office', batch: 'partner' },
    { name: 'Cred', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'partner' },
    { name: 'Zepto', city: 'Mumbai', lat: '19.1136', lon: '72.8697', type: 'office', batch: 'partner' },
    { name: 'PhonePe', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'partner' },
    { name: 'Swiggy', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'partner' },
    { name: 'Zomato', city: 'Gurugram', lat: '28.4595', lon: '77.0266', type: 'office', batch: 'partner' },
    { name: 'Freshworks', city: 'Chennai', lat: '13.0475', lon: '80.2090', type: 'office', batch: 'partner' },
    { name: 'Chargebee', city: 'Chennai', lat: '13.0418', lon: '80.2341', type: 'office', batch: 'S14' },
    { name: 'Whatfix', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'S14' },
    { name: 'Yellow.ai', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'W17' },
    { name: 'Vyapar', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'W20' },
    { name: 'Pixxel', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'S21' },
    { name: 'Agnikul Cosmos', city: 'Chennai', lat: '13.0105', lon: '80.2354', type: 'office', batch: 'W21' },
    { name: 'Skyroot Aerospace', city: 'Hyderabad', lat: '17.4065', lon: '78.4772', type: 'office', batch: 'S19' },
    { name: 'Vedantu', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'S15' },
    { name: 'Licious', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'partner' },
    { name: 'Country Delight', city: 'Gurugram', lat: '28.4595', lon: '77.0266', type: 'office', batch: 'partner' },
    { name: 'InfraCloud', city: 'Pune', lat: '18.5204', lon: '73.8567', type: 'office', batch: 'W22' },
    { name: 'Porter', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'partner' },
    { name: 'BlackBuck (Zinka)', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'partner' },
    { name: 'Frootles', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'partner' },
    { name: 'Tracxn', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'S13' },
    { name: 'Apna', city: 'Mumbai', lat: '19.0760', lon: '72.8777', type: 'office', batch: 'S19' },
    { name: 'Scaler (InterviewBit)', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'S14' },
    { name: 'Instamojo', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'S12' },
    { name: 'GreyOrange', city: 'Gurugram', lat: '28.4595', lon: '77.0266', type: 'office', batch: 'W12' },
    { name: 'Practo', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'S12' },
    { name: 'Innov8 (Smartworks)', city: 'New Delhi', lat: '28.6139', lon: '77.2090', type: 'office', batch: 'S16' },
    { name: 'Slice', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'S16' },
    { name: 'BukuWarung', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'W20' },
    { name: 'GoKwik', city: 'Gurugram', lat: '28.4595', lon: '77.0266', type: 'office', batch: 'W22' },
    { name: 'Jar', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'S21' },
    { name: 'Moneyview', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'partner' },
    { name: 'OkCredit', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'S18' },
    { name: 'Turtlemint', city: 'Mumbai', lat: '19.0760', lon: '72.8777', type: 'office', batch: 'S16' },
    { name: 'WorkIndia', city: 'Mumbai', lat: '19.0760', lon: '72.8777', type: 'office', batch: 'W19' },
    { name: 'HealthifyMe', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'S15' },
    { name: 'Pocket FM', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'S18' },
    { name: 'Doubtnut', city: 'Gurugram', lat: '28.4595', lon: '77.0266', type: 'office', batch: 'W19' },
    { name: 'Spenny', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'S22' },
    { name: 'Cashfree Payments', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'S17' },
    { name: 'Karkhana.io', city: 'Hyderabad', lat: '17.4065', lon: '78.4772', type: 'office', batch: 'W22' },
    { name: 'OneCode', city: 'Mumbai', lat: '19.0760', lon: '72.8777', type: 'office', batch: 'W21' },
    { name: 'Anar', city: 'Ahmedabad', lat: '23.0225', lon: '72.5714', type: 'office', batch: 'S21' },
    { name: 'Refyne', city: 'Mumbai', lat: '19.1136', lon: '72.8697', type: 'office', batch: 'S20' },
    { name: 'Animall', city: 'Noida', lat: '28.5355', lon: '77.3910', type: 'office', batch: 'W20' },
    { name: 'Trell', city: 'Bengaluru', lat: '12.9716', lon: '77.5946', type: 'office', batch: 'S18' },
    { name: 'Park+', city: 'Gurugram', lat: '28.4595', lon: '77.0266', type: 'office', batch: 'S20' },
    { name: 'Praan', city: 'Bengaluru', lat: '12.9279', lon: '77.6271', type: 'office', batch: 'W22' },
    { name: 'Yulu', city: 'Bengaluru', lat: '12.9352', lon: '77.6245', type: 'office', batch: 'S18' },
];

// ── Nominatim: search companies anywhere in India ───────────────────────────
app.get('/api/search-companies', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) return res.json([]);

        // 0. Instant match against curated YC companies
        const qLower = q.toLowerCase();
        const ycMatches = YC_COMPANIES_INDIA
            .filter(c => c.name.toLowerCase().includes(qLower))
            .map(c => ({
                place_id: `yc-${c.name.toLowerCase().replace(/\s/g, '-')}`,
                lat: c.lat,
                lon: c.lon,
                display_name: `${c.name}, ${c.city}, India`,
                type: c.type,
                yc_batch: c.batch
            }));


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

        // Merge: YC first, then Nominatim + Overpass, deduplicate by name prefix
        const seen = new Set();
        // Mark YC names as seen first
        ycMatches.forEach(yc => seen.add(yc.display_name.split(',')[0].toLowerCase().trim()));

        const mapResults = [...nominatimResults, ...overpassNormalised].filter(item => {
            const key = item.display_name.split(',')[0].toLowerCase().trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const merged = [...ycMatches, ...mapResults].slice(0, 20);

        res.json(merged);
    } catch (e) {
        console.error('Search error:', e.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

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

        // Inject Bengaluru static food DB if location is within Bengaluru bounds
        const blrFoodItems = isInBangalore(lat, lon) ? getBangaloreFood(lat, lon, 3000) : [];
        if (blrFoodItems.length > 0) {
            console.log(`[blr-food] Injecting ${blrFoodItems.length} Bengaluru food places for [${lat.toFixed(3)},${lon.toFixed(3)}]`);
        }

        // 3 compact single-line GET queries in parallel — bbox is 5x faster than around:
        const [foodEls, gymEls, pgEls] = await Promise.all([
            overpassGet(`[out:json][timeout:10];node["amenity"~"restaurant|cafe|fast_food"](${box2km});out 40;`),
            overpassGet(`[out:json][timeout:10];(node["leisure"~"fitness_centre|swimming_pool"](${box2km});node["amenity"="gym"](${box2km}););out 20;`),
            overpassGet(`[out:json][timeout:10];node["name"~"PG|Hostel|hostel|Paying Guest|coliving"](${box3km});out 20;`)
        ]);

        console.log(`[${lat.toFixed(3)},${lon.toFixed(3)}] raw: food=${foodEls.length} gym=${gymEls.length} pg=${pgEls.length}`);

        // Merge custom providers
        const providers = loadJSON(PROVIDERS_FILE);
        const customProviders = providers.map(p => {
            if (!p.lat || !p.lon) return null;
            const dist = getDistance(lat, lon, p.lat, p.lon);
            if (dist > 5000) return null; // 5km radius
            
            // Format as OSM node so frontend doesn't need API structure changes
            return {
                id: `prov-${p.id}`,
                lat: p.lat,
                lon: p.lon,
                tags: {
                    name: p.name,
                    amenity: p.type === 'food' ? 'restaurant' : undefined,
                    tourism: p.type === 'pg' ? 'hostel' : undefined,
                    neardesk_custom: true, // Special flag for frontend UI styling
                    custom_data: p
                }
            };
        }).filter(Boolean);

        // Merge: custom providers first, then Bengaluru curated food, then OSM results
        // Deduplicate Bengaluru food vs OSM food by name to avoid duplicate cards
        const osmFoodNames = new Set(foodEls.map(el => (el.tags?.name || '').toLowerCase().trim()).filter(Boolean));
        const dedupedBlrFood = blrFoodItems.filter(item => {
            const name = (item.tags?.name || '').toLowerCase().trim();
            return name && !osmFoodNames.has(name);
        });

        const mergedElements = [...customProviders, ...dedupedBlrFood, ...foodEls, ...gymEls, ...pgEls];

        const payload = { elements: mergedElements };
        
        console.log(`[${lat.toFixed(3)},${lon.toFixed(3)}] final: ${mergedElements.length} places (custom:${customProviders.length} blr_food:${dedupedBlrFood.length} food:${foodEls.length} gym:${gymEls.length} pg:${pgEls.length})`);  
        cache.set(cacheKey, { data: payload, ts: Date.now() });
        res.json(payload);

    } catch (e) {
        console.error('Nearby error:', e.message);
        res.status(500).json({ error: 'Failed to fetch nearby data' });
    }
});

if (require.main === module) {
    app.listen(PORT, () => console.log(`NearDesk backend running on http://localhost:${PORT}`));
}

module.exports = app;
