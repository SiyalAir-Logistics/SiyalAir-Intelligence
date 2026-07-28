import os
import time
import random
import re
import requests
import json
import datetime
from google import genai
from google.genai import types

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

# 1. AUTH & CONFIG
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("[CRITICAL WARNING]: GEMINI_API_KEY environment variable is missing or empty.")

client = genai.Client(api_key=api_key) if api_key else None

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
            time.sleep(random.uniform(5.0, 15.0))
            response = requests.get(url, headers=get_stealth_headers(), timeout=20)
            
            if response.status_code == 200:
                if BeautifulSoup is None:
                    from bs4 import BeautifulSoup
                
                soup = BeautifulSoup(response.content, 'html.parser')
                for element in soup(["script", "style", "nav", "footer", "iframe"]):
                    element.extract()
                text = soup.get_text(separator=' ', strip=True)[:5000]
                scraped_text += f"\n---SOURCE: {url}---\n{text}\n"
            else:
                print(f"[WARN]: HTTP {response.status_code} encountered while scraping {url}")
        except Exception as e:
            print(f"[SILENT FETCH NOTICE]: Scraping failed for {url} ({e}). Continuing pipeline.")
            continue
            
    return prompt_content, scraped_text

def extract_json_safely(raw_text):
    """Uses Regex to isolate and parse JSON without corrupting braces."""
    clean_str = raw_text.replace("```json", "").replace("```", "").strip()
    match = re.search(r'\{.*\}', clean_str, re.DOTALL)
    if match:
        json_str = match.group(0)
        return json.loads(json_str)
    return json.loads(clean_str)

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

            # Safe JSON parsing
            parsed_payload = extract_json_safely(response.text)
            
            # Unwrap slides_data if nested
            if "slides_data" in parsed_payload and isinstance(parsed_payload["slides_data"], dict):
                slides_object = parsed_payload["slides_data"]
            else:
                slides_object = parsed_payload

            # Enforce top-level keys required by engine.js
            if "main" not in slides_object or not isinstance(slides_object["main"], dict):
                slides_object["main"] = {
                    "titleWhite": parsed_payload.get("titleWhite", "GLOBAL LOGISTICS"),
                    "titleBlue": parsed_payload.get("titleBlue", "INTELLIGENCE"),
                    "footerSummary": parsed_payload.get("footerSummary", "Real-time updates on global freight and supply chain operations.")
                }

            if "slides" not in slides_object or not isinstance(slides_object["slides"], list):
                slides_object["slides"] = parsed_payload.get("slides", [])

            shorts_module_object = parsed_payload.get("linkedin_shorts_module", {})
            post_content = parsed_payload.get("social_post", "")

            # Strict 4-bullet enforcement per slide
            for slide in slides_object["slides"]:
                if isinstance(slide, dict) and "points" in slide and isinstance(slide["points"], list):
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

            # Save clean template.js
            slides_json_str = json.dumps(slides_object, indent=4)
            with open("template.js", "w", encoding="utf-8") as f:
                f.write(f"const dailyData = {slides_json_str};")
                
            # Path & Export Realignment
            linkedin_dir = os.path.join("Social_Media", "LinkedIn")
            os.makedirs(linkedin_dir, exist_ok=True)
            linkedin_file_path = os.path.join(linkedin_dir, "LinkedIn_Template_EN.js")
            
            shorts_json_str = json.dumps(shorts_module_object, indent=4)
            isomorphic_js = (
                f"if (typeof window !== 'undefined') {{ window.linkedinData = {shorts_json_str}; }}\n"
                f"if (typeof module !== 'undefined' && module.exports) {{ module.exports = {shorts_json_str}; }}"
            )
            
            with open(linkedin_file_path, "w", encoding="utf-8") as f:
                f.write(isomorphic_js)
                
            # Save post.txt
            with open("post.txt", "w", encoding="utf-8") as f:
                if isinstance(post_content, dict):
                    clean_post = json.dumps(post_content, indent=2)
                else:
                    clean_post = str(post_content).replace('\\n', '\n')
                f.write(clean_post)
                
            print(f"[SUCCESS]: Ingestion and pipeline synthesis completed successfully using {model}.")
            return
        except Exception as e:
            print(f"[RETRY NOTICE]: Model {model} pipeline execution failed: {e}. Backing off 10s...")
            time.sleep(10)
            continue

if __name__ == "__main__":
    main()
