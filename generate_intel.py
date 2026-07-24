import os
import time
import random
import re
import requests
import json
from google import genai
from google.genai import types
import datetime
import hashlib

# 1. AUTH & CONFIG
# Fetches API key from GitHub Secrets
api_key = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

# Models in priority order
MODEL_PRIORITY = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"]
HASH_FILE = "processed_hashes.txt"

# 2. DEDUPLICATION ENGINE
def load_processed_hashes():
    """Loads previously processed article content hashes to prevent duplication."""
    if not os.path.exists(HASH_FILE):
        return set()
    with open(HASH_FILE, "r", encoding="utf-8") as f:
        return set(line.strip() for line in f if line.strip())

def save_processed_hash(content_signature):
    """Appends a new unique content hash to the registry file."""
    processed = load_processed_hashes()
    content_hash = hashlib.sha256(content_signature.encode('utf-8')).hexdigest()
    
    if content_hash in processed:
        return True # Duplicate detected
        
    processed.add(content_hash)
    with open(HASH_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(processed) + "\n")
    return False

# 3. STEALTH ENGINE
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

# 4. PIPELINE EXECUTION
def main():
    prompt_base, data = fetch_and_clean()
    
    # Check deduplication against the combined gathered intel signature
    if data.strip():
        signature_sample = data[:1000] # Use top text chunk as unique fingerprint
        if save_processed_hash(signature_sample):
            print("Duplicate news feed detected in registry. Halting execution to avoid redundancy.")
            return

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
            
            # --- VALIDATION & STRUCTURAL EXTRACTION: Ensure generated text parses correctly and splits quote data ---
            parsed_payload = json.loads(raw_text)
            
            # Extract content paths from the structured JSON schema safely
            slides_data_obj = parsed_payload.get("slides_data", parsed_payload)
            
            # --- FIX: Isolate executive quote slide from standard core slides array ---
            slides_list = slides_data_obj.get("slides", [])
            extracted_quote = {}
            cleaned_slides = []
            
            for s in slides_list:
                if s.get("id") == 8 or "EXECUTIVE PERSPECTIVE" in s.get("heading", ""):
                    points = s.get("points", ["", "", ""])
                    extracted_quote = {
                        "heading": s.get("heading", "EXECUTIVE PERSPECTIVE: INDUSTRY VALIDATION"),
                        "quoteText": points[0].strip('"'),
                        "author": points[1].replace("—", "").strip(),
                        "context": points[2].replace("Context:", "").strip()
                    }
                else:
                    cleaned_slides.append(s)
            
            slides_data_obj["slides"] = cleaned_slides
            slides_data_obj["quote"] = extracted_quote
            
            post_content = parsed_payload.get("social_post", "")
            
            # Convert extracted slides data back to a clean string format
            slides_json_str = json.dumps(slides_data_obj, indent=4)
            
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
