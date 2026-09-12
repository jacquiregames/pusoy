# run.py
import multiprocessing
import uvicorn
from backend.app.main import app, get_ip

if __name__ == "__main__":
    # Required for Windows executables using multiprocessing/Pyinstaller
    multiprocessing.freeze_support() 
    
    local_ip = get_ip()
    port = 3000
    
    print("="*60)
    print(f"🃏 PUSOY DOS SERVER STARTED")
    print(f"👉 Players on your LAN can join at: http://{local_ip}:{port}")
    print("="*60)
    
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")