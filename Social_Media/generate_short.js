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
// SECTION 2: VOICE PROFILE & TTS CONFIGURATION
// Configures pitch, speaking rate, and active voice profile.
// ==========================================
const SELECTED_VOICE_PROFILE = 'FEMALE_BREAKING'; 

const VOICE_PROFILES = {
    FEMALE_BREAKING: {
        voiceName: "en-IN-NeerjaNeural",
        introRate: "+22%",    // Amplified ultra-high-urgency breaking news hook speed
        introPitch: "+6Hz",   // Higher commanding pitch for instant attention
        bodyRate: "+18%",     // Fast-paced, urgent, adrenaline-driven news delivery
        bodyPitch: "+3Hz",    // Elevated pitch for sharp, alert energy
        outroRate: "+12%",    // Accelerated dynamic punch for the closing call to action
        outroPitch: "+1Hz"
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
// SECTION 3: UTILITY & PHONETIC ENGINE & AUDIO SYNTHESIS
// Normalizes text strings, handles abbreviations/numbers smartly, and triggers Python Edge-TTS.
// ==========================================

function numberToWords(n) {
    const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
    const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
    
    if (n === 0) return "zero";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " hundred" + (n % 100 !== 0 ? " and " + numberToWords(n % 100) : "");
    if (n < 1000000) return numberToWords(Math.floor(n / 1000)) + " thousand" + (n % 1000 !== 0 ? " " + numberToWords(n % 1000) : "");
    return n.toString();
}

function parseDecimalsPhonetically(text) {
    return text.replace(/\b(\d+)\.(\d+)\b/g, (match, integerPart, decimalPart) => {
        const intWord = numberToWords(parseInt(integerPart, 10));
        const decWords = decimalPart.split('').map(digit => numberToWords(parseInt(digit, 10))).join(' ');
        return `${intWord} point ${decWords}`;
    });
}

function parseCurrenciesPhonetically(text) {
    return text
        .replace(/\$([0-9.]+)([M|B|K]?)\b/gi, (match, num, suffix) => {
            let cleanNum = num.replace(/,/g, " ");
            const spokenNum = parseDecimalsPhonetically(cleanNum);
            let multiplier = '';
            const upperSuffix = suffix ? suffix.toUpperCase() : '';
            if (upperSuffix === 'M') multiplier = ' million';
            else if (upperSuffix === 'B') multiplier = ' billion';
            else if (upperSuffix === 'K') multiplier = ' thousand';
            return `${spokenNum}${multiplier} U.S. Dollars`;
        })
        .replace(/€([0-9.]+)([M|B|K]?)\b/gi, (match, num, suffix) => {
            let cleanNum = num.replace(/,/g, " ");
            const spokenNum = parseDecimalsPhonetically(cleanNum);
            let multiplier = '';
            const upperSuffix = suffix ? suffix.toUpperCase() : '';
            if (upperSuffix === 'M') multiplier = ' million';
            else if (upperSuffix === 'B') multiplier = ' billion';
            else if (upperSuffix === 'K') multiplier = ' thousand';
            return `${spokenNum}${multiplier} Euros`;
        })
        .replace(/£([0-9.]+)([M|B|K]?)\b/gi, (match, num, suffix) => {
            let cleanNum = num.replace(/,/g, " ");
            const spokenNum = parseDecimalsPhonetically(cleanNum);
            let multiplier = '';
            const upperSuffix = suffix ? suffix.toUpperCase() : '';
            if (upperSuffix === 'M') multiplier = ' million';
            else if (upperSuffix === 'B') multiplier = ' billion';
            else if (upperSuffix === 'K') multiplier = ' thousand';
            return `${spokenNum}${multiplier} British Pounds`;
        });
}

function expandQuarterTermsPhonetically(text) {
    return text
        .replace(/\bQ1\b/gi, 'first quarter')
        .replace(/\bQ2\b/gi, 'second quarter')
        .replace(/\bQ3\b/gi, 'third quarter')
        .replace(/\bQ4\b/gi, 'fourth quarter');
}

function parseLegalSectionsPhonetically(text) {
    return text.replace(/\b(Section|Article|Clause|Rule)\s+(\d{1,4})\b/gi, (match, label, numStr) => {
        const num = parseInt(numStr, 10);
        let spokenNum = '';
        if (num >= 100 && num <= 999 && num % 100 !== 0) {
            const hundreds = Math.floor(num / 100);
            const remainder = num % 100;
            spokenNum = `${numberToWords(hundreds)} hundred ${numberToWords(remainder)}`;
        } else {
            spokenNum = numberToWords(num);
        }
        return `${label} ${spokenNum}`;
    });
}

function cleanAbbreviationsForSpeech(text) {
    return text.replace(/\b(?:[A-Z]\.){2,}[A-Z]?\b/g, (match) => {
        return match.replace(/\./g, '');
    });
}

function smartNumberParser(text) {
    return text.replace(/\b\d{1,6}\b/g, (match) => {
        const num = parseInt(match, 10);
        if (!isNaN(num) && num < 1000000) {
            return numberToWords(num);
        }
        return match;
    });
}

function parseFractionsPhonetically(text) {
    return text.replace(/\b(\d+)\/(\d+)\b/g, (match, numerator, denominator) => {
        const numVal = parseInt(numerator, 10);
        const denVal = parseInt(denominator, 10);
        const numWord = numberToWords(numVal);
        let denWord = '';
        
        if (denVal === 2) denWord = numVal === 1 ? 'half' : 'halves';
        else if (denVal === 3) denWord = numVal === 1 ? 'third' : 'thirds';
        else if (denVal === 4) denWord = numVal === 1 ? 'quarter' : 'quarters';
        else if (denVal === 5) denWord = numVal === 1 ? 'fifth' : 'fifths';
        else if (denVal === 8) denWord = numVal === 1 ? 'eighth' : 'eighths';
        else if (denVal === 10) denWord = numVal === 1 ? 'tenth' : 'tenths';
        else if (denVal === 100) denWord = numVal === 1 ? 'hundredth' : 'hundredths';
        else denWord = numberToWords(denVal) + (numVal === 1 ? 'th' : 'ths');

        return `${numWord} ${denWord}`;
    });
}

function spellAcronymsForTTS(text) {
    return text.replace(/\b([A-Z]{2,5})\b/g, (match) => {
        return match.split('').join(' ');
    });
}

function prepareHumanizedText(rawText) {
    if (!rawText) return "";
    
    let clean = rawText.replace(/<[^>]*>/g, '').trim();

    clean = clean
        .replace(/\be-commerce\b/gi, 'e-commerce')
        .replace(/\be-commerce's\b/gi, "e-commerce's")
        .replace(/\bco-op\b/gi, 'co-op')
        .replace(/\bon-line\b/gi, 'online');

    clean = clean.replace(/([a-zA-Z0-9]+)-([a-zA-Z0-9]+)/g, '$1 $2');

    clean = cleanAbbreviationsForSpeech(clean);
    clean = expandQuarterTermsPhonetically(clean);
    clean = parseFractionsPhonetically(clean);
    clean = parseCurrenciesPhonetically(clean);
    clean = parseLegalSectionsPhonetically(clean);
    clean = parseDecimalsPhonetically(clean);

    clean = clean
        .replace(/%/g, ' per cent')
        .replace(/&/g, ' and ')
        .replace(/\+/g, ' plus ')
        .replace(/\bvs\.?\b/gi, 'versus');

    clean = smartNumberParser(clean);
    clean = spellAcronymsForTTS(clean);

    clean = clean.replace(/([a-z0-9])\.\s+([A-Z])/g, '$1, $2');

    clean = clean
        .replace(/\s*(–|—|-)\s+/g, ', ')
        .replace(/:\s*/g, ', ')
        .replace(/;\s*/g, '. ');

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
// SECTION 4: MAIN AUDIO-ONLY BUILD ENGINE
// Reads template data and generates standalone MP3 audio files for all slides.
// ==========================================

async function buildAudioFromTemplate(templatePath) {
    const templateFileName = path.basename(templatePath, '.js');
    console.log(`\n🚀 Initializing audio-only pipeline for template: ${templateFileName}.js ...`);

    const data = require(templatePath);
    const rootDataKey = Object.keys(data).find(k => k.includes('shorts_data') || k.includes('script_slides')) || Object.keys(data)[0];
    const rawContainer = data[rootDataKey] || data;
    const newsSlides = rawContainer.script_slides || [];
    const templateLang = (data.language || 'EN').toLowerCase();

    const activeProfile = VOICE_PROFILES[SELECTED_VOICE_PROFILE];
    console.log(`🎙️ Active Voice: ${activeProfile.voiceName} | Language: ${templateLang.toUpperCase()}`);

    const closingNarration = "Struggling with shipping delays and soaring costs, Upgrade your supply chain with Siyaal air logistics, Tap the link in bio for instant premium rates.";

    const generatedAudioFiles = [];

    // 1. Intro Audio (Slide 1)
    console.log(`🎙️ Generating intro audio (Slide 1)...`);
    const introAudioPath = path.join(__dirname, `slide_audio_${templateFileName}_intro.mp3`);
    const createSilenceCmd = `"${ffmpegInstaller}" -f lavfi -i anullsrc=r=44100:cl=stereo -t 1.0 -c:a mp3 -y "${introAudioPath}"`;
    execSync(createSilenceCmd, { stdio: 'ignore' });
    generatedAudioFiles.push(introAudioPath);

    // 2. Body Slide Audios (Slides 2 to 9)
    console.log(`🎙️ Synthesizing news body narration audio files (Slides 2 through ${newsSlides.length + 1})...`);
    for (let i = 0; i < newsSlides.length; i++) {
        const slide = newsSlides[i];
        const slideText = slide.alpha_narration || slide.narration_line || slide.title || "";
        const slideAudioPath = path.join(__dirname, `slide_audio_${templateFileName}_slide_${i + 1}.mp3`);

        synthesizeVoiceover(slideText, slideAudioPath, `${templateFileName}_${i}`, 'body');
        generatedAudioFiles.push(slideAudioPath);
    }

    // 3. Closing Audio (Slide 10)
    console.log(`🎙️ Synthesizing closing call-to-action audio (Slide 10)...`);
    const closingAudioPath = path.join(__dirname, `slide_audio_${templateFileName}_closing.mp3`);
    synthesizeVoiceover(closingNarration, closingAudioPath, `closing_${templateFileName}`, 'closing');
    generatedAudioFiles.push(closingAudioPath);

    console.log(`\n🎉 Success! All ${generatedAudioFiles.length} MP3 audio files generated successfully for ${templateFileName}.`);
}

// ==========================================
// SECTION 5: AUTOMATED PIPELINE BATCH EXECUTION
// Discovers template JS files in root and triggers batch MP3 generation.
// ==========================================
async function runMainTemplateQueue() {
    console.log("🔍 workspace template scan initialized for audio generation...");
    const files = fs.readdirSync(__dirname);
    const templateFiles = files.filter(file => file.endsWith('.js') && (file.includes('template') || file.includes('shorts') || file.includes('Video_Template')));

    for (const file of templateFiles) {
        try {
            await buildAudioFromTemplate(path.join(__dirname, file));
        } catch (error) {
            console.error(`❌ Pipeline failure encountered while processing ${file}:`, error);
        }
    }

    console.log("\n🏁 All queued audio generations completed!");
}

runMainTemplateQueue().catch(console.error);
