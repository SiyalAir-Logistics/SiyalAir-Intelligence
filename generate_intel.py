# ==============================================================================
# [ MODULE 1: CONFIGURATION & AUTHENTICATION ]
# Purpose: Initializes environment variables, API keys, and dynamic model discovery.
# Data Flow: Reads from OS ENV -> Queries live model list -> Sets fallback chain.
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

def get_dynamic_model_priority():
    """Dynamically fetches available flash/pro models from the API, 
    ensuring a universal fallback chain that never gets stuck on old versions."""
    dynamic_models = []
    try:
        for m in client.models.list():
            name = m.name.replace("models/", "")
            if "flash" in name and name not in dynamic_models:
                dynamic_models.append(name)
    except Exception as e:
        print(f"[WARNING] Could not fetch dynamic model list: {str(e)}")

    fallback_chain = ["gemini-2.0-flash", "gemini-1.5-flash"]
    combined = list(dict.fromkeys(dynamic_models + fallback_chain))
    return combined

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
# [ MODULE 3: TRACKER LOG & STATE SYNCHRONIZATION ENGINES ]
# Purpose: Maintains sequential integer rotation trackers with max capping and cycle loops.
# ==============================================================================
def update_sequential_tracker(tracker_filename, max_limit=10):
    """Reads integer from tracker file, increments sequentially, wraps using modulo, 
    and writes back with atomic flush/fsync enforcement."""
    current_val = 1
    if os.path.exists(tracker_filename):
        try:
            with open(tracker_filename, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content.isdigit():
                    val = int(content)
                    current_val = (val % max_limit) + 1
        except Exception as e:
            log("WARNING", f"Could not read {tracker_filename}, defaulting sequence to 1: {str(e)}")

    try:
        with open(tracker_filename, "w", encoding="utf-8") as f:
            f.write(str(current_val))
            f.flush()
            os.fsync(f.fileno())
        log("SUCCESS", f"Updated {tracker_filename} successfully to sequence value: {current_val}")
    except Exception as e:
        log("ERROR", f"Failed to update {tracker_filename}: {str(e)}")
        raise e
    return current_val

def update_tracker_files():
    """Updates bg_tracker.txt and follow_tracker.txt atomically with sequential numbers (1 to 10 loop cycle)."""
    update_sequential_tracker("bg_tracker.txt", max_limit=10)
    update_sequential_tracker("follow_tracker.txt", max_limit=10)

def extract_previous_topics():
    """Reads existing template.js solely to extract previous slide headings for deduplication blacklist.
    Does NOT use template.js for formatting rules (format comes strictly from prompt.txt)."""
    excluded_topics = []
    try:
        if os.path.exists("template.js"):
            with open("template.js", "r", encoding="utf-8") as f:
                content = f.read()
                matches = re.findall(r'["\']heading["\']\s*:\s*["\']([^"\']+)["\']', content)
                excluded_topics = list(set(matches))
                log("INFO", f"Loaded {len(excluded_topics)} previous headlines for deduplication blacklist.")
    except Exception as e:
        log("WARNING", f"Could not read template.js for deduplication: {str(e)}")
    return excluded_topics

# ==============================================================================
# [ MODULE 4: LLM PIPELINE & SEQUENTIAL ATOMIC SYNCHRONIZATION ]
# Purpose: Combines prompt with live data, enforces structure, and executes atomic file writes in logical sequence.
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
        exit(1)

    # Extract past topics from template.js to enforce strict non-duplication blacklist
    past_topics = extract_previous_topics()
    blacklist_context = ""
    if past_topics:
        blacklist_context = "\n\n[EXCLUSION BLACKLIST - DO NOT REPEAT THESE RECENT TOPICS/HEADLINES]:\n" + "\n".join([f"- {t}" for t in past_topics])

    final_input = f"{prompt_base}{blacklist_context}\n\n[LATEST LIVE DATA]:\n{data}"
    model_priority = get_dynamic_model_priority()
    log("INFO", f"Active model priority chain: {model_priority}")

    for model in model_priority:
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
            log("SUCCESS", f"LLM payload successfully parsed as valid JSON using model: {model}")
            
            # --- ROBUST NODE EXTRACTION & FALLBACKS ---
            slides_data_node = parsed_payload.get("slides_data")
            if not slides_data_node:
                if "slides" in parsed_payload:
                    slides_data_node = {"main": parsed_payload.get("main", {}), "slides": parsed_payload["slides"]}
                else:
                    slides_data_node = parsed_payload

            video_module_node = parsed_payload.get("video_shorts_module")
            if not video_module_node:
                video_module_node = parsed_payload.get("video_shorts_data", {"language": "EN", "video_shorts_data": parsed_payload})

            post_content = parsed_payload.get("social_post", "")
            if not post_content and isinstance(parsed_payload, dict):
                post_content = "🌐 GLOBAL LOGISTICS INTELLIGENCE\nStay ahead of the global freight pulse."

            # --- ENFORCEMENT ---
            slides_data_node = enforce_slide_structure(slides_data_node)
            slides_json_str = json.dumps(slides_data_node, indent=4)
            
            # ==============================================================================
            # SEQUENTIAL ATOMIC WRITE SEQUENCE (ORDERED TO PREVENT STALE/SKIPPED FILES)
            # ==============================================================================
            
            # 1. Update Tracker Logs First (State Synchronization with flush/fsync enforcement)
            update_tracker_files()
            
            # 2. Base Slide Template (template.js in Root)
            with open("template.js", "w", encoding="utf-8") as f:
                f.write(f"const dailyData = {slides_json_str};")
                f.flush()
                os.fsync(f.fileno())
            log("SUCCESS", "Generated and exported: template.js")
                
            # 3. Social Media Post Content (post.txt in Root)
            with open("post.txt", "w", encoding="utf-8") as f:
                clean_post = str(post_content).replace('\\n', '\n')
                f.write(clean_post)
                f.flush()
                os.fsync(f.fileno())
            log("SUCCESS", "Generated and exported: post.txt")
                
            # 4. Cinematic Video Template (Social_Media/Video_Template_EN.js)
            social_media_dir = "Social_Media"
            os.makedirs(social_media_dir, exist_ok=True)
            video_template_path = os.path.join(social_media_dir, "Video_Template_EN.js")
            
            if "video_shorts_data" not in video_module_node:
                video_payload_to_write = {
                    "language": "EN",
                    "video_shorts_data": video_module_node
                }
            else:
                video_payload_to_video = video_module_node # safe fallback reference
                video_payload_to_write = video_module_node

            video_js_content = f"module.exports = {json.dumps(video_payload_to_write, indent=4)};"

            with open(video_template_path, "w", encoding="utf-8") as f:
                f.write(video_js_content)
                f.flush()
                os.fsync(f.fileno())
            log("SUCCESS", f"Generated and exported video template: {video_template_path}")
                
            log("SUCCESS", "generate_intel.py pipeline completed successfully with full sequence synchronization.")
            return
            
        except Exception as e:
            log("WARNING", f"Model {model} generation failed or JSON invalid: {str(e)}")
            log("INFO", "Backing off for 10 seconds before next fallback attempt...")
            time.sleep(10)
            continue
            
    log("ERROR", "All models failed. Pipeline execution aborted.")
    exit(1)

if __name__ == "__main__":
    main()
