const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const ffmpegInstaller = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

// Wrap text cleanly for centered display (~70% width)
function formatMultilineText(text, maxCharsPerLine = 16) {
    if (!text) return "";
    const words = text.trim().split(/\s+/);
    let lines = [];
    let currentLine = '';

    words.forEach(word => {
        if ((currentLine + ' ' + word).trim().length > maxCharsPerLine) {
            if (currentLine.trim()) lines.push(currentLine.trim());
            currentLine = word;
        } else {
            currentLine += (currentLine ? ' ' : '') + word;
        }
    });
    if (currentLine.trim()) {
        lines.push(currentLine.trim());
    }
    return lines.join('\n');
}

async function buildShortFromTemplate(templatePath) {
    const templateFileName = path.basename(templatePath, '.js');
    console.log(`\n🚀 Initializing pipeline for template: ${templateFileName}.js ...`);

    const data = require(templatePath);
    
    // Dynamically resolve root object container (supports youtube_shorts_data, linkedin_shorts_data, or fallback)
    const rootDataKey = Object.keys(data).find(k => k.includes('_shorts_data')) || Object.keys(data)[0];
    const rawContainer = data[rootDataKey] || data;
    const newsSlides = rawContainer.script_slides || [];

    const styleConfig = fs.existsSync(path.join(__dirname, 'short_style.json')) 
        ? require('./short_style.json') 
        : {
            fontName: "MYRIADPRO-REGULAR.otf",
            fontSize: 76,
            fontColor: "white",
            lineSpacing: 22,
            boxEnabled: false,
            boxColor: "black@0.0",
            boxBorderWidth: 0,
            transitionDuration: 0.5
        };

    console.log(`📜 Loaded ${newsSlides.length} narrative points using font: ${styleConfig.fontName}`);

    // Universal brand intro data tailored for global logistics
    const introSlideData = {
        imagePath: path.join(__dirname, 'yt_backgrounds', 'introbackgroundyt.png'),
        narration: "Hey, Want to know what's trending in global logistics?",
        formattedText: formatMultilineText("TRENDING NOW", 16)
    };

    // Universal closing outro data (No text overlay, only background image + call to action narration)
    const closingSlideData = {
        imagePath: path.join(__dirname, 'yt_backgrounds', 'closingbackgroundyt.png'),
        narration: "Subscribe and follow for hourly decoded global trade signals. Link in bio.",
        formattedText: "" // No text rendered for closing slide
    };

    const hasIntroBg = fs.existsSync(introSlideData.imagePath);
    if (!hasIntroBg) {
        console.warn("⚠️ Warning: Missing 'introbackgroundyt.png' in yt_backgrounds folder.");
    }

    const hasClosingBg = fs.existsSync(closingSlideData.imagePath);
    if (!hasClosingBg) {
        console.warn("⚠️ Warning: Missing 'closingbackgroundyt.png' in yt_backgrounds folder.");
    }

    const voiceName = "en-US-EmmaNeural";
    const slideAudioFiles = [];
    const slideDurations = [];
    const allSlides = [];

    // 1. Synthesize Universal Intro Audio if intro background exists
    if (hasIntroBg) {
        console.log("🎙️ Synthesizing universal brand intro audio...");
        const introAudioPath = path.join(__dirname, `temp_slide_audio_intro_${templateFileName}.mp3`);
        const introTtsCmd = `python -m edge_tts --voice "${voiceName}" --text "${introSlideData.narration}" --write-media "${introAudioPath}"`;
        execSync(introTtsCmd, { stdio: 'inherit' });

        const probeCmd = `"${ffprobeStatic.path}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${introAudioPath}"`;
        const durationStr = execSync(probeCmd).toString().trim();
        const exactDuration = parseFloat(durationStr);

        slideAudioFiles.push(introAudioPath);
        const introDuration = Math.max(exactDuration, 1.5);
        slideDurations.push(introDuration);

        allSlides.push({
            imagePath: introSlideData.imagePath,
            duration: introDuration,
            audioPath: introAudioPath,
            text: introSlideData.formattedText,
            isIntro: true,
            isClosing: false
        });
    }

    console.log("🎙️ Synthesizing individual news slide audio tracks...");
    for (let i = 0; i < newsSlides.length; i++) {
        const slide = newsSlides[i];
        const slideText = slide.alpha_narration || slide.narration_line || slide.title || "";
        const slideAudioPath = path.join(__dirname, `temp_slide_audio_${templateFileName}_${i}.mp3`);

        const ttsCommand = `python -m edge_tts --voice "${voiceName}" --text "${slideText}" --write-media "${slideAudioPath}"`;
        execSync(ttsCommand, { stdio: 'inherit' });

        const probeCmd = `"${ffprobeStatic.path}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${slideAudioPath}"`;
        const durationStr = execSync(probeCmd).toString().trim();
        const exactDuration = parseFloat(durationStr);

        slideAudioFiles.push(slideAudioPath);
        const duration = Math.max(exactDuration, 2.0);
        slideDurations.push(duration);

        const bgNum = i + 1;
        const imgPath = path.join(__dirname, 'yt_backgrounds', `backgroundyt${bgNum}.png`);
        
        if (fs.existsSync(imgPath)) {
            const rawFormattedText = formatMultilineText(slide.narration_line || slide.title || "", 16);
            allSlides.push({
                imagePath: imgPath,
                duration: duration,
                audioPath: slideAudioPath,
                text: rawFormattedText,
                isIntro: false,
                isClosing: false
            });
        } else {
            console.warn(`⚠️ Warning: Missing background asset -> backgroundyt${bgNum}.png`);
        }
    }

    // 2. Synthesize Closing Outro Audio if closing background exists
    if (hasClosingBg) {
        console.log("🎙️ Synthesizing universal closing outro audio...");
        const closingAudioPath = path.join(__dirname, `temp_slide_audio_closing_${templateFileName}.mp3`);
        const closingTtsCmd = `python -m edge_tts --voice "${voiceName}" --text "${closingSlideData.narration}" --write-media "${closingAudioPath}"`;
        execSync(closingTtsCmd, { stdio: 'inherit' });

        const probeCmd = `"${ffprobeStatic.path}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${closingAudioPath}"`;
        const durationStr = execSync(probeCmd).toString().trim();
        const exactDuration = parseFloat(durationStr);

        slideAudioFiles.push(closingAudioPath);
        const closingDuration = Math.max(exactDuration, 2.0);
        slideDurations.push(closingDuration);

        allSlides.push({
            imagePath: closingSlideData.imagePath,
            duration: closingDuration,
            audioPath: closingAudioPath,
            text: closingSlideData.formattedText, // Empty string, no text drawn
            isIntro: false,
            isClosing: true
        });
    }

    console.log(`🎬 Compiling video with ${allSlides.length} total segments for ${templateFileName}...`);

    const outputVideoName = `output_${templateFileName.replace(/_template|_EN|_DE|_FR/gi, '')}_${data.language || 'en'}.mp4`.toLowerCase();
    const outputVideoPath = path.join(__dirname, outputVideoName);
    const rawFontPath = path.join(__dirname, 'fonts', styleConfig.fontName);
    const customFontPath = rawFontPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    const transDur = styleConfig.transitionDuration || 0.5;

    const bgMusicPath = path.join(__dirname, 'BG_Sound', 'Orchestronika_Another_Try.mp3');
    const hasBgMusic = fs.existsSync(bgMusicPath);

    const ffmpegArgs = [];
    let filterComplex = '';

    allSlides.forEach((slide) => {
        ffmpegArgs.push('-loop', '1', '-t', String(slide.duration + transDur), '-i', slide.imagePath);
        ffmpegArgs.push('-i', slide.audioPath);
    });

    if (hasBgMusic) {
        ffmpegArgs.push('-stream_loop', '-1', '-i', bgMusicPath);
    }

    const totalSlidesCount = allSlides.length;
    const dotSpacing = 36; // Horizontal pixels between pagination circles
    const totalPaginationWidth = (totalSlidesCount - 1) * dotSpacing;
    const paginationStartX = Math.round((1080 - totalPaginationWidth) / 2);
    const paginationY = 1750; // Centered near the bottom vertically

    allSlides.forEach((slide, i) => {
        let baseVideoFilter = `[${i * 2}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1`;

        let drawFilters = baseVideoFilter;

        if (!slide.isClosing && slide.text) {
            const textFilePath = path.join(__dirname, `temp_text_${templateFileName}_${i}.txt`);
            fs.writeFileSync(textFilePath, slide.text, 'utf8');
            const safeTextPath = textFilePath.replace(/\\/g, '/').replace(/:/g, '\\:');
            const alphaExpr = `if(lt(t,0.3),t/0.3,1)`;

            // ADDED: expansion=none to guarantee literal string interpretation and prevent silent text layer drops
            drawFilters += `,drawtext=fontfile='${customFontPath}':textfile='${safeTextPath}':expansion=none:fontcolor=${styleConfig.fontColor}:fontsize=${styleConfig.fontSize}:line_spacing=${styleConfig.lineSpacing}:box=${styleConfig.boxEnabled ? 1 : 0}:boxcolor=${styleConfig.boxColor}:boxborderw=${styleConfig.boxBorderWidth}:alpha='${alphaExpr}':x=(w-text_w)/2:y=(h-text_h)/2`;
        }

        // Smart Next Arrow cue on bottom right, perfectly aligned vertically with the pagination dots line (y = paginationY - 30)
        if (!slide.isClosing && slide.duration > 1.0) {
            const arrowAppearTime = slide.duration - 1.0;
            const arrowAlpha = `if(gte(t,${arrowAppearTime}),if(lt(t,${arrowAppearTime}+0.3),(t-${arrowAppearTime})/0.3,1),0)`;
            drawFilters += `,drawtext=fontfile='${customFontPath}':text='NEXT ›':fontcolor=white@0.85:fontsize=42:alpha='${arrowAlpha}':x=w-text_w-60:y=${paginationY - 30}`;
        }

        // Bottom Center Pagination Carousel Slider (rendered as glowing blue circles for current slide, dim gray for others)
        for (let d = 0; d < totalSlidesCount; d++) {
            const dotX = paginationStartX + (d * dotSpacing);
            const isCurrent = (d === i);
            const dotColor = isCurrent ? '#00d2ff@0.95' : '#888888@0.4';
            const dotRadius = isCurrent ? 8 : 6; // Active slide dot is slightly larger and glows

            drawFilters += `,drawbox=x=${dotX - dotRadius}:y=${paginationY - dotRadius}:w=${dotRadius * 2}:h=${dotRadius * 2}:color=${dotColor}:t=fill`;
        }

        filterComplex += `${drawFilters}[vbase${i}];\n`;
    });

    let currentVideoLabel = "vbase0";
    let accumulatedTime = 0;

    for (let i = 0; i < allSlides.length - 1; i++) {
        accumulatedTime += allSlides[i].duration;
        const nextLabel = i === allSlides.length - 2 ? "outv" : `vtrans${i}`;
        
        filterComplex += `[${currentVideoLabel}][vbase${i + 1}]xfade=transition=fade:duration=${transDur}:offset=${accumulatedTime}[${nextLabel}];\n`;
        currentVideoLabel = nextLabel;
    }

    if (allSlides.length === 1) {
        filterComplex += `[vbase0]copy[outv];\n`;
    }

    let concatAudioString = '';
    allSlides.forEach((_, i) => {
        const audioInputIndex = (i * 2) + 1;
        concatAudioString += `[${audioInputIndex}:a]`;
    });
    // Keep voiceover at standard raw concat volume without boosting it further, preventing it from overpowering the background track
    filterComplex += `${concatAudioString}concat=n=${allSlides.length}:v=0:a=1[voice_mix];\n`;

    if (hasBgMusic) {
        const bgMusicIndex = allSlides.length * 2;
        const totalDuration = allSlides.reduce((acc, s) => acc + s.duration, 0);
        // Bumped background music volume up to 0.22 so it sits clearly and prominently in the mix without being masked
        filterComplex += `[${bgMusicIndex}:a]volume=0.22,atrim=duration=${totalDuration}[bg_muted];\n`;
        filterComplex += `[voice_mix][bg_muted]amix=inputs=2:duration=first:dropout_transition=2[outa]`;
    } else {
        filterComplex += `[voice_mix]copy[outa]`;
    }

    const filterScriptPath = path.join(__dirname, `temp_filter_${templateFileName}.txt`);
    fs.writeFileSync(filterScriptPath, filterComplex, 'utf8');

    ffmpegArgs.push('-filter_complex_script', filterScriptPath);
    ffmpegArgs.push('-map', '[outv]');
    ffmpegArgs.push('-map', '[outa]');
    ffmpegArgs.push('-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p');
    ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
    ffmpegArgs.push('-y', outputVideoPath);

    return new Promise((resolve, reject) => {
        console.log(`⚙️ Executing FFmpeg rendering process for ${templateFileName}...`);
        const ffmpegProcess = spawn(ffmpegInstaller, ffmpegArgs);

        ffmpegProcess.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        ffmpegProcess.stderr.on('data', (data) => {
            process.stderr.write(data);
        });

        ffmpegProcess.on('close', (code) => {
            if (fs.existsSync(filterScriptPath)) fs.unlinkSync(filterScriptPath);
            allSlides.forEach((_, i) => {
                const textPath = path.join(__dirname, `temp_text_${templateFileName}_${i}.txt`);
                if (fs.existsSync(textPath)) fs.unlinkSync(textPath);
            });
            slideAudioFiles.forEach(audioPath => {
                if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
            });

            if (code === 0) {
                console.log(`\n🎉 Success! Short successfully generated at: ${outputVideoPath}`);
                resolve();
            } else {
                reject(new Error(`FFmpeg process exited with code ${code} for ${templateFileName}`));
            }
        });
    });
}

async function runMultiTemplateQueue() {
    console.log("🔍 Scanning workspace for matching template files...");
    const files = fs.readdirSync(__dirname);
    
    // Automatically match files ending with _template.js or containing template keywords
    const templateFiles = files.filter(file => file.endsWith('.js') && (file.includes('template') || file.includes('shorts')));
    
    if (templateFiles.length === 0) {
        console.log("⚠️ No template files detected. Falling back to default youtube_template.js if present.");
        if (fs.existsSync(path.join(__dirname, 'youtube_template.js'))) {
            await buildShortFromTemplate(path.join(__dirname, 'youtube_template.js'));
        } else {
            console.error("❌ Error: No valid template files found to execute.");
        }
        return;
    }

    console.log(`📁 Discovered ${templateFiles.length} template file(s): ${templateFiles.join(', ')}`);

    for (const file of templateFiles) {
        try {
            await buildShortFromTemplate(path.join(__dirname, file));
        } catch (error) {
            console.error(`❌ Pipeline failure encountered while processing ${file}:`, error);
        }
    }

    console.log("\n🏁 All queued template video generations completed successfully!");
}

runMultiTemplateQueue().catch(console.error);
