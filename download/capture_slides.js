const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    // Target the specific "download" directory you just created
    const downloadPath = path.resolve(__dirname);
    
    console.log("Cleaning out any old slide images from previous runs...");
    const existingFiles = fs.readdirSync(downloadPath);
    existingFiles.forEach(file => {
        if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.webp') || file.endsWith('.crdownload')) {
            try {
                fs.unlinkSync(path.join(downloadPath, file));
            } catch (err) {
                console.warn(`Warning: Could not remove old file ${file}: ${err.message}`);
            }
        }
    });

    console.log("Launching headless browser viewport...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Added: Prevents Linux shared memory crashes in GitHub Actions runner containers
            '--no-first-run',
            '--no-zygote'
        ]
    });
    
    try {
        const page = await browser.newPage();

        // Intercept the browser's native download behavior and force it into your 'download' folder
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath
        });

        // Appended dynamic cache-busting query string to completely bypass GitHub Pages CDN edge cache and force live payload ingestion
        const liveTargetUrl = `https://siyalair-logistics.github.io/SiyalAir-Intelligence/?cache_bust=${Date.now()}`;

        console.log("Connecting to live visual matrix page...");
        // LOCKED IN: Target the authentic SiyalAir website deployment URL with zero-cache injection
        await page.goto(liveTargetUrl, {
            waitUntil: 'networkidle0', // Upgraded to networkidle0 to guarantee full evaluation of newly deployed static payloads
            timeout: 60000
        });

        // IMPLEMENTED USER SUGGESTION: Enforce a dedicated 120-second (2 minute) stability delay post-load. 
        // This allows client-side scripts, canvas generators, and dynamic render loops enough real-world time to flush legacy DOM elements and re-synthesize fresh asset buffers before automated triggering.
        console.log("Page fully loaded. Initiating mandatory 2-minute stabilization window to ensure fresh asset compilation...");
        for (let i = 120; i > 0; i -= 15) {
            console.log(`Stabilization countdown: ${i} seconds remaining...`);
            await new Promise(r => setTimeout(r, 15000));
        }

        console.log("Triggering your engine's bulk download sequence...");
        // Programmatically click your existing functional header button (#download-active)
        await page.click('#download-active');

        console.log("Awaiting engine synthesis pipeline to process all slides...");
        
        // Wait until files have finished downloading completely (dynamically checks based on available elements and active .crdownload locks)
        let totalFiles = 0;
        for (let attempt = 0; attempt < 60; attempt++) {
            await new Promise(r => setTimeout(r, 1000));
            const currentDirFiles = fs.readdirSync(downloadPath);
            
            // Check if Chrome is still actively writing temporary download files to disk
            const activeDownloads = currentDirFiles.filter(f => f.endsWith('.crdownload'));
            const completedFiles = currentDirFiles.filter(f => f.endsWith('.png') || f.endsWith('.webp') || f.endsWith('.jpg'));
            
            totalFiles = completedFiles.length;
            
            // Proceed only when target slide yield (9 assets) is reached and NO temporary download locks remain
            if (totalFiles >= 9 && activeDownloads.length === 0) {
                console.log(`Download settled cleanly. All ${totalFiles} target assets confirmed finalized on disk.`);
                break; 
            }
        }

        console.log(`Discovered ${totalFiles} raw assets. Streamlining structural order labels...`);

        // Organize and sequentially rename the captured files cleanly (slide_01 to slide_09)
        const files = fs.readdirSync(downloadPath).filter(f => f.endsWith('.png') || f.endsWith('.webp') || f.endsWith('.jpg'));
        files.forEach((file) => {
            const fullPath = path.join(downloadPath, file);
            let newName = "";

            // Enhanced regex pattern matching: case-insensitive & localized prefix/suffix resistant
            if (/MAIN/i.test(file)) {
                newName = "slide_01.webp";
            } else if (/FOLLOW/i.test(file)) {
                newName = "slide_09.webp";
            } else {
                const match = file.match(/SLIDE_(\d+)/i);
                if (match) {
                    // Adds 1 so SLIDE_1 becomes slide_02.webp (leaving slide_01 for MAIN)
                    const slideNum = parseInt(match[1], 10) + 1; 
                    newName = `slide_${String(slideNum).padStart(2, '0')}.webp`;
                }
            }

            if (newName) {
                const targetPath = path.join(downloadPath, newName);
                fs.renameSync(fullPath, targetPath);
                console.log(`Renamed: ${file} -> ${newName}`);
            }
        });

        console.log("Asset synchronization sequence completed successfully.");
    } catch (error) {
        console.error("Critical Failure in Capture Engine Pipeline:", error);
        throw error;
    } finally {
        // Guaranteed Process Disassembly: Prevents orphaned Chrome processes in CI runners
        console.log("Disassembling browser instance...");
        await browser.close();
    }
})();
