const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('ffmpeg-static');
const { EdgeTTS } = require('edge-tts');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller);

async function buildYouTubeShort() {
    console.log("🚀 Initializing YouTube Short Video Generation Pipeline...");

    // 1. Read your template data
    const templatePath = path.join(__dirname, 'youtube_template.js');
    // Read and parse the template (assuming standard JSON export or object structure)
    // If your template is a JS module, you can require it directly:
    const data = require('./youtube_template.js');
    const slides = data.youtube_shorts_data.script_slides;

    console.log(`📜 Loaded ${slides.length} narrative points from template.`);

    // 2. Combine all narration lines for the voiceover
    const fullNarrationText = slides.map(s => s.narration_line).join(" ");
    
    // 3. Generate Voiceover using Edge-TTS
    console.log("🎙️ Synthesizing voiceover audio...");
    const tts = new EdgeTTS({
        voice: "en-US-ChristopherNeural", // Professional broadcast news voice
        lang: "en-US",
        outputFormat: "audio-24khz-48kbitrate-mono-mp3"
    });

    const audioOutputPath = path.join(__dirname, 'voiceover.mp3');
    await tts.ttsPromise(fullNarrationText, audioOutputPath);
    console.log("✅ Voiceover audio saved successfully.");

    // 4. Map background images from your yt_backgrounds folder
    // Ensures paths target: shorts_output/yt_backgrounds/backgroundyt1.png etc.
    console.log("🎞️ Mapping vertical background assets (1080x1920)...");
    
    // For a streamlined FFmpeg image sequence or concat filter setup, 
    // we verify files exist:
    slides.forEach((slide, index) => {
        const bgNum = index + 1;
        const imgPath = path.join(__dirname, 'yt_backgrounds', `backgroundyt${bgNum}.png`);
        if (!fs.existsSync(imgPath)) {
            console.warn(`⚠️ Warning: Missing background asset -> backgroundyt${bgNum}.png`);
        }
    });

    console.log("🎬 Ready to compile video tracks with FFmpeg Ken Burns effects.");
    // Next step will integrate the explicit FFmpeg filter complex for zoom/pan and text overlay.
}

buildYouTubeShort().catch(console.error);
