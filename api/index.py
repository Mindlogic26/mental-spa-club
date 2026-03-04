from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI()

# This is your Lobby Design saved directly in the 'Brain'
LOBBY_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Mental Spa Club</title>
    <style>
        body { margin: 0; padding: 0; background: #f4f7f6; font-family: sans-serif; 
               display: flex; justify-content: center; align-items: center; height: 100vh; text-align: center; }
        .container { max-width: 600px; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        h1 { color: #4a4a4a; font-weight: 300; letter-spacing: 2px; }
        p { color: #666; line-height: 1.6; margin-bottom: 30px; }
        .btn { display: inline-block; padding: 12px 30px; background: #8da9a6; color: white; 
               text-decoration: none; border-radius: 25px; transition: 0.3s; }
        .btn:hover { background: #7a9491; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to the Club</h1>
        <p>Take a deep breath. This is your quiet corner of the internet.</p>
        <a href="/api/labyrinth" class="btn">BEGIN JOURNEY</a>
    </div>
</body>
</html>
"""

@app.get("/")
def read_root():
    return HTMLResponse(content=LOBBY_HTML)

@app.get("/api/health")
def health():
    return {"status": "The Mental Spa is online."}