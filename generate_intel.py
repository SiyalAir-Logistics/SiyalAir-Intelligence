import os
import time
import random
import re
import requests
import json
from google import genai
from google.genai import types
import datetime

# 1. AUTH & CONFIG
# Fetches API key from GitHub Secrets
api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

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
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(response.content, 'html.parser')
                # Remove non-content junk
                for element in soup(["script", "style", "nav", "footer", "iframe"]):
                    element.extract()
                # EXPANDED DATA BUFFER: Increased character chunk threshold from 1,000 to 5,000
                text = soup.get_text(separator=' ', strip=True)[:5000]
                scraped_text += f"\n---SOURCE: {url}---\n{text}\n"
        except Exception:
            continue # Fail silently to keep the pipeline moving
    return prompt_content, scraped_text

# 3. PIPELINE EXECUTION
def main():
    prompt_base, data = fetch_and_clean()
    final_input = f"{prompt_base}\n\n[LATEST LIVE DATA]:\n{data}"
    
    for model in MODEL_PRIORITY:
        try:
            response = client.models.generate_content(
                model=model,
                contents=final_input,
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            
            # --- UPDATED: Sanitization and strict }; closure ---
            # Remove any markdown artifacts
            raw_text = response.text.replace("```json", "").replace("```", "").strip()
            
            # Ensure the output is clean for valid JSON parsing
            if raw_text.endswith(';'):
                raw_text = raw_text[:-1]
            if not raw_text.startswith('{'): raw_text = '{' + raw_text
            if not raw_text.endswith('}'): raw_text = raw_text + '}'
            
            # --- VALIDATION: Ensure generated text is valid JSON ---
            parsed_payload = json.loads(raw_text)
            
            # Extract content paths from the structured JSON schema safely
            slides_object = parsed_payload.get("slides_data", parsed_payload)
            post_content = parsed_payload.get("social_post", "")
            
            # Convert extracted slides data back to a clean string format
            slides_json_str = json.dumps(slides_object, indent=4)
            
            # Save exactly as required for template.js
            with open("template.js", "w", encoding="utf-8") as f:
                f.write(f"const dailyData = {slides_json_str};")
                
            # Save the clean free-form social media post to your root location
            with open("post.txt", "w", encoding="utf-8") as f:
                # Safely convert raw literal \n string characters into actual structural line breaks
                clean_post = post_content.replace('\\n', '\n')
                f.write(clean_post)
                
            return # Success
        except Exception:
            time.sleep(10) # Back-off if model rate-limits or JSON is invalid
            continue

if __name__ == "__main__":
    main()

# SYSTEM RESET LOGIC: Kickstart cron automation cache sync
