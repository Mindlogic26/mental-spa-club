from fastapi import FastAPI
from fastapi.responses import HTMLResponse
import os

app = FastAPI()

# HELPER FUNCTION: This "opens the door" to any room folder you create
def open_room(room_folder):
    # This finds the exact folder on Vercel's server
    current_dir = os.path.dirname(os.path.realpath(__file__))
    file_path = os.path.join(current_dir, room_folder, "index.html")
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content=content)
    except Exception as e:
        # If the folder or file is missing, it will tell us why
        return HTMLResponse(content=f"Room '{room_folder}' not found. Error: {str(e)}", status_code=404)

# --- ROUTE 1: THE LOBBY (Your main entrance) ---
@app.get("/")
def read_root():
    return open_room("lobby")

# --- ROUTE 2: THE FLORAL MIRROR (Your new app room) ---
@app.get("/mirror")
def read_mirror():
    return open_room("mirror")

# --- HEALTH CHECK ---
@app.get("/api/health")
def health():
    return {"status": "The Mental Spa is online."}
