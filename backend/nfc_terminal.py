import time
import requests
from smartcard.System import readers
from smartcard.util import toHexString

BACKEND_URL = "http://localhost:5000/api/tap"

def format_uid(uid_bytes):
    return "".join(f"{b:02X}" for b in uid_bytes)

def main():
    print("Starting Smart School NFC Terminal")
    print("Waiting for card taps...")
    
    last_uid = None
    last_tap_time = 0

    while True:
        r = readers()
        if not r:
            time.sleep(1)
            continue
            
        connection = None
        for reader in r:
            try:
                conn = reader.createConnection()
                conn.connect()
                connection = conn
                break
            except Exception:
                pass
                
        if not connection:
            time.sleep(0.5)
            continue
            
        try:
            # PC/SC APDU to get UID
            GET_UID = [0xFF, 0xCA, 0x00, 0x00, 0x00]
            data, sw1, sw2 = connection.transmit(GET_UID)
            
            if sw1 == 0x90 and sw2 == 0x00:
                uid_str = format_uid(data)
                
                # Debounce logic (3 seconds)
                current_time = time.time()
                if uid_str == last_uid and (current_time - last_tap_time) < 3.0:
                    time.sleep(0.5)
                    continue
                
                print(f"\n[Tap Detected] Card UID: {uid_str}")
                
                payload = {"uid": uid_str}
                try:
                    response = requests.post(BACKEND_URL, json=payload, timeout=2)
                    res_data = response.json()
                    
                    if response.status_code == 200:
                        print(f" -> Access Granted: {res_data['student']['name']} ({res_data['unit']['code']})")
                    else:
                        print(f" -> Denied: {res_data.get('message')}")
                except Exception as e:
                    print(f" -> Backend Error: {e}")
                
                last_uid = uid_str
                last_tap_time = current_time
        except Exception as e:
            pass
            
        time.sleep(0.5)

if __name__ == '__main__':
    main()
