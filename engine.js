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
        
        // DYNAMIC HYDRATION: Load updated LinkedIn Intelligence Module
        const linkedinScript = document.createElement('script');
        linkedinScript.src = 'Social_Media/LinkedIn/LinkedIn_Template_EN.js?t=' + Date.now();
        linkedinScript.onload = () => {
            console.log("LinkedIn Intelligence Module loaded successfully.");
        };
        linkedinScript.onerror = () => {
            console.warn("Notice: LinkedIn template path not found, using embedded fallback.");
        };
        document.head.appendChild(linkedinScript);

        // Fix background image compatibility
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
        console.error("Critical System Fault: Failed to load template.js.");
    };
    
    document.head.appendChild(script);
};

/**
 * Normalizes dailyData whether it has top-level keys or nested wrappers.
 */
function getNormalizedData() {
    if (typeof dailyData === 'undefined' || !dailyData) return null;
    if (dailyData.slides && dailyData.main) return dailyData;
    if (dailyData.slides_data && dailyData.slides_data.slides) return dailyData.slides_data;
    if (dailyData.data && dailyData.data.slides) return dailyData.data;
    return dailyData;
}

/**
 * FIX: Converts background-image to Base64 to prevent HTML2Canvas Tainted Canvas block.
 */
async function fixBackgroundCORS() {
    const canvas = document.getElementById('post-canvas');
    if (!canvas) return;

    let bgIndex = 1;

    try {
        const trackerRes = await fetch('bg_tracker.txt?t=' + Date.now());
        if (trackerRes.ok) {
            const text = await trackerRes.text();
            const parsedNum = parseInt(text.trim(), 10);
            if (!isNaN(parsedNum) && parsedNum > 0) {
                bgIndex = parsedNum;
            }
        }
    } catch (e) {
        console.log("Tracker read defaulted, using background1.png");
    }

    const bgUrl = `assets/background${bgIndex}.png`;
    
    try {
        const response = await fetch(bgUrl);
        if (!response.ok) throw new Error("Background asset not found");
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
            canvas.style.backgroundImage = `url(${reader.result})`;
            console.log(`Loaded background${bgIndex}.png successfully.`);
        };
        reader.readAsDataURL(blob);
    } catch (e) {
        console.warn(`Failed to load background${bgIndex}.png, falling back to default asset.`);
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
                <header>
                    <h1 class="auto-fit">${stackedTitleHTML}</h1>
                </header>
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
                if (!isNaN(parsedNum) && parsedNum > 0) {
                    followIndex = parsedNum;
                }
            }
        } catch (e) {
            console.log("Follow tracker read defaulted, using slide9-1.png");
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
            } else if (slide.content) {
                const sentences = slide.content.split('. ').filter(s => s.trim().length > 0);
                bulletList = sentences.map(s => `<li>${s.trim().replace(/\.$/, '')}</li>`).join('');
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

    const data = getNormalizedData();
    if (!data) return;

    const originalActiveTab = document.querySelector('.tab-btn.active');
    let originalId = 'main';
    
    if (originalActiveTab) {
        if (originalActiveTab.innerText === 'MAIN') originalId = 'main';
        else if (originalActiveTab.innerText === 'FOLLOW') originalId = 'follow';
        else originalId = parseInt(originalActiveTab.innerText.replace('SLIDE-', ''), 10);
    }

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
        alert("Bulk download failed. Verify pipeline file system links.");
    } finally {
        await switchSlide(originalId, originalActiveTab);
        dlBtn.innerText = "DOWNLOAD ALL SLIDES";
        dlBtn.disabled = false;
    }
}

/**
 * EMBEDDED BACKEND MODULE FALLBACK
 */
const linkedinShortsModule = (typeof window !== 'undefined' && window.linkedinData)
    ? window.linkedinData
    : {
        metadata: {
            targetPlatform: "LinkedIn",
            language: "EN",
            version: "2.0",
            author: "SIYAL AIR LLC",
            timestamp: "2026-07-27"
        },
        slides: [
            {
                slideNumber: 1,
                heading: "GLOBAL FREIGHT SHIFT:",
                narration: "The international logistics landscape is experiencing rapid structural adjustments driven by real-time trade updates and port data.",
                visualText: "CRITICAL SUPPLY CHAIN SHIFTS"
            }
        ],
        socialPost: {
            headline: "GLOBAL LOGISTICS INTELLIGENCE BRIEFING",
            body: "The international freight landscape is experiencing rapid structural adjustments driven by real-time trade data.",
            hashtags: ["#SupplyChain", "#FreightForwarding", "#SiyalAir"]
        }
    };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = linkedinShortsModule;
}
