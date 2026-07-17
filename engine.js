/**
 * SIYALAIR-INTEL-STUDIO CORE ENGINE (PROD_v2.0_2026)
 * Engineered for high-density global logistics asset synthesis.
 */

window.onload = async () => {
    // FORCE CACHE-BUST: Load the template.js dynamically
    const script = document.createElement('script');
    script.src = 'template.js?t=' + Date.now();
    
    script.onload = async () => {
        console.log("Siyal Air Template loaded successfully.");
        
        // Force fix the background image compatibility
        await fixBackgroundCORS();

        if (typeof dailyData !== 'undefined') {
            initTabs();
            const mainBtn = document.querySelector('.tab-btn');
            if (mainBtn) switchSlide('main', mainBtn);
        }
        
        const dlBtn = document.getElementById('download-active');
        if (dlBtn) {
            dlBtn.onclick = (e) => {
                e.preventDefault();
                downloadAllSlides();
            };
        }
    };
    
    script.onerror = () => {
        console.error("Critical System Fault: Failed to load template.js. Check network path.");
    };
    
    document.head.appendChild(script);
};

/**
 * FIX: Converts the background-image to Base64 
 * Prevents the HTML2Canvas Tainted Canvas exploit block.
 */
async function fixBackgroundCORS() {
    const canvas = document.getElementById('post-canvas');
    if (!canvas) return;

    const bgUrl = 'assets/background.png';
    
    try {
        const response = await fetch(bgUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
            canvas.style.backgroundImage = `url(${reader.result})`;
            console.log("Background channel secured and optimized for render capture.");
        };
        reader.readAsDataURL(blob);
    } catch (e) {
        console.warn("Local sandbox file system blocked fetch. Run via a dedicated local server (VS Code Live Server).");
    }
}

function initTabs() {
    const tabContainer = document.getElementById('slide-tabs');
    if (!tabContainer) return;
    tabContainer.innerHTML = ''; 
    
    const mainBtn = document.createElement('button');
    mainBtn.className = 'tab-btn active';
    mainBtn.innerText = 'MAIN';
    mainBtn.onclick = (e) => { e.preventDefault(); switchSlide('main', mainBtn); };
    tabContainer.appendChild(mainBtn);
    
    dailyData.slides.forEach((slide, index) => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.innerText = `SLIDE-${index + 1}`;
        btn.onclick = (e) => { e.preventDefault(); switchSlide(index + 1, btn); };
        tabContainer.appendChild(btn);
    });

    const followBtn = document.createElement('button');
    followBtn.className = 'tab-btn';
    followBtn.innerText = 'FOLLOW';
    followBtn.onclick = (e) => { e.preventDefault(); switchSlide('follow', followBtn); };
    tabContainer.appendChild(followBtn);
}

function fitText(element, maxHeight, maxWidth) {
    let fontSize = parseInt(window.getComputedStyle(element).fontSize);
    while ((element.scrollHeight > maxHeight || element.scrollWidth > maxWidth) && fontSize > 18) {
        fontSize--;
        element.style.fontSize = fontSize + "px";
    }
}

function switchSlide(id, element) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (element) element.classList.add('active');
    
    const canvas = document.getElementById('post-canvas');
    if (!canvas) return;

    // Structural Title Splitter Logic
    const formatTitleBlue = (text) => {
        if (text.includes(':')) {
            const parts = text.split(':');
            const bluePart = parts[0] + ':';
            const whitePart = parts.slice(1).join(':');
            return `<span class="blue-text">${bluePart}</span>${whitePart}`;
        }
        const words = text.trim().split(' ');
        if (words.length <= 1) return `<span class="last-word-blue">${text}</span>`;
        const last = words.pop();
        return `${words.join(' ')} <span class="last-word-blue">${last}</span>`;
    };

    let html = "";
    if (id === 'main') {
        const fullTitleStr = `${dailyData.main.titleWhite} ${dailyData.main.titleBlue}`.trim();
        const wordsArray = fullTitleStr.split(/\s+/);
        
        const stackedTitleHTML = wordsArray.map((word, idx) => {
            if (idx === wordsArray.length - 1) {
                return `<div class="last-word-blue">${word}</div>`;
            }
            return `<div>${word}</div>`;
        }).join('');

        // DYNAMIC PREVIEW GENERATION: Compiles exactly 7 sub-slide titles for the bottom matrix panel
        const matrixItemsHTML = dailyData.slides.slice(0, 7).map((slide, idx) => {
            const cleanHeading = slide.heading.replace(/:$/, '').trim();
            return `
                <div class="matrix-item">
                    <span class="matrix-num">0${idx + 1}</span>
                    <span class="matrix-text">${cleanHeading}</span>
                </div>
            `;
        }).join('');
        
        canvas.className = 'main-hook-style clean-intel-layout'; 
        html = `
            <div class="content-body intel-cover-container">
                <span class="kicker">UNCLASSIFIED // GLOBAL MACRO BRIEFING</span>
                <header>
                    <h1 class="auto-fit">${stackedTitleHTML}</h1>
                </header>
                
                <!-- Bottom Briefing Matrix Panel -->
                <div class="briefing-bottom-matrix">
                    <div class="matrix-header">INSIDE THIS BRIEFING</div>
                    <div class="matrix-grid-layout">
                        ${matrixItemsHTML}
                    </div>
                </div>
            </div>
            <div class="swipe-prompt">SWIPE NEXT →</div>
        `;
    } else if (id === 'follow') {
        canvas.className = 'main-hook-style cta-slide';
        // CTA FIXED LOGIC: Optimized for conversion and enterprise links
        html = `<div class="content-body">
                <span class="kicker">GLOBAL FREIGHT CONVERSION MATRIX</span>
                <header><h1 class="auto-fit">SCAN. CONNECT. <span class="last-word-blue">FORWARD.</span></h1></header>
                <div class="bulletin-container"><div class="bulletin-label">SIYAL AIR LOGISTICS NETWORKS</div>
                <p class="cta-subtext">Scan the link infrastructure to capture real-time freight routing solutions, cross-border customs advisory, and spot market contract structures.</p></div>
                <div class="barcode-target-zone"></div>
                </div>`;
    } else {
        const index = id - 1;
        const slide = dailyData.slides[index];
        canvas.className = 'sub-slide-style';
        if (slide) {
            // FIXED PARSER: Safely flattens point arrays and splits sentences into individual micro-bullets
            let bulletList = "";
            if (Array.isArray(slide.points)) {
                const combinedText = slide.points.join(' ');
                const sentences = combinedText.split('. ').filter(s => s.trim().length > 0);
                bulletList = sentences.map(s => `<li>${s.trim().replace(/\.$/, '')}</li>`).join('');
            } else if (slide.content) {
                const sentences = slide.content.split('. ').filter(s => s.trim().length > 0);
                bulletList = sentences.map(s => `<li>${s.trim().replace(/\.$/, '')}</li>`).join('');
            }
            
            const formattedHeading = formatTitleBlue(slide.heading);
            
            html = `<div class="content-body">
                    <header><h1 class="auto-fit">${formattedHeading}</h1><div class="header-divider"></div></header>
                    <div class="detail-text"><ul class="smart-bullets">${bulletList}</ul></div>
                    </div><div class="swipe-prompt">SWIPE NEXT →</div>`;
        }
    }
    canvas.innerHTML = html;
    setTimeout(() => {
        const titles = canvas.querySelectorAll('.auto-fit');
        titles.forEach(t => fitText(t, 500, 850));
    }, 50);
}

async function downloadCurrentSlide() {
    const canvas = document.getElementById('post-canvas');
    const dlBtn = document.getElementById('download-active');
    const activeTab = document.querySelector('.tab-btn.active');
    
    if (!canvas || !dlBtn) return;

    dlBtn.innerText = "CAPTURING...";
    dlBtn.disabled = true;

    try {
        const rendered = await html2canvas(canvas, { 
            scale: 2, 
            useCORS: true,
            allowTaint: true, 
            backgroundColor: "#050505",
            logging: false
        });
        
        const imageData = rendered.toDataURL("image/png");
        const link = document.createElement('a');
        const slideName = activeTab ? activeTab.innerText.replace(/\s+/g, '_') : "SLIDE";
        
        link.href = imageData;
        link.download = `SIYAL_AIR_${slideName}.png`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (err) {
        console.error("Capture Error:", err);
        alert("Render extraction halted. Verify local script server permissions.");
    } finally {
        dlBtn.innerText = "DOWNLOAD SLIDE";
        dlBtn.disabled = false;
    }
}

async function downloadAllSlides() {
    const canvas = document.getElementById('post-canvas');
    const dlBtn = document.getElementById('download-active');
    if (!canvas || !dlBtn) return;

    const originalActiveTab = document.querySelector('.tab-btn.active');
    let originalId = 'main';
    
    if (originalActiveTab) {
        if (originalActiveTab.innerText === 'MAIN') originalId = 'main';
        else if (originalActiveTab.innerText === 'FOLLOW') originalId = 'follow';
        else originalId = parseInt(originalActiveTab.innerText.replace('SLIDE-', ''));
    }

    dlBtn.innerText = "CAPTURING ALL...";
    dlBtn.disabled = true;

    const queue = ['main'];
    dailyData.slides.forEach((_, i) => queue.push(i + 1));
    queue.push('follow');

    queue.reverse();

    try {
        for (const slideId of queue) {
            switchSlide(slideId, null);
            await new Promise(resolve => setTimeout(resolve, 80));

            const rendered = await html2canvas(canvas, { 
                scale: 2, 
                useCORS: true,
                allowTaint: true,
                backgroundColor: "#050505",
                logging: false
            });
            
            const imageData = rendered.toDataURL("image/png");
            const link = document.createElement('a');
            const fileSuffix = typeof slideId === 'string' ? slideId.toUpperCase() : `SLIDE_${slideId}`;
            
            link.href = imageData;
            link.download = `SIYAL_AIR_${fileSuffix}.png`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (err) {
        console.error("Bulk Processing Error:", err);
        alert("Bulk download failed. Verify pipeline file system links.");
    } finally {
        switchSlide(originalId, originalActiveTab);
        dlBtn.innerText = "DOWNLOAD ALL SLIDES";
        dlBtn.disabled = false;
    }
}
