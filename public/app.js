// app.js
document.addEventListener('DOMContentLoaded', () => {
    // 1. STATE MANAGEMENT
    const state = {
        currentStep: -1,
        userRole: 'seeker', // seeker | provider
        authMode: 'login', // login | signup
        company: 'TCS Hinjewadi Pune',
        food: 'Mezza9',
        foodPrice: 3200,
        lat: 18.586,
        lon: 73.742,
        facilities: ['Wi-Fi', 'Swimming Pool'],
        roomType: 'Three Sharing',
        roomPrice: 6500
    };

    // 2. LOADER
    const loader = document.getElementById('loader');
    setTimeout(() => {
        loader.classList.add('hidden');
        setTimeout(() => {
            if(loader) loader.remove();
            initStep(-2); // Initialize Role Select step after loader
        }, 500);
    }, 2500);

    // 3. PARTICLES CANVAS
    const canvas = document.getElementById('particles-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.vx = (Math.random() - 0.5) * 0.5;
                this.vy = (Math.random() - 0.5) * 0.5;
                this.radius = Math.random() * 2 + 2;
                this.color = Math.random() > 0.5 ? 'rgba(124,58,237,0.3)' : 'rgba(168,139,250,0.2)';
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
                if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
            }
        }

        for (let i = 0; i < 50; i++) {
            particles.push(new Particle());
        }

        function animateParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();
                
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < 100) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(124,58,237,${0.1 - distance/1000})`;
                        ctx.lineWidth = 1;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(animateParticles);
        }
        animateParticles();
    }

    // 4. STEP NAVIGATION
    const steps = document.querySelectorAll('.step');
    
    function goToStep(index) {
        const currentElement = document.querySelector(`.step[data-step="${state.currentStep}"]`);
        const nextElement = document.querySelector(`.step[data-step="${index}"]`);
        
        if(!nextElement) return;

        if(currentElement) {
            currentElement.classList.remove('active');
            currentElement.classList.add('exit-left');
        }
        
        setTimeout(() => {
            if(currentElement) currentElement.classList.remove('exit-left');
            if(nextElement) nextElement.classList.add('active');
            state.currentStep = index;
            initStep(index);
        }, 300);
    }

    // Global back button handler — one listener for all .back-btn
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.back-btn');
        if (!btn) return;
        const target = btn.getAttribute('data-back');
        if (target !== null) {
            goToStep(isNaN(target) ? target : parseInt(target));
        }
    });

    // ── ROLE SELECTION LOGIC (STEP -2) ─────────────────────────────
    const roleCards = document.querySelectorAll('#step-role-select .role-card');
    roleCards.forEach(card => {
        card.addEventListener('click', () => {
            state.userRole = card.dataset.role;
            const title = document.getElementById('auth-title');
            if (title) {
                title.textContent = state.userRole === 'provider' ? 'Provider Login' : 'Seeker Login';
            }
            goToStep('-1');
        });
    });

    // ── AUTHENTICATION LOGIC (STEP -1) ─────────────────────────────
    const authTabs = document.querySelectorAll('.auth-tab');
    const signupFields = document.getElementById('signup-fields');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authError = document.getElementById('auth-error');

    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.authMode = tab.dataset.action;
            
            const title = document.getElementById('auth-title');
            
            if (state.authMode === 'signup') {
                signupFields.style.display = 'block';
                authSubmitBtn.textContent = 'Create Account';
                if (title) title.textContent = state.userRole === 'provider' ? 'Provider Sign Up' : 'Seeker Sign Up';
            } else {
                signupFields.style.display = 'none';
                authSubmitBtn.textContent = 'Login';
                if (title) title.textContent = state.userRole === 'provider' ? 'Provider Login' : 'Seeker Login';
            }
        });
    });

    authSubmitBtn.addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const name = document.getElementById('auth-name').value;

        if (!email || !password || (state.authMode === 'signup' && !name)) {
            authError.textContent = 'Please fill all required fields.';
            authError.style.display = 'block';
            return;
        }

        try {
            authSubmitBtn.textContent = 'Loading...';
            const endpoint = state.authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
            const body = state.authMode === 'signup' 
                ? { name, email, password, role: state.userRole }
                : { email, password };

            const res = await fetch(`${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Authentication failed');

            // If login, set state role to backend returned role
            if (state.authMode === 'login' && data.user) {
                state.userRole = data.user.role;
            }

            authError.style.display = 'none';
            // Route based on role
            if (state.userRole === 'provider') {
                goToStep('p1');
            } else {
                goToStep(0);
            }
        } catch (e) {
            authError.textContent = e.message;
            authError.style.display = 'block';
        } finally {
            authSubmitBtn.textContent = state.authMode === 'signup' ? 'Create Account' : 'Login';
        }
    });

    // ── PROVIDER FLOW LOGIC ────────────────────────────────────────────────
    document.querySelectorAll('.provider-type-card').forEach(card => {
        card.addEventListener('click', () => {
            const ptype = card.dataset.ptype;
            if (ptype === 'food') goToStep('p2-food');
            else if (ptype === 'pg') {
                // Populate PG facilities from existing ones if not done
                const pgFacContainer = document.getElementById('p-pg-facilities');
                if (pgFacContainer && pgFacContainer.children.length === 0) {
                    const tiles = document.querySelectorAll('#step-facilities .facility-tile');
                    tiles.forEach(tile => {
                        const clone = tile.cloneNode(true);
                        clone.classList.remove('selected');
                        clone.addEventListener('click', () => clone.classList.toggle('selected'));
                        pgFacContainer.appendChild(clone);
                    });
                }
                goToStep('p2-pg');
            }
        });
    });

    document.getElementById('btn-submit-food')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-submit-food');
        btn.textContent = 'Submitting...';
        const data = {
            type: 'food',
            lat: state.providerLat,
            lon: state.providerLon,
            name: document.getElementById('p-food-name').value,
            timings: document.getElementById('p-food-timing').value,
            monthlyPrice: document.getElementById('p-food-price').value,
            menu: document.getElementById('p-food-menu').value
        };
        await fetch('/api/provider/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
        btn.textContent = 'List Food Centre';
        goToStep('p3');
    });

    document.getElementById('btn-submit-pg')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-submit-pg');
        btn.textContent = 'Submitting...';
        
        // Collect beds
        const beds = Array.from(document.querySelectorAll('#p-pg-beds input:checked')).map(el => el.value);
        // Collect facilities
        const facilities = Array.from(document.querySelectorAll('#p-pg-facilities .facility-tile.selected span')).map(el => el.textContent);

        const data = {
            type: 'pg',
            lat: state.providerLat,
            lon: state.providerLon,
            name: document.getElementById('p-pg-name').value,
            landmark: document.getElementById('p-pg-landmark').value,
            capacity: document.getElementById('p-pg-capacity').value,
            vacancies: document.getElementById('p-pg-vacancies').value,
            beds,
            facilities
        };
        await fetch('/api/provider/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
        btn.textContent = 'List PG Property';
        goToStep('p3');
    });

    function initStep(index) {
        if (index === 1) {
            const el = document.getElementById('company-name-display');
            if(el) el.textContent = state.company;

            // Update company name label in stat
            const statName = document.getElementById('stat-company-name');
            if(statName) statName.textContent = state.company.split(',')[0];

            // Fetch REAL search count from backend, animate 0 → real number
            const statCount = document.getElementById('stat-count');
            const statPeople = document.getElementById('stat-people');

            // Reset to 0 while loading
            if(statCount) statCount.textContent = '+0';
            if(statPeople) statPeople.textContent = '0 people';

            fetch(`/api/search-count?company=${encodeURIComponent(state.company)}`)
                .then(r => r.json())
                .then(({ count }) => {
                    const target = count; // real number from DB
                    let current = 0;

                    if (target === 0) {
                        // First time this company is searched — show 0, live tick
                        if(statCount) statCount.textContent = '+1';
                        if(statPeople) statPeople.textContent = '1 person';
                        return;
                    }

                    // Animate from 0 to real count
                    const stepSize = Math.max(1, Math.ceil(target / 40));
                    const fastInterval = setInterval(() => {
                        current = Math.min(current + stepSize, target);
                        if(statCount) statCount.textContent = '+' + current.toLocaleString();
                        if(statPeople) statPeople.textContent = current.toLocaleString() + ' people';
                        if(current >= target) {
                            clearInterval(fastInterval);
                            // Tick up 1 every few seconds to feel live (already includes current user)
                            setInterval(() => {
                                current += 1;
                                if(statCount) statCount.textContent = '+' + current.toLocaleString();
                                if(statPeople) statPeople.textContent = current.toLocaleString() + ' people';
                            }, 8000);
                        }
                    }, 40);
                })
                .catch(() => {
                    // Backend unreachable — show a neutral placeholder
                    if(statCount) statCount.textContent = '+1';
                    if(statPeople) statPeople.textContent = '1 person';
                });
        } else if (index === 2) {
            // Food step — always fetch fresh live data for the selected company
            const foodContainer = document.getElementById('food-cards');
            if (foodContainer) {
                foodContainer.innerHTML = `
                    <div style="padding:40px;text-align:center;color:#7C3AED;">
                        <div style="font-size:2.5rem;margin-bottom:12px;animation:pulse 1.5s infinite;">🍽️</div>
                        <p style="font-weight:600;font-size:1rem;">Finding restaurants near ${state.company.split(',')[0]}...</p>
                        <p style="font-size:0.8rem;color:#9ca3af;margin-top:4px;">Checking live data from OpenStreetMap</p>
                    </div>`;
            }
            fetchNearbyData(state.lat, state.lon);
        } else if (index === 4) {
            if (window.leafletMap) {
                setTimeout(async () => {
                    window.leafletMap.invalidateSize();
                    window.leafletMap.setView([state.lat, state.lon], 14);
                    if (window.updateMapOffice) window.updateMapOffice();
                    // Only re-fetch if we don't have live data yet for this location
                    if (markersLayer) renderMapMarkers('all');
                }, 300);
            }
        } else if (index === 6) {
            const el = document.getElementById('matches-company');
            if(el) el.textContent = state.company.split(',')[0];
            renderMatchCards();
        } else if (index === 7) {
            updateSummary();
        }
    }

    async function fetchNearbyData(lat, lon) {
        try {
            const nRes = await fetch(`/api/nearby?lat=${lat}&lon=${lon}`);
            const data = await nRes.json();
            
            // Backend now returns { elements: [...] } with raw OSM nodes + custom providers
            const elements = Array.isArray(data) ? data : (data.elements || []);
            if (elements.length === 0) {
                console.warn('No nearby data returned for', lat, lon);
            }
            
            // Normalize each element into the format our renderers expect
            mockProperties = elements.map(el => {
                const tags = el.tags || {};
                const name = tags.name || el.name;
                if (!name) return null;
                
                const elLat = el.lat ?? el.center?.lat;
                const elLon = el.lon ?? el.center?.lon;
                if (!elLat || !elLon) return null;
                
            // Determine type
                let type = 'food';
                if (tags.tourism === 'hostel' || tags.tourism === 'guest_house' || 
                    (name && /PG|Hostel|hostel|Paying Guest|coliving/i.test(name))) {
                    type = 'pg';
                } else if (tags.leisure === 'fitness_centre' || tags.leisure === 'swimming_pool' || tags.amenity === 'gym') {
                    type = 'gym';
                }
                
                // Determine icon
                const amenity = tags.amenity || '';
                let icon = '🍽️';
                if (type === 'gym') icon = tags.leisure === 'swimming_pool' ? '🏊' : '💪';
                else if (type === 'pg') icon = '🏠';
                else if (amenity === 'cafe' || (tags.neardesk_blr_food && (tags.cuisine||'').toLowerCase().includes('coffee'))) icon = '☕';
                else if (amenity === 'fast_food') icon = '🍔';
                
                return {
                    id: el.id,
                    name,
                    type,
                    lat: elLat,
                    lng: elLon,
                    icon,
                    verified: Math.random() > 0.5,
                    tags: tags, // Preserve tags for neardesk_custom/blr_food detection
                    // Expose Bengaluru curated food data at top level for easy rendering
                    blr_food: tags.neardesk_blr_food ? tags.blr_food_data : null
                };
            }).filter(Boolean);
            renderFoodCards();
            if (markersLayer) renderMapMarkers('all');
            if (window.updateMapOffice) window.updateMapOffice();
        } catch(e) {
            console.error('Failed to fetch nearby:', e);
            // Show error in food container
            const foodContainer = document.getElementById('food-cards');
            if (foodContainer && foodContainer.querySelector('[style*="finding"]')) {
                foodContainer.innerHTML = `
                    <div style="padding:32px;text-align:center;color:#ef4444;">
                        <div style="font-size:2rem;margin-bottom:8px;">⚠️</div>
                        <p>Could not load live data.<br><small>Make sure backend is running on port 3001</small></p>
                    </div>`;
            }
        }
    }

    // 5. STEP 0: HERO
    const companyInput = document.getElementById('company-input');
    const searchSuggestions = document.getElementById('search-suggestions');
    const searchBtn = document.getElementById('search-btn');

    function setupLocationSearch(inputId, suggId, onSelect, onHover = null) {
        const input = document.getElementById(inputId);
        const sugg = document.getElementById(suggId);
        let timeout;

        if (!input || !sugg) return;

        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 2) {
                clearTimeout(timeout);
                sugg.innerHTML = '<div class="suggestion">Searching...</div>';
                sugg.style.display = 'flex';
                
                timeout = setTimeout(async () => {
                    try {
                        const res = await fetch(`/api/search-companies?q=${encodeURIComponent(query)}`);
                        const data = await res.json();
                        sugg.innerHTML = '';
                        if (data.length === 0) {
                            sugg.innerHTML = '<div class="suggestion">No results found</div>';
                        } else {
                            data.forEach(item => {
                                const div = document.createElement('div');
                                div.className = 'suggestion';
                                const parts = item.display_name.split(',').map(s => s.trim());
                                const name = parts[0];
                                const location = parts.slice(1, 3).join(', ');
                                const label = parts.slice(0, 3).join(', ');
                                const itemLat = parseFloat(item.lat);
                                const itemLon = parseFloat(item.lon);
                                const typeIcons = { 'office': '🏢', 'restaurant': '🍽️', 'shop': '🛒', 'hospital': '🏥', 'school': '🎓', 'hotel': '🏨', 'bank': '🏦', 'fuel': '⛽', 'supermarket': '🛒' };
                                const icon = typeIcons[item.type] || '🏢';
                                div.innerHTML = `
                                    <div style="display:flex;align-items:center;gap:10px;width:100%;">
                                        <span style="font-size:1.1rem;">${icon}</span>
                                        <div style="flex:1;min-width:0;">
                                            <div style="font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
                                            <div style="font-size:0.75rem;opacity:0.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${location || 'India'}</div>
                                        </div>
                                    </div>`;
                                
                                if (onHover) {
                                    div.addEventListener('mouseenter', () => onHover(itemLat, itemLon), { once: true });
                                }

                                div.addEventListener('click', () => {
                                    input.value = label;
                                    sugg.style.display = 'none';
                                    onSelect(label, itemLat, itemLon);
                                });
                                sugg.appendChild(div);
                            });
                        }
                    } catch(e) {
                        sugg.innerHTML = '<div class="suggestion">Error fetching results</div>';
                    }
                }, 500);
            } else {
                sugg.style.display = 'none';
            }
        });
    }

    // Initialize Seeker Hero Search
    setupLocationSearch('company-input', 'search-suggestions', (label, lat, lon) => {
        state.company = label;
        state.lat = lat;
        state.lon = lon;

        // Track this real search — fire and forget
        fetch('/api/track-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company: label })
        }).catch(() => {}); // silent fail if offline

        // Fire nearby fetch in background — don't block navigation
        fetchNearbyData(state.lat, state.lon);
        goToStep(1);
    }, (lat, lon) => fetchNearbyData(lat, lon));

    // Initialize Provider Form Searches
    setupLocationSearch('p-food-loc', 'p-food-sugg', (label, lat, lon) => {
        state.providerLat = lat;
        state.providerLon = lon;
    });

    setupLocationSearch('p-pg-loc', 'p-pg-sugg', (label, lat, lon) => {
        state.providerLat = lat;
        state.providerLon = lon;
    });

    if (companyInput) {
        companyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && companyInput.value.trim() !== '') {
                state.company = companyInput.value.trim();
                goToStep(1);
            }
        });
    }

    if(searchBtn && companyInput) {
        searchBtn.addEventListener('click', () => {
            if (companyInput.value.trim() !== '') {
                state.company = companyInput.value.trim();
                goToStep(1);
            }
        });
    }

    // STEP 1 to 2
    const btnToFood = document.getElementById('btn-to-food');
    if(btnToFood) btnToFood.addEventListener('click', () => goToStep(2));

    // 6. STEP 2: FOOD
    const foodTabs = document.querySelectorAll('.food-tab');
    const foodCards = document.querySelectorAll('.food-card');

    foodTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            foodTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const type = tab.getAttribute('data-type');
            foodCards.forEach(card => {
                if (type === 'all' || card.getAttribute('data-type') === type) {
                    card.style.display = 'flex';
                    setTimeout(() => card.style.opacity = '1', 50);
                } else {
                    card.style.opacity = '0';
                    setTimeout(() => card.style.display = 'none', 300);
                }
            });
        });
    });

    foodCards.forEach(card => {
        card.addEventListener('click', () => {
            foodCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            const h4 = card.querySelector('h4');
            if(h4) state.food = h4.textContent;
            
            const priceText = card.querySelector('.price-amount');
            if(priceText) state.foodPrice = parseInt(priceText.textContent.replace('₹', '').replace(',', ''));
            
            // Pulse animation
            card.style.transform = 'scale(0.97)';
            setTimeout(() => card.style.transform = '', 150);
        });
    });

    function renderFoodCards() {
        const foodContainer = document.getElementById('food-cards');
        if (!foodContainer) return;
        
        foodContainer.innerHTML = '';
        // Show up to 9 real food items (more since Bengaluru DB may have many)
        const foodItems = mockProperties.filter(p => p.type === 'food').slice(0, 9);
        
        if (foodItems.length === 0) {
            foodContainer.innerHTML = `
                <div style="padding:32px;text-align:center;color:#6b7280;">
                    <div style="font-size:2rem;margin-bottom:8px;">🍽️</div>
                    <p>No food places found nearby.<br>Try a different location.</p>
                </div>`;
            return;
        }

        foodItems.forEach((item, index) => {
            const isFirst = index === 0;
            const isCustom = item.tags && item.tags.neardesk_custom;
            const isBlrFood = item.blr_food !== null && item.blr_food !== undefined;
            const customData = isCustom ? item.tags.custom_data : null;
            const blrData = isBlrFood ? item.blr_food : null;

            // Determine display values — priority: blrData > customData > fallback
            let displayName, displayPrice, timings, displayRating, ratingCount, displayArea;

            if (isBlrFood && blrData) {
                displayName = blrData.name;
                displayPrice = blrData.price_for_two || 500;
                timings = blrData.cuisine || 'Restaurant';
                displayRating = blrData.rating || (3.5 + Math.random() * 1.4).toFixed(1);
                ratingCount = Math.floor(200 + Math.random() * 800);
                displayArea = blrData.area || 'Bengaluru';
            } else if (isCustom && customData) {
                displayName = customData.name;
                displayPrice = parseInt(customData.monthlyPrice) || 2500;
                timings = customData.timings || 'Restaurant';
                displayRating = '5.0';
                ratingCount = 'New';
                displayArea = null;
            } else {
                displayName = item.name;
                displayPrice = 500;
                timings = item.tags?.cuisine || 'Restaurant';
                displayRating = (3.5 + Math.random() * 1.4).toFixed(1);
                ratingCount = Math.floor(50 + Math.random() * 450);
                displayArea = item.tags?.['addr:suburb'] || null;
            }

            if (isFirst) {
                state.food = displayName;
                state.foodPrice = displayPrice;
            }

            // Estimate distance from company in metres
            const dLat = (item.lat - state.lat) * 111000;
            const dLng = (item.lng - state.lon) * 111000 * Math.cos(state.lat * Math.PI / 180);
            const distM = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
            const distLabel = distM < 1000 ? `${distM}m away` : `${(distM / 1000).toFixed(1)}km away`;
            const walkMin = Math.round(distM / 80); // ~80m per min walk

            // Badge label based on source
            let badgeClass = 'nonveg';
            let badgeLabel = 'Non-Veg';
            let badgeStyle = '';

            if (isCustom) { 
                badgeClass = 'verified'; badgeLabel = '⭐ Verified Partner'; badgeStyle = 'background:#F59E0B;';
            } else if (isBlrFood) { 
                badgeClass = 'veg'; badgeLabel = '🗺️ Bengaluru Pick'; badgeStyle = 'background:linear-gradient(135deg,#7C3AED,#4F46E5);color:#fff;';
            } else if (item.icon === '☕') { 
                badgeClass = 'veg'; badgeLabel = 'Cafe';
            } else if (item.icon === '🍔') { 
                badgeClass = 'nonveg'; badgeLabel = 'Fast Food';
            } else if (item.verified) { 
                badgeClass = 'veg'; badgeLabel = 'Verified';
            }
            
            const card = document.createElement('div');
            card.className = `food-card${isFirst ? ' selected' : ''}`;
            card.setAttribute('data-type', 'restaurants');
            
            // Price label changes based on source
            const priceLabel = (isBlrFood) ? 'for two' : isCustom ? '/month' : 'for two';
            const priceDisplay = isBlrFood ? `₹${displayPrice.toLocaleString()}` : isCustom ? `₹${displayPrice.toLocaleString()}` : `₹${displayPrice}`;
            
            card.innerHTML = `
                <div class="food-card-img">
                    <img src="images/food.png" alt="${displayName}" />
                    <span class="food-badge ${badgeClass}" style="${badgeStyle}">${badgeLabel}</span>
                </div>
                <div class="food-card-info">
                    <h4>${item.icon || '🍽️'} ${displayName}</h4>
                    ${displayArea ? `<div style="font-size:0.72rem;color:#9ca3af;margin-bottom:2px;">📍 ${displayArea}</div>` : ''}
                    <div class="food-rating">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        <span>${displayRating}</span>
                        <span class="rating-count">(${ratingCount})</span>
                    </div>
                    <div class="food-meta">
                        <span class="food-meals">${timings}</span>
                        <span class="food-distance">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            ${distLabel} · ${walkMin} min walk
                        </span>
                    </div>
                    <div class="food-price">
                        <span class="price-amount">${priceDisplay}</span>
                        <span class="price-period">${priceLabel}</span>
                    </div>
                </div>
            `;
            
            card.addEventListener('click', () => {
                document.querySelectorAll('.food-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.food = displayName;
                state.foodPrice = displayPrice;
            });
            
            foodContainer.appendChild(card);
        });
    }

    const btnToFacilities = document.getElementById('btn-to-facilities');
    if(btnToFacilities) btnToFacilities.addEventListener('click', () => goToStep(3));

    function renderMatchCards() {
        const container = document.getElementById('match-cards');
        if (!container) return;

        const pgItems = mockProperties.filter(p => p.type === 'pg').slice(0, 5);

        if (pgItems.length === 0) {
            container.innerHTML = `
                <div style="padding:32px;text-align:center;color:#6b7280;">
                    <div style="font-size:2rem;margin-bottom:8px;">🏠</div>
                    <p>No PGs found nearby.<br>Try a different company location.</p>
                </div>`;
            return;
        }

        const amenityPool = ['Wi-Fi', 'AC', 'Laundry', 'Power Backup', 'CCTV', 'Hot Water', 'Meals', 'Parking'];
        const companyShort = state.company.split(',')[0];

        container.innerHTML = '';
        pgItems.forEach((pg, i) => {
            const isCustom = pg.tags && pg.tags.neardesk_custom;
            const customData = isCustom ? pg.tags.custom_data : null;
            
            const displayName = isCustom ? customData.name : pg.name;

            const dLat = (pg.lat - state.lat) * 111000;
            const dLng = (pg.lng - state.lon) * 111000 * Math.cos(state.lat * Math.PI / 180);
            const distM = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
            const distLabel = distM < 1000 ? `${distM}m from ${companyShort}` : `${(distM/1000).toFixed(1)}km from ${companyShort}`;
            const walkMin = Math.round(distM / 80);
            const rating = isCustom ? '5.0' : (3.8 + Math.random() * 1.1).toFixed(1);
            const reviews = isCustom ? 'New' : Math.floor(40 + Math.random() * 300);
            const price = state.roomPrice || 6500;
            
            let amenities = [];
            if (isCustom && customData.facilities) {
                amenities = customData.facilities.slice(0, 4);
            } else {
                const shuffled = [...amenityPool].sort(() => Math.random() - 0.5);
                amenities = [...new Set([...state.facilities.slice(0,2), ...shuffled])].slice(0, 4);
            }

            const customInfoBadge = isCustom && customData.vacancies 
                ? `<span style="font-size:0.7rem; background:#7C3AED; color:white; padding:2px 6px; border-radius:4px; margin-left:8px;">${customData.vacancies} Vacancies</span>` 
                : '';

            const card = document.createElement('div');
            card.className = 'match-card';
            card.innerHTML = `
                <div class="match-card-img">
                    <img src="images/stay.png" alt="${displayName}" />
                    ${isCustom ? `<span class="verified-badge" style="background:#F59E0B;"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Verified Partner</span>` : (pg.verified ? `<span class="verified-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Verified</span>` : '')}
                </div>
                <div class="match-card-info">
                    <div class="match-card-top">
                        <h4 style="display:flex; align-items:center;">${displayName} ${customInfoBadge}</h4>
                        <span class="match-distance">${distLabel} · ${walkMin} min walk</span>
                    </div>
                    <div class="match-rating">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        <span>${rating}</span>
                        <span class="rating-count">(${reviews})</span>
                    </div>
                    <div class="match-amenities">
                        ${amenities.map(a => `<span class="amenity-pill">${a}</span>`).join('')}
                        <span class="amenity-pill">${state.roomType || '3 Sharing'}</span>
                    </div>
                    <div class="match-bottom">
                        <div class="match-price">
                            <span class="price-amount">₹${price.toLocaleString()}</span>
                            <span class="price-period">/month</span>
                        </div>
                        <button class="view-details-btn" onclick="document.querySelector('.step[data-step=\"7\"]').classList.add('active');document.querySelector('.step[data-step=\"6\"]').classList.remove('active');">View Details</button>
                    </div>
                </div>`;
            container.appendChild(card);
        });
    }

    // 7. STEP 3: FACILITIES
    const facilityTiles = document.querySelectorAll('.facility-tile');
    
    facilityTiles.forEach(tile => {
        tile.addEventListener('click', () => {
            tile.classList.toggle('selected');
            const facilityNameSpan = tile.querySelector('span');
            const facilityName = facilityNameSpan ? facilityNameSpan.textContent : '';
            
            if (tile.classList.contains('selected')) {
                if (!state.facilities.includes(facilityName)) {
                    state.facilities.push(facilityName);
                }
            } else {
                state.facilities = state.facilities.filter(f => f !== facilityName);
            }
            
            // Pop animation
            tile.style.transform = 'scale(0.9)';
            setTimeout(() => tile.style.transform = 'scale(1.05)', 100);
            setTimeout(() => tile.style.transform = '', 200);
        });
    });

    const btnToMap = document.getElementById('btn-to-map');
    if(btnToMap) btnToMap.addEventListener('click', () => goToStep(4));

    // STEP 4: REAL LEAFLET MAP
    let mockProperties = [
        { id: 1, type: 'pg', name: 'Zolo Stanza', lat: 18.591, lng: 73.738, price: '₹7,500', icon: '🏠', color: 'marker-bg-green', verified: true },
        { id: 2, type: 'pg', name: 'Tulip PG', lat: 18.595, lng: 73.742, price: '₹6,000', icon: '🏠', color: 'marker-bg-green' },
        { id: 3, type: 'pg', name: 'YourSpace Hostel', lat: 18.588, lng: 73.748, price: '₹8,500', icon: '🛏️', color: 'marker-bg-green', verified: true },
        { id: 4, type: 'pg', name: 'Sunrise PG', lat: 18.582, lng: 73.735, price: '₹5,500', icon: '🏢', color: 'marker-bg-green' },
        { id: 5, type: 'pg', name: 'Shree PG', lat: 18.585, lng: 73.745, price: '₹6,800', icon: '🏠', color: 'marker-bg-green', verified: true },
        
        { id: 6, type: 'gym', name: "Gold's Gym", lat: 18.580, lng: 73.755, price: '₹15k/yr', icon: '💪', color: 'marker-bg-blue', verified: true },
        { id: 7, type: 'gym', name: 'Abs Fitness', lat: 18.578, lng: 73.739, price: '₹12k/yr', icon: '🏋️', color: 'marker-bg-blue' },
        { id: 8, type: 'gym', name: 'FitPro Gym', lat: 18.575, lng: 73.748, price: '₹10k/yr', icon: '🏃', color: 'marker-bg-blue', verified: true },
        { id: 9, type: 'gym', name: 'Silver Sports Club', lat: 18.573, lng: 73.742, price: 'Pool', icon: '🏊', color: 'marker-bg-blue' },
        
        { id: 10, type: 'food', name: 'Mezza9', lat: 18.592, lng: 73.744, price: '4.5★', icon: '🍽️', color: 'marker-bg-orange', verified: true },
        { id: 11, type: 'food', name: 'Ignite - Courtyard', lat: 18.586, lng: 73.736, price: '4.8★', icon: '🥂', color: 'marker-bg-orange', verified: true },
        { id: 12, type: 'food', name: 'Behrouz Biryani', lat: 18.585, lng: 73.758, price: '4.2★', icon: '🍲', color: 'marker-bg-orange' },
        { id: 13, type: 'food', name: "Domino's Pizza", lat: 18.590, lng: 73.750, price: '4.0★', icon: '🍕', color: 'marker-bg-orange' },
        { id: 14, type: 'food', name: 'Kasturi Restaurant', lat: 18.580, lng: 73.740, price: '4.1★', icon: '🍛', color: 'marker-bg-orange' },
        { id: 15, type: 'food', name: 'Thikana', lat: 18.595, lng: 73.735, price: '4.6★', icon: '🍻', color: 'marker-bg-orange', verified: true }
    ];

    let map;
    let markersLayer;
    
    // Initialize map
    const mapEl = document.getElementById('leaflet-map');
    if (mapEl && typeof L !== 'undefined') {
        const centerLat = state.lat;
        const centerLng = state.lon;
        
        map = L.map('leaflet-map', {
            zoomControl: false 
        }).setView([centerLat, centerLng], 14);
        
        window.leafletMap = map;
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors',
            className: 'map-tiles'
        }).addTo(map);
        
        L.control.zoom({ position: 'topright' }).addTo(map);
        window.officeMarkerLayer = L.layerGroup().addTo(map);
        
        window.updateMapOffice = function() {
            window.officeMarkerLayer.clearLayers();
            L.circle([state.lat, state.lon], {
                color: '#8b5cf6',
                fillColor: '#f3e8ff',
                fillOpacity: 0.2,
                radius: 1500,
                dashArray: '5, 10',
                weight: 2
            }).addTo(window.officeMarkerLayer);
            
            const officeIcon = L.divIcon({
                className: 'custom-map-marker',
                html: `<div class="office-marker"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" stroke-width="2"><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4M9 7h6M9 11h6M9 15h6"/></svg>${state.company.split(',')[0]}</div>`,
                iconSize: [140, 40],
                iconAnchor: [70, 20]
            });
            L.marker([state.lat, state.lon], { icon: officeIcon, zIndexOffset: 1000 }).addTo(window.officeMarkerLayer);
            
            if (markersLayer) renderMapMarkers('all');
        };
        
        markersLayer = L.layerGroup().addTo(map);
        window.updateMapOffice();
    }

    function renderMapMarkers(filterType, isVerified = false) {
        if(!markersLayer) return;
        markersLayer.clearLayers();
        
        mockProperties.forEach(prop => {
            if (filterType !== 'all' && prop.type !== filterType && prop.type !== 'circle') {
                return;
            }
            if (prop.type !== 'circle') {
                if (isVerified && !prop.verified) return;
            }
            
            let iconHtml = '';
            if (prop.type === 'circle') {
                iconHtml = `<div class="map-circle-marker">${prop.label}</div>`;
            } else {
                iconHtml = `
                    <div class="marker-bubble">
                        <div class="marker-icon-circle ${prop.color}">${prop.icon}</div>
                        ${prop.price}
                    </div>
                `;
            }
            
            const customIcon = L.divIcon({
                className: 'custom-map-marker',
                html: iconHtml,
                iconSize: [100, 40],
                iconAnchor: prop.type === 'circle' ? [16, 16] : [50, 40]
            });
            
            const marker = L.marker([prop.lat, prop.lng], { icon: customIcon }).addTo(markersLayer);
            
            marker.on('click', () => {
                const el = marker.getElement();
                if(el) {
                    el.style.transform = el.style.transform + ' scale(1.15)';
                    el.style.zIndex = 1000;
                    setTimeout(() => goToStep(5), 400); // Go to room selection
                }
            });
        });
    }

    // Filter Logic
    const realMapPills = document.querySelectorAll('.real-map-pill');
    realMapPills.forEach(pill => {
        pill.addEventListener('click', () => {
            if(pill.classList.contains('icon-pill')) {
                pill.classList.toggle('active');
            } else {
                realMapPills.forEach(p => {
                    if(!p.classList.contains('icon-pill')) p.classList.remove('active')
                });
                pill.classList.add('active');
            }
            
            const activeMain = Array.from(realMapPills).find(p => p.classList.contains('active') && !p.classList.contains('icon-pill'));
            const filterType = activeMain ? activeMain.getAttribute('data-filter') : 'all';
            
            const verifiedPill = document.querySelector('.verified-pill');
            const isVerified = verifiedPill ? verifiedPill.classList.contains('active') : false;
            
            renderMapMarkers(filterType, isVerified);
        });
    });
    
    const toggleSwitch = document.querySelector('.toggle-switch');
    if (toggleSwitch) {
        toggleSwitch.addEventListener('click', () => {
            toggleSwitch.classList.toggle('active');
        });
    }
    
    const searchAreaBtn = document.querySelector('.real-map-search-area');
    if (searchAreaBtn) {
        searchAreaBtn.addEventListener('click', () => {
            const originalHtml = searchAreaBtn.innerHTML;
            searchAreaBtn.innerHTML = 'Searching...';
            searchAreaBtn.style.opacity = '0.7';
            setTimeout(() => {
                searchAreaBtn.innerHTML = originalHtml;
                searchAreaBtn.style.opacity = '1';
                
                // Slightly move map to simulate refresh
                if(window.leafletMap) {
                    window.leafletMap.panBy([0, 10]);
                    setTimeout(() => window.leafletMap.panBy([0, -10]), 300);
                }
            }, 800);
        });
    }

    const btnToRoom = document.getElementById('btn-to-room');
    if(btnToRoom) btnToRoom.addEventListener('click', () => goToStep(5));

    // 8. STEP 5: ROOM
    const roomOptions = document.querySelectorAll('.room-option');
    const roomDetailCard = document.getElementById('room-detail-card');
    
    const roomDetails = {
        'three': { badge: 'Spacious', title: 'Three Sharing Room', items: ['3 Beds', '3 Wardrobes', 'Study Table', 'Attached Balcony'] },
        'two': { badge: 'Comfortable', title: 'Two Sharing Room', items: ['2 Beds', '2 Wardrobes', 'Study Desk', 'Attached Bathroom'] },
        'single': { badge: 'Private', title: 'Single Room', items: ['1 Queen Bed', 'Personal Wardrobe', 'Work Desk', 'Private Bathroom'] }
    };

    roomOptions.forEach(option => {
        option.addEventListener('click', () => {
            roomOptions.forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            
            const roomTypeKey = option.getAttribute('data-room');
            const h4 = option.querySelector('h4');
            if(h4) state.roomType = h4.textContent;
            
            const price = option.getAttribute('data-price');
            if(price) state.roomPrice = parseInt(price);
            
            // Update details
            const details = roomDetails[roomTypeKey];
            if(roomDetailCard && details) {
                const badge = roomDetailCard.querySelector('.room-detail-badge');
                if(badge) badge.textContent = details.badge;
                
                const title = roomDetailCard.querySelector('h4');
                if(title) title.textContent = details.title;
                
                const list = roomDetailCard.querySelector('.room-detail-list');
                if(list) {
                    list.innerHTML = '';
                    details.items.forEach(item => {
                        const li = document.createElement('li');
                        li.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="#7C3AED"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> ${item}`;
                        list.appendChild(li);
                    });
                }
            }
            
            // Pulse animation
            option.style.transform = 'scale(0.97)';
            setTimeout(() => option.style.transform = '', 150);
        });
    });

    const btnToMatches = document.getElementById('btn-to-matches');
    if(btnToMatches) btnToMatches.addEventListener('click', () => goToStep(6));

    // 9. STEP 6: MATCHES
    document.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', () => goToStep(7));
    });
    
    const btnToSummary = document.getElementById('btn-to-summary');
    if(btnToSummary) btnToSummary.addEventListener('click', () => goToStep(7));
    
    const exploreMoreBtn = document.getElementById('explore-more-btn');
    if(exploreMoreBtn) exploreMoreBtn.addEventListener('click', () => {
        showToast('More options coming soon!');
    });

    // 10. STEP 6: SUMMARY
    function updateSummary() {
        const sc = document.getElementById('summary-company'); if(sc) sc.textContent = state.company;
        const cc = document.getElementById('cost-company'); if(cc) cc.textContent = state.company;
        
        const sf = document.getElementById('summary-food'); if(sf) sf.textContent = state.food;
        const cf = document.getElementById('cost-food'); if(cf) cf.textContent = state.food;
        const cfa = document.getElementById('cost-food-amount'); if(cfa) cfa.textContent = `₹${state.foodPrice.toLocaleString()}/month`;
        
        const facilitiesText = state.facilities.length > 0 ? state.facilities.join(', ') : 'None selected';
        const sfac = document.getElementById('summary-facilities'); if(sfac) sfac.textContent = facilitiesText;
        const cfac = document.getElementById('cost-facilities'); if(cfac) cfac.textContent = facilitiesText;
        
        const sr = document.getElementById('summary-room'); if(sr) sr.textContent = state.roomType;
        const cr = document.getElementById('cost-room'); if(cr) cr.textContent = state.roomType;
        const cra = document.getElementById('cost-room-amount'); if(cra) cra.textContent = `₹${state.roomPrice.toLocaleString()}/month`;
        
        const total = state.foodPrice + state.roomPrice;
        const ct = document.getElementById('cost-total'); if(ct) ct.textContent = `₹${total.toLocaleString()}/month`;
    }

    const editLink = document.querySelector('.edit-link');
    if(editLink) editLink.addEventListener('click', () => goToStep(0));

    function finishFlow() {
        createConfetti();
        setTimeout(() => {
            alert('Redirecting to your perfect stay...');
        }, 1500);
    }

    const ctaFinal = document.getElementById('cta-final');
    if(ctaFinal) ctaFinal.addEventListener('click', finishFlow);
    
    const ctaSeeStays = document.getElementById('cta-see-stays');
    if(ctaSeeStays) ctaSeeStays.addEventListener('click', finishFlow);

    // UTILS
    function createConfetti() {
        const colors = ['#7C3AED', '#a855f7', '#F59E0B', '#22c55e', '#ec4899'];
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.width = `${Math.random() * 5 + 5}px`;
            confetti.style.height = `${Math.random() * 5 + 5}px`;
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = `${Math.random() * 100}vw`;
            confetti.style.top = '-10px';
            confetti.style.zIndex = '10000';
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            
            document.body.appendChild(confetti);
            
            const animation = confetti.animate([
                { transform: 'translate3d(0,0,0) rotateX(0) rotateY(0)', opacity: 1 },
                { transform: `translate3d(${Math.random()*200 - 100}px, 100vh, 0) rotateX(${Math.random()*360}deg) rotateY(${Math.random()*360}deg)`, opacity: 0 }
            ], {
                duration: Math.random() * 1000 + 1500,
                easing: 'cubic-bezier(.37,0,.63,1)'
            });
            
            animation.onfinish = () => confetti.remove();
        }
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%) translateY(100px)';
        toast.style.background = '#1a1a2e';
        toast.style.color = 'white';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '8px';
        toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        toast.style.zIndex = '9999';
        toast.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.style.transform = 'translateX(-50%) translateY(0)', 10);
        
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(100px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
});
