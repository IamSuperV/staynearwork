// app.js
document.addEventListener('DOMContentLoaded', () => {
    // 1. STATE MANAGEMENT
    const state = {
        currentStep: 0,
        company: 'TCS Hinjewadi Pune',
        food: 'Sai Krishna Mess',
        foodPrice: 3200,
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
            initStep(0); // Initialize first step after loader
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
        if (index < 0 || index >= steps.length) return;
        
        const currentElement = document.querySelector(`.step[data-step="${state.currentStep}"]`);
        const nextElement = document.querySelector(`.step[data-step="${index}"]`);
        
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

    function initStep(index) {
        if (index === 1) {
            const el = document.getElementById('company-name-display');
            if(el) el.textContent = state.company;
        } else if (index === 5) {
            const el = document.getElementById('matches-company');
            if(el) el.textContent = state.company.split(' ')[0];
        } else if (index === 6) {
            updateSummary();
        }
    }

    // 5. STEP 0: HERO
    const companyInput = document.getElementById('company-input');
    const searchSuggestions = document.getElementById('search-suggestions');
    const searchBtn = document.getElementById('search-btn');

    if(companyInput && searchSuggestions) {
        companyInput.addEventListener('input', (e) => {
            if (e.target.value.length > 0) {
                searchSuggestions.style.display = 'flex';
            } else {
                searchSuggestions.style.display = 'none';
            }
        });

        companyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && companyInput.value.trim() !== '') {
                state.company = companyInput.value.trim();
                goToStep(1);
            }
        });
    }

    document.querySelectorAll('.suggestion').forEach(item => {
        item.addEventListener('click', () => {
            const company = item.getAttribute('data-company');
            if(companyInput) companyInput.value = company;
            state.company = company;
            goToStep(1);
        });
    });

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
    const viewToggleBtns = document.querySelectorAll('.view-toggle-btn');
    const foodListView = document.getElementById('food-list-view');
    const foodMapView = document.getElementById('food-map-view');

    viewToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            viewToggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const view = btn.getAttribute('data-view');
            if(view === 'list') {
                if(foodMapView) foodMapView.style.display = 'none';
                if(foodListView) foodListView.style.display = 'block';
            } else {
                if(foodListView) foodListView.style.display = 'none';
                if(foodMapView) foodMapView.style.display = 'block';
            }
        });
    });

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

    const btnToFacilities = document.getElementById('btn-to-facilities');
    if(btnToFacilities) btnToFacilities.addEventListener('click', () => goToStep(3));

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

    const btnToRoom = document.getElementById('btn-to-room');
    if(btnToRoom) btnToRoom.addEventListener('click', () => goToStep(4));

    // 8. STEP 4: ROOM
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
    if(btnToMatches) btnToMatches.addEventListener('click', () => goToStep(5));

    // 9. STEP 5: MATCHES
    document.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', () => goToStep(6));
    });
    
    const btnToSummary = document.getElementById('btn-to-summary');
    if(btnToSummary) btnToSummary.addEventListener('click', () => goToStep(6));
    
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
