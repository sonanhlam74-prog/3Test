document.addEventListener('DOMContentLoaded', function () {
    const buttons = document.querySelectorAll('.tab-button');
    const searchInput = document.querySelector('.search_input');
    const locationBtn = document.querySelector('.location-btn');
    
    console.log('Search input found:', searchInput);

    // Dropdown menu toggle functionality
    const settingBtn = document.querySelector('.setting-btn');
    const dropdown = document.querySelector('.dropdown');
    const dropdownContent = document.querySelector('.dropdown-content');
    
    if (settingBtn && dropdown) {
        settingBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
        
        // Prevent dropdown from closing when clicking inside
        if (dropdownContent) {
            dropdownContent.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }
    }

    let dailyCache = [];
    let dailyHoursCache = [];

    async function fetchWeather(city) {
        console.log('Fetching weather for:', city);
        try {
            const response = await fetch(`/api/weather/${city}`);
            const data = await response.json();
            if (data.error) { console.error('Error:', data.error); return; }
            updateWeatherUI(data);
            // Update location display
            const positionEl = document.querySelector('.position');
            if (positionEl) {
                positionEl.textContent = `Hôm nay ${data.location}`;
            }
            // Cache daily + per-day hours
            if (Array.isArray(data.daily)) dailyCache = data.daily;
            if (Array.isArray(data.daily_hours)) dailyHoursCache = data.daily_hours;
            if (Array.isArray(data.hourly)) {
                renderHourlyForecast(data.hourly);
                renderHourlyCharts(data.hourly);
            }
            if (dailyCache.length) renderDailyForecast(dailyCache);
        } catch (error) {
            console.error('Fetch error:', error);
        }
    }
    // --- UV gauge helpers ---
    const arcEl = document.querySelector('.arc-progress');
    const uvCurrentEl = document.querySelector('.uv-current');
    const uvMaxEl = document.querySelector('.uv-max');
    // safe defaults if elements not yet present; we'll re-query inside showUV when needed

    function uvColor(level) {
        // Colors by UV scale: 0-2 green, 3-5 yellow, 6-7 orange, 8-10 red, 11+ purple
        if (level <= 2) return '#2e7d32';
        if (level <= 5) return '#f9a825';
        if (level <= 7) return '#ef6c00';
        if (level <= 10) return '#d32f2f';
        return '#6a1b9a';
    }
    function airPressureColor(level) {
        if (level < 1000) return '#1976d2'; // low pressure - blue
        if (level <= 1020) return '#388e3c';
        return '#f57c00'; // high pressure - orange
    }
    function showUV(value) {
        // lazy-select elements in case DOM updated
        const arc = arcEl || document.querySelector('.arc-progress');
        const uvCur = uvCurrentEl || document.querySelector('.uv-current');
        const uvMax = uvMaxEl || document.querySelector('.uv-max');

        const max = 11;
        const v = Math.max(0, Number(value) || 0);
        if (uvCur) uvCur.textContent = v > max ? `${max}+` : String(v);
        if (uvMax) uvMax.textContent = String(max);

        if (!arc) return; // nothing to draw

        // ensure stroke transition is smooth
        arc.style.transition = 'stroke-dasharray 700ms ease, stroke 400ms ease';

        const total = arc.getTotalLength ? arc.getTotalLength() : 100; // fallback
        const percent = Math.min(v, max) / max;
        const visible = total * percent;
        arc.style.strokeDasharray = `${visible} ${total}`;
        arc.style.stroke = uvColor(v);
    }

    // expose for testing
    window.showUV = showUV;

    // --- Air pressure gauge helpers ---
    const airArcEl = document.querySelector('.air-pressure-icon .arc-progress');

    function showAirPressure(value) {
        // lazy-select in case DOM updated
        const arc = airArcEl || document.querySelector('.air-pressure-icon .arc-progress');
        if (!arc) return;

        const v = Number(value) || 0;
        // Map typical sea-level pressure range to 0..1 for the semicircle
        // Assumption: consider 950..1050 hPa as full range (adjustable)
        const min = 950;
        const max = 1050;
        const clamped = Math.max(min, Math.min(max, v));
        const percent = (clamped - min) / (max - min);

        // compute stroke dasharray based on path length
        const total = arc.getTotalLength ? arc.getTotalLength() : 100;
        const visible = Math.round(total * percent);
        arc.style.transition = 'stroke-dasharray 700ms ease, stroke 400ms ease';
        arc.style.strokeDasharray = `${visible} ${total}`;
        // color handled elsewhere (airPressureColor)
    }

    // expose for testing
    window.showAirPressure = showAirPressure;

    

    function updateWeatherUI(data) {
        document.querySelector('.temperature').textContent = `${Math.round(data.temperature)}°C`;
        document.querySelector('.condition').textContent = data.condition;
        document.querySelector('.weather-image').src = `https:${data.icon}`;
        
        // Cập nhật địa điểm thành phố
        const locationElement = document.querySelector('.location');
        if (locationElement) {
            locationElement.textContent = `Hôm nay ${data.location}`;
        }
        
        // Cập nhật Wind-chill
        const windChillValue = document.querySelector('.wind-chill-value');
        if (windChillValue) {
            windChillValue.textContent = `${Math.round(data.windchill_c)}°C`;
        }

        const heatIndexValue = document.querySelector('.heat-index-value');
        if (heatIndexValue) {
            heatIndexValue.textContent = `${Math.round(data.heat_index_c)}°C`;
        }
        
        const visibilityValue = document.querySelector('.visibility-value');
        if (visibilityValue) {
            visibilityValue.textContent = `${data.visibility_km} Km`;
        }

        const cloudCoverValue = document.querySelector('.cloud-cover-value');
        if (cloudCoverValue) {
            cloudCoverValue.textContent = `${data.cloud_cover}%`;
        }
        // Update wind values using the actual classes in the markup
        const windSpeedEl = document.querySelector('.wind-speed');
        const windGustEl = document.querySelector('.wind-gust');
        const windDegreeEl = document.querySelector('.wind-degree');

        if (windSpeedEl) {
            windSpeedEl.textContent = `${data.wind_kph} km/h`;
        }
        if (windGustEl) {
            windGustEl.textContent = `${data.gust_kph} km/h`;
        }
        if (windDegreeEl) {
            // Show numeric degree and, if available, cardinal direction (e.g. N, NE)
            const dir = data.wind_dir || data.wind_direction || '';
            const degree = (data.wind_degree !== undefined && data.wind_degree !== null) ? `${data.wind_degree}°` : '--';
            windDegreeEl.textContent = dir ? `${degree} W` : degree;
        }
        const relativeHumidityValues = document.querySelectorAll('.relative-humidity-value');
        // Support 0, 1 or 2 elements in the markup. If only one exists, set it.
        if (relativeHumidityValues.length >= 1) {
            relativeHumidityValues[0].textContent = `${data.relative_humidity}%`;
        }
        if (relativeHumidityValues.length >= 2) {
            relativeHumidityValues[1].textContent = `Điểm sương: ${data.relative_humidity}%`;
        } else {
            // If there's only one value element, update the caption (if present) instead
            const rhCaption = document.querySelector('.relative-humidity-caption');
            if (rhCaption) rhCaption.textContent = `Điểm sương: ${data.relative_humidity}%`;
        }
        // Render UV gauge (arc + numeric). If gauge is present, showUV will handle it.
        if (typeof showUV === 'function') showUV(data.uv_index);
        // Update the gauge-centered pressure value and the unit below the gauge.
        const airPressureCurrent = document.querySelector('.air-pressure-current');
        const airPressureUnitBelow = document.querySelector('.air-pressure-unit-below');
        if (airPressureCurrent) {
            airPressureCurrent.textContent = `${data.air_pressure_hpa}`;
            // color the text according to pressure
            if (typeof airPressureColor === 'function') airPressureCurrent.style.color = airPressureColor(data.air_pressure_hpa);
        }
        if (airPressureUnitBelow) airPressureUnitBelow.textContent = 'hPa';

        // color the air-pressure arc and scale it according to value if present
        const apArc = document.querySelector('.air-pressure-icon .arc-progress');
        if (apArc && typeof airPressureColor === 'function') {
            apArc.style.stroke = airPressureColor(data.air_pressure_hpa);
        }
        if (typeof showAirPressure === 'function') showAirPressure(data.air_pressure_hpa);

        const items = document.querySelectorAll('.item:not(.empty-space)');
        
        // (air pressure coloring handled above)
        // Item 0: Cảm giác như
        if (items[0]) {
            const span = items[0].querySelector('span:not(.tooltip-text)');
            if (span) span.textContent = `${Math.round(data.feels_like)}°C`;
        }
        
        // Item 1: Nhiệt độ thay đổi 24 giờ qua
        if (items[1]) {
            const span = items[1].querySelector('span:not(.tooltip-text)');
            if (span) span.textContent = `${data.temp_change_24h >= 0 ? '+' : ''}${Math.round(data.temp_change_24h)}°C`;
        }
        
        // Item 2: Khả năng sấm sét
        if (items[2]) {
            const span = items[2].querySelector('span:not(.tooltip-text)');
            if (span) span.textContent = `${data.chance_of_thunder}%`;
        }
        
        // Item 3: Nhiệt độ cao nhất
        if (items[3]) {
            const span = items[3].querySelector('span:not(.tooltip-text)');
            if (span) span.textContent = `${Math.round(data.temp_max)}°C`;
        }
        
        // Item 4: Nhiệt độ thấp nhất
        if (items[4]) {
            const span = items[4].querySelector('span:not(.tooltip-text)');
            if (span) span.textContent = `${Math.round(data.temp_min)}°C`;
        }
        
        // Item 5: QPF
        if (items[5]) {
            const span = items[5].querySelector('span:not(.tooltip-text)');
            if (span) span.textContent = `${data.precip_mm} mm`;
        }
        
        // Item 6: Khả năng mưa
        if (items[6]) {
            const span = items[6].querySelector('span:not(.tooltip-text)');
            if (span) span.textContent = `${data.chance_of_rain}%`;
        }

    }
    
    // Kiểm tra searchInput tồn tại trước khi thêm event listener
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            console.log('Key pressed:', e.key); // Debug
            if (e.key === 'Enter') {
                const city = this.value.trim();
                console.log('City entered:', city); // Debug
                if (city) {
                    fetchWeather(city);
                }
            }
        });
        
        // Thêm click vào icon search
        const searchIcon = document.querySelector('.searchbar .material-symbols-outlined');
        if (searchIcon) {
            searchIcon.style.cursor = 'pointer';
            searchIcon.addEventListener('click', function() {
                const city = searchInput.value.trim();
                if (city) {
                    fetchWeather(city);
                }
            });
        }
    } else {
        console.error('Search input not found!');
    }
    

    const page1Weather = document.getElementById('page1');
    const page2Content = document.getElementById('page2');
    const page3Analysis = document.getElementById('page3');

    function setActive(pageKey) {
        buttons.forEach(b => b.classList.toggle('active', b.dataset.page === pageKey));

        if (!page1Weather || !page2Content) {
            console.error('Page containers missing', { page1Weather, page2Content });
            return;
        }
        
        if (pageKey === 'page1') {
            page1Weather.classList.remove('hidden');
            page2Content.classList.add('hidden');
            page3Analysis.classList.add('hidden');
        } else if (pageKey === 'page2') {
            page2Content.classList.remove('hidden');
            page1Weather.classList.add('hidden');
            page3Analysis.classList.add('hidden');
        } else if (pageKey === 'page3') {
            page3Analysis.classList.remove('hidden');
            page1Weather.classList.add('hidden');
            page2Content.classList.add('hidden');
            // Update statistics when page 3 is shown
            if (dailyCache.length > 0) {
                updatePage3Statistics(dailyCache);
            }
        }
    }

    buttons.forEach(btn => {
        btn.addEventListener('click', function () {
            setActive(this.dataset.page);
        });
    });
    setActive('page2');
    

    fetchWeather('Hanoi');

    // --------------- Page 2: Hourly forecast (list) ---------------
    function formatHourLabel(isoTime) {
        if (!isoTime) return '';
        // isoTime like "2025-01-01 13:00" -> take HH:mm
        const parts = isoTime.split(' ');
        if (parts.length === 2) return parts[1];
        return isoTime;
    }

    function renderHourlyForecast(hourly) {
        const container = document.querySelector('#page2 .hourly-forecast .hour');
        if (!container) return;
        container.innerHTML = '';

        hourly.forEach((h, idx) => {
            const el = document.createElement('div');
            el.className = 'hour-element' + (idx === 0 ? ' selected' : '');
            const timeLabel = idx === 0 ? 'Now' : formatHourLabel(h.time);
            const windDirDeg = Number(h.wind_degree) || 0;

            el.innerHTML = `
                <p class="item-time">${timeLabel}</p>
                <div class="icon-container">
                    <img class="weather-icon" src="https:${h.icon || ''}" alt="${h.condition_text || ''}" />
                </div>
                <p class="wind">
                    <span>${Math.round(h.wind_kph || 0)}km/h</span>
                    <span style="color: rgb(95,99,104); transform: rotate(${windDirDeg}deg);">
                        <svg width="8" height="9" viewBox="0 0 8 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3.98265 6.87198L0.916818 8.32969C0.812516 8.38088 0.71451 8.39571 0.622801 8.3742C0.531162 8.35274 0.45485 8.31258 0.393883 8.25371C0.332916 8.19483 0.29147 8.11808 0.269545 8.02345C0.247681 7.92888 0.260503 7.82858 0.30802 7.72255L3.67958 0.448403C3.72046 0.350675 3.78148 0.276699 3.86265 0.226375C3.9438 0.176051 4.03019 0.148239 4.12181 0.143139C4.21345 0.138039 4.29889 0.156251 4.37814 0.197674C4.45741 0.239097 4.5154 0.306495 4.55215 0.399968L7.6204 7.32104C7.66263 7.41969 7.67124 7.51767 7.64613 7.61498C7.62102 7.71223 7.57664 7.79379 7.51298 7.85966C7.44942 7.92553 7.37025 7.97406 7.27549 8.00526C7.18071 8.0364 7.08242 8.03207 6.98071 7.99229L3.98265 6.87198Z" fill="currentColor"></path>
                        </svg>
                    </span>
                </p>
            `;
            container.appendChild(el);
        });
    }

    // --------------- Page 2: Hourly charts (temperature, precipitation, UV) ---------------
    function renderHourlyCharts(hourly) {
                const block = document.querySelector('#page2 .charts-block');
                if (!block) return;
                block.innerHTML = '';
                const feels = hourly.map(h => h.feelslike_c ?? h.temp_c);
                const temps = hourly.map(h => h.temp_c);
                const rains = hourly.map(h => Number(h.chance_of_rain) || 0);
                const uvs = hourly.map(h => Number(h.uv) || 0);

                const section = document.createElement('div');
                section.className = 'chart-pack';
                section.innerHTML = `
                        <div class="chart-row">
                            <h4>Cảm giác thực tế</h4>
                            <div class="chart" id="chart-temp"></div>
                        </div>
                        <div class="chart-row">
                            <h4>Lượng mưa</h4>
                            <div class="chart" id="chart-rain"></div>
                        </div>
                        <div class="chart-row">
                            <h4>Chỉ số UV</h4>
                            <div class="chart" id="chart-uv"></div>
                        </div>`;
                block.appendChild(section);
                
                // Match chart block width to the hourly forecast block width
                const hourlyBlock = document.querySelector('#page2 .hourly-forecast .hour');
                if (hourlyBlock) {
                    block.style.width = `${hourlyBlock.scrollWidth}px`;
                }

                const tempHost = section.querySelector('#chart-temp');
                const rainHost = section.querySelector('#chart-rain');
                const uvHost = section.querySelector('#chart-uv');

                drawDualLineChart(tempHost, temps, feels, '#fbbc04', '#ffd54f');
                drawLineChart(rainHost, rains, '#4285f4');
                drawBarChart(uvHost, uvs, '#34a853');
                linkScrollers();
    }

    // Measure current hourly tile layout for precise alignment
    function getHourLayout(){
        const row = document.querySelector('#page2 .hourly-forecast .hour');
        if(!row) return null;
        const els = row.querySelectorAll('.hour-element');
        const count = els.length;
        if(count === 0) return null;
        const r1 = els[0].getBoundingClientRect();
        let tileWidth = Math.round(r1.width); // ensure integer width centers
        let gap = 8;
        if(count > 1){
            const r2 = els[1].getBoundingClientRect();
            gap = Math.max(0, Math.round(r2.left - r1.right));
        }
    const totalWidth = tileWidth * count + gap * (count - 1);
    // Use the exact rounded content width; avoid manual -1 which can cause drift vs scrollWidth
    return {count, tileWidth, gap, totalWidth: Math.max(0, Math.round(totalWidth))};
    }

    function drawLineChart(host, values, stroke = '#000') {
        const layout = getHourLayout();
        const count = values.length;
        const width = host.clientWidth;
        const height = 150;
        const topPad = 25; // Space for text labels at top
        const bottomPad = 0; // No space at bottom - flush with container
        const leftPad = layout ? (layout.tileWidth / 2) : 8;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const span = max - min || 1;
        const stepX = layout ? (layout.tileWidth + layout.gap) : ((width - leftPad * 2) / Math.max(1, count - 1));
        const points = values.map((v, i) => {
            const x = leftPad + i * stepX;
            const y = topPad + (1 - (v - min) / span) * (height - topPad - bottomPad);
            return `${x},${y}`;
        }).join(' ');

        host.innerHTML = '';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));
        
        // Add vertical grid lines
        const gridGroup = document.createElementNS('http://www.w3.org/2000/svg','g');
        for(let i=0; i < count; i++){ 
            const x = leftPad + i*stepX; 
            const line=document.createElementNS('http://www.w3.org/2000/svg','line'); 
            line.setAttribute('x1',x); 
            line.setAttribute('y1',topPad); 
            line.setAttribute('x2',x); 
            line.setAttribute('y2',height); 
            line.setAttribute('stroke','#eee'); 
            gridGroup.appendChild(line);
        }
        svg.appendChild(gridGroup);
        
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        poly.setAttribute('fill', 'none');
        poly.setAttribute('stroke', stroke);
        poly.setAttribute('stroke-width', '2');
        poly.setAttribute('points', points);
        svg.appendChild(poly);

        // Add text labels
        values.forEach((v, i) => {
            const x = leftPad + i * stepX;
            const y = topPad + (1 - (v - min) / span) * (height - topPad - bottomPad);
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', y - 5);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '11');
            text.setAttribute('fill', '#333');
            text.textContent = `${v}%`;
            svg.appendChild(text);
        });

        host.appendChild(svg);
    }

    function drawDualLineChart(host, primary, secondary, strokeA='#fbbc04', strokeB='#ffa000') {
        const layout = getHourLayout();
        const width = host.clientWidth;
        const height = 150;
        const topPad = 25; // Space for text labels at top
        const bottomPad = 0; // No space at bottom - flush with container
        const leftPad = layout ? (layout.tileWidth / 2) : 12;
        const all = primary.concat(secondary);
        const min = Math.min(...all);
        const max = Math.max(...all);
        const span = max - min || 1;
        const stepX = layout ? (layout.tileWidth + layout.gap) : ((width - leftPad * 2) / Math.max(1, primary.length - 1));
        function points(arr){
            return arr.map((v,i)=>{
                const x = leftPad + i*stepX;
                const y = topPad + (1 - (v - min)/span)*(height - topPad - bottomPad);
                return `${x},${y}`;
            }).join(' ');
        }
        host.innerHTML='';
        const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));
        const gridGroup = document.createElementNS('http://www.w3.org/2000/svg','g');
        const cols = primary.length;
        for(let i=0;i<cols;i++){ 
            const x = leftPad + i*stepX; 
            const line=document.createElementNS('http://www.w3.org/2000/svg','line'); 
            line.setAttribute('x1',x); 
            line.setAttribute('y1',topPad); 
            line.setAttribute('x2',x); 
            line.setAttribute('y2',height); 
            line.setAttribute('stroke','#eee'); 
            gridGroup.appendChild(line);
        }        
        svg.appendChild(gridGroup);
        const poly1=document.createElementNS('http://www.w3.org/2000/svg','polyline'); poly1.setAttribute('fill','none'); poly1.setAttribute('stroke',strokeA); poly1.setAttribute('stroke-width','2'); poly1.setAttribute('points',points(primary)); svg.appendChild(poly1);
        
        // Add text labels for primary line
        primary.forEach((v, i) => {
            const x = leftPad + i * stepX;
            const y = topPad + (1 - (v - min) / span) * (height - topPad - bottomPad);
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', y - 5);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '11');
            text.setAttribute('fill', '#333');
            text.textContent = `${Math.round(v)}°`;
            svg.appendChild(text);
        });

        host.appendChild(svg);
    }

    function drawBarChart(host, values, fill = '#000') {
        const layout = getHourLayout();
        const width = host.clientWidth;
        const height = 150;
        const topPad = 25; // Space for text labels at top
        const bottomPad = 0; // No space at bottom - flush with container
        const leftPad = layout ? (layout.tileWidth / 2) : 8;
        const max = Math.max(1, ...values);
        const stepX = layout ? (layout.tileWidth + layout.gap) : ((width - leftPad * 2) / Math.max(1, values.length - 1));
        host.innerHTML = '';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));
        
        // Add vertical grid lines
        const gridGroup = document.createElementNS('http://www.w3.org/2000/svg','g');
        for(let i=0; i < values.length; i++){ 
            const x = leftPad + i*stepX; 
            const line=document.createElementNS('http://www.w3.org/2000/svg','line'); 
            line.setAttribute('x1',x); 
            line.setAttribute('y1',topPad); 
            line.setAttribute('x2',x); 
            line.setAttribute('y2',height); 
            line.setAttribute('stroke','#eee'); 
            gridGroup.appendChild(line);
        }
        svg.appendChild(gridGroup);
        
        values.forEach((v, i) => {
            const h = Math.max(1, (v / max) * (height - topPad - bottomPad));
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            const centerX = leftPad + i * stepX;
            const barWidth = layout ? (layout.tileWidth * 0.6) : 20;
            rect.setAttribute('x', String(centerX - barWidth / 2));
            rect.setAttribute('y', String(height - bottomPad - h));
            rect.setAttribute('width', String(barWidth));
            rect.setAttribute('height', String(h));
            rect.setAttribute('fill', fill);
            svg.appendChild(rect);

            // Add text labels
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', centerX);
            text.setAttribute('y', String(height - bottomPad - h - 4));
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '11');
            text.setAttribute('fill', '#333');
            text.textContent = v;
            svg.appendChild(text);
        });
        host.appendChild(svg);
    }

    // Keep charts scroll in sync with hour tiles
    function linkScrollers(){
        const row = document.querySelector('#page2 .hourly-forecast .hour');
        const charts = document.querySelector('#page2 .charts-block');
        if(!row || !charts) return;
        let lock = false;
        row.addEventListener('scroll', ()=>{
            if(lock) return; lock = true; charts.scrollLeft = row.scrollLeft; lock = false;
        });
        charts.addEventListener('scroll', ()=>{
            if(lock) return; lock = true; row.scrollLeft = charts.scrollLeft; lock = false;
        });
    }

    // --------------- Page 2: Daily forecast ---------------
    function weekdayFromDateStr(dateStr) {
        try {
            const d = new Date(dateStr);
            const wd = d.getDay();
            const names = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
            return names[wd] || dateStr;
        } catch { return dateStr; }
    }

    function renderDailyForecast(daily) {
        console.log('Daily forecast data:', daily); // Debug log
        console.log('Number of days:', daily.length); // Debug log
        
        const section = document.querySelector('#page2 daily-forecast');
        if (!section) return;
        const listHost = section.querySelector('.forecast-container .scroll-container');
        const detailsHost = section.querySelector('.forecast-details');
        if (!listHost || !detailsHost) return;

        listHost.innerHTML = '';
        daily.forEach((d, idx) => {
            const card = document.createElement('div');
            card.className = 'forecast-day' + (idx === 0 ? ' selected' : '');
            card.innerHTML = `
                <span class="weekday">${weekdayFromDateStr(d.date)}</span>
                <span class="weekday">${d.date}</span>
                <div class="icon-container"><img class="weather-icon circle" src="https:${d.icon || ''}" alt="${d.condition_text || ''}"/></div>
                <span class="max-temp">${Math.round(d.maxtemp_c)}°C</span>
            `;
            card.addEventListener('click', () => {
                listHost.querySelectorAll('.forecast-day').forEach(el => el.classList.remove('selected'));
                card.classList.add('selected');
                renderDailyDetails(detailsHost, d);
                activeDayIndex = idx;
                syncHourlyForDay();
            });
            listHost.appendChild(card);
        });

        // Render details for the first day by default
        if (daily.length) renderDailyDetails(detailsHost, daily[0]);
        activeDayIndex = 0;
        syncHourlyForDay();
    }

    function renderDailyDetails(host, d) {
        host.innerHTML = '';
        
        // Tìm dữ liệu giờ cho ngày này
        const dayHours = dailyHoursCache.find(dh => dh.date === d.date);
        let dayData = {
            cloud_cover: 0,
            icon: d.icon,
            condition_text: d.condition_text,
            chance_of_rain: d.daily_chance_of_rain || 0,
            precip_mm: d.totalprecip_mm || 0,
            temp: d.maxtemp_c,
            minTemp: d.mintemp_c,
            uv: d.uv,
            humidity: d.avghumidity
        };
        let nightData = {
            cloud_cover: 0,
            icon: d.icon,
            condition_text: d.condition_text,
            chance_of_rain: d.daily_chance_of_rain || 0,
            precip_mm: d.totalprecip_mm || 0,
            temp: d.mintemp_c,
            minTemp: d.mintemp_c,
            uv: d.uv,
            humidity: d.avghumidity
        };

        // Nếu có dữ liệu giờ, tính toán riêng cho ban ngày và ban đêm
        if (dayHours && dayHours.hours) {
            const hours = dayHours.hours;
            
            // Ban ngày: 6:00 - 18:00
            const dayHoursList = hours.filter(h => {
                const hour = parseInt(h.time.split(' ')[1].split(':')[0]);
                return hour >= 6 && hour < 18;
            });
            
            // Ban đêm: 18:00 - 6:00 (ngày hôm sau)
            const nightHoursList = hours.filter(h => {
                const hour = parseInt(h.time.split(' ')[1].split(':')[0]);
                return hour >= 18 || hour < 6;
            });

            // Tính toán cho ban ngày
            if (dayHoursList.length > 0) {
                const cloudCoverAvg = dayHoursList.reduce((sum, h) => sum + (h.cloud || 0), 0) / dayHoursList.length;
                const avgRain = dayHoursList.reduce((sum, h) => sum + (h.chance_of_rain || 0), 0) / dayHoursList.length;
                const totalPrecip = dayHoursList.reduce((sum, h) => sum + (h.precip_mm || 0), 0);
                const maxTemp = Math.max(...dayHoursList.map(h => h.temp_c || 0));
                const minTemp = Math.min(...dayHoursList.map(h => h.temp_c || 0));
                const avgUV = dayHoursList.reduce((sum, h) => sum + (h.uv || 0), 0) / dayHoursList.length;
                const avgHumidity = dayHoursList.reduce((sum, h) => sum + (h.humidity || 0), 0) / dayHoursList.length;
                
                // Lấy icon phổ biến nhất
                const iconCounts = {};
                dayHoursList.forEach(h => {
                    iconCounts[h.icon] = (iconCounts[h.icon] || 0) + 1;
                });
                const mostCommonIcon = Object.keys(iconCounts).reduce((a, b) => iconCounts[a] > iconCounts[b] ? a : b, dayHoursList[0].icon);
                const iconIndex = dayHoursList.findIndex(h => h.icon === mostCommonIcon);
                
                dayData = {
                    cloud_cover: Math.round(cloudCoverAvg),
                    icon: mostCommonIcon,
                    condition_text: dayHoursList[iconIndex]?.condition_text || d.condition_text,
                    chance_of_rain: Math.round(avgRain),
                    precip_mm: totalPrecip,
                    temp: maxTemp,
                    minTemp: minTemp,
                    uv: Math.round(avgUV * 10) / 10,
                    humidity: Math.round(avgHumidity)
                };
            }

            // Tính toán cho ban đêm
            if (nightHoursList.length > 0) {
                const cloudCoverAvg = nightHoursList.reduce((sum, h) => sum + (h.cloud || 0), 0) / nightHoursList.length;
                const avgRain = nightHoursList.reduce((sum, h) => sum + (h.chance_of_rain || 0), 0) / nightHoursList.length;
                const totalPrecip = nightHoursList.reduce((sum, h) => sum + (h.precip_mm || 0), 0);
                const maxTemp = Math.max(...nightHoursList.map(h => h.temp_c || 0));
                const minTemp = Math.min(...nightHoursList.map(h => h.temp_c || 0));
                const avgUV = nightHoursList.reduce((sum, h) => sum + (h.uv || 0), 0) / nightHoursList.length;
                const avgHumidity = nightHoursList.reduce((sum, h) => sum + (h.humidity || 0), 0) / nightHoursList.length;
                
                // Lấy icon phổ biến nhất
                const iconCounts = {};
                nightHoursList.forEach(h => {
                    iconCounts[h.icon] = (iconCounts[h.icon] || 0) + 1;
                });
                const mostCommonIcon = Object.keys(iconCounts).reduce((a, b) => iconCounts[a] > iconCounts[b] ? a : b, nightHoursList[0].icon);
                const iconIndex = nightHoursList.findIndex(h => h.icon === mostCommonIcon);
                
                nightData = {
                    cloud_cover: Math.round(cloudCoverAvg),
                    icon: mostCommonIcon,
                    condition_text: nightHoursList[iconIndex]?.condition_text || d.condition_text,
                    chance_of_rain: Math.round(avgRain),
                    precip_mm: totalPrecip,
                    temp: maxTemp,
                    minTemp: minTemp,
                    uv: Math.round(avgUV * 10) / 10,
                    humidity: Math.round(avgHumidity)
                };
            }
        }
        
        // Card Ban ngày (bên trái)
        const dayCard = document.createElement('div');
        dayCard.className = 'forecast-detail day-forecast';
        dayCard.innerHTML = `
            <div class="detail-title">☀️ Ban ngày</div>
            <div class="conditions">
                <div class="icon-container circle"><img class="weather-icon" src="https:${dayData.icon || ''}" alt="${dayData.condition_text || ''}"/></div>
                <span>${dayData.condition_text || ''}</span>
            </div>
            <div class="probability">
                <p>🌧️ <span>${dayData.chance_of_rain}%</span></p>
                <p>☔ <span>${Math.round(dayData.precip_mm)} mm</span></p>
            </div>
            <div class="addition-info">
                <div class = "row-addition-temp">
                <p><span class = "material-symbols-outlined heat-title-icon">thermostat</span> max: <span>${Math.round(dayData.temp)}°C</span></p>
                <p><span class = "material-symbols-outlined heat-title-icon">thermostat</span> min: <span>${Math.round(dayData.minTemp)}°C</span></p>
                </div>
                <div class = "row-addition-uv-humidity">
                <p><span class = "material-symbols-outlined cloud-cover-title-icon">cloud</span> Mây <span>${dayData.cloud_cover}%</span></p>
                <p><span class = "material-symbols-outlined UV-index-title-icon">sunny</span>UV <span> - ${dayData.uv ?? '-'}</span></p>
                <p><span class = "material-symbols-outlined relative-humidity-title-icon">water_drop</span>Độ ẩm <span>${dayData.humidity}%</span></p>
                </div>
                <p class="moon-sun">
                    <span>${d.sunrise || '-'}</span>
                    <span class="dash"></span>
                    <span>☀️</span>
                    <span class="dash"></span>
                    <span>${d.sunset || '-'}</span>
                </p>
            </div>
        `;
        const nightCard = document.createElement('div');
        nightCard.className = 'forecast-detail night-forecast';
        nightCard.innerHTML = `
            <div class="detail-title">🌙 Ban đêm</div>
            <div class="conditions">
                <div class="icon-container circle"><img class="weather-icon" src="https:${nightData.icon || ''}" alt="${nightData.condition_text || ''}"/></div>
                <span>${nightData.condition_text || ''}</span>
            </div>
            <div class="probability">
                <p>🌧️ <span>${nightData.chance_of_rain}%</span></p>
                <p>☔ <span>${Math.round(nightData.precip_mm)} mm</span></p>
            </div>
            <div class="addition-info">
                <div class = "row-addition-temp">
                <p><span class = "material-symbols-outlined heat-title-icon">thermostat</span> max: <span>${Math.round(nightData.temp)}°C</span></p>
                <p><span class = "material-symbols-outlined heat-title-icon">thermostat</span> min: <span>${Math.round(nightData.minTemp)}°C</span></p>
                </div>
                <div class = "row-addition-uv-humidity">
                <p><span class = "material-symbols-outlined cloud-cover-title-icon">cloud</span> Mây <span>${nightData.cloud_cover}%</span></p>
                <p><span class = "material-symbols-outlined UV-index-title-icon">sunny</span>UV <span> - ${nightData.uv ?? '-'}</span></p>
                <p><span class = "material-symbols-outlined relative-humidity-title-icon">water_drop</span>Độ ẩm <span>${nightData.humidity}%</span></p>
                </div>
                <p class="moon-sun">
                    <span>${d.moonrise || '-'}</span>
                    <span class="dash"></span>
                    <span>🌙</span>
                    <span class="dash"></span>
                    <span>${d.moonset || '-'}</span>
                </p>
            </div>
        `;

        host.appendChild(dayCard);
        host.appendChild(nightCard);
    }

    // ---- Day navigation & keyboard support ----
    let activeDayIndex = 0;
    function syncHourlyForDay(){
        if(!dailyHoursCache.length) return;
        const date = dailyCache[activeDayIndex]?.date;
        const found = dailyHoursCache.find(d => d.date === date);
        if(found){
            renderHourlyForecast(found.hours.slice(0,12));
            renderHourlyCharts(found.hours.slice(0,12));
        }
        updateDayNavHeader();
    }
    function updateDayNavHeader(){
        const dateEl = document.querySelector('#page2 .days-nav .date');
        if(!dateEl) return;
        const dateStr = dailyCache[activeDayIndex]?.date || '';
        dateEl.innerHTML = `<span>${activeDayIndex===0?'Hôm nay':'Ngày '+(activeDayIndex+1)}</span><span>${dateStr}</span>`;
        const backBtn = document.querySelector('#page2 .days-nav .back');
        const nextBtn = document.querySelector('#page2 .days-nav .next');
        if(backBtn) backBtn.disabled = activeDayIndex<=0;
        if(nextBtn) nextBtn.disabled = activeDayIndex>=dailyCache.length-1;
    }
    function shiftDay(delta){
        const newIndex = activeDayIndex + delta;
        if(newIndex < 0 || newIndex >= dailyCache.length) return;
        activeDayIndex = newIndex;
        // highlight card
        const listHost = document.querySelector('#page2 daily-forecast .forecast-container .scroll-container');
        if(listHost){
            listHost.querySelectorAll('.forecast-day').forEach((el,i)=>{
                el.classList.toggle('selected', i===activeDayIndex);
            });
        }
        renderDailyDetails(document.querySelector('#page2 daily-forecast .forecast-details'), dailyCache[activeDayIndex]);
        syncHourlyForDay();
    }
    document.addEventListener('keydown', e => {
        if(document.getElementById('page2') && !document.getElementById('page2').classList.contains('hidden')){
            if(e.key === 'ArrowLeft') shiftDay(-1);
            else if(e.key === 'ArrowRight') shiftDay(1);
        }
    });
    // Hook arrow buttons
    setTimeout(()=>{
        const backBtn = document.querySelector('#page2 .days-nav .back');
        const nextBtn = document.querySelector('#page2 .days-nav .next');
        if(backBtn) backBtn.addEventListener('click', ()=>shiftDay(-1));
        if(nextBtn) nextBtn.addEventListener('click', ()=>shiftDay(1));
    },500);

    // Extend fetch integration to store caches
    // removed secondary refetch override to simplify

    // ============= PAGE 3 STATISTICS FUNCTIONS =============
    
    function updatePage3Statistics(dailyData) {
        if (!dailyData || dailyData.length === 0) return;

        // Calculate temperature statistics
        const temps = dailyData.map(d => d.maxtemp_c);
        const minTemps = dailyData.map(d => d.mintemp_c);
        const avgTemp = (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
        
        const hottestIdx = temps.indexOf(Math.max(...temps));
        const coldestIdx = minTemps.indexOf(Math.min(...minTemps));
        
        document.getElementById('hottest-day').textContent = weekdayFromDateStr(dailyData[hottestIdx].date);
        document.getElementById('hottest-temp').textContent = `${Math.round(dailyData[hottestIdx].maxtemp_c)}°C`;
        document.getElementById('coldest-day').textContent = weekdayFromDateStr(dailyData[coldestIdx].date);
        document.getElementById('coldest-temp').textContent = `${Math.round(dailyData[coldestIdx].mintemp_c)}°C`;
        document.getElementById('avg-temp').textContent = `${avgTemp}°C`;

        // Calculate rain statistics
        const rains = dailyData.map(d => d.totalprecip_mm || 0);
        const avgRain = (rains.reduce((a, b) => a + b, 0) / rains.length).toFixed(1);
        
        const rainiestIdx = rains.indexOf(Math.max(...rains));
        const leastRainIdx = rains.indexOf(Math.min(...rains));
        
        document.getElementById('rainiest-day').textContent = weekdayFromDateStr(dailyData[rainiestIdx].date);
        document.getElementById('rainiest-amount').textContent = `${dailyData[rainiestIdx].totalprecip_mm} mm`;
        document.getElementById('least-rain-day').textContent = weekdayFromDateStr(dailyData[leastRainIdx].date);
        document.getElementById('least-rain-amount').textContent = `${dailyData[leastRainIdx].totalprecip_mm} mm`;
        document.getElementById('avg-rain').textContent = `${avgRain} mm`;

        // Calculate UV statistics
        const uvs = dailyData.map(d => d.uv || 0);
        const avgUV = (uvs.reduce((a, b) => a + b, 0) / uvs.length).toFixed(1);
        
        const highestUVIdx = uvs.indexOf(Math.max(...uvs));
        const lowestUVIdx = uvs.indexOf(Math.min(...uvs));
        
        document.getElementById('highest-uv-day').textContent = weekdayFromDateStr(dailyData[highestUVIdx].date);
        document.getElementById('highest-uv').textContent = `UV ${dailyData[highestUVIdx].uv}`;
        document.getElementById('lowest-uv-day').textContent = weekdayFromDateStr(dailyData[lowestUVIdx].date);
        document.getElementById('lowest-uv').textContent = `UV ${dailyData[lowestUVIdx].uv}`;
        document.getElementById('avg-uv').textContent = `UV ${avgUV}`;

        // Calculate humidity statistics
        const humidities = dailyData.map(d => d.avghumidity || 0);
        
        const highestHumidityIdx = humidities.indexOf(Math.max(...humidities));
        const lowestHumidityIdx = humidities.indexOf(Math.min(...humidities));
        
        document.getElementById('highest-humidity-day').textContent = weekdayFromDateStr(dailyData[highestHumidityIdx].date);
        document.getElementById('highest-humidity').textContent = `${dailyData[highestHumidityIdx].avghumidity}%`;
        document.getElementById('lowest-humidity-day').textContent = weekdayFromDateStr(dailyData[lowestHumidityIdx].date);
        document.getElementById('lowest-humidity').textContent = `${dailyData[lowestHumidityIdx].avghumidity}%`;

        // Build evaluation table
        buildEvaluationTable(dailyData);
        
        // Find and display nice days
        displayNiceDays(dailyData);
    }

    function evaluateDay(day) {
        const temp = day.maxtemp_c;
        const rain = day.totalprecip_mm || 0;
        const uv = day.uv || 0;
        const humidity = day.avghumidity || 0;
        
        let score = 0;
        let issues = [];
        
        // Temperature evaluation (22-28°C is ideal)
        if (temp >= 22 && temp <= 28) {
            score += 25;
        } else if (temp >= 18 && temp <= 32) {
            score += 15;
            issues.push('Nhiệt độ không lý tưởng');
        } else {
            issues.push('Nhiệt độ quá cao/thấp');
        }
        
        // Rain evaluation (no rain is ideal)
        if (rain === 0) {
            score += 25;
        } else if (rain < 5) {
            score += 15;
            issues.push('Có mưa nhẹ');
        } else {
            issues.push('Mưa nhiều');
        }
        
        // UV evaluation (0-5 is ideal)
        if (uv >= 0 && uv <= 5) {
            score += 25;
        } else if (uv <= 7) {
            score += 15;
            issues.push('UV hơi cao');
        } else {
            issues.push('UV rất cao');
        }
        
        // Humidity evaluation (40-60% is ideal)
        if (humidity >= 40 && humidity <= 60) {
            score += 25;
        } else if (humidity >= 30 && humidity <= 70) {
            score += 15;
            issues.push('Độ ẩm không tối ưu');
        } else {
            issues.push('Độ ẩm quá cao/thấp');
        }
        
        // Determine rating
        let rating = '';
        let ratingClass = '';
        
        if (score >= 90) {
            rating = '⭐⭐⭐ Tuyệt vời';
            ratingClass = 'evaluation-good';
        } else if (score >= 70) {
            rating = '⭐⭐ Tốt';
            ratingClass = 'evaluation-good';
        } else if (score >= 50) {
            rating = '⭐ Khá';
            ratingClass = 'evaluation-moderate';
        } else {
            rating = '❌ Không tốt';
            ratingClass = 'evaluation-poor';
        }
        
        return {
            score,
            rating,
            ratingClass,
            issues,
            advice: issues.length > 0 ? issues.join(', ') : 'Thời tiết lý tưởng!'
        };
    }

    function isNiceDay(day) {
        const temp = day.maxtemp_c;
        const rain = day.totalprecip_mm || 0;
        const uv = day.uv || 0;
        const humidity = day.avghumidity || 0;
        
        return temp >= 22 && temp <= 28 &&
               humidity >= 40 && humidity <= 60 &&
               uv >= 0 && uv <= 5 &&
               rain === 0;
    }

    function buildEvaluationTable(dailyData) {
        const tbody = document.getElementById('evaluation-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        dailyData.forEach(day => {
            const evaluation = evaluateDay(day);
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td><strong>${weekdayFromDateStr(day.date)}</strong><br><small>${day.date}</small></td>
                <td>${Math.round(day.maxtemp_c)}°C</td>
                <td>${day.totalprecip_mm || 0} mm</td>
                <td>UV ${day.uv || 0}</td>
                <td>${day.avghumidity || 0}%</td>
                <td class="${evaluation.ratingClass}">
                    ${evaluation.rating}<br>
                    <small style="font-weight: normal; color: #666;">${evaluation.advice}</small>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    function displayNiceDays(dailyData) {
        const container = document.getElementById('nice-days-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        const niceDays = dailyData.filter(day => isNiceDay(day));
        
        if (niceDays.length === 0) {
            container.innerHTML = '<div class="no-nice-days">😔 Không có ngày nào đạt tiêu chí ngày đẹp trời trong khoảng thời gian này.</div>';
            return;
        }
        
        niceDays.forEach(day => {
            const card = document.createElement('div');
            card.className = 'nice-day-card';
            
            card.innerHTML = `
                <div class="day-name">${weekdayFromDateStr(day.date)}</div>
                <div class="day-date">${day.date}</div>
                <div class="day-icon">☀️</div>
                <div class="day-temp">${Math.round(day.maxtemp_c)}°C</div>
                <div style="font-size: 0.85rem; margin-top: 0.5rem; opacity: 0.9;">
                    💧 ${day.avghumidity}% | ☀️ UV ${day.uv}
                </div>
            `;
            
            container.appendChild(card);
        });
    }
});