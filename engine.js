if (id === 'main') {
        const fullTitleStr = `${dailyData.main.titleWhite} ${dailyData.main.titleBlue}`.trim();
        const wordsArray = fullTitleStr.split(/\s+/);
        
        const stackedTitleHTML = wordsArray.map((word, idx) => {
            if (idx === wordsArray.length - 1) {
                return `<div class="last-word-blue">${word}</div>`;
            }
            return `<div>${word}</div>`;
        }).join('');

        // BRAND FIXED LOGIC
        let kickerHTML = dailyData.main.kicker;
        if (kickerHTML.includes('SIYAL AIR')) {
            kickerHTML = kickerHTML.replace('AIR', '<span class="blue-text">AIR</span>');
        }

        // DYNAMIC PREVIEW GENERATION: Compiles the 6 sub-slide headlines
        const matrixItemsHTML = dailyData.slides.slice(0, 6).map((slide, idx) => {
            // Clean up any trailing colons or layout punctuation for the preview line
            const cleanHeading = slide.heading.replace(/:$/, '').trim();
            return `
                <div class="matrix-item">
                    <span class="matrix-num">0${idx + 1}</span>
                    <span class="matrix-text">${cleanHeading}</span>
                </div>
            `;
        }).join('');
        
        canvas.className = 'main-hook-style continuous-matrix-layout'; 
        html = `
            <div class="main-cover-split">
                <!-- Left Column: Primary Brand Hook -->
                <div class="cover-brand-column">
                    <div class="logo-container">
                        <img src="assets/logo.png" alt="SIYALAIR LOGO" class="brand-logo" onerror="this.style.display='none';">
                    </div>
                    <span class="kicker">${kickerHTML}</span>
                    <header>
                        <h1 class="auto-fit main-title-stacked">${stackedTitleHTML}</h1>
                    </header>
                </div>
                
                <!-- Right Column: Briefing Matrix -->
                <div class="cover-matrix-column">
                    <div class="matrix-header">INSIDE THIS BRIEFING</div>
                    <div class="matrix-grid">
                        ${matrixItemsHTML}
                    </div>
                </div>
            </div>
            <div class="swipe-prompt">SWIPE NEXT →</div>
        `;
    }
