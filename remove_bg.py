from PIL import Image
import base64
import re

# 1. Open the original image
img = Image.open('ID_CARDS/KeMU Logo.jpg')
img = img.convert("RGBA")
datas = img.getdata()

# 2. Make white (and near-white) pixels transparent
newData = []
for item in datas:
    # If the pixel is close to white, make it transparent
    if item[0] > 240 and item[1] > 240 and item[2] > 240:
        newData.append((255, 255, 255, 0))
    else:
        newData.append(item)

img.putdata(newData)
img.save('ID_CARDS/KeMU_Logo_transparent.png', "PNG")

# 3. Read it as base64
with open('ID_CARDS/KeMU_Logo_transparent.png', 'rb') as f:
    logo_b64 = base64.b64encode(f.read()).decode('utf-8')

# 4. Update IDCard.jsx with the new base64 string
filepath = 'frontend/src/components/IDCard.jsx'
with open(filepath, 'r') as f:
    content = f.read()

# Replace the base64 string
new_content = re.sub(
    r'const kemuLogo = "data:image/jpeg;base64,.*?";',
    f'const kemuLogo = "data:image/png;base64,{logo_b64}";',
    content
)

with open(filepath, 'w') as f:
    f.write(new_content)

print("Successfully replaced logo with transparent PNG!")
