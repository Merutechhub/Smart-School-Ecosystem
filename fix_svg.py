import base64
import re

filepath = 'frontend/src/components/IDCard.jsx'
with open(filepath, 'r') as f:
    content = f.read()

# Extract base64
match = re.search(r'const kemuLogo = "data:image/svg\+xml;base64,([^"]+)";', content)
if match:
    b64_str = match.group(1)
    svg_str = base64.b64decode(b64_str).decode('utf-8')
    
    # Check if viewBox exists
    if 'viewBox' not in svg_str:
        # Insert viewBox
        svg_str = re.sub(r'(width="\d+" height="\d+")', r'\1 viewBox="0 0 678 452"', svg_str)
        
        # Re-encode
        new_b64 = base64.b64encode(svg_str.encode('utf-8')).decode('utf-8')
        
        # Replace
        new_content = content.replace(b64_str, new_b64)
        
        with open(filepath, 'w') as f:
            f.write(new_content)
        print("Successfully added viewBox to SVG!")
    else:
        print("viewBox already exists.")
else:
    print("Could not find base64 SVG in IDCard.jsx")
