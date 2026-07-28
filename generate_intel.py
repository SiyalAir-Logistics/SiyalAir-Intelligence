import os
import time
import random
import re
import requests
import json
import datetime
from google import genai
from google.genai import types

# Optional top-level BeautifulSoup import guard
try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

# 1. AUTH & CONFIG
# Fetches API key from GitHub Secrets / System Environment
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("[CRITICAL WARNING]: GEMINI_API_KEY environment variable is missing or empty.")

client = genai.Client(api_key=api_key) if api_key else None

# Models in priority order
MODEL_PRIORITY = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"]

# 2. STEALTH ENGINE
def get_stealth_headers():
    """Rotates User-Agent to mimic different browsers/devices."""
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, with Gecko) Chrome/126.0.0.0 Safari/537.36"
    ]
    return {
        "User-Agent": random.choice(user_agents),
        "Referer": "https://www.google.com/",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive"
    }

def fetch_and_clean():
    """Extracts URLs from prompt.txt and scrapes with human-like timing."""
    if not os.path.exists("prompt.txt"):
        print("[WARN]: prompt.txt not found in current execution directory.")
        return "", ""

    with open("prompt.txt", "r", encoding="utf-8") as f:
        prompt_content = f.read()
    
    urls = list(set(re.findall(r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+', prompt_content)))
    scraped_text = ""
    
    for url in urls:
        try:
            # Human jitter: wait between 5 and 15 seconds to look like a slow reader
            time.sleep(random.uniform(5.0, 15.0))
            response = requests.get(url, headers=get_stealth_headers(), timeout=20)
            
            if response.status_code == 200:
                if BeautifulSoup is None:
                    from bs4 import BeautifulSoup
                
                soup = BeautifulSoup(response.content, 'html.parser')
                # Remove non-content junk
                for element in soup(["script", "style", "nav", "footer", "iframe"]):
                    element.extract()
                # EXPANDED DATA BUFFER: Increased character chunk threshold from 1,000 to 5,000
                text = soup.get_text(separator=' ', strip=True)[:5000]
                scraped_text += f"\n---SOURCE: {url}---\n{text}\n"
            else:
                print(f"[WARN]: HTTP {response.status_code} encountered while scraping {url}")
        except Exception as e:
            print(f"[SILENT FETCH NOTICE]: Scraping failed for {url} ({e}). Continuing pipeline.")
            continue # Fail silently to keep the pipeline moving
            
    return prompt_content, scraped_text

# 3. PIPELINE EXECUTION
def main():
    if not client:
        print("[FATAL]: Cannot execute pipeline without a valid Gemini API client instance.")
        return

    prompt_base, data = fetch_and_clean()
    final_input = f"{prompt_base}\n\n[LATEST LIVE DATA]:\n{data}"
    
    for model in MODEL_PRIORITY:
        try:
            print(f"[EXECUTION]: Initiating generation request using model priority: {model}")
            response = client.models.generate_content(
                model=model,
                contents=final_input,
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            
            if not response or not response.text:
                raise ValueError("Model returned an empty payload or null string response.")

            # --- UPDATED: Sanitization and strict }; closure ---
            # Remove any markdown artifacts
            raw_text = response.text.replace("```json", "").replace("```", "").strip()
            
            # Ensure the output is clean for valid JSON parsing
            if raw_text.endswith(';'):
                raw_text = raw_text[:-1]
            if not raw_text.startswith('{'): 
                raw_text = '{' + raw_text
            if not raw_text.endswith('}'): 
                raw_text = raw_text + '}'
            
            # --- VALIDATION: Ensure generated text is valid JSON ---
            parsed_payload = json.loads(raw_text)
            
            # Extract content paths from the structured JSON schema safely
            slides_object = parsed_payload.get("slides_data", parsed_payload)
            shorts_module_object = parsed_payload.get("linkedin_shorts_module", {})
            post_content = parsed_payload.get("social_post", "")
            
            # --- ROBUST ENFORCEMENT: Enforce strict 4-bullet point limit per slide ---
            if isinstance(slides_object, dict) and "slides" in slides_object:
                for slide in slides_object["slides"]:
                    if "points" in slide and isinstance(slide["points"], list):
                        # Flatten any multi-sentence strings or accidental sub-lists that broke formatting
                        cleaned_points = []
                        for pt in slide["points"]:
                            # Clean internal rogue line breaks or accidental markdown bullet tokens
                            clean_pt = str(pt).replace('\n', ' ').replace('•', '').replace('➔', '').strip()
                            if clean_pt:
                                cleaned_points.append(clean_pt)
                        
                        # Hard lock: Slice or pad precisely to 4 bullet items to prevent overflowing and UI breakage
                        if len(cleaned_points) > 4:
                            # If model generated extra, merge trailing sentences or truncate to exact top 4 major points
                            slide["points"] = cleaned_points[:4]
                        elif len(cleaned_points) < 4:
                            while len(cleaned_points) < 4:
                                cleaned_points.append("Continuous trade shifts require monitoring immediate carrier capacity adjustments.")
                            slide["points"] = cleaned_points

            # Convert extracted slides data back to a clean string format
            slides_json_str = json.dumps(slides_object, indent=4)
            
            # Save exactly as required for template.js
            with open("template.js", "w", encoding="utf-8") as f:
                f.write(f"const dailyData = {slides_json_str};")
                
            # --- PATH & EXPORT REALIGNMENT ---
            # Save LinkedIn Shorts Module export file (`Social_Media/LinkedIn/LinkedIn_Template_EN.js`)
            linkedin_dir = os.path.join("Social_Media", "LinkedIn")
            os.makedirs(linkedin_dir, exist_ok=True)
            linkedin_file_path = os.path.join(linkedin_dir, "LinkedIn_Template_EN.js")
            
            shorts_json_str = json.dumps(shorts_module_object, indent=4)
            
            # Universal isomorphic export format (Supports both Browser DOM window injection & Node.js CommonJS require)
            isomorphic_js = (
                f"if (typeof window !== 'undefined') {{ window.linkedinData = {shorts_json_str}; }}\n"
                f"if (typeof module !== 'undefined' && module.exports) {{ module.exports = {shorts_json_str}; }}"
            )
            
            with open(linkedin_file_path, "w", encoding="utf-8") as f:
                f.write(isomorphic_js)
                
            # Save the clean free-form social media post to your root location
            with open("post.txt", "w", encoding="utf-8") as f:
                # Safely handle string vs object structure for post_content
                if isinstance(post_content, dict):
                    clean_post = json.dumps(post_content, indent=2)
                else:
                    clean_post = str(post_content).replace('\\n', '\n')
                f.write(clean_post)
                
            print(f"[SUCCESS]: Ingestion and pipeline synthesis completed successfully using {model}.")
            return # Success
        except Exception as e:
            print(f"[RETRY NOTICE]: Model {model} pipeline execution failed: {e}. Backing off 10s...")
            time.sleep(10) # Back-off if model rate-limits or JSON is invalid
            continue

if __name__ == "__main__":
    main()

# SYSTEM RESET LOGIC: Kickstart cron automation cache sync
