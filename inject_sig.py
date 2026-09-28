import base64
import re

with open(r'C:\Users\Administrator\Documents\LogBook\attachment\Signature_transparent.png', 'rb') as f:
    sig_b64 = base64.b64encode(f.read()).decode('utf-8')

filepath = 'c:/Users/Administrator/Desktop/SmartSchoolEcosystem/frontend/src/components/IDCard.jsx'
with open(filepath, 'r') as f:
    content = f.read()

# Insert the base64 string at the top of IDCard component
new_content = content.replace(
    'const kemuLogo =',
    f'const sigBase64 = "data:image/png;base64,{sig_b64}";\n  const kemuLogo ='
)

with open(filepath, 'w') as f:
    f.write(new_content)

print("Injected signature base64!")
