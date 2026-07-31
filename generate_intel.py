# ==============================================================================
# SIYALAIR INTELLIGENCE GENERATOR (PROD_v2.0_2026)
# MODULE: generate_intel.py
# PURPOSE: Fetches news, executes Gemini AI structural parser, and outputs:
#          1. template.js                     (Carousel Canvas Schema)
#          2. Social_Media/Video_Template_EN.js (Video Shorts Schema)
#          3. post.txt                         (Social Media Post Text Payload)
# ==============================================================================

import os
import re
import json
import time
import requests
from bs4 import BeautifulSoup
from google import genai
from google.genai import types

# ------------------------------------------------------------------------------
# 1. NEWS SCRAPING ENGINE
# ------------------------------------------------------------------------------
def fetch_latest_logistics_news():
    """Scrapes top logistics news headlines and summaries from targeted industry feeds."""
    urls = [
        "https://www.logisticsmgmt.com/news",
        "https://www.freightwaves.com/news",
        "https://www.supplychaindive.com"
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    scraped_articles = []
    
    for url in urls:
        try:
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code == 200:
                soup = BeautifulSoup(res.text, 'html.parser')
                # Extract headlines from standard article tags
                headlines = soup.find_all(['h2', 'h3'], class_=True, limit=5)
                for h in headlines:
                    text = h.get_text(strip=True)
                    if len(text) > 25 and text not in scraped_articles:
                        scraped_articles.append(text)
        except Exception as e:
            print(f"[WARNING] News fetch error from {url}: {str(e)}")
            
    if not scraped_articles:
        # Fallback news payload if remote feeds are unreachable
        scraped_articles = [
            "US Trade Representative pushes enforcement on foreign freight regulatory tariffs.",
            "Strait of Hormuz maritime disruption escalates ocean carrier delays across trans-Pacific routes.",
            "Federal court advisory verdict impacts third-party logistics broker liability standards.",
            "Freight automation initiatives accelerate military veteran driver onboarding pipelines.",
            "Air cargo carriers review dynamic fuel surcharges amid middle east energy volatility."
        ]
        
    return "\n".join(scraped_articles[:10])

# ------------------------------------------------------------------------------
# 2. GEMINI AI PARSER & DATA GENERATION
# ------------------------------------------------------------------------------
def generate_payload():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("[ERROR] GEMINI_API_KEY environment variable is missing.")

    client = genai.Client(api_key=api_key)
    raw_news_data = fetch_latest_logistics_news()

    # Read the JSON structure contract from prompt.txt
    prompt_file_path = "prompt.txt"
    if os.path.exists(prompt_file_path):
        with open(prompt_file_path, "r", encoding="utf-8") as pf:
            system_instructions = pf.read()
    else:
        system_instructions = "Extract top logistics news and convert into structured JSON carousel data."

    user_query = f"""
    Analyze the following recent logistics news and format strictly into the required JSON schema:
    
    NEWS DATA:
    {raw_news_data}
    """

    print("[INFO] Calling Gemini AI API to generate dynamic payload...")
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=user_query,
        config=types.GenerateContentConfig(
            system_instruction=system_instructions,
            temperature=0.2,
            response_mime_type="application/json"
        )
    )

    clean_json_str = re.sub(r"^```json\s*", "", response.text.strip())
    clean_json_str = re.sub(r"\s*```$", "", clean_json_str)

    data = json.loads(clean_json_str)
    return data

# ------------------------------------------------------------------------------
# 3. SCHEMA CONVERTERS & FILE GENERATION
# ------------------------------------------------------------------------------
def main():
    try:
        data = generate_payload()
        
        main_info = data.get("main", {})
        slides_list = data.get("slides", [])

        # ======================================================================
        # FILE 1: template.js (Carousel Canvas Schema)
        # ======================================================================
        template_js_content = f"""if (typeof window !== 'undefined') {{ window.dailyData = {json.dumps(data, indent=4)}; }}
if (typeof module !== 'undefined' && module.exports) {{ module.exports = {json.dumps(data, indent=4)}; }}"""

        with open("template.js", "w", encoding="utf-8") as f:
            f.write(template_js_content)
        print("[SUCCESS] Successfully generated 'template.js'.")

        # ======================================================================
        # FILE 2: Social_Media/Video_Template_EN.js (Video Shorts Schema)
        # ======================================================================
        os.makedirs("Social_Media", exist_ok=True)

        # Extract Hook Title for Video Shorts from main title or first slide
        title_white = main_info.get("titleWhite", "GLOBAL LOGISTICS")
        title_blue = main_info.get("titleBlue", "UPDATE")
        hook_title = f"{title_white} {title_blue}".upper().strip()

        script_slides = []
        for idx, slide in enumerate(slides_list, start=1):
            heading = slide.get("heading", f"SLIDE {idx}")
            next_teaser = slide.get("nextUpTease", "")
            
            # Combine bullet points into a clean 1-2 sentence narration line
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

        with open("Social_Media/Video_Template_EN.js", "w", encoding="utf-8") as f:
            f.write(video_js_content)
        print("[SUCCESS] Successfully generated 'Social_Media/Video_Template_EN.js'.")

        # ======================================================================
        # FILE 3: post.txt (Social Media Caption Payload)
        # ======================================================================
        summary_text = main_info.get("footerSummary", "")
        hashtags = "#Logistics #SupplyChain #Freight #GlobalTrade #SiyalAir #LogisticsNews"
        
        post_text = f"🚨 GLOBAL INTEL UPDATE: {hook_title} 🚨\n\n{summary_text}\n\n"
        for slide in slides_list:
            post_text += f"🔹 {slide.get('heading', '')}\n"
            for p in slide.get('points', []):
                post_text += f" • {p}\n"
            post_text += "\n"
        post_text += f"{hashtags}"

        with open("post.txt", "w", encoding="utf-8") as f:
            f.write(post_text.strip())
        print("[SUCCESS] Successfully generated 'post.txt'.")

    except Exception as e:
        print(f"[ERROR] Pipeline execution failed: {str(e)}")
        raise e

if __name__ == "__main__":
    main()
