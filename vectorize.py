import vtracer
import base64
import re
import os

input_path = 'ID_CARDS/KeMU_Logo_transparent.png'
output_path = 'ID_CARDS/KeMU_Logo.svg'

# Convert raster to vector using vtracer
# These settings will aim for high quality multi-color tracing
vtracer.convert_image_to_svg_py(
    input_path,
    output_path,
    colormode='color',
    hierarchical='stacked',
    mode='spline',
    filter_speckle=4,
    color_precision=6,
    layer_difference=16,
    corner_threshold=60,
    length_threshold=4.0,
    max_iterations=10,
    splice_threshold=45,
    path_precision=8
)

print(f"Successfully vectorized {input_path} to {output_path}")

# Now read the SVG and base64 encode it
with open(output_path, 'rb') as f:
    svg_data = f.read()

svg_b64 = base64.b64encode(svg_data).decode('utf-8')

# Update IDCard.jsx
filepath = 'frontend/src/components/IDCard.jsx'
with open(filepath, 'r') as f:
    content = f.read()

# Replace the base64 string
new_content = re.sub(
    r'const kemuLogo = "data:image/.*?";',
    f'const kemuLogo = "data:image/svg+xml;base64,{svg_b64}";',
    content
)

with open(filepath, 'w') as f:
    f.write(new_content)

print("Successfully replaced logo with SVG vector version in IDCard.jsx!")
