from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1]
folder = root / 'resources'
folder.mkdir(exist_ok=True)
icon = Image.new('RGBA', (512, 512), '#111618')
draw = ImageDraw.Draw(icon)
draw.rounded_rectangle((24, 24, 488, 488), 90, fill='#1b2225', outline='#f4b942', width=16)
draw.ellipse((130, 130, 382, 382), outline='#f4b942', width=14)
for line in [(256, 78, 256, 198), (256, 314, 256, 434), (78, 256, 198, 256), (314, 256, 434, 256)]:
    draw.line(line, fill='#f4b942', width=16)
draw.ellipse((238, 238, 274, 274), fill='#e86c55')
icon.save(folder / 'icon.png')
icon.save(folder / 'icon.ico', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
res = root / 'android' / 'res' / 'drawable'
res.mkdir(parents=True, exist_ok=True)
icon.resize((192,192), Image.Resampling.LANCZOS).save(res / 'app_icon.png')
print('Generated desktop and Android icons')
