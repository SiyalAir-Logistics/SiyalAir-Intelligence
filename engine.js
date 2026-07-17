/**
 * SIYALAIR-INTEL-STUDIO CORE ENGINE
 * Specialized to handle local background images without CORS errors.
 */

window.onload = async () => {
    // FORCE CACHE-BUST: Load the template.js dynamically
    const script = document.createElement('script');
    script.src = 'template.js?t=' + Date.now();
    
    script.onload = async () => {
        console.log("Template loaded successfully.");
        
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
        console.error("Failed to load template.js. Check file path.");
    };
    
    document.head.appendChild(script);
};

/**
 * FIX: Converts the background-image to Base64 
 * This prevents the "Tainted Canvas" error while keeping your image.
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
            console.log("Background optimized for capture.");
        };
        reader.readAsDataURL(blob);
    } catch (e) {
        console.warn("Local fetch blocked. If download fails, run via a local server (VS Code Live Server).");
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
    while ((element.scrollHeight > maxHeight || element.scrollWidth > maxWidth) && fontSize > 20) {
        fontSize--;
        element.style.fontSize = fontSize + "px";
    }
}

function switchSlide(id, element) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (element) element.classList.add('active');
    
    const canvas = document.getElementById('post-canvas');
    if (!canvas) return;

    // UPDATED: Logic to wrap text before and including colon in blue span
    const formatTitleBlue = (text) => {
        if (text.includes(':')) {
            const parts = text.split(':');
            const bluePart = parts[0] + ':';
            const whitePart = parts.slice(1).join(':');
            return `<span class="blue-text">${bluePart}</span>${whitePart}`;
        }
        // Fallback to original logic if no colon
        const words = text.trim().split(' ');
        if (words.length <= 1) return `<span class="last-word-blue">${text}</span>`;
        const last = words.pop();
        return `${words.join(' ')} <span class="last-word-blue">${last}</span>`;
    };

    let html = "";
    if (id === 'main') {
        // Merge original title strings and divide into single clean words
        const fullTitleStr = `${dailyData.main.titleWhite} ${dailyData.main.titleBlue}`.trim();
        const wordsArray = fullTitleStr.split(/\s+/);
        
        // Convert each word to a block layer, explicitly coloring the final word blue
        const stackedTitleHTML = wordsArray.map((word, idx) => {
            if (idx === wordsArray.length - 1) {
                return `<div class="last-word-blue">${word}</div>`;
            }
            return `<div>${word}</div>`;
        }).join('');

        // Dynamically style the kicker string to make "AIR" dark blue
        let kickerHTML = dailyData.main.kicker;
        if (kickerHTML.includes('SIYALAIR INTEL')) {
            kickerHTML = kickerHTML.replace('INTEL', '<span class="blue-text">INTEL</span>');
        }
        
        canvas.className = 'main-hook-style'; 
        html = `<div class="content-body">
                <div class="logo-container">
                    <img src="assets/logo.png" alt="SIYALAIR LOGO" class="brand-logo" onerror="this.style.display='none';">
                </div>
                <span class="kicker">${kickerHTML}</span>
                <header>
                    <h1 class="auto-fit">${stackedTitleHTML}</h1>
                </header>
                </div><div class="swipe-prompt">SWIPE NEXT →</div>`;
    } else if (id === 'follow') {
        canvas.className = 'main-hook-style cta-slide';
        html = `<div class="content-body">
                <span class="kicker">STAY AHEAD</span>
                <header><h1 class="auto-fit">LIKE. SHARE. <span class="last-word-blue">FOLLOW.</span></h1></header>
                <div class="bulletin-container"><div class="bulletin-label">HOURLY UPDATES</div>
                <p class="cta-subtext">Join the archive for the latest AI happenings and enterprise visual systems updates.</p></div>
                </div>`;
    } else {
        const index = id - 1;
        const slide = dailyData.slides[index];
        canvas.className = 'sub-slide-style';
        if (slide) {
            // FIXED PARSER: Handles both array (points) and string (content) safely.
            let bulletList = "";
            if (Array.isArray(slide.points)) {
                bulletList = slide.points.map(p => `<li>${p}</li>`).join('');
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
        alert("Download failed. If you are not using a local server, the browser is blocking the background image file access.");
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
        console.error("Bulk Capture Error:", err);
        alert("Download failed during bulk process. Ensure environment uses a valid local file system pipeline connection server.");
    } finally {
        switchSlide(originalId, originalActiveTab);
        dlBtn.innerText = "DOWNLOAD ALL SLIDES";
        dlBtn.disabled = false;
    }
}
