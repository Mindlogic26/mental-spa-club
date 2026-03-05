from fastapi import FastAPI, Request # <--- CHANGE: Added 'Request' so we can read the mood from the mirror
from fastapi.responses import HTMLResponse
import os
import requests # <--- ADD: This is the "telephone" Python uses to call Google's AI

app = FastAPI()

# HELPER FUNCTION: This "opens the door" to any room folder you create
def open_room(room_folder):
    # (This part stays exactly the same!)
    current_dir = os.path.dirname(os.path.realpath(__file__))
    file_path = os.path.join(current_dir, room_folder, "index.html")
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content=content)
    except Exception as e:
        return HTMLResponse(content=f"Room '{room_folder}' not found. Error: {str(e)}", status_code=404)

# +++ NEW ADDITION START +++
# This is a "POST" route. Unlike the others, it doesn't show a page; 
# it processes data behind the scenes.
@app.post("/api/generate-flower")
async def generate_flower(request: Request):
    api_key = os.environ.get("GEMINI_API_KEY")
    data = await request.json()
    mood = data.get("mood", "peaceful")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    # Updated Prompt for a cleaner response
    prompt = f"The user is feeling '{mood}'. Suggest one flower and a short quote. Keep it brief."
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    
    response = requests.post(url, json=payload)
    result = response.json()
    
    # This helps us debug! If there is an error, it shows up in Vercel Logs
    if "error" in result:
        print(f"AI Error: {result['error']}")
        
    return result


# +++ NEW ADDITION END +++

# --- ROUTE 1: THE LOBBY (Remains same) ---
@app.get("/")
def read_root():
    return open_room("lobby")

# --- ROUTE 2: THE FLORAL MIRROR (Remains same) ---
@app.get("/mirror")
def read_mirror():
    return open_room("mirror")

# --- HEALTH CHECK (Remains same) ---
@app.get("/api/health")
def health():
    return {"status": "The Mental Spa is online."}