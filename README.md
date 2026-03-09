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
python3 -m http.server 5500
```

3. Open `http://localhost:5500`
4. Click **Start Camera** (or use **Upload Image**)
5. Click **Read Text (OCR)**
6. Click **Translate to Spanish**

## Notes
- Best results: sharp image, high contrast text, minimal background noise.
- Translation uses an online endpoint, so internet is required in browser.
