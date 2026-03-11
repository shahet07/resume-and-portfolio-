# Image Text Translator (Spanish)

Capture or upload an image that contains normal text, run OCR, and translate it to Spanish.

## Features
- Camera capture and image upload
- OCR extraction using `Tesseract.js`
- Editable detected text before translation
- Spanish translation output

## Run
1. Open terminal in this project.
2. Start local server:

```bash
python3 -m http.server 3000
```

3. Open `http://localhost:3000`
4. Click **Start Camera** (or use **Upload Image**)
5. Choose OCR mode:
   - `Fast`: quicker detection, lower accuracy
   - `Accurate`: slower, higher accuracy
6. Click **Read Text (OCR)**
7. Click **Translate to Spanish**

## Notes
- Best results: sharp image, high contrast text, minimal background noise.
- Translation uses an online endpoint, so internet is required in browser.
