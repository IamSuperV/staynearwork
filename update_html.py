import re
import sys

def main():
    file_path = "index.html"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update step-total
    content = content.replace('<span class="step-total">06</span>', '<span class="step-total">07</span>')

    # 2. Update data-steps
    content = content.replace('class="step step-room" data-step="4"', 'class="step step-room" data-step="5"')
    content = content.replace('class="step step-matches" data-step="5"', 'class="step step-matches" data-step="6"')
    content = content.replace('class="step step-summary" data-step="6"', 'class="step step-summary" data-step="7"')

    # 3. Step numbering in indicators. Replace exactly the known indicators for the latter steps.
    content = content.replace('<span class="step-num">06</span> / <span class="step-total">07</span>', '<span class="step-num">07</span> / <span class="step-total">07</span>')
    content = content.replace('<span class="step-num">05</span> / <span class="step-total">07</span>', '<span class="step-num">06</span> / <span class="step-total">07</span>')
    content = content.replace('<span class="step-num">04</span> / <span class="step-total">07</span>', '<span class="step-num">05</span> / <span class="step-total">07</span>')

    # 4. Progress bar manipulation.
    # Add the Map dot before the Room dot.
    
    # We will just replace the specific <div class="progress-dot" data-target="4"> patterns.
    dot_uncompleted = '<div class="progress-dot" data-target="4"><span class="dot-num">04</span><span class="dot-label">Room</span></div>'
    dot_uncompleted_new = '<div class="progress-dot" data-target="4"><span class="dot-num">04</span><span class="dot-label">Map</span></div>\\n                    <div class="progress-line"></div>\\n                    <div class="progress-dot" data-target="5"><span class="dot-num">05</span><span class="dot-label">Room</span></div>'
    content = content.replace(dot_uncompleted, dot_uncompleted_new.replace('\\n', '\n'))

    dot_uncompleted_2 = '<div class="progress-dot" data-target="4">\n                        <span class="dot-num">04</span>\n                        <span class="dot-label">Room</span>\n                    </div>'
    dot_uncompleted_2_new = '<div class="progress-dot" data-target="4">\n                        <span class="dot-num">04</span>\n                        <span class="dot-label">Map</span>\n                    </div>\n                    <div class="progress-line"></div>\n                    <div class="progress-dot" data-target="5">\n                        <span class="dot-num">05</span>\n                        <span class="dot-label">Room</span>\n                    </div>'
    content = content.replace(dot_uncompleted_2, dot_uncompleted_2_new)

    dot_completed = '<div class="progress-dot completed" data-target="4"><span class="dot-num">04</span></div>'
    dot_completed_new = '<div class="progress-dot completed" data-target="4"><span class="dot-num">04</span></div>\n                    <div class="progress-line filled"></div>\n                    <div class="progress-dot completed" data-target="5"><span class="dot-num">05</span></div>'
    content = content.replace(dot_completed, dot_completed_new)

    dot_active = '<div class="progress-dot active" data-target="4">\n                        <span class="dot-num">04</span>\n                        <span class="dot-label">Room</span>\n                    </div>'
    dot_active_new = '<div class="progress-dot completed" data-target="4"><span class="dot-num">04</span></div>\n                    <div class="progress-line filled"></div>\n                    <div class="progress-dot active" data-target="5">\n                        <span class="dot-num">05</span>\n                        <span class="dot-label">Room</span>\n                    </div>'
    content = content.replace(dot_active, dot_active_new)

    # 5. Fix Next button ID in Facilities
    content = content.replace('id="btn-to-room"', 'id="btn-to-map"')
    
    # 6. Insert new HTML step
    step_map_html = """
    <!-- ==================== STEP 4: NEIGHBORHOOD MAP ==================== -->
    <section class="step step-map" data-step="4" id="step-map">
        <div class="step-bg">
            <img src="images/hero.png" alt="Map scene" class="step-bg-img" style="filter: blur(5px) brightness(1.1) contrast(0.9); transform: scale(1.1);" />
            <div class="step-bg-overlay step-bg-overlay-light"></div>
        </div>

        <div class="step-header">
            <div class="progress-bar">
                <div class="progress-dots">
                    <div class="progress-dot completed" data-target="1"><span class="dot-num">01</span></div>
                    <div class="progress-line filled"></div>
                    <div class="progress-dot completed" data-target="2"><span class="dot-num">02</span></div>
                    <div class="progress-line filled"></div>
                    <div class="progress-dot completed" data-target="3"><span class="dot-num">03</span></div>
                    <div class="progress-line filled"></div>
                    <div class="progress-dot active" data-target="4">
                        <span class="dot-num">04</span>
                        <span class="dot-label">Map</span>
                    </div>
                    <div class="progress-line"></div>
                    <div class="progress-dot" data-target="5"><span class="dot-num">05</span><span class="dot-label">Room</span></div>
                </div>
            </div>
        </div>

        <div class="step-content map-content">
            <h2 class="section-title">Explore your neighborhood</h2>
            <p class="section-subtitle">Everything you need, right around the corner.</p>

            <div class="map-overlay-panel">
                <div class="map-filter-pills">
                    <button class="map-pill active" data-filter="all">All</button>
                    <button class="map-pill" data-filter="gym">Gyms</button>
                    <button class="map-pill" data-filter="salon">Salons</button>
                    <button class="map-pill" data-filter="grocery">Groceries</button>
                </div>
                
                <div class="interactive-map-container">
                    <div class="map-grid">
                        <div class="map-road map-road-h" style="top: 30%"></div>
                        <div class="map-road map-road-v" style="left: 50%"></div>
                        <div class="map-road map-road-h" style="top: 70%"></div>
                        <div class="map-road map-road-v" style="left: 20%"></div>
                    </div>
                    <div class="map-pin glass-pin" style="top: 25%; left: 30%;" data-type="gym">
                        <div class="pin-icon bg-pink">🏋️</div>
                        <div class="pin-info"><strong>FitPro Gym</strong><span>200m</span></div>
                    </div>
                    <div class="map-pin glass-pin" style="top: 60%; left: 70%;" data-type="salon">
                        <div class="pin-icon bg-green">✂️</div>
                        <div class="pin-info"><strong>Style Studio</strong><span>450m</span></div>
                    </div>
                    <div class="map-pin glass-pin" style="top: 40%; left: 15%;" data-type="grocery">
                        <div class="pin-icon bg-blue">🛒</div>
                        <div class="pin-info"><strong>Daily Needs</strong><span>100m</span></div>
                    </div>
                    <div class="map-pin glass-pin" style="top: 75%; left: 45%;" data-type="hospital">
                        <div class="pin-icon bg-red">🏥</div>
                        <div class="pin-info"><strong>City Care</strong><span>600m</span></div>
                    </div>
                    
                    <div class="map-pin glass-pin pin-office pulse" style="top: 45%; left: 50%;">
                        <div class="pin-icon bg-purple">🏢</div>
                        <div class="pin-info"><strong>Your Office</strong></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="step-nav">
            <div class="step-indicator">
                <span class="step-num">04</span> / <span class="step-total">07</span>
            </div>
            <button class="next-btn" id="btn-to-room" aria-label="Next">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
        </div>
    </section>
"""
    
    # 7. Insert step-map HTML replacing the STEP 5 header (which will now be renumbered or just comment)
    # Wait, the comment is: "    <!-- ==================== STEP 5: ROOM SHARING ==================== -->"
    content = content.replace('    <!-- ==================== STEP 5: ROOM SHARING ==================== -->', step_map_html + '\n    <!-- ==================== STEP 5: ROOM SHARING ==================== -->')

    # Update summary step to 7 in comments too, optionally. Not strictly necessary.
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print("HTML updated successfully.")

if __name__ == "__main__":
    main()
