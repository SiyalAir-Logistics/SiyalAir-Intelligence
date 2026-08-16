// ==========================================
// SECTION 1: CORE MODULE DEPENDENCIES & IMPORTS
// ==========================================
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ffmpegInstaller = require('ffmpeg-static');

// ==========================================
// SECTION 2: VOICE PROFILE & TTS CONFIGURATION
// ==========================================
const SELECTED_VOICE_PROFILE = 'FEMALE_BREAKING'; 

const VOICE_PROFILES = {
    FEMALE_BREAKING: {
        voiceName: "en-IN-NeerjaNeural",
        introRate: "+22%",
        introPitch: "+6Hz",
        bodyRate: "+18%",
        bodyPitch: "+3Hz",
        outroRate: "+12%",
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
// SECTION 3: UTILITY & PHONETIC ENGINE
// ==========================================
function numberToWords(n) {
    const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
    const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
    if (n === 0) return "zero";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " hundred" + (n % 100 !== 0 ? " and " + numberToWords(n % 100) : "");
    return n.toString();
}

function prepareHumanizedText(rawText) {
    if (!rawText) return "";
    let clean = rawText.replace(/<[^>]*>/g, '').trim();
    clean = clean.replace(/([a-zA-Z0-9]+)-([a-zA-Z0-9]+)/g, '$1 $2');
    clean = clean.replace(/%/g, ' per cent').replace(/&/g, ' and ').replace(/\+/g, ' plus ').replace(/\bvs\.?\b/gi, 'versus');
    clean = clean.replace(/\s*(–|—|-)\s+/g, ', ').replace(/:\s*/g, ', ').replace(/;\s*/g, '. ');
    clean = clean.replace(/\s+/g, ' ').trim();
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
// SECTION 4: COMBINED AUDIO BUILD ENGINE
// ==========================================
async function buildCombinedAudioFromTemplate(templatePath) {
    const templateFileName = path.basename(templatePath, '.js');
    console.log(`\n🚀 Initializing single combined audio pipeline for: ${templateFileName}.js ...`);

    const data = require(templatePath);
    const rootDataKey = Object.keys(data).find(k => k.includes('shorts_data') || k.includes('script_slides')) || Object.keys(data)[0];
    const rawContainer = data[rootDataKey] || data;
    const newsSlides = rawContainer.script_slides || [];

    const closingNarration = "Struggling with shipping delays and soaring costs, Upgrade your supply chain with Siyaal air logistics, Tap the link in bio for instant premium rates.";
    const audioParts = [];

    // 1. Intro Silence/Audio Part
    console.log(`🎙️ Generating intro segment...`);
    const introAudioPath = path.join(__dirname, `temp_part_intro_${templateFileName}.mp3`);
    execSync(`"${ffmpegInstaller}" -f lavfi -i anullsrc=r=44100:cl=stereo -t 1.0 -c:a mp3 -y "${introAudioPath}"`, { stdio: 'ignore' });
    audioParts.push(introAudioPath);

    // 2. Body Slides Audio Parts
    console.log(`🎙️ Synthesizing ${newsSlides.length} body narration slides...`);
    for (let i = 0; i < newsSlides.length; i++) {
        const slide = newsSlides[i];
        const slideText = slide.alpha_narration || slide.narration_line || slide.title || "";
        const slideAudioPath = path.join(__dirname, `temp_part_slide_${templateFileName}_${i}.mp3`);
        synthesizeVoiceover(slideText, slideAudioPath, `${templateFileName}_body_${i}`, 'body');
        audioParts.push(slideAudioPath);
    }

    // 3. Closing Audio Part
    console.log(`🎙️ Synthesizing closing call-to-action segment...`);
    const closingAudioPath = path.join(__dirname, `temp_part_closing_${templateFileName}.mp3`);
    synthesizeVoiceover(closingNarration, closingAudioPath, `closing_${templateFileName}`, 'closing');
    audioParts.push(closingAudioPath);

    // 4. Combine all parts into ONE master MP3 file using FFmpeg concat demuxer
    const listFilePath = path.join(__dirname, `temp_concat_list_${templateFileName}.txt`);
    const listContent = audioParts.map(p => `file '${path.basename(p)}'`).join('\n');
    fs.writeFileSync(listFilePath, listContent, 'utf8');

    const finalOutputMp3Name = `combined_audio_${templateFileName.replace(/_template|_EN|_DE|_FR/gi, '')}.mp3`.toLowerCase();
    const finalOutputMp3Path = path.join(__dirname, finalOutputMp3Name);

    console.log(`🔗 Concatenating parts into master file: ${finalOutputMp3Name} ...`);
    const concatCmd = `"${ffmpegInstaller}" -f concat -safe 0 -i "${listFilePath}" -c copy "${finalOutputMp3Path}"`;
    execSync(concatCmd, { stdio: 'inherit' });

    // Cleanup temporary chunk files
    if (fs.existsSync(listFilePath)) fs.unlinkSync(listFilePath);
    audioParts.forEach(p => {
        if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    console.log(`\n🎉 Success! Combined master audio created at: ${finalOutputMp3Name}`);
}

// ==========================================
// SECTION 5: BATCH EXECUTION QUEUE
// ==========================================
async function runMainTemplateQueue() {
    const files = fs.readdirSync(__dirname);
    const templateFiles = files.filter(file => file.endsWith('.js') && (file.includes('template') || file.includes('shorts') || file.includes('Video_Template')));

    for (const file of templateFiles) {
        try {
            await buildCombinedAudioFromTemplate(path.join(__dirname, file));
        } catch (error) {
            console.error(`❌ Pipeline failure on ${file}:`, error);
        }
    }
    console.log("\n🏁 All combined audio generations completed!");
}

runMainTemplateQueue().catch(console.error);
