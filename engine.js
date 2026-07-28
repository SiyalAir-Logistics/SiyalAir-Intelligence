/**
 * SIYALAIR-INTEL-STUDIO CORE ENGINE (PROD_v2.5_MULTILINGUAL_SYNC)
 * Engineered for multi-language dynamic rendering & synchronized slide tabs.
 */

window.onload = async () => {
    // FORCE CACHE-BUST: Load template.js dynamically
    const script = document.createElement('script');
    script.src = 'template.js?t=' + Date.now();
    
    script.onload = async () => {
        console.log("Siyal Air Template loaded successfully.");
        
        // Load LinkedIn Intelligence Module dynamically
        const linkedinScript = document.createElement('script');
        linkedinScript.src = 'Social_Media/LinkedIn/LinkedIn_Template_EN.js?t=' + Date.now();
        linkedinScript.onload = () => {
            console.log("LinkedIn Module mounted.");
        };
        linkedinScript.onerror = () => {
            console.warn("Notice: LinkedIn template path missing, using embedded fallback.");
        };
        document.head.appendChild(linkedinScript);

        // Fix CORS background
        await fixBackgroundCORS();

        // Bind language selector listener if present
        setupLanguageSelector();

        // Initialize tabs and load MAIN slide
        initTabs();
        const mainBtn = document.querySelector('.tab-btn');
        if (mainBtn) switchSlide('main', mainBtn);
        
        const dlBtn = document.getElementById('download-active');
        if (dlBtn) {
            dlBtn.onclick = (e) => {
                e.preventDefault();
                downloadAllSlides();
            };
        }
    };
    
    script.onerror = () => {
        console.error("Critical System Fault: Failed to load template.js.");
    };
    
    document.head.appendChild(script);
};

/**
 * Gets currently selected language code from UI dropdown if available.
 */
function getActiveLanguage() {
    const langSelect = document.getElementById('lang-select') || document.querySelector('select');
    if (langSelect && langSelect.value) {
        return langSelect.value.toLowerCase().trim();
    }
    return 'en';
}

/**
 * Normalizes dailyData across root, language-keyed, or wrapped schemas.
 */
function getNormalizedData() {
    if (typeof dailyData === 'undefined' || !dailyData) return null;
    
    const lang = getActiveLanguage();

    // 1. Check if dailyData is language-keyed (e.g. dailyData.en or dailyData["EN"])
    if (dailyData[lang] && (dailyData[lang].slides || dailyData[lang].main)) {
        return dailyData[lang];
    }
    if (dailyData[lang.toUpperCase()] && (dailyData[lang.toUpperCase()].slides || dailyData[lang.toUpperCase()].main)) {
        return dailyData[lang.toUpperCase()];
    }

    // 2. Check direct top-level keys
    if (dailyData.slides && dailyData.main) return dailyData;

    // 3. Check nested slides_data wrapper
    if (dailyData.slides_data) {
        if (dailyData.slides_data[lang]) return dailyData.slides_data[lang];
        if (dailyData.slides_data.slides) return dailyData.slides_data;
    }

    return dailyData;
}

/**
 * Setup event listener for language dropdown to re-render slides instantly upon change.
 */
function setupLanguageSelector() {
    const langSelect = document.getElementById('lang-select') || document.querySelector('select');
    if (langSelect) {
        langSelect.onchange = () => {
            console.log(`Language changed to: ${langSelect.value}`);
            initTabs();
            const mainBtn = document.querySelector('.tab-btn');
            if (mainBtn) switchSlide('main', mainBtn);
        };
    }
}

async function fixBackgroundCORS() {
    const canvas = document.getElementById('post-canvas');
    if (!canvas) return;

    let bgIndex = 1;
    try {
        const trackerRes = await fetch('bg_tracker.txt?t=' + Date.now());
        if (trackerRes.ok) {
            const text = await trackerRes.text();
            const parsedNum = parseInt(text.trim(), 10);
            if (!isNaN(parsedNum) && parsedNum > 0) bgIndex = parsedNum;
        }
    } catch (e) {
        console.log("Tracker read defaulted, using background1.png");
    }

    const bgUrl = `assets/background${bgIndex}.png`;
    try {
        const response = await fetch(bgUrl);
        if (!response.ok) throw new Error("Background missing");
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
            canvas.style.backgroundImage = `url(${reader.result})`;
        };
        reader.readAsDataURL(blob);
    } catch (e) {
        fallbackDefaultBackground(canvas);
    }
}

async function fallbackDefaultBackground(canvas) {
    try {
        const response = await fetch('assets/background.png');
        if (!response.ok) throw new Error("Default background missing");
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
            canvas.style.backgroundImage = `url(${reader.result})`;
        };
        reader.readAsDataURL(blob);
    } catch (err) {
        console.error("Default background fallback failed.");
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
    
    const data = getNormalizedData();
    if (data && Array.isArray(data.slides)) {
        data.slides.forEach((slide, index) => {
            const btn = document.createElement('button');
            btn.className = 'tab-btn';
            btn.innerText = `SLIDE-${index + 1}`;
            btn.onclick = (e) => { e.preventDefault(); switchSlide(index + 1, btn); };
            tabContainer.appendChild(btn);
        });
    }

    const followBtn = document.createElement('button');
    followBtn.className = 'tab-btn';
    followBtn.innerText = 'FOLLOW';
    followBtn.onclick = (e) => { e.preventDefault(); switchSlide('follow', followBtn); };
    tabContainer.appendChild(followBtn);
}

function fitText(element, maxHeight, maxWidth) {
    let fontSize = parseInt(window.getComputedStyle(element).fontSize, 10);
    while ((element.scrollHeight > maxHeight || element.scrollWidth > maxWidth) && fontSize > 18) {
        fontSize--;
        element.style.fontSize = fontSize + "px";
    }
}

async function switchSlide(id, element) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (element) element.classList.add('active');
    
    const canvas = document.getElementById('post-canvas');
    if (!canvas) return;

    const data = getNormalizedData();
    if (!data) return;

    const formatTitleBlue = (text) => {
        if (!text) return "";
        if (text.includes(':')) {
            const parts = text.split(':');
            return `<span class="blue-text">${parts[0]}:</span>${parts.slice(1).join(':')}`;
        }
        const words = text.trim().split(' ');
        if (words.length <= 1) return `<span class="last-word-blue">${text}</span>`;
        const last = words.pop();
        return `${words.join(' ')} <span class="last-word-blue">${last}</span>`;
    };

    let html = "";
    if (id === 'main') {
        const fullTitleStr = `${data.main?.titleWhite || ''} ${data.main?.titleBlue || ''}`.trim();
        const wordsArray = fullTitleStr.split(/\s+/);
        
        const stackedTitleHTML = wordsArray.map((word, idx) => {
            if (idx === wordsArray.length - 1) {
                return `<div class="last-word-blue">${word}</div>`;
            }
            return `<div>${word}</div>`;
        }).join('');

        const footerText = data.main?.footerSummary || "";
        const nextTease = data.slides?.[0]?.heading || "";
        
        canvas.className = 'main-hook-style'; 
        html = `<div class="content-body">
                <span class="kicker"></span>
                <header><h1 class="auto-fit">${stackedTitleHTML}</h1></header>
                <div class="footer-paragraph-placeholder">${footerText}</div>
                </div>
                <div class="next-up-tease">NEXT UP: ${nextTease}</div>
                <div class="swipe-prompt">SWIPE NEXT →</div>`;
    } else if (id === 'follow') {
        canvas.className = 'main-hook-style cta-slide';
        let followIndex = 1;
        try {
            const trackerRes = await fetch('follow_tracker.txt?t=' + Date.now());
            if (trackerRes.ok) {
                const text = await trackerRes.text();
                const parsedNum = parseInt(text.trim(), 10);
                if (!isNaN(parsedNum) && parsedNum > 0) followIndex = parsedNum;
            }
        } catch (e) {
            console.log("Follow tracker defaulted.");
        }
        const followAssetUrl = `followup/slide9-${followIndex}.png`;
        html = `<div class="content-body" style="background-image: url('${followAssetUrl}'); background-size: cover; background-position: center; width: 100%; height: 100%;"></div>`;
    } else {
        const index = id - 1;
        const slide = data.slides?.[index];
        canvas.className = 'sub-slide-style';
        if (slide) {
            let bulletList = "";
            if (Array.isArray(slide.points)) {
                bulletList = slide.points.map(pt => `<li>${pt.trim().replace(/\.$/, '')}</li>`).join('');
            }
            
            const formattedHeading = formatTitleBlue(slide.heading);
            const nextTease = (index < data.slides.length - 1) ? data.slides[index + 1].heading : "";
            
            html = `<div class="content-body">
                    <header><h1 class="auto-fit">${formattedHeading}</h1><div class="header-divider"></div></header>
                    <div class="detail-text"><ul class="smart-bullets">${bulletList}</ul></div>
                    </div>
                    ${nextTease ? `<div class="next-up-tease">NEXT UP: ${nextTease}</div>` : ""}
                    <div class="swipe-prompt">SWIPE NEXT →</div>`;
        }
    }
    canvas.innerHTML = html;
    setTimeout(() => {
        const titles = canvas.querySelectorAll('.auto-fit');
        titles.forEach(t => fitText(t, 500, 850));
    }, 50);
}

async function downloadAllSlides() {
    const canvas = document.getElementById('post-canvas');
    const dlBtn = document.getElementById('download-active');
    if (!canvas || !dlBtn) return;

    const data = getNormalizedData();
    if (!data) return;

    dlBtn.innerText = "CAPTURING ALL...";
    dlBtn.disabled = true;

    const queue = ['main'];
    if (data && Array.isArray(data.slides)) {
        data.slides.forEach((_, i) => queue.push(i + 1));
    }
    queue.push('follow');
    queue.reverse();

    try {
        for (const slideId of queue) {
            await switchSlide(slideId, null);
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
    } finally {
        await switchSlide('main', document.querySelector('.tab-btn'));
        dlBtn.innerText = "DOWNLOAD ALL SLIDES";
        dlBtn.disabled = false;
    }
}
