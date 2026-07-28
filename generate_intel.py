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
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
    ]
    return {
        "User-Agent": random.choice(user_agents),
        "Referer": "https://www.google.com/",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive"
    }

def fetch_and_clean():
    if not os.path.exists("prompt.txt"):
        return "", ""

    with open("prompt.txt", "r", encoding="utf-8") as f:
        prompt_content = f.read()
    
    urls = list(set(re.findall(r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+', prompt_content)))
    scraped_text = ""
    
    for url in urls:
        try:
            time.sleep(random.uniform(3.0, 8.0))
            response = requests.get(url, headers=get_stealth_headers(), timeout=15)
            if response.status_code == 200:
                if BeautifulSoup is None:
                    from bs4 import BeautifulSoup
                soup = BeautifulSoup(response.content, 'html.parser')
                for element in soup(["script", "style", "nav", "footer", "iframe"]):
                    element.extract()
                text = soup.get_text(separator=' ', strip=True)[:5000]
                scraped_text += f"\n---SOURCE: {url}---\n{text}\n"
        except Exception:
            continue
            
    return prompt_content, scraped_text

def extract_json_safely(raw_text):
    clean_str = raw_text.replace("```json", "").replace("```", "").strip()
    match = re.search(r'\{.*\}', clean_str, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    return json.loads(clean_str)

# 3. PIPELINE EXECUTION
def main():
    if not client:
        print("[FATAL]: Gemini API client not initialized.")
        return

    prompt_base, data = fetch_and_clean()
    final_input = f"{prompt_base}\n\n[LATEST LIVE DATA]:\n{data}"
    
    for model in MODEL_PRIORITY:
        try:
            print(f"[EXECUTION]: Running model {model}...")
            response = client.models.generate_content(
                model=model,
                contents=final_input,
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            
            if not response or not response.text:
                raise ValueError("Empty response received from LLM.")

            parsed_payload = extract_json_safely(response.text)
            
            # Normalize slides object
            if "slides_data" in parsed_payload and isinstance(parsed_payload["slides_data"], dict):
                slides_object = parsed_payload["slides_data"]
            else:
                slides_object = parsed_payload

            # Ensure main structure exists
            if "main" not in slides_object:
                slides_object["main"] = {
                    "titleWhite": "GLOBAL LOGISTICS",
                    "titleBlue": "INTELLIGENCE",
                    "footerSummary": "Real-time updates on global freight and supply chain operations."
                }

            if "slides" not in slides_object or not isinstance(slides_object["slides"], list):
                slides_object["slides"] = []

            # Clean bullet points (hard lock 4 items)
            for slide in slides_object["slides"]:
                if isinstance(slide, dict) and "points" in slide and isinstance(slide["points"], list):
                    cleaned_points = [str(pt).replace('\n', ' ').replace('•', '').replace('➔', '').strip() for pt in slide["points"] if pt]
                    if len(cleaned_points) > 4:
                        slide["points"] = cleaned_points[:4]
                    elif len(cleaned_points) < 4:
                        while len(cleaned_points) < 4:
                            cleaned_points.append("Continuous trade shifts require monitoring immediate carrier capacity adjustments.")
                        slide["points"] = cleaned_points

            # Format social post for post.txt & email body
            raw_post = parsed_payload.get("social_post", "")
            if isinstance(raw_post, dict):
                headline = raw_post.get("headline", "GLOBAL LOGISTICS UPDATE")
                body = raw_post.get("body", "Latest supply chain metrics updated.")
                tags = " ".join(raw_post.get("hashtags", ["#Logistics", "#SupplyChain"]))
                clean_post_text = f"⚡ {headline}\n\n{body}\n\n{tags}"
            elif isinstance(raw_post, str) and raw_post.strip():
                clean_post_text = raw_post.replace('\\n', '\n')
            else:
                # Fallback if social_post was empty
                clean_post_text = f"⚡ GLOBAL LOGISTICS BRIEFING\n\n{slides_object['main']['footerSummary']}\n\n#Logistics #SupplyChain #Freight"

            shorts_module_object = parsed_payload.get("linkedin_shorts_module", {
                "metadata": {"targetPlatform": "LinkedIn", "language": "EN"},
                "socialPost": {"headline": "GLOBAL LOGISTICS UPDATE", "body": clean_post_text}
            })

            # --- ATOMIC SYNCHRONIZED WRITE ---
            # 1. template.js
            with open("template.js", "w", encoding="utf-8") as f:
                f.write(f"const dailyData = {json.dumps(slides_object, indent=4)};")

            # 2. LinkedIn_Template_EN.js
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

            # 3. post.txt
            with open("post.txt", "w", encoding="utf-8") as f:
                f.write(clean_post_text)

            print(f"[SUCCESS]: Synchronized write completed for template.js, LinkedIn_Template_EN.js, and post.txt via {model}.")
            return
        except Exception as e:
            print(f"[RETRY]: Model {model} failed: {e}. Retrying in 10s...")
            time.sleep(10)

if __name__ == "__main__":
    main()
