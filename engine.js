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

        // Wire up the copy caption button handler
        const copyBtn = document.getElementById('copy-caption-btn');
        if (copyBtn) {
            copyBtn.onclick = (e) => {
                e.preventDefault();
                copyCaptionToClipboard();
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

    let bgIndex = 1;

    try {
        const trackerRes = await fetch('bg_tracker.txt?t=' + Date.now());
        if (trackerRes.ok) {
            const text = await trackerRes.text();
            const parsedNum = parseInt(text.trim());
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
            console.log(`Loaded background${bgIndex}.png successfully and optimized for render capture.`);
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
    
    // 1. MAIN TAB
    const mainBtn = document.createElement('button');
    mainBtn.className = 'tab-btn active';
    mainBtn.innerText = 'MAIN';
    mainBtn.onclick = (e) => { e.preventDefault(); switchSlide('main', mainBtn); };
    tabContainer.appendChild(mainBtn);
    
    // 2. SLIDES 1 through 7 (Core Intelligence)
    // Assuming dailyData.slides contains indices 0 to 6 as the core 7 slides, and index 7 as the quote slide.
    // Let's safely split them or map them according to your exact sequencing order: MAIN, SLIDE-1 to SLIDE-7, QUOTE, FOLLOW, POST.
    const coreSlidesCount = Math.min(7, dailyData.slides.length);
    for (let i = 0; i < coreSlidesCount; i++) {
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.innerText = `SLIDE-${i + 1}`;
        btn.onclick = (e) => { e.preventDefault(); switchSlide(i + 1, btn); };
        tabContainer.appendChild(btn);
    }

    // 3. QUOTE TAB (Slide 8 - Daily Executive Quote)
    const quoteBtn = document.createElement('button');
    quoteBtn.className = 'tab-btn';
    quoteBtn.innerText = 'QUOTE';
    quoteBtn.onclick = (e) => { e.preventDefault(); switchSlide('quote', quoteBtn); };
    tabContainer.appendChild(quoteBtn);

    // 4. FOLLOW TAB (Slide 9 - Follow-up / Archive Routing)
    const followBtn = document.createElement('button');
    followBtn.className = 'tab-btn';
    followBtn.innerText = 'FOLLOW';
    followBtn.onclick = (e) => { e.preventDefault(); switchSlide('follow', followBtn); };
    tabContainer.appendChild(followBtn);

    // 5. POST TAB (Slide 10 - Isolated Social Caption View)
    const postBtn = document.createElement('button');
    postBtn.className = 'tab-btn';
    postBtn.innerText = 'POST';
    postBtn.onclick = (e) => { e.preventDefault(); switchSlide('post', postBtn); };
    tabContainer.appendChild(postBtn);
}

function fitText(element, maxHeight, maxWidth) {
    let fontSize = parseInt(window.getComputedStyle(element).fontSize);
    while ((element.scrollHeight > maxHeight || element.scrollWidth > maxWidth) && fontSize > 18) {
        fontSize--;
        element.style.fontSize = fontSize + "px";
    }
}

async function switchSlide(id, element) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (element) element.classList.add('active');
    
    const canvas = document.getElementById('post-canvas');
    const captionCanvas = document.getElementById('caption-canvas');
    const dlBtn = document.getElementById('download-active');
    const copyBtn = document.getElementById('copy-caption-btn');

    if (!canvas) return;

    // Handle view visibility toggle between Visual Canvas and Text Caption Canvas
    if (id === 'post') {
        canvas.style.display = 'none';
        if (captionCanvas) captionCanvas.style.display = 'block';
        if (dlBtn) dlBtn.style.display = 'none';
        if (copyBtn) copyBtn.style.display = 'inline-block';

        // Populate caption text from template payload
        const captionDisplay = document.getElementById('caption-text-display');
        if (captionDisplay) {
            const rawCaption = (typeof dailyData !== 'undefined' && dailyData.social_post) 
                ? dailyData.social_post 
                : "No social caption payload found in template.js.";
            captionDisplay.innerText = rawCaption;
        }
        return;
    } else {
        canvas.style.display = 'flex';
        if (captionCanvas) captionCanvas.style.display = 'none';
        if (dlBtn) dlBtn.style.display = 'inline-block';
        if (copyBtn) copyBtn.style.display = 'none';
    }

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

        const footerText = dailyData.main.footerSummary || "";
        const nextTease = dailyData.slides[0]?.heading || "";
        
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
    } else if (id === 'quote') {
        // Slide 8: Daily Executive Quote Card
        canvas.className = 'sub-slide-style';
        const quoteData = dailyData.quote_slide || dailyData.slides[7] || {
            heading: "EXECUTIVE PERSPECTIVE: INDUSTRY VALIDATION",
            quote: "Constraint awareness is the vital skill; constant market shifts demand prioritization.",
            author: "Davey Miller, COO at CMC",
            context: "Inbound Logistics Industry Leadership Review, July 2026"
        };

        const formattedHeading = formatTitleBlue(quoteData.heading || "EXECUTIVE PERSPECTIVE: INDUSTRY VALIDATION");
        
        html = `<div class="content-body">
                <header><h1 class="auto-fit">${formattedHeading}</h1><div class="header-divider"></div></header>
                <div class="detail-text">
                    <ul class="smart-bullets" style="list-style: none;">
                        <li style="font-size: 32px; font-style: italic; margin-bottom: 24px;">"${quoteData.quote || quoteData.content}"</li>
                        <li style="font-size: 26px; color: var(--aeon-blue); font-weight: 700; margin-bottom: 15px;">— ${quoteData.author || "Executive Leadership"}</li>
                        <li style="font-size: 22px; color: rgba(255,255,255,0.8); font-weight: 400;">Context: ${quoteData.context || "Global Logistics Review"}</li>
                    </ul>
                </div>
                </div>
                <div class="swipe-prompt">SWIPE NEXT →</div>`;
    } else if (id === 'follow') {
        canvas.className = 'main-hook-style cta-slide';
        
        let followIndex = 1;
        try {
            const trackerRes = await fetch('follow_tracker.txt?t=' + Date.now());
            if (trackerRes.ok) {
                const text = await trackerRes.text();
                const parsedNum = parseInt(text.trim());
                if (!isNaN(parsedNum) && parsedNum > 0) {
                    followIndex = parsedNum;
                }
            }
        } catch (e) {
            console.log("Follow tracker read defaulted, using slide9-1.png");
        }

        const followAssetUrl = `followup/slide9-${followIndex}.png`;

        // Follow-up slide has no swipe prompt or next-up tease per instructions
        html = `<div class="content-body" style="background-image: url('${followAssetUrl}'); background-size: cover; background-position: center; width: 100%; height: 100%;"></div>`;
    } else {
        const index = id - 1;
        const slide = dailyData.slides[index];
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
            
            // Customized footer handling: Slide 7 specifically teases the Executive Perspective quote slide
            let nextTease = "";
            if (index === 6) {
                nextTease = "EXECUTIVE PERSPECTIVE";
            } else if (index < dailyData.slides.length - 1 && index < 6) {
                nextTease = dailyData.slides[index + 1].heading;
            }
            
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

function copyCaptionToClipboard() {
    const captionDisplay = document.getElementById('caption-text-display');
    const copyBtn = document.getElementById('copy-caption-btn');
    if (!captionDisplay) return;

    const textToCopy = captionDisplay.innerText;
    navigator.clipboard.writeText(textToCopy).then(() => {
        if (copyBtn) {
            const originalText = copyBtn.innerText;
            copyBtn.innerText = "COPIED TO CLIPBOARD!";
            copyBtn.style.background = "#15803d";
            setTimeout(() => {
                copyBtn.innerText = originalText;
                copyBtn.style.background = "#22c55e";
            }, 2000);
        }
    }).catch(err => {
        console.error("Failed to copy text: ", err);
        alert("Clipboard access failed. Please check browser permissions.");
    });
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
        else if (originalActiveTab.innerText === 'QUOTE') originalId = 'quote';
        else if (originalActiveTab.innerText === 'POST') originalId = 'post';
        else originalId = parseInt(originalActiveTab.innerText.replace('SLIDE-', ''));
    }

    dlBtn.innerText = "CAPTURING ALL...";
    dlBtn.disabled = true;

    // Queue excluding the isolated POST caption view (capturing visual slides only)
    const queue = ['main'];
    for (let i = 0; i < Math.min(7, dailyData.slides.length); i++) {
        queue.push(i + 1);
    }
    queue.push('quote');
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
