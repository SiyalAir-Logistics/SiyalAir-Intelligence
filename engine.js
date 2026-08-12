/**
 * ==============================================================================
 * SIYALAIR-INTEL-STUDIO CORE ENGINE (PROD_v2.0_2026)
 * DIRECTORY:   Social_Media/
 * MODULE:      Video_Template_EN.js
 * PURPOSE:     Unified client-side DOM rendering engine for social media video slides.
 *              Handles dynamic script loading, CORS background image encoding,
 *              DOM slide layout synthesis, auto-fit typography, and slide capture.
 * DATA FLOW:   template.js -> Video_Template_EN.js -> DOM Hydration -> Puppeteer Capture
 * ==============================================================================
 */

// Unified logger taxonomy for consistent debugging across browser and Puppeteer logs
const log = (level, message) => {
    console.log(`[${level.toUpperCase()}] ${message}`);
};

// ==============================================================================
// [ MODULE 1: DYNAMIC ASSET & SCRIPT HYDRATION PIPELINE ]
// Purpose: Dynamically injects primary template data script with strict cache-busting.
// ==============================================================================
window.onload = async () => {
    log('INFO', 'Initializing Unified Video Template Engine lifecycle...');

    // Load primary daily template payload with cache-busting
    const script = document.createElement('script');
    script.src = 'template.js?t=' + Date.now();

    script.onload = async () => {
        log('SUCCESS', 'Primary data payload (template.js) loaded successfully.');

        // Convert background image to Base64 to bypass CORS html2canvas restrictions
        await fixBackgroundCORS();

        // Hydrate navigation tabs and render initial frame if payload is active
        if (typeof dailyData !== 'undefined') {
            initTabs();
            const mainBtn = document.querySelector('.tab-btn');
            if (mainBtn) switchSlide('main', mainBtn);
        }

        // Attach event listener for slide download trigger
        const dlBtn = document.getElementById('download-active');
        if (dlBtn) {
            dlBtn.onclick = (e) => {
                e.preventDefault();
                downloadAllSlides();
            };
        }
    };

    script.onerror = () => {
        log('ERROR', 'Critical System Fault: Failed to load template.js payload. Check network path.');
    };

    document.head.appendChild(script);
};

// ==============================================================================
// [ MODULE 2: CORS & BACKGROUND IMAGE BASE64 CONVERTER ]
// Purpose: Converts background image assets into Base64 DataURLs to prevent
//          html2canvas tainted canvas export errors.
// ==============================================================================
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
        log('WARNING', 'Background tracker read failed; defaulting to background1.png');
    }

    const bgUrl = `assets/background${bgIndex}.png`;

    try {
        const response = await fetch(bgUrl);
        if (!response.ok) throw new Error(`Background asset missing at ${bgUrl}`);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
            canvas.style.backgroundImage = `url(${reader.result})`;
            log('SUCCESS', `Background asset (background${bgIndex}.png) loaded and optimized for render capture.`);
        };
        reader.readAsDataURL(blob);
    } catch (e) {
        log('WARNING', `Failed to load background${bgIndex}.png. Invoking default asset fallback...`);
        await fallbackDefaultBackground(canvas);
    }
}

async function fallbackDefaultBackground(canvas) {
    try {
        const response = await fetch('assets/background.png');
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
            canvas.style.backgroundImage = `url(${reader.result})`;
            log('SUCCESS', 'Default fallback background asset loaded.');
        };
        reader.readAsDataURL(blob);
    } catch (err) {
        log('ERROR', 'Default background asset fallback failed completely.');
    }
}

// ==============================================================================
// [ MODULE 3: DYNAMIC UI NAVIGATION & DOM TAB CONTROLLER ]
// Purpose: Generates interactive tab controls corresponding to main, sub-slides,
//          and CTA callout slides based on dailyData payload.
// ==============================================================================
function initTabs() {
    const tabContainer = document.getElementById('slide-tabs');
    if (!tabContainer || typeof dailyData === 'undefined') return;

    tabContainer.innerHTML = '';

    // Render Main Hook Tab
    const mainBtn = document.createElement('button');
    mainBtn.className = 'tab-btn active';
    mainBtn.innerText = 'MAIN';
    mainBtn.onclick = (e) => { e.preventDefault(); switchSlide('main', mainBtn); };
    tabContainer.appendChild(mainBtn);

    // Render Sub-Slide Tabs
    if (Array.isArray(dailyData.slides)) {
        dailyData.slides.forEach((slide, index) => {
            const btn = document.createElement('button');
            btn.className = 'tab-btn';
            btn.innerText = `SLIDE-${index + 1}`;
            btn.onclick = (e) => { e.preventDefault(); switchSlide(index + 1, btn); };
            tabContainer.appendChild(btn);
        });
    }

    // Render CTA Follow Tab
    const followBtn = document.createElement('button');
    followBtn.className = 'tab-btn';
    followBtn.innerText = 'FOLLOW';
    followBtn.onclick = (e) => { e.preventDefault(); switchSlide('follow', followBtn); };
    tabContainer.appendChild(followBtn);
}

// ==============================================================================
// [ MODULE 4: SLIDE RENDERING, TYPOGRAPHY AUTO-FIT & FORMATTING ]
// Purpose: Dynamically populates DOM slide layouts, formats headings with blue accents,
//          and auto-scales text font-size to avoid visual overflowing.
// ==============================================================================
function fitText(element, maxHeight, maxWidth) {
    if (!element) return;
    let fontSize = parseInt(window.getComputedStyle(element).fontSize, 10);
    while ((element.scrollHeight > maxHeight || element.scrollWidth > maxWidth) && fontSize > 18) {
        fontSize--;
        element.style.fontSize = `${fontSize}px`;
    }
}

async function switchSlide(id, element) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (element) element.classList.add('active');

    const canvas = document.getElementById('post-canvas');
    if (!canvas || typeof dailyData === 'undefined') return;

    const formatTitleBlue = (text) => {
        if (!text) return "";
        if (text.includes(':')) {
            const parts = text.split(':');
            const bluePart = parts[0].trim() + ':';
            const whitePart = parts.slice(1).join(':').trim();
            return `<span class="blue-text">${bluePart}</span> ${whitePart}`;
        }
        const words = text.trim().split(' ');
        if (words.length <= 1) return `<span class="last-word-blue">${text}</span>`;
        const last = words.pop();
        return `${words.join(' ')} <span class="last-word-blue">${last}</span>`;
    };

    // Automated smart metric highlighter for sub-slide bullet paragraphs using theme accent color
    const highlightMetrics = (text) => {
        if (!text) return "";
        const metricRegex = /(\$[0-9]+(\.[0-9]+)?[BBMK]?|\bQ[1-4]\s+[0-9]{4}\b|[0-9]+(\.[0-9]+)?%|\b\d+(?:\.\d+)?\b)/g;
        return text.replace(metricRegex, `<span class="blue-text" style="font-weight: 700;">$&</span>`);
    };

    let html = "";

    if (id === 'main') {
        const fullTitleStr = `${dailyData.main?.titleWhite || ''} ${dailyData.main?.titleBlue || ''}`.trim();
        const wordsArray = fullTitleStr.split(/\s+/);

        let stackedTitleHTML = "";
        if (wordsArray.length > 0) {
            const whiteWords = wordsArray.slice(0, wordsArray.length - 1);
            const lastWord = wordsArray[wordsArray.length - 1];

            const lines = [];
            let currentLine = [];
            let currentLength = 0;
            const MAX_CHARS_PER_LINE = 13; // Optimized character threshold to cluster words naturally per line

            whiteWords.forEach(word => {
                const wordLen = word.length;
                if (currentLine.length > 0 && (currentLength + 1 + wordLen > MAX_CHARS_PER_LINE)) {
                    lines.push(currentLine.join(' '));
                    currentLine = [word];
                    currentLength = wordLen;
                } else {
                    currentLine.push(word);
                    currentLength += (currentLine.length > 1 ? 1 : 0) + wordLen;
                }
            });
            if (currentLine.length > 0) {
                lines.push(currentLine.join(' '));
            }

            stackedTitleHTML = lines.map(line => `<div>${line}</div>`).join('');
            if (lastWord) {
                stackedTitleHTML += `<div class="last-word-blue">${lastWord}</div>`;
            }
        }

        const footerText = dailyData.main?.footerSummary || "";
        const nextTease = dailyData.slides?.[0]?.heading || "";

        canvas.className = 'main-hook-style';
        html = `
            <div class="content-body">
                <span class="kicker"></span>
                <header>
                    <h1 class="auto-fit">${stackedTitleHTML}</h1>
                </header>
                <div class="footer-paragraph-placeholder">${footerText}</div>
            </div>
            <div class="next-up-tease">NEXT UP: ${nextTease}</div>
            <div class="swipe-prompt">SWIPE NEXT →</div>
        `;
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
            log('WARNING', 'Follow tracker read failed; defaulting to slide9-1.png');
        }

        const followAssetUrl = `followup/slide9-${followIndex}.png`;
        html = `<div class="content-body" style="background-image: url('${followAssetUrl}'); background-size: cover; background-position: center; width: 100%; height: 100%;"></div>`;
    } else {
        const index = id - 1;
        const slide = dailyData.slides?.[index];
        canvas.className = 'sub-slide-style';

        if (slide) {
            let bulletList = "";
            if (Array.isArray(slide.points)) {
                bulletList = slide.points.map(pt => `<li>${highlightMetrics(pt.trim().replace(/\.$/, ''))}</li>`).join('');
            } else if (slide.content) {
                const sentences = slide.content.split('. ').filter(s => s.trim().length > 0);
                bulletList = sentences.map(s => `<li>${highlightMetrics(s.trim().replace(/\.$/, ''))}</li>`).join('');
            }

            const formattedHeading = formatTitleBlue(slide.heading);
            const nextTease = (index < dailyData.slides.length - 1) ? dailyData.slides[index + 1].heading : "";

            html = `
                <div class="content-body">
                    <header>
                        <h1 class="auto-fit">${formattedHeading}</h1>
                        <div class="header-divider"></div>
                    </header>
                    <div class="detail-text"><ul class="smart-bullets">${bulletList}</ul></div>
                </div>
                ${nextTease ? `<div class="next-up-tease">NEXT UP: ${nextTease}</div>` : ""}
                <div class="swipe-prompt">SWIPE NEXT →</div>
            `;
        }
    }

    canvas.innerHTML = html;

    // Trigger typography fitting pass after DOM update
    setTimeout(() => {
        const titles = canvas.querySelectorAll('.auto-fit');
        titles.forEach(t => fitText(t, 500, 850));
    }, 50);
}

// ==============================================================================
// [ MODULE 5: IMAGE EXTRACTION ENGINE ]
// Purpose: Captures DOM slide elements into PNG images via html2canvas.
// ==============================================================================
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
        log('SUCCESS', `Captured individual slide frame: SIYAL_AIR_${slideName}.png`);
    } catch (err) {
        log('ERROR', `Capture Error encountered: ${err.message}`);
        alert("Render extraction halted. Verify local script server permissions.");
    } finally {
        dlBtn.innerText = "DOWNLOAD SLIDE";
        dlBtn.disabled = false;
    }
}

async function downloadAllSlides() {
    const canvas = document.getElementById('post-canvas');
    const dlBtn = document.getElementById('download-active');
    if (!canvas || !dlBtn || typeof dailyData === 'undefined') return;

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
    if (Array.isArray(dailyData.slides)) {
        dailyData.slides.forEach((_, i) => queue.push(i + 1));
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
        log('SUCCESS', 'All slide frames captured and exported successfully.');
    } catch (err) {
        log('ERROR', `Bulk Processing Error: ${err.message}`);
        alert("Bulk download failed. Verify pipeline file system links.");
    } finally {
        await switchSlide(originalId, originalActiveTab);
        dlBtn.innerText = "DOWNLOAD ALL SLIDES";
        dlBtn.disabled = false;
    }
}
