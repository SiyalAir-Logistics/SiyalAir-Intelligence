// ==========================================
// SECTION 1: CORE MODULE DEPENDENCIES & IMPORTS
// Handles file system operations, path resolving, process execution, and FFmpeg binaries.
// ==========================================
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const ffmpegInstaller = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

// ==========================================
// SECTION 2: ABSOLUTE SLIDE MAP & BANNER RULES CLARIFICATION
// ==========================================
/*
  ABSOLUTE SLIDE NUMBERING MAPPING (Index 0 to 9 in total 10 slides):
  - Slide 1: Main Intro Slide (Intro hook screen) -> NO BOTTOM BANNER.
  - Slide 2 to Slide 8 (Array indices 1 to 7, corresponding to Sub-Slide 1 through Sub-Slide 7) -> MUST SHOW BOTTOM BANNER.
    * Special Rule for Slide 8 (Sub-Slide 7 / 2nd last content sub-slide): Must show bottom banner and title, but MUST HAVE NO NEXT SLIDE TEASER TEXT.
  - Slide 9: Follow-up / 2nd last slide -> NO BOTTOM BANNER.
  - Slide 10: Last / Closing slide -> NO BOTTOM BANNER.
*/

// ==========================================
// SECTION 3: VOICE PROFILE & TTS CONFIGURATION
// Configures pitch, speaking rate, and active voice profile (en-US-AvaNeural).
// ==========================================
const SELECTED_VOICE_PROFILE = 'FEMALE_BREAKING'; 

const VOICE_PROFILES = {
    FEMALE_BREAKING: {
        voiceName: "en-US-AvaNeural",
        introRate: "+12%",    // Snappier, high-urgency hook speed
        introPitch: "+3Hz", 
        bodyRate: "+10%",    // Snappier news delivery cadence
        bodyPitch: "+1Hz",
        outroRate: "+4%",    // Proportional closing acceleration
        outroPitch: "+0Hz"
    },
    MALE_AUTHORITY: {
        voiceName: "en-US-AndrewNeural",
        introRate: "+8%",
        introPitch: "+1Hz",
        bodyRate: "+5%",
        bodyPitch: "+0Hz",
        outroRate: "+2%",
        outroPitch: "-1Hz"
    }
};

// ==========================================
// SECTION 4: UTILITY & TEXT FORMATTING HELPER FUNCTIONS
// Date formatting, multiline text wrapping, intro title single-word stacker, dynamic scaling.
// ==========================================

/**
 * Helper to generate current date string dynamically in DD-MMM-YYYY format (e.g., 31-JUL-2026)
 */
function getCurrentFormattedDate() {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[d.getMonth()];
    const year = String(d.getFullYear());
    return `${day}-${month}-${year}`;
}

/**
 * Format multiline text for symmetric body text display
 */
function formatMultilineText(text, maxCharsPerLine = 22) {
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

/**
 * Format Main Intro Hook Title into single-word vertical stack matching reference layout
 */
function formatIntroTitleSingleWord(text) {
    if (!text) return { mainText: "", lastWord: "", totalLines: 0, mainLineCount: 0 };
    const words = text.trim().split(/\s+/);
    if (words.length === 1) {
        return { mainText: "", lastWord: words[0].toUpperCase(), totalLines: 1, mainLineCount: 0 };
    }
    const mainWords = words.slice(0, -1).map(w => w.toUpperCase());
    const lastWord = words[words.length - 1].toUpperCase();
    return {
        mainText: mainWords.join('\n'),
        lastWord: lastWord,
        totalLines: words.length,
        mainLineCount: mainWords.length
    };
}

/**
 * DYNAMIC INTRO FONT SCALER & ALIGNMENT CALCULATOR
 */
function calculateDynamicIntroFontSize(introTitleObj) {
    const totalLines = introTitleObj.totalLines || 1;
    let maxLineLength = 0;
    
    if (introTitleObj.mainText) {
        const lines = introTitleObj.mainText.split('\n');
        lines.forEach(l => { if (l.length > maxLineLength) maxLineLength = l.length; });
    }
    if (introTitleObj.lastWord && introTitleObj.lastWord.length > maxLineLength) {
        maxLineLength = introTitleObj.lastWord.length;
    }

    let fontSize = 185; 

    if (totalLines >= 6) fontSize = 115;
    else if (totalLines === 5) fontSize = 135;
    else if (totalLines === 4) fontSize = 155;

    if (maxLineLength > 12) fontSize = Math.min(fontSize, 110);
    else if (maxLineLength > 9) fontSize = Math.min(fontSize, 130);

    const lineSpacing = Math.round(fontSize * 0.05);
    const totalHeight = (totalLines * fontSize) + ((totalLines - 1) * lineSpacing);
    const startY = Math.round(900 - (totalHeight / 2)); 

    return { fontSize, lineSpacing, startY };
}

// ==========================================
// SECTION 5: PHONETIC ENGINE & AUDIO SYNTHESIS
// Normalizes text strings and triggers Python Edge-TTS for audio synthesis.
// ==========================================

function prepareHumanizedText(rawText) {
    if (!rawText) return "";
    
    let clean = rawText.replace(/<[^>]*>/g, '').trim();

    clean = clean
        .replace(/\be-commerce\b/gi, 'ecommerce')
        .replace(/\be-commerce's\b/gi, "ecommerce's")
        .replace(/\bco-op\b/gi, 'coop')
        .replace(/\bon-line\b/gi, 'online');

    clean = clean.replace(/([a-zA-Z0-9]+)-([a-zA-Z0-9]+)/g, '$1 $2');

    clean = clean
        .replace(/%/g, ' per cent')
        .replace(/&/g, ' and ')
        .replace(/\+/g, ' plus ')
        .replace(/\bUSD\b/gi, 'U.S. Dollars')
        .replace(/\bEUR\b/gi, 'Euros')
        .replace(/\bGBP\b/gi, 'British Pounds')
        .replace(/\bvs\.?\b/gi, 'versus')
        .replace(/\bTEU\b/gi, 'T-E-U')
        .replace(/\bTEUs\b/gi, 'T-E-Us')
        .replace(/\bAI\b/g, 'A.I.')
        .replace(/\bUS\b/g, 'US')
        .replace(/\bU\.S\./g, 'US')
        .replace(/\bUK\b/g, 'U.K.')
        .replace(/\bUAE\b/g, 'U.A.E.');

    clean = clean
        .replace(/\s+(–|—|-)\s+/g, ' ')
        .replace(/:\s*/g, ', ')
        .replace(/;\s*/g, ' ');

    clean = clean
        .replace(/,\s*,+/g, ',')
        .replace(/\.\s*,+/g, '.')
        .replace(/,\s*\./g, '.')
        .replace(/\s+/g, ' ')
        .trim();

    if (!clean.endsWith('.') && !clean.endsWith('!') && !clean.endsWith('?')) {
        clean += '.';
    }

    return clean;
}

function synthesizeVoiceover(rawText, outputPath, tempTag, segmentType = 'body') {
    const cleanText = prepareHumanizedText(rawText);
    const tempTxtPath = path.join(__dirname, `temp_speech_${tempTag}.txt`);
    fs.writeFileSync(tempTxtPath, cleanText, 'utf8');

    const profile = VOICE_PROFILES[SELECTED_VOICE_PROFILE] || VOICE_PROFILES.FEMALE_BREAKING;
    
    let rate = profile.bodyRate;
    let pitch = profile.bodyPitch;

    if (segmentType === 'intro') {
        rate = profile.introRate;
        pitch = profile.introPitch;
    } else if (segmentType === 'closing') {
        rate = profile.outroRate;
        pitch = profile.outroPitch;
    }

    const cmd = `python -m edge_tts --voice "${profile.voiceName}" --rate="${rate}" --pitch="${pitch}" -f "${tempTxtPath}" --write-media "${outputPath}"`;
    execSync(cmd, { stdio: 'inherit' });

    if (fs.existsSync(tempTxtPath)) {
        fs.unlinkSync(tempTxtPath);
    }
}

// ==========================================
// SECTION 6: MAIN SHORT BUILD ENGINE
// Reads video template data, orchestrates audio generation, and structures slide models.
// ==========================================

async function buildShortFromTemplate(templatePath) {
    const templateFileName = path.basename(templatePath, '.js');
    console.log(`\n🚀 Initializing news pipeline for template: ${templateFileName}.js ...`);

    const data = require(templatePath);
    const rootDataKey = Object.keys(data).find(k => k.includes('shorts_data') || k.includes('script_slides')) || Object.keys(data)[0];
    const rawContainer = data[rootDataKey] || data;
    const newsSlides = rawContainer.script_slides || [];
    const templateLang = (data.language || 'EN').toLowerCase();

    const dynamicHookTitle = rawContainer.hookTitle 
        || (newsSlides[0] && (newsSlides[0].headline || newsSlides[0].title)) 
        || "BREAKING NEWS INTELLIGENCE";

    const styleConfig = fs.existsSync(path.join(__dirname, 'short_style.json')) 
        ? require('./short_style.json') 
        : {
            fontName: "MYRIADPRO-REGULAR.otf",
            fontSize: 76,
            fontColor: "white",
            lineSpacing: 26,
            transitionDuration: 0.35
        };

    const activeProfile = VOICE_PROFILES[SELECTED_VOICE_PROFILE];
    console.log(`🎙️ Active Voice: ${activeProfile.voiceName} | Language: ${templateLang.toUpperCase()}`);

    const introTitleObj = formatIntroTitleSingleWord(dynamicHookTitle);
    const introFontMetrics = calculateDynamicIntroFontSize(introTitleObj);

    const introSlideData = {
        imagePath: path.join(__dirname, 'yt_backgrounds', 'introbackgroundyt.png'),
        introTitleObj: introTitleObj,
        introFontSize: introFontMetrics.fontSize,
        introLineSpacing: introFontMetrics.lineSpacing,
        introStartY: introFontMetrics.startY,
        teaserTitle: newsSlides[0] ? (newsSlides[0].teaserTitle || newsSlides[0].headline || "") : ""
    };

    const closingSlideData = {
        imagePath: path.join(__dirname, 'yt_backgrounds', 'closingbackgroundyt.png'),
        narration: "Subscribe and follow for hourly decoded global trade signals. Link in bio.",
        formattedText: ""
    };

    const hasIntroBg = fs.existsSync(introSlideData.imagePath);
    const hasClosingBg = fs.existsSync(closingSlideData.imagePath);

    const slideAudioFiles = [];
    const slideDurations = [];
    const allSlides = [];

    const transDur = styleConfig.transitionDuration || 0.35;

    const customBannerPath = path.join(__dirname, 'assets', 'bottom_banner.png');
    const hasCustomBanner = fs.existsSync(customBannerPath);
    if (hasCustomBanner) {
        console.log("🎨 Custom lower-third asset detected: assets/bottom_banner.png");
    }

    // SLIDE 1 (Index 0): Main Intro Slide -> No Bottom Banner
    if (hasIntroBg) {
        console.log("🎙️ Preparing silent 1.0s intro hook screen (Slide 1)...");
        const introAudioPath = path.join(__dirname, `temp_slide_audio_intro_${templateFileName}.mp3`);
        
        const createSilenceCmd = `"${ffmpegInstaller}" -f lavfi -i anullsrc=r=44100:cl=stereo -t 1.0 -c:a mp3 -y "${introAudioPath}"`;
        execSync(createSilenceCmd, { stdio: 'ignore' });

        const introDuration = 1.0; 
        slideAudioFiles.push(introAudioPath);
        slideDurations.push(introDuration);

        allSlides.push({
            imagePath: introSlideData.imagePath,
            duration: introDuration,
            audioPath: introAudioPath,
            introTitleObj: introSlideData.introTitleObj,
            introFontSize: introSlideData.introFontSize,
            introLineSpacing: introSlideData.introLineSpacing,
            introStartY: introSlideData.introStartY,
            headline: "TRENDING NOW",
            teaserTitle: introSlideData.teaserTitle,
            absoluteSlideNumber: 1,
            showBanner: false,
            hasTeaserText: false,
            isIntro: true,
            isClosing: false
        });
    }

    console.log("🎙️ Synthesizing news body narration (Slides 2 through 9)...");
    for (let i = 0; i < newsSlides.length; i++) {
        const slide = newsSlides[i];
        const slideText = slide.alpha_narration || slide.narration_line || slide.title || "";
        const rawHeadline = (slide.headline || slide.title || "").toUpperCase();
        
        // Absolute slide number calculation: Slide 1 is intro, so news slides start at Slide 2
        const absoluteSlideNum = i + 2; 

        // Rule check: Slides 2 through 8 show bottom banner. Slide 9 (followup/2nd last) does NOT show banner.
        const showBanner = (absoluteSlideNum >= 2 && absoluteSlideNum <= 8);

        // Rule check: Slide 8 must have NO next slide teaser text.
        const isSlide8 = (absoluteSlideNum === 8);
        let slideTeaser = isSlide8 ? "" : (slide.teaserTitle || "");
        const hasTeaserText = showBanner && !isSlide8 && Boolean(slideTeaser);

        const slideHeadline = `${i + 1}. ${rawHeadline}`;
        const slideAudioPath = path.join(__dirname, `temp_slide_audio_${templateFileName}_${i}.mp3`);

        synthesizeVoiceover(slideText, slideAudioPath, `${templateFileName}_${i}`, 'body');

        const probeCmd = `"${ffprobeStatic.path}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${slideAudioPath}"`;
        const exactDuration = parseFloat(execSync(probeCmd).toString().trim());

        slideAudioFiles.push(slideAudioPath);

        const duration = Math.max(exactDuration + 0.5, 2.5);
        slideDurations.push(duration);

        const bgNum = i + 1;
        const imgPath = path.join(__dirname, 'yt_backgrounds', `backgroundyt${bgNum}.png`);
        
        if (fs.existsSync(imgPath)) {
            // UNIFIED UNIFORM LAYOUT FIX: Standardize maxChars strictly to 22 across all content slides to lock line width, padding, and vertical footprint.
            let maxChars = 22;
            const rawFormattedText = formatMultilineText(slide.narration_line || slide.title || "", maxChars);
            allSlides.push({
                imagePath: imgPath,
                duration: duration,
                audioPath: slideAudioPath,
                text: rawFormattedText,
                rawText: slide.narration_line || slide.title || "",
                headline: slideHeadline,
                rawTitle: rawHeadline,
                teaserTitle: slideTeaser,
                absoluteSlideNumber: absoluteSlideNum,
                showBanner: showBanner,
                hasTeaserText: hasTeaserText,
                isIntro: false,
                isClosing: false
            });
        }
    }

    // SLIDE 10 (Last / Closing Slide): No Bottom Banner
    if (hasClosingBg) {
        console.log("🎙️ Synthesizing closing call-to-action (Slide 10)...");
        const closingAudioPath = path.join(__dirname, `temp_slide_audio_closing_${templateFileName}.mp3`);

        synthesizeVoiceover(closingSlideData.narration, closingAudioPath, `closing_${templateFileName}`, 'closing');

        const probeCmd = `"${ffprobeStatic.path}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${closingAudioPath}"`;
        const exactDuration = parseFloat(execSync(probeCmd).toString().trim());

        slideAudioFiles.push(closingAudioPath);
        const closingDuration = Math.max(exactDuration + 1.2, 3.8);
        slideDurations.push(closingDuration);

        allSlides.push({
            imagePath: closingSlideData.imagePath,
            duration: closingDuration,
            audioPath: closingAudioPath,
            text: closingSlideData.formattedText,
            headline: "",
            rawTitle: "",
            teaserTitle: "",
            absoluteSlideNumber: 10,
            showBanner: false,
            hasTeaserText: false,
            isIntro: false,
            isClosing: true
        });
    }

    // ==========================================
    // SECTION 7: FFMPEG GRAPH COMPILATION & FILTER CHAINS
    // Configures canvas overlays, text drawfilters, lower-third banners, pagination, and transitions.
    // ==========================================
    console.log(`🎬 Assembling ${allSlides.length} video segments with strict absolute slide rules...`);

    const outputVideoName = `output_${templateFileName.replace(/_template|_EN|_DE|_FR/gi, '')}_${templateLang}.mp4`.toLowerCase();
    const outputVideoPath = path.join(__dirname, outputVideoName);
    const rawFontPath = path.join(__dirname, 'fonts', styleConfig.fontName);
    const customFontPath = rawFontPath.replace(/\\/g, '/').replace(/:/g, '\\:');

    const bgMusicPath = path.join(__dirname, 'BG_Sound', 'Orchestronika_Another_Try.mp3');
    const hasBgMusic = fs.existsSync(bgMusicPath);

    const ffmpegArgs = [];
    let filterComplex = '';

    allSlides.forEach((slide) => {
        ffmpegArgs.push('-loop', '1', '-t', String(slide.duration + transDur), '-i', slide.imagePath);
        ffmpegArgs.push('-i', slide.audioPath);
    });

    if (hasCustomBanner) {
        ffmpegArgs.push('-i', customBannerPath);
    }

    if (hasBgMusic) {
        ffmpegArgs.push('-stream_loop', '-1', '-i', bgMusicPath);
    }

    const totalSlidesCount = allSlides.length;
    const dotSpacing = 36;
    const totalPaginationWidth = (totalSlidesCount - 1) * dotSpacing;
    const paginationStartX = Math.round((1080 - totalPaginationWidth) / 2);
    const paginationY = 1750;

    const bannerInputIndex = hasCustomBanner ? (allSlides.length * 2) : -1;
    const currentDateStr = getCurrentFormattedDate();

    allSlides.forEach((slide, i) => {
        let baseVideoFilter = `[${i * 2}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1`;
        let drawFilters = baseVideoFilter;

        // ------------------------------------------
        // SUB-SECTION 7A: MAIN BODY TEXT SLIDES
        // ------------------------------------------
        if (!slide.isClosing && !slide.isIntro && slide.text) {
            const alphaExpr = `if(lt(t,0.25),t/0.25,1)`;
            const textFilePath = path.join(__dirname, `temp_text_${templateFileName}_${i}.txt`);
            fs.writeFileSync(textFilePath, slide.text, 'utf8');
            const safeTextPath = textFilePath.replace(/\\/g, '/').replace(/:/g, '\\:');

            // UNIFIED UNIFORM LAYOUT FIX: Stripped out font inflation multipliers (* 1.22) and variable font sizes/line spacings. 
            // All content slides (2-9) now render with a locked, identical broadcast-grade font size, uniform line spacing (52px), 
            // and perfectly synchronized padding/vertical baseline (y=360). Main text remains completely un-animated except for smooth fade-in alpha.
            drawFilters += `,drawtext=fontfile='${customFontPath}':textfile='${safeTextPath}':expansion=none:fontcolor=${styleConfig.fontColor}:fontsize=${styleConfig.fontSize}:line_spacing=52:alpha='${alphaExpr}':x=(1080-text_w)/2:y=360`;
        }

        // ------------------------------------------
        // SUB-SECTION 7B: PAGINATION DOT INDICATORS
        // ------------------------------------------
        for (let d = 0; d < totalSlidesCount; d++) {
            const dotX = paginationStartX + (d * dotSpacing);
            const isCurrent = (d === i);
            const dotColor = isCurrent ? '#D32F2F@1.0' : '#888888@0.4'; 
            const dotRadius = isCurrent ? 8 : 6;

            drawFilters += `,drawbox=x=${dotX - dotRadius}:y=${paginationY - dotRadius}:w=${dotRadius * 2}:h=${dotRadius * 2}:color=${dotColor}:t=fill`;
        }

        // ------------------------------------------
        // SUB-SECTION 7C: LOWER-THIRD BANNER (Strictly applied ONLY to Slides 2 through 8)
        // ------------------------------------------
        if (slide.showBanner) {
            if (hasCustomBanner) {
                drawFilters += `[v_stage_${i}];[v_stage_${i}][${bannerInputIndex}:v]overlay=0:1815`;
            } else {
                drawFilters += `,drawbox=x=0:y=1812:w=1080:h=3:color=#D32F2F@1.0:t=fill`;    
                drawFilters += `,drawbox=x=0:y=1815:w=220:h=105:color=#D32F2F@1.0:t=fill`;   
                drawFilters += `,drawbox=x=220:y=1815:w=860:h=105:color=#000000@0.90:t=fill`;   
            }

            if (!hasCustomBanner) {
                const breakingAlphaExpr = `if(lt(mod(t,12),5),1,if(lt(mod(t,12),6),1-(mod(t,12)-5),0))`;
                const dateAlphaExpr = `if(lt(mod(t,12),6),0,if(lt(mod(t,12),11),1,if(lt(mod(t,12),12),1-(mod(t,12)-11),0)))`;

                drawFilters += `,drawtext=fontfile='${customFontPath}':text='BREAKING':expansion=none:fontcolor=white:fontsize=20:alpha='${breakingAlphaExpr}':x=110-text_w/2:y=1836`;
                drawFilters += `,drawtext=fontfile='${customFontPath}':text='NEWS':expansion=none:fontcolor=white:fontsize=36:alpha='${breakingAlphaExpr}':x=110-text_w/2:y=1862`; 

                drawFilters += `,drawtext=fontfile='${customFontPath}':text='DATE':expansion=none:fontcolor=white:fontsize=18:alpha='${dateAlphaExpr}':x=110-text_w/2:y=1838`;
                drawFilters += `,drawtext=fontfile='${customFontPath}':text='${currentDateStr}':expansion=none:fontcolor=white:fontsize=26:alpha='${dateAlphaExpr}':x=110-text_w/2:y=1864`; 
            }

            const bannerTitlePath = path.join(__dirname, `temp_bannertitle_${templateFileName}_${i}.txt`);
            const titleString = (slide.rawTitle || slide.headline || "").replace(/^\d+\.\s*/, '');
            fs.writeFileSync(bannerTitlePath, titleString, 'utf8');
            const safeBannerTitlePath = bannerTitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');

            const rawTitleLen = titleString.length;
            let titleFontSize = 38; 
            if (rawTitleLen > 38) titleFontSize = 26;
            else if (rawTitleLen > 30) titleFontSize = 30;
            else if (rawTitleLen > 24) titleFontSize = 34;

            const bannerTitleXExpr = `if(lt(t,0.1),250,if(lt(t,0.3),250-(1-(t-0.1)/0.2)*150,if(lt(t,3.0),250,if(lt(t,3.2),250-((t-3.0)/0.2)*150,-500))))`;
            const bannerTitleAlpha = `if(lt(t,0.1),0,if(lt(t,0.3),(t-0.1)/0.2,if(lt(t,3.0),1,if(lt(t,3.2),1-(t-3.0)/0.2,0))))`;
            drawFilters += `,drawtext=fontfile='${customFontPath}':textfile='${safeBannerTitlePath}':expansion=none:fontcolor=white:fontsize=${titleFontSize}:alpha='${bannerTitleAlpha}':x='${bannerTitleXExpr}':y=1867.5-text_h/2`; 

            if (slide.hasTeaserText && slide.teaserTitle) {
                const bannerTeaserPath = path.join(__dirname, `temp_bteaser_${templateFileName}_${i}.txt`);
                const bannerTeaserStr = `NEXT: ${slide.teaserTitle.toUpperCase()}`;
                fs.writeFileSync(bannerTeaserPath, bannerTeaserStr, 'utf8');
                const safeBannerTeaserPath = bannerTeaserPath.replace(/\\/g, '/').replace(/:/g, '\\:');

                let teaserFontSize = titleFontSize;
                
                const slideTargetDuration = slide.duration;
                const teaserSlideOutStart = Math.max(3.5, slideTargetDuration - 0.4);
                const bannerTeaserXExpr = `if(lt(t,3.2),1200,if(lt(t,3.5),1050+(1-(t-3.2)/0.3)*300,if(lt(t,${teaserSlideOutStart}),1050,if(lt(t,${slideTargetDuration}),1050+((t-${teaserSlideOutStart})/0.4)*300,1200))))`;
                const teaserFadeAlpha = `if(lt(t,3.2),0,if(lt(t,3.5),(t-3.2)/0.3,if(lt(t,${teaserSlideOutStart}),1,if(lt(t,${slideTargetDuration}),1-(t-${teaserSlideOutStart})/0.4,0))))`;

                drawFilters += `,drawtext=fontfile='${customFontPath}':textfile='${safeBannerTeaserPath}':expansion=none:fontcolor=white:fontsize=${teaserFontSize}:alpha='${teaserFadeAlpha}':x='${bannerTeaserXExpr}-text_w':y=1867.5-text_h/2`; 
            }
        }

        filterComplex += `${drawFilters}[vbase${i}];\n`;
    });

    // ------------------------------------------
    // SUB-SECTION 7D: TRANSITION COMPOSITING & AUDIO DSP
    // ------------------------------------------
    let currentVideoLabel = "vbase0";
    let accumulatedTime = 0;

    for (let i = 0; i < allSlides.length - 1; i++) {
        accumulatedTime += allSlides[i].duration;
        const nextLabel = i === allSlides.length - 2 ? "outv" : `vtrans${i}`;
        
        filterComplex += `[${currentVideoLabel}][vbase${i + 1}]xfade=transition=fade:duration=${transDur}:offset=${accumulatedTime.toFixed(3)}[${nextLabel}];\n`;
        currentVideoLabel = nextLabel;
    }

    if (allSlides.length === 1) {
        filterComplex += `[vbase0]copy[outv];\n`;
    }

    let concatAudioString = '';
    allSlides.forEach((slide, i) => {
        const audioInputIndex = (i * 2) + 1;
        filterComplex += `[${audioInputIndex}:a]aresample=44100,apad=pad_dur=1.5,atrim=0:${slide.duration.toFixed(3)}[a_${i}];\n`;
        concatAudioString += `[a_${i}]`;
    });
    
    filterComplex += `${concatAudioString}concat=n=${allSlides.length}:v=0:a=1[voice_raw];\n`;

    filterComplex += `[voice_raw]highpass=f=80,equalizer=f=220:width_type=h:width=120:g=-3.5,equalizer=f=3400:width_type=h:width=1200:g=3.0,equalizer=f=7500:width_type=h:width=1500:g=-4.0,deesser=i=0.5:m=0.5,aecho=0.8:0.88:12:0.04,compand=attacks=0.01:decays=0.15:points=-80/-80|-40/-16|-15/-5|0/0,loudnorm=I=-16:TP=-1.2:LRA=9[voice_master];\n`;

    if (hasBgMusic) {
        const bgMusicIndex = hasCustomBanner ? (allSlides.length * 2) + 1 : (allSlides.length * 2);
        const totalDuration = allSlides.reduce((acc, s) => acc + s.duration, 0);
        
        filterComplex += `[${bgMusicIndex}:a]volume=0.38,atrim=duration=${totalDuration.toFixed(3)}[bg_trimmed];\n`;
        filterComplex += `[voice_master]asplit=2[v_for_mix][v_for_sc];\n`;
        filterComplex += `[bg_trimmed][v_for_sc]sidechaincompress=threshold=0.08:ratio=3.2:attack=15:release=250[bg_ducked];\n`;
        filterComplex += `[v_for_mix][bg_ducked]amix=inputs=2:duration=first:dropout_transition=1.0[outa]`;
    } else {
        filterComplex += `[voice_master]copy[outa]`;
    }

    const filterScriptPath = path.join(__dirname, `temp_filter_${templateFileName}.txt`);
    fs.writeFileSync(filterScriptPath, filterComplex, 'utf8');

    ffmpegArgs.push('-filter_complex_script', filterScriptPath);
    ffmpegArgs.push('-map', '[outv]');
    ffmpegArgs.push('-map', '[outa]');
    ffmpegArgs.push('-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p');
    ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
    ffmpegArgs.push('-y', outputVideoPath);

    // ==========================================
    // SECTION 8: CHILD PROCESS EXECUTION & CLEANUP
    // Spawns FFmpeg, streams output, and purges temporary files.
    // ==========================================
    return new Promise((resolve, reject) => {
        const ffmpegProcess = spawn(ffmpegInstaller, ffmpegArgs);

        ffmpegProcess.stderr.on('data', (data) => {
            process.stderr.write(data);
        });

        ffmpegProcess.on('close', (code) => {
            if (fs.existsSync(filterScriptPath)) fs.unlinkSync(filterScriptPath);
            allSlides.forEach((_, i) => {
                const textPath = path.join(__dirname, `temp_text_${templateFileName}_${i}.txt`);
                if (fs.existsSync(textPath)) fs.unlinkSync(textPath);
                const headlinePath = path.join(__dirname, `temp_headline_${templateFileName}_${i}.txt`);
                if (fs.existsSync(headlinePath)) fs.unlinkSync(headlinePath);
                const teaserPath = path.join(__dirname, `temp_teaser_${templateFileName}_${i}.txt`);
                if (fs.existsSync(teaserPath)) fs.unlinkSync(teaserPath);
                const bannerTitlePath = path.join(__dirname, `temp_bannertitle_${templateFileName}_${i}.txt`);
                if (fs.existsSync(bannerTitlePath)) fs.unlinkSync(bannerTitlePath);
                const bannerTeaserPath = path.join(__dirname, `temp_bteaser_${templateFileName}_${i}.txt`);
                if (fs.existsSync(bannerTeaserPath)) fs.unlinkSync(bannerTeaserPath);
            });
            slideAudioFiles.forEach(audioPath => {
                if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
            });

            if (code === 0) {
                console.log(`\n🎉 Success! High-energy news short rendered at: ${outputVideoPath}`);
                resolve();
            } else {
                reject(new Error(`FFmpeg process exited with code ${code}`));
            }
        });
    });
}

// ==========================================
// SECTION 9: AUTOMATED PIPELINE BATCH EXECUTION
// Discovers template JS files in root and triggers batch compilation.
// ==========================================
async function runMainTemplateQueue() {
    console.log("🔍 Scanning workspace for matching template files...");
    
    // UPDATED MATCH PATTERN: Added 'template_news' matching rule so dynamic workflows detect JSON/JS templates seamlessly.
    const files = fs.readdirSync(__dirname);
    const templateFiles = files.filter(file => file.endsWith('.js') && (
        file.includes('template') || 
        file.includes('shorts') || 
        file.includes('Video_Template') ||
        file.includes('template_news')
    ));

    for (const file of templateFiles) {
        try {
            await buildShortFromTemplate(path.join(__dirname, file));
        } catch (error) {
            console.error(`❌ Pipeline failure encountered while processing ${file}:`, error);
        }
    }

    console.log("\n🏁 All queued video generations completed!");
}

runMainTemplateQueue().catch(console.error);
