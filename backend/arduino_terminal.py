
import time
import requests
import serial
import serial.tools.list_ports
import re
import sys
import json
import os
import threading
from datetime import datetime

BACKEND_URL = "http://localhost:5000/api/tap"
QUEUE_FILE = os.path.join(os.path.dirname(__file__), "tap_queue.json")


# ─────────────────────────────────────────────
# Offline Queue Management
# ─────────────────────────────────────────────

def load_queue():
    if os.path.exists(QUEUE_FILE):
        try:
            with open(QUEUE_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_queue(queue):
    try:
        with open(QUEUE_FILE, 'w') as f:
            json.dump(queue, f, indent=2)
    except Exception as e:
        print(f"[Queue] Failed to save queue: {e}")

def enqueue_tap(uid, tappoint_id=None):
    queue = load_queue()
    entry = {"uid": uid, "tappoint_id": tappoint_id, "queued_at": datetime.utcnow().isoformat()}
    queue.append(entry)
    save_queue(queue)
    print(f"[Offline] Tap queued ({len(queue)} in queue): {uid}")

def replay_queue():
    queue = load_queue()
    if not queue:
        return
    print(f"\n[Queue Replay] Replaying {len(queue)} queued tap(s)...")
    remaining = []
    for entry in queue:
        payload = {"uid": entry["uid"]}
        if entry.get("tappoint_id"):
            payload["tappoint_id"] = entry["tappoint_id"]
        try:
            response = requests.post(BACKEND_URL, json=payload, timeout=3)
            res_data = response.json()
            status = "OK" if response.status_code == 200 else "DENIED"
            print(f"  [{status}] {entry['uid']} (queued at {entry['queued_at']})")
        except Exception as e:
            print(f"  [FAILED] {entry['uid']} — {e}")
            remaining.append(entry)
    save_queue(remaining)
    if remaining:
        print(f"[Queue] {len(remaining)} tap(s) still pending (backend unreachable)")
    else:
        print(f"[Queue] All queued taps replayed successfully.")


# ─────────────────────────────────────────────
# Background Queue Replay Thread
# ─────────────────────────────────────────────

def queue_replay_loop():
    """Runs in background — tries to replay queued taps every 30 seconds."""
    while True:
        time.sleep(30)
        queue = load_queue()
        if queue:
            try:
                # Quick connectivity check
                requests.get(BACKEND_URL.replace('/api/tap', '/api/stats'), timeout=2)
                replay_queue()
            except Exception:
                pass  # Backend still unreachable


# ─────────────────────────────────────────────
# Port Detection
# ─────────────────────────────────────────────

def find_arduino_port():
    ports = list(serial.tools.list_ports.comports())
    print("Available Serial Ports:")
    if not ports:
        print("  (None found)")
    else:
        for port in ports:
            print(f"  -> {port.device}: {port.description}")
    for port in ports:
        desc = port.description.lower()
        if "arduino" in desc or "ch340" in desc or "cp210" in desc or "usb serial" in desc or "esp32" in desc:
            print(f"\nAuto-selected: {port.device}")
            return port.device
    return None


# ─────────────────────────────────────────────
# Send Tap to Backend
# ─────────────────────────────────────────────

def send_tap(uid, tappoint_id=None):
    payload = {"uid": uid}
    if tappoint_id:
        payload["tappoint_id"] = tappoint_id
    try:
        response = requests.post(BACKEND_URL, json=payload, timeout=3)
        res_data = response.json()
        if response.status_code == 200:
            student = res_data.get('student', {})
            print(f" -> Access Granted: {student.get('name', 'Unknown')} | {res_data.get('message', '')}")
        else:
            print(f" -> Denied: {res_data.get('message', str(res_data))}")
    except requests.exceptions.ConnectionError:
        print(f" -> Backend offline. Queuing tap for replay.")
        enqueue_tap(uid, tappoint_id)
    except Exception as e:
        print(f" -> Error: {e}")
        enqueue_tap(uid, tappoint_id)


# ─────────────────────────────────────────────
# Main Loop
# ─────────────────────────────────────────────

def main():
    print("===========================================")
    print(" Smart School Arduino/ESP32 NFC Terminal")
    print("===========================================")

    port = sys.argv[1] if len(sys.argv) > 1 else find_arduino_port()
    baud = int(sys.argv[2]) if len(sys.argv) > 2 else 9600
    tappoint_id = sys.argv[3] if len(sys.argv) > 3 else None

    if tappoint_id:
        print(f"TapPoint ID: {tappoint_id}")

    # Show queued taps on startup
    queue = load_queue()
    if queue:
        print(f"\n[Startup] {len(queue)} tap(s) found in offline queue.")
        try:
            requests.get(BACKEND_URL.replace('/api/tap', '/api/stats'), timeout=2)
            replay_queue()
        except Exception:
            print("[Startup] Backend not reachable — queue will replay when connection is restored.")
    else:
        print("[Startup] No queued taps.")

    # Start background replay thread
    replay_thread = threading.Thread(target=queue_replay_loop, daemon=True)
    replay_thread.start()

    if not port:
        print("\nNo serial port found. Connect your Arduino/ESP32 and try again.")
        print("Usage: python arduino_terminal.py [COM_PORT] [BAUD] [TAPPOINT_ID]")
        return

    print(f"\nConnecting to {port} at {baud} baud...")
    try:
        ser = serial.Serial(port, baud, timeout=1)
        time.sleep(2)
    except Exception as e:
        print(f"Failed to connect to {port}: {e}")
        print("Make sure the Arduino IDE Serial Monitor is closed!")
        return

    print("Connected! Waiting for card taps...\n")
    last_uid = None
    last_tap_time = 0

    while True:
        try:
            if ser.in_waiting > 0:
                raw_bytes = ser.readline()
                try:
                    line = raw_bytes.decode('utf-8').strip()
                except Exception:
                    continue
                if not line:
                    continue

                print(f"[Serial] {line}")

                # Extract UID — matches any 4+ consecutive 2-char hex tokens
                hex_matches = re.findall(r'\b[0-9A-Fa-f]{2}\b', line)
                if len(hex_matches) >= 4:
                    uid_str = "".join(hex_matches).upper()
                    current_time = time.time()
                    # Debounce: same card within 3 seconds = ignore
                    if uid_str == last_uid and (current_time - last_tap_time) < 3.0:
                        continue
                    print(f"\n[Tap] UID: {uid_str}")
                    send_tap(uid_str, tappoint_id)
                    last_uid = uid_str
                    last_tap_time = current_time

        except KeyboardInterrupt:
            print("\n\nStopped. Goodbye.")
            break
        except serial.SerialException as e:
            print(f"\n[Disconnected] Device lost or serial error: {e}")
            print("Please check the connection and restart the script.")
            break
        except Exception as e:
            print(f"[Error] {e}")
            time.sleep(1)


if __name__ == '__main__':
    main()
