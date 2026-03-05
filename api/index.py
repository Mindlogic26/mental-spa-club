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
    # 1. Grab your secret key from the Vercel "vault" you just set up
    api_key = os.environ.get("GEMINI_API_KEY")
    
    # 2. Receive the mood (the data) sent from your HTML page
    data = await request.json()
    mood = data.get("mood", "peaceful")
    
    # 3. This is the "Address" of Google's Gemini AI
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    # 4. Our instructions to the AI
    prompt = f"The user is feeling '{mood}'. Suggest one specific flower and a quote."
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    
    # 5. Actually make the "phone call" to Google
    response = requests.post(url, json=payload)
    return response.json()
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