import urllib.request
import json
try:
    with urllib.request.urlopen('http://localhost:5000/api/nfc/scan') as response:
        html = response.read()
        print("Status:", response.status)
        print("Response:", json.loads(html))
except urllib.error.HTTPError as e:
    print("HTTPError Status:", e.code)
    print("HTTPError Response:", e.read().decode())
except Exception as e:
    print("Error:", e)
