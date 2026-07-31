# ==============================================================================
# [ MODULE 1: CONFIGURATION & AUTHENTICATION ]
# Purpose: Initializes environment variables, API keys, and model fallback.
# Data Flow: Reads from OS ENV -> Configures Gemini Client -> Sets global priorities.
# ==============================================================================
import os
import time
import random
import re
import requests
import json
from google import genai
from google.genai import types
from bs4 import BeautifulSoup

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("[ERROR] GEMINI_API_KEY environment variable not found.")
    exit(1)

client = genai.Client(api_key=api_key)

# Models in priority order for fallback resilience
MODEL_PRIORITY = ["gemini-2.0-flash", "gemini-1.5-flash"]

def log(level, message):
    """Enforces standardized logging taxonomy for GitHub Actions runners."""
    print(f"[{level}] {message}")

# ==============================================================================
# [ MODULE 2: STEALTH DATA EXTRACTION ENGINE ]
# Purpose: Parses prompt, extracts URLs, and scrapes content using human-like delays.
# Data Flow: prompt.txt -> regex URL extraction -> HTTP GET -> BeautifulSoup parsing -> Text buffer.
# ==============================================================================
def get_stealth_headers():
    """Rotates User-Agent to mimic different browsers/devices and avoid blocking."""
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ]
    return {
        "User-Agent": random.choice(user_agents),
        "Referer": "https://www.google.com/",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive"
    }

def fetch_and_clean():
    """Extracts URLs from prompt.txt and scrapes with human-like timing."""
    log("INFO", "Reading prompt.txt and extracting target URLs.")
    try:
        with open("prompt.txt", "r", encoding="utf-8") as f:
            prompt_content = f.read()
    except FileNotFoundError:
        log("ERROR", "prompt.txt not found in root directory.")
        return "", ""

    urls = list(set(re.findall(r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+', prompt_content)))
    scraped_text = ""
    
    log("INFO", f"Found {len(urls)} unique URLs to process.")
    for url in urls:
        try:
            sleep_time = random.uniform(5.0, 15.0)
            log("INFO", f"Sleeping for {sleep_time:.2f}s before fetching: {url}")
            time.sleep(sleep_time)
            
            response = requests.get(url, headers=get_stealth_headers(), timeout=20)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                for element in soup(["script", "style", "nav", "footer", "iframe"]):
                    element.extract()
                
                text = soup.get_text(separator=' ', strip=True)[:5000]
                scraped_text += f"\n---SOURCE: {url}---\n{text}\n"
                log("SUCCESS", f"Successfully extracted data from: {url}")
            else:
                log("WARNING", f"Failed to fetch {url} - Status Code: {response.status_code}")
        except Exception as e:
            log("WARNING", f"Exception occurred while fetching {url}: {str(e)}")
            continue
            
    return prompt_content, scraped_text

# ==============================================================================
# [ MODULE 3: LLM PIPELINE & STRUCTURAL ENFORCEMENT ]
# Purpose: Combines prompt with live data, calls API, sanitizes output, and writes files.
# Data Flow: LLM Output -> JSON Validation -> Bullet Padding/Truncation -> File System Writes.
# ==============================================================================
def enforce_slide_structure(slides_object):
    """Enforces a strict 4-bullet point limit per slide to prevent UI overflow."""
    if isinstance(slides_object, dict) and "slides" in slides_object:
        for slide in slides_object["slides"]:
            if "points" in slide and isinstance(slide["points"], list):
                cleaned_points = []
                for pt in slide["points"]:
                    clean_pt = str(pt).replace('\n', ' ').replace('•', '').replace('➔', '').strip()
                    if clean_pt:
                        cleaned_points.append(clean_pt)
                
                if len(cleaned_points) > 4:
                    slide["points"] = cleaned_points[:4]
                elif len(cleaned_points) < 4:
                    while len(cleaned_points) < 4:
                        cleaned_points.append("Continuous trade shifts require monitoring immediate carrier capacity adjustments.")
                    slide["points"] = cleaned_points
    return slides_object

def main():
    log("INFO", "Starting execution pipeline.")
    prompt_base, data = fetch_and_clean()
    
    if not prompt_base:
        log("ERROR", "No prompt base found. Pipeline aborted.")
        return

    final_input = f"{prompt_base}\n\n[LATEST LIVE DATA]:\n{data}"
    
    for model in MODEL_PRIORITY:
        log("INFO", f"Attempting generation with model: {model}")
        try:
            response = client.models.generate_content(
                model=model,
                contents=final_input,
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            
            # --- SANITIZATION ---
            raw_text = response.text.replace("```json", "").replace("```", "").strip()
            if raw_text.endswith(';'):
                raw_text = raw_text[:-1]
            if not raw_text.startswith('{'): raw_text = '{' + raw_text
            if not raw_text.endswith('}'): raw_text = raw_text + '}'
            
            # --- VALIDATION ---
            parsed_payload = json.loads(raw_text)
            log("SUCCESS", "LLM payload successfully parsed as valid JSON.")
            
            # Extract paths safely
            slides_object = parsed_payload.get("slides_data", parsed_payload)
            post_content = parsed_payload.get("social_post", "")
            
            # --- ENFORCEMENT ---
            slides_object = enforce_slide_structure(slides_object)
            slides_json_str = json.dumps(slides_object, indent=4)
            
            # --- EXPORT TO FILES ---
            # 1. Base slide template (template.js in Root)
            with open("template.js", "w", encoding="utf-8") as f:
                f.write(f"const dailyData = {slides_json_str};")
            log("SUCCESS", "Generated and exported: template.js")
                
            # 2. Correct Video Shorts Schema Mirror to Social_Media/Video_Template_EN.js
            social_media_dir = "Social_Media"
            os.makedirs(social_media_dir, exist_ok=True)
            video_template_path = os.path.join(social_media_dir, "Video_Template_EN.js")
            
            # Extract main title elements or fallback to defaults for video shorts
            main_info = slides_object.get("main", {}) if isinstance(slides_object, dict) else {}
            title_white = main_info.get("titleWhite", "GLOBAL LOGISTICS")
            title_blue = main_info.get("titleBlue", "UPDATE")
            hook_title = f"{title_white} {title_blue}".upper().strip()

            slides_list = slides_object.get("slides", []) if isinstance(slides_object, dict) else []
            script_slides = []
            for idx, slide in enumerate(slides_list, start=1):
                heading = slide.get("heading", f"SLIDE {idx}")
                next_teaser = slide.get("nextUpTease", "")
                points = slide.get("points", [])
                narration = " ".join(points[:2]) if points else f"Latest update on {heading}."

                script_slides.append({
                    "slide_index": idx,
                    "headline": heading,
                    "teaserTitle": next_teaser if idx < len(slides_list) else "",
                    "visual_asset": f"backgroundyt{idx}.png",
                    "narration_line": narration
                })

            video_shorts_data = {
                "language": "EN",
                "video_shorts_data": {
                    "hookTitle": hook_title,
                    "totalDurationSeconds": 30,
                    "script_slides": script_slides
                }
            }

            video_js_content = f"module.exports = {json.dumps(video_shorts_data, indent=4)};"

            with open(video_template_path, "w", encoding="utf-8") as f:
                f.write(video_js_content)
            log("SUCCESS", f"Generated and exported correct Video Shorts Schema mirror: {video_template_path}")
                
            # 3. Social Media Post (post.txt in Root)
            with open("post.txt", "w", encoding="utf-8") as f:
                clean_post = post_content.replace('\\n', '\n')
                f.write(clean_post)
            log("SUCCESS", "Generated and exported: post.txt")
                
            log("SUCCESS", "generate_intel.py pipeline completed successfully.")
            return # Exit successfully without trying fallback models
            
        except Exception as e:
            log("WARNING", f"Model {model} generation failed or JSON invalid: {str(e)}")
            log("INFO", "Backing off for 10 seconds before next fallback attempt...")
            time.sleep(10)
            continue
            
    log("ERROR", "All models failed. Pipeline execution aborted.")

if __name__ == "__main__":
    main()
