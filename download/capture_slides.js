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
            fs.unlinkSync(path.join(downloadPath, file));
        }
    });

    console.log("Launching headless browser viewport...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();

    // Intercept the browser's native download behavior and force it into your 'download' folder
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath
    });

    console.log("Connecting to live visual matrix page...");
    // LOCKED IN: Target the authentic SiyalAir website deployment URL
    await page.goto('https://siyalair-logistics.github.io/SiyalAir-Intelligence/', {
        waitUntil: 'networkidle2',
        timeout: 60000
    });

    console.log("Triggering your engine's bulk download sequence...");
    // Programmatically click your existing functional header button (#download-active)
    await page.click('#download-active');

    console.log("Awaiting engine synthesis pipeline to process all slides...");
    
    // Wait until files have finished downloading completely (dynamically checks based on available elements)
    let totalFiles = 0;
    for (let attempt = 0; attempt < 45; attempt++) {
        await new Promise(r => setTimeout(r, 1000));
        const files = fs.readdirSync(downloadPath).filter(f => f.endsWith('.png') || f.endsWith('.webp') || f.endsWith('.jpg'));
        totalFiles = files.length;
        if (totalFiles >= 9) break; 
    }

    console.log(`Discovered ${totalFiles} raw assets. Streamlining structural order labels...`);

    // Organize and sequentially rename the captured files cleanly (slide_01 to slide_09)
    const files = fs.readdirSync(downloadPath).filter(f => f.endsWith('.png') || f.endsWith('.webp') || f.endsWith('.jpg'));
    files.forEach((file) => {
        const fullPath = path.join(downloadPath, file);
        let newName = "";

        if (file.includes('MAIN')) {
            newName = "slide_01.webp";
        } else if (file.includes('FOLLOW')) {
            newName = "slide_09.webp";
        } else if (file.includes('QUOTE')) {
            newName = "slide_08.webp";
        } else {
            const match = file.match(/SLIDE_(\d+)/);
            if (match) {
                // Standard sub-slides 1 through 7 map directly to slide_02 through slide_08 originally, 
                // but with QUOTE locked at slide_08, sub-slides map precisely to slide_02 through slide_07.
                const slideNum = parseInt(match[1]) + 1; 
                newName = `slide_${String(slideNum).padStart(2, '0')}.webp`;
            }
        }

        if (newName) {
            fs.renameSync(fullPath, path.join(downloadPath, newName));
            console.log(`Renamed: ${file} -> ${newName}`);
        }
    });

    console.log("Asset synchronization sequence completed successfully.");
    await browser.close();
})();
