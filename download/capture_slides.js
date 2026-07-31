/**
 * ==============================================================================
 * MODULE NAME: capture_slides.js
 * DIRECTORY:   download/
 * PURPOSE:     Puppeteer automation script to render visual matrix and capture slides.
 * DATA FLOW:   Live GitHub Pages URL -> CDP Download Interception -> Local Asset Renaming.
 * ==============================================================================
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Helper function to enforce unified log taxonomy across runner outputs
const log = (level, message) => {
    console.log(`[${level.toUpperCase()}] ${message}`);
};

(async () => {
    const downloadPath = path.resolve(__dirname);
    let browser = null;

    try {
        log('INFO', 'Starting capture_slides pipeline.');

        // ==============================================================================
        // [ MODULE 1: PRE-RUN CLEANUP ]
        // Purpose: Purges leftover image assets and partial downloads from prior runs.
        // ==============================================================================
        log('INFO', 'Purging legacy image artifacts from target directory...');
        const existingFiles = fs.readdirSync(downloadPath);
        let purgedCount = 0;

        existingFiles.forEach(file => {
            if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.webp') || file.endsWith('.crdownload')) {
                fs.unlinkSync(path.join(downloadPath, file));
                purgedCount++;
            }
        });
        log('SUCCESS', `Cleanup complete. Removed ${purgedCount} legacy artifacts.`);

        // ==============================================================================
        // [ MODULE 2: BROWSER INITIALIZATION & CDP SETUP ]
        // Purpose: Launches headless Chrome and intercepts Chrome DevTools Protocol downloads.
        // ==============================================================================
        log('INFO', 'Launching headless Puppeteer browser viewport...');
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Intercept native browser download behavior to direct assets to downloadPath
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath
        });

        // Dynamic cache-buster parameter to force live payload evaluation
        const liveTargetUrl = `https://siyalair-logistics.github.io/SiyalAir-Intelligence/?cache_bust=${Date.now()}`;
        
        log('INFO', `Connecting to visual matrix target: ${liveTargetUrl}`);
        await page.goto(liveTargetUrl, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });
        log('SUCCESS', 'Page connection established.');

        // ==============================================================================
        // [ MODULE 3: DOM STABILIZATION & CAPTURE TRIGGER ]
        // Purpose: Delays execution to allow canvas/DOM compilation before triggering capture.
        // ==============================================================================
        log('INFO', 'Initiating 120-second stabilization window for fresh asset compilation...');
        for (let remaining = 120; remaining > 0; remaining -= 15) {
            log('INFO', `Stabilization in progress: ${remaining}s remaining...`);
            await new Promise(r => setTimeout(r, 15000));
        }

        log('INFO', 'Triggering bulk download sequence via DOM target (#download-active)...');
        await page.click('#download-active');

        log('INFO', 'Awaiting file synthesis and download completion...');
        let totalFiles = 0;
        for (let attempt = 0; attempt < 45; attempt++) {
            await new Promise(r => setTimeout(r, 1000));
            const currentFiles = fs.readdirSync(downloadPath).filter(f => 
                f.endsWith('.png') || f.endsWith('.webp') || f.endsWith('.jpg')
            );
            totalFiles = currentFiles.length;
            if (totalFiles >= 9) break;
        }

        log('SUCCESS', `Synthesis pipeline complete. ${totalFiles} raw slide assets captured.`);

        // ==============================================================================
        // [ MODULE 4: ASSET RESTRUCTURING & SEQUENTIAL RENAMING ]
        // Purpose: Standardizes captured filenames to slide_01.webp through slide_09.webp.
        // ==============================================================================
        log('INFO', 'Re-indexing captured assets into standard sequential schema...');
        const capturedFiles = fs.readdirSync(downloadPath).filter(f => 
            f.endsWith('.png') || f.endsWith('.webp') || f.endsWith('.jpg')
        );

        capturedFiles.forEach((file) => {
            const fullPath = path.join(downloadPath, file);
            let newName = "";

            if (file.includes('MAIN')) {
                newName = "slide_01.webp";
            } else if (file.includes('FOLLOW')) {
                newName = "slide_09.webp";
            } else {
                const match = file.match(/SLIDE_(\d+)/);
                if (match) {
                    const slideNum = parseInt(match[1], 10) + 1;
                    newName = `slide_${String(slideNum).padStart(2, '0')}.webp`;
                }
            }

            if (newName) {
                fs.renameSync(fullPath, path.join(downloadPath, newName));
                log('SUCCESS', `Re-indexed asset: ${file} -> ${newName}`);
            }
        });

        log('SUCCESS', 'Asset capture and re-indexing pipeline executed successfully.');

    } catch (error) {
        log('ERROR', `Pipeline execution failed in capture_slides.js: ${error.message}`);
        process.exitCode = 1;
    } finally {
        if (browser !== null) {
            log('INFO', 'Terminating headless browser instance...');
            await browser.close();
        }
    }
})();
