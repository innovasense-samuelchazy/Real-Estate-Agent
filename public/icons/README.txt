ICON GENERATION INSTRUCTIONS
==========================

The placeholder icon files need to be replaced with actual icons in the specified sizes.
You can generate these icons using tools like:

1. https://realfavicongenerator.net/ - Upload your logo and download a complete package
2. https://www.pwabuilder.com/ - Has tools for icon generation
3. Using ImageMagick command line: 

   # Example commands to generate icons from SVG source
   # Install ImageMagick first if not already installed

   # macOS
   brew install imagemagick

   # Ubuntu
   # sudo apt-get install imagemagick

   # Converting SVG to PNG icons in different sizes
   convert -background none -size 72x72 innovasense.svg icon-72x72.png
   convert -background none -size 96x96 innovasense.svg icon-96x96.png
   convert -background none -size 128x128 innovasense.svg icon-128x128.png
   convert -background none -size 144x144 innovasense.svg icon-144x144.png
   convert -background none -size 152x152 innovasense.svg icon-152x152.png
   convert -background none -size 192x192 innovasense.svg icon-192x192.png
   convert -background none -size 256x256 innovasense.svg icon-256x256.png
   convert -background none -size 384x384 innovasense.svg icon-384x384.png
   convert -background none -size 512x512 innovasense.svg icon-512x512.png
   
   # For apple-touch-icon (typically 180x180)
   convert -background none -size 180x180 innovasense.svg apple-touch-icon.png
   
   # For favicon
   convert -background none -size 32x32 innovasense.svg favicon-32x32.png
   convert -background none -size 16x16 innovasense.svg favicon-16x16.png

4. For the maskable icon, you need to ensure there's padding around the logo so it 
   looks good when displayed in an adaptive shape on Android. This should typically 
   have about 25% safe zone from each edge.

REQUIRED ICONS FOR COMPLETE PWA SUPPORT:
----------------------------------------
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-256x256.png
- icon-384x384.png
- icon-512x512.png
- maskable-icon.png
- apple-touch-icon.png
- favicon-32x32.png
- favicon-16x16.png
- safari-pinned-tab.svg 