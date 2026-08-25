import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

def diagnose():
    print(f"Current working directory: {os.getcwd()}")
    
    # Replicate database.py logic
    file_path = os.path.abspath(__file__)
    # backend/scripts/diagnose.py -> backend/scripts -> backend -> root
    # Wait, in database.py it is services/database.py -> services -> backend -> root
    # So 3 levels up.
    # Here: scripts/diagnose.py -> scripts -> backend -> root.
    # So also 3 levels up.
    
    ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(file_path)))
    print(f"Calculated ROOT_DIR: {ROOT_DIR}")
    
    workspace_dir = os.path.join(ROOT_DIR, 'workspace')
    print(f"Calculated WORKSPACE_DIR: {workspace_dir}")
    
    if os.path.exists(workspace_dir):
        print(f"Workspace directory exists.")
        print("Contents:")
        try:
            for item in os.listdir(workspace_dir):
                print(f" - {item}")
        except Exception as e:
            print(f"Error listing workspace: {e}")
    else:
        print(f"Workspace directory DOES NOT exist.")
        
    # Check for alwrity.db in backend
    backend_db = os.path.join(backend_dir, 'alwrity.db')
    if os.path.exists(backend_db):
        print(f"Found legacy DB in backend: {backend_db}")
        
    # Check for alwrity.db in root
    root_db = os.path.join(ROOT_DIR, 'alwrity.db')
    if os.path.exists(root_db):
        print(f"Found legacy DB in root: {root_db}")

if __name__ == "__main__":
    diagnose()
