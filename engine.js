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
            // Apply inline style background image permanently to survive tab switches/re-renders
            canvas.style.backgroundImage = `url(${reader.result})`;
            canvas.style.backgroundSize = 'cover';
            canvas.style.backgroundPosition = 'center';
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
            canvas.style.backgroundSize = 'cover';
            canvas.style.backgroundPosition = 'center';
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
    
    // --- STABLE TAB FIX: Strictly limit regular slides loop to exactly 7 slides (SLIDE-1 through SLIDE-7) ---
    const targetSlideCount = Math.min(dailyData.slides.length, 7);
    for (let index = 0; index < targetSlideCount; index++) {
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.innerText = `SLIDE-${index + 1}`;
        btn.onclick = (e) => { e.preventDefault(); switchSlide(index + 1, btn); };
        tabContainer.appendChild(btn);
    }

    // --- REQUIREMENT 1 & 3: Insert QUOTE tab right after regular slides ---
    const quoteBtn = document.createElement('button');
    quoteBtn.className = 'tab-btn';
    quoteBtn.innerText = 'QUOTE';
    quoteBtn.onclick = (e) => { e.preventDefault(); switchSlide('quote', quoteBtn); };
    tabContainer.appendChild(quoteBtn);

    const followBtn = document.createElement('button');
    followBtn.className = 'tab-btn';
    followBtn.innerText = 'FOLLOW';
    followBtn.onclick = (e) => { e.preventDefault(); switchSlide('follow', followBtn); };
    tabContainer.appendChild(followBtn);

    // --- REQUIREMENT 1 & 3: Insert POST tab at the absolute end, isolated from downloads ---
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
    if (!canvas) return;

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

        // --- REQUIREMENT 3: Slide 9 (FOLLOW) strictly has image background only with nothing else ---
        html = `<div class="content-body" style="background-image: url('${followAssetUrl}'); background-size: cover; background-position: center; width: 100%; height: 100%;"></div>`;
    } else if (id === 'quote') {
        // --- FIXED: Independent standalone quote style with clean layout and NO 'NEXT UP' text string ---
        canvas.className = 'quote-slide-style';
        const qData = dailyData.quote || { heading: "EXECUTIVE PERSPECTIVE", quoteText: "", author: "", context: "" };
        const formattedQuoteHeading = formatTitleBlue(qData.heading || "EXECUTIVE PERSPECTIVE");
        
        html = `<div class="content-body">
                <header><h1 class="auto-fit">${formattedQuoteHeading}</h1><div class="header-divider"></div></header>
                <div class="quote-content-wrapper">
                    <p class="quote-main-text">"${qData.quoteText || qData.content || ""}"</p>
                    <p class="quote-author">${qData.author ? "— " + qData.author : (qData.author || "")}</p>
                    <p class="quote-context">${qData.context ? "Context: " + qData.context : (qData.context || "")}</p>
                </div>
                </div>
                <div class="swipe-prompt">SWIPE NEXT →</div>`;
    } else if (id === 'post') {
        // --- REQUIREMENT 3: Isolated POST slide with clean white background, text caption, and standalone copy button ---
        canvas.className = 'post-slide-style';
        let postTextContent = "Loading post content...";
        try {
            const postRes = await fetch('post.txt?t=' + Date.now());
            if (postRes.ok) {
                postTextContent = await postRes.text();
            }
        } catch (e) {
            postTextContent = "Failed to load post.txt content.";
        }

        html = `<div class="post-content-container" style="background: #ffffff; color: #111111; padding: 40px; width: 100%; height: 100%; box-sizing: border-box; overflow-y: auto; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <h2 style="margin-top: 0; color: #000000; font-family: sans-serif; font-size: 24px; border-bottom: 2px solid #00c0ff; padding-bottom: 10px;">SOCIAL MEDIA POST CAPTION</h2>
                    <pre style="white-space: pre-wrap; font-family: monospace; font-size: 14px; line-height: 1.5; color: #222222; margin-top: 20px;">${postTextContent}</pre>
                </div>
                <div style="text-align: right; margin-top: 20px;">
                    <button id="isolated-copy-btn" style="background: #00c0ff; color: #ffffff; border: none; padding: 12px 24px; font-weight: bold; cursor: pointer; border-radius: 4px; font-size: 14px;">COPY POST CAPTION</button>
                </div>
               `;
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
            
            // --- REQUIREMENT 2: Slide 7 bottom next up precisely points to EXECUTIVE PERSPECTIVE ---
            let nextTease = "";
            const maxSubSlides = Math.min(dailyData.slides.length, 7);
            if (index === maxSubSlides - 1) {
                nextTease = "EXECUTIVE PERSPECTIVE";
            } else if (index < maxSubSlides - 1) {
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

    // Attach copy event listener if POST slide is active
    if (id === 'post') {
        const copyBtn = document.getElementById('isolated-copy-btn');
        if (copyBtn) {
            copyBtn.onclick = async () => {
                try {
                    let textToCopy = "";
                    const postRes = await fetch('post.txt?t=' + Date.now());
                    if (postRes.ok) {
                        textToCopy = await postRes.text();
                    } else {
                        textToCopy = document.querySelector('.post-content-container pre')?.innerText || "";
                    }
                    await navigator.clipboard.writeText(textToCopy);
                    copyBtn.innerText = "COPIED SUCCESSFULLY!";
                    setTimeout(() => { copyBtn.innerText = "COPY POST CAPTION"; }, 2000);
                } catch (err) {
                    console.error("Clipboard write failed", err);
                    alert("Failed to copy text automatically.");
                }
            };
        }
    }

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
    if (activeTab && activeTab.innerText === 'POST') {
        alert("Post slide is isolated from image downloads.");
        return;
    }

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

    // --- FIXED PIPELINE ORDER: MAIN -> SLIDES 1..7 -> QUOTE -> FOLLOW (Sequential Folder Ordering) ---
    const queue = ['main'];
    const maxSubSlides = Math.min(dailyData.slides.length, 7);
    for (let i = 1; i <= maxSubSlides; i++) {
        queue.push(i);
    }
    queue.push('quote');
    queue.push('follow');

    try {
        let sequenceIndex = 1;
        for (const slideId of queue) {
            await switchSlide(slideId, null);
            // Increased pause interval to 1500ms to guarantee DOM paint stability and prevent race conditions
            await new Promise(resolve => setTimeout(resolve, 1500));

            const rendered = await html2canvas(canvas, { 
                scale: 2, 
                useCORS: true,
                allowTaint: true,
                backgroundColor: "#050505",
                logging: false
            });
            
            const imageData = rendered.toDataURL("image/png");
            const link = document.createElement('a');
            
            // Apply pristine zero-padded file serialization prefixes (01 to 09)
            const paddedNum = String(sequenceIndex).padStart(2, '0');
            const fileSuffix = typeof slideId === 'string' ? slideId.toUpperCase() : `SLIDE_${paddedNum}`;
            
            link.href = imageData;
            link.download = `SIYAL_AIR_${paddedNum}_${fileSuffix}.png`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            sequenceIndex++;
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
