const startCameraBtn = document.getElementById("startCamera");
const captureFrameBtn = document.getElementById("captureFrame");
const retakeBtn = document.getElementById("retake");
const readTextBtn = document.getElementById("readText");
const translateSpanishBtn = document.getElementById("translateSpanish");
const uploadImageInput = document.getElementById("uploadImage");

const camera = document.getElementById("camera");
const snapshot = document.getElementById("snapshot");
const cameraStatus = document.getElementById("cameraStatus");
const ocrText = document.getElementById("ocrText");
const spanishText = document.getElementById("spanishText");
const result = document.getElementById("result");
const toast = document.getElementById("toast");

const ctx = snapshot.getContext("2d");
let stream = null;
let hasCapture = false;
const DEFAULT_SNAPSHOT = { width: 1280, height: 720 };
const baseCanvas = document.createElement("canvas");
const baseCtx = baseCanvas.getContext("2d");
let selection = null;
let selectionStart = null;
let isSelecting = false;
const TEXT_ROIS = [
  { name: "full", x: 0, y: 0, w: 1, h: 1 },
  { name: "center", x: 0.1, y: 0.2, w: 0.8, h: 0.55 },
  { name: "bottom", x: 0.05, y: 0.5, w: 0.9, h: 0.45 }
];

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

function drawToSnapshot(source, width, height) {
  snapshot.width = width;
  snapshot.height = height;
  baseCanvas.width = width;
  baseCanvas.height = height;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  baseCtx.imageSmoothingEnabled = true;
  baseCtx.imageSmoothingQuality = "high";
  baseCtx.clearRect(0, 0, width, height);
  baseCtx.drawImage(source, 0, 0, width, height);
  selection = null;
  redrawSnapshot();
}

function redrawSnapshot() {
  if (!baseCanvas.width || !baseCanvas.height) return;
  ctx.clearRect(0, 0, snapshot.width, snapshot.height);
  ctx.drawImage(baseCanvas, 0, 0);

  if (!selection) return;
  const { x, y, w, h } = selection;
  ctx.save();
  ctx.strokeStyle = "#ff6b4a";
  ctx.lineWidth = Math.max(2, Math.round(snapshot.width / 500));
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "rgba(255, 107, 74, 0.12)";
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function getCanvasPoint(event) {
  const rect = snapshot.getBoundingClientRect();
  const scaleX = snapshot.width / rect.width;
  const scaleY = snapshot.height / rect.height;
  const x = Math.max(0, Math.min(snapshot.width, (event.clientX - rect.left) * scaleX));
  const y = Math.max(0, Math.min(snapshot.height, (event.clientY - rect.top) * scaleY));
  return { x, y };
}

function normalizeRect(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(a.x - b.x);
  const h = Math.abs(a.y - b.y);
  return { x, y, w, h };
}

function createSelectionCanvas(sel) {
  const selected = document.createElement("canvas");
  const sx = Math.floor(sel.x);
  const sy = Math.floor(sel.y);
  const sw = Math.max(1, Math.floor(sel.w));
  const sh = Math.max(1, Math.floor(sel.h));
  selected.width = sw;
  selected.height = sh;
  const sctx = selected.getContext("2d");
  sctx.drawImage(baseCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return selected;
}

function createPaddedSelectionCanvas(sel, paddingRatio = 0.05) {
  const padX = Math.round(sel.w * paddingRatio);
  const padY = Math.round(sel.h * paddingRatio);
  const x = Math.max(0, sel.x - padX);
  const y = Math.max(0, sel.y - padY);
  const w = Math.min(baseCanvas.width - x, sel.w + padX * 2);
  const h = Math.min(baseCanvas.height - y, sel.h + padY * 2);
  return createSelectionCanvas({ x, y, w, h });
}

function createProcessedCanvas(sourceCanvas, variant) {
  const srcWidth = sourceCanvas.width;
  const srcHeight = sourceCanvas.height;
  const scale = 2;
  const processed = document.createElement("canvas");
  processed.width = srcWidth * scale;
  processed.height = srcHeight * scale;
  const pctx = processed.getContext("2d");
  pctx.drawImage(sourceCanvas, 0, 0, processed.width, processed.height);

  const imageData = pctx.getImageData(0, 0, processed.width, processed.height);
  const data = imageData.data;
  let graySum = 0;
  const sampleStep = 16;
  for (let i = 0; i < data.length; i += 4 * sampleStep) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    graySum += g;
  }
  const sampleCount = Math.max(1, Math.floor(data.length / (4 * sampleStep)));
  const avgGray = graySum / sampleCount;
  const threshold =
    variant === "hard-threshold"
      ? Math.max(130, Math.min(205, avgGray + 8))
      : Math.max(120, Math.min(210, avgGray + 22));

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const contrastGray = Math.max(0, Math.min(255, (gray - 128) * 1.8 + 128));

    if (variant === "grayscale") {
      data[i] = contrastGray;
      data[i + 1] = contrastGray;
      data[i + 2] = contrastGray;
    } else if (variant === "invert-threshold") {
      const bw = contrastGray > threshold ? 0 : 255;
      data[i] = bw;
      data[i + 1] = bw;
      data[i + 2] = bw;
    } else if (variant === "boost") {
      const boosted = Math.max(0, Math.min(255, (contrastGray - 128) * 2.3 + 128));
      data[i] = boosted;
      data[i + 1] = boosted;
      data[i + 2] = boosted;
    } else {
      const bw = contrastGray > threshold ? 255 : 0;
      data[i] = bw;
      data[i + 1] = bw;
      data[i + 2] = bw;
    }
  }

  pctx.putImageData(imageData, 0, 0);
  return processed;
}

function createRoiCanvas(sourceCanvas, roi) {
  const sx = Math.floor(sourceCanvas.width * roi.x);
  const sy = Math.floor(sourceCanvas.height * roi.y);
  const sw = Math.floor(sourceCanvas.width * roi.w);
  const sh = Math.floor(sourceCanvas.height * roi.h);
  const roiCanvas = document.createElement("canvas");
  roiCanvas.width = Math.max(1, sw);
  roiCanvas.height = Math.max(1, sh);
  const rctx = roiCanvas.getContext("2d");
  rctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, roiCanvas.width, roiCanvas.height);
  return roiCanvas;
}

async function startCamera() {
  if (stream) {
    showToast("Camera already running");
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 60 }
      },
      audio: false
    });
    camera.srcObject = stream;

    const [track] = stream.getVideoTracks();
    if (track && track.getCapabilities) {
      const caps = track.getCapabilities();
      const advanced = [];
      if (caps.focusMode && caps.focusMode.includes("continuous")) {
        advanced.push({ focusMode: "continuous" });
      }
      if (typeof caps.sharpness?.max === "number") {
        advanced.push({ sharpness: caps.sharpness.max });
      }
      if (typeof caps.contrast?.max === "number") {
        advanced.push({ contrast: caps.contrast.max });
      }
      if (advanced.length > 0) {
        try {
          await track.applyConstraints({ advanced });
        } catch (error) {
          // Some cameras do not support advanced constraints.
        }
      }
    }

    cameraStatus.textContent = "Camera live";
    showToast("Camera ready");
  } catch (error) {
    cameraStatus.textContent = "Camera blocked";
    showToast("Camera permission denied");
  }
}

async function captureFrame() {
  if (!stream) {
    showToast("Start camera first");
    return;
  }

  const width = camera.videoWidth;
  const height = camera.videoHeight;

  if (!width || !height) {
    showToast("Camera not initialized yet");
    return;
  }

  const [track] = stream.getVideoTracks();
  let usedPhotoCapture = false;

  if (track && "ImageCapture" in window) {
    try {
      const imageCapture = new ImageCapture(track);
      const blob = await imageCapture.takePhoto();
      const bitmap = await createImageBitmap(blob);
      drawToSnapshot(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
      usedPhotoCapture = true;
    } catch (error) {
      usedPhotoCapture = false;
    }
  }

  if (!usedPhotoCapture) {
    drawToSnapshot(camera, width, height);
  }

  hasCapture = true;
  result.textContent = "Captured. Drag on the snapshot to select only the text area, then run OCR.";
  showToast(usedPhotoCapture ? "Captured. Drag-select text area." : "Captured. Drag-select text area.");
}

function loadImageToCanvas(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    drawToSnapshot(image, image.naturalWidth, image.naturalHeight);
    hasCapture = true;
    URL.revokeObjectURL(url);
    result.textContent = "Image loaded. Drag on the snapshot to select only the text area, then run OCR.";
    showToast("Image loaded. Drag-select text area.");
  };

  image.onerror = () => {
    URL.revokeObjectURL(url);
    showToast("Could not read image");
  };

  image.src = url;
}

function clearCapture() {
  snapshot.width = DEFAULT_SNAPSHOT.width;
  snapshot.height = DEFAULT_SNAPSHOT.height;
  baseCanvas.width = DEFAULT_SNAPSHOT.width;
  baseCanvas.height = DEFAULT_SNAPSHOT.height;
  ctx.clearRect(0, 0, snapshot.width, snapshot.height);
  baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
  ocrText.value = "";
  spanishText.value = "";
  result.textContent = "Ready.";
  hasCapture = false;
  selection = null;
  showToast("Cleared");
}

function cleanupOcrText(text) {
  return (text || "")
    .replace(/[|]/g, "I")
    .replace(/[“”]/g, "\"")
    .replace(/[’`]/g, "'")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textScore(text, confidence) {
  const clean = cleanupOcrText(text);
  if (!clean) return -999;
  const tokens = clean.split(/\s+/).filter(Boolean);
  const words = tokens.length;
  const letters = (clean.match(/[a-zA-Z]/g) || []).length;
  const digits = (clean.match(/[0-9]/g) || []).length;
  const symbols = (clean.match(/[^a-zA-Z0-9\s.,!?'"():;-]/g) || []).length;
  const letterRatio = letters / Math.max(1, clean.replace(/\s/g, "").length);
  const hasVowels = /[aeiou]/i.test(clean);
  const hasCommonWord = /\b(my|name|is|hello|i|am|the|this|that)\b/i.test(clean);
  const shortTokenCount = tokens.filter((t) => t.length <= 1).length;
  const alphaWords = tokens.filter((t) => /^[a-zA-Z]+$/.test(t)).length;
  const likelySentence = alphaWords >= 3 && shortTokenCount <= Math.max(1, Math.floor(words / 3));
  const commonWords = /\b(my|name|is|hello|i|am|the|this|that|you|we|are|to|from|and)\b/gi;
  const commonHits = (clean.match(commonWords) || []).length;
  const longAlphaWords = tokens.filter((t) => /^[a-zA-Z]{3,}$/.test(t)).length;

  let score = confidence;
  score += words * 4 + letters * 0.7 + digits * 0.2;
  score -= symbols * 8;
  score += letterRatio * 35;
  if (hasVowels) score += 8;
  if (hasCommonWord) score += 15;
  score += commonHits * 8;
  score += longAlphaWords * 4;
  if (likelySentence) score += 25;
  if (shortTokenCount > Math.floor(words / 2)) score -= 25;
  if (alphaWords <= 1 && symbols > 0) score -= 40;
  if (words >= 3 && alphaWords <= 1) score -= 45;
  if (/^[a-zA-Z ]+$/.test(clean)) score += 10;
  if (clean.length < 3) score -= 30;
  return score;
}

async function readText() {
  if (!hasCapture) {
    showToast("Capture or upload an image first");
    return;
  }

  if (!window.Tesseract) {
    showToast("OCR library failed to load");
    return;
  }

  result.textContent = "Running OCR...";

  try {
    const variants = ["grayscale", "hard-threshold", "soft-threshold", "invert-threshold", "boost"];
    const pageModes = ["6", "7", "11"];
    const candidates = [];
    const ocrSources = [];

    if (selection && selection.w >= 30 && selection.h >= 20) {
      ocrSources.push({ name: "selection", canvas: createSelectionCanvas(selection) });
      ocrSources.push({ name: "selection-pad", canvas: createPaddedSelectionCanvas(selection) });
    } else {
      const sourceCanvas = baseCanvas.width ? baseCanvas : snapshot;
      for (const roi of TEXT_ROIS) {
        const roiCanvas = roi.name === "full" ? sourceCanvas : createRoiCanvas(sourceCanvas, roi);
        ocrSources.push({ name: roi.name, canvas: roiCanvas });
      }
    }

    for (const source of ocrSources) {
      for (const variant of variants) {
        const processed = createProcessedCanvas(source.canvas, variant);
        for (const psm of pageModes) {
          const { data } = await Tesseract.recognize(processed, "eng", {
            tessedit_pageseg_mode: psm,
            preserve_interword_spaces: "1",
            tessedit_char_whitelist:
              "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?':;()-",
            logger: (msg) => {
              if (msg.status === "recognizing text" && typeof msg.progress === "number") {
                const pct = Math.round(msg.progress * 100);
                result.textContent = `Running OCR (${source.name}/${variant}/psm${psm})... ${pct}%`;
              }
            }
          });

          const text = cleanupOcrText(data.text || "");
          const confidence = typeof data.confidence === "number" ? data.confidence : 0;
          candidates.push({
            roi: source.name,
            variant,
            psm,
            text,
            confidence,
            score: textScore(text, confidence)
          });
        }
      }
    }

    // Also try line-level extraction from best candidate blocks when available.
    const refined = [];
    for (const c of candidates) {
      const lines = c.text
        .split(/\n+/)
        .map((line) => cleanupOcrText(line))
        .filter(Boolean);
      for (const line of lines) {
        refined.push({
          ...c,
          text: line,
          score: c.score + textScore(line, c.confidence)
        });
      }
    }

    const allCandidates = [...candidates, ...refined];
    allCandidates.sort((a, b) => b.score - a.score);
    const best = allCandidates[0] || { text: "", confidence: 0 };

    if (!best.text || best.text.length < 2 || best.score < 25) {
      ocrText.value = "";
      result.textContent = "No readable text detected. Try a closer, clearer image.";
      showToast("No readable text found");
      return;
    }

    ocrText.value = best.text;
    result.textContent = "OCR complete. You can edit detected text before translation.";
    showToast(`Text detected (${Math.round(best.confidence)}% confidence)`);
  } catch (error) {
    result.textContent = `OCR failed: ${error.message}`;
    showToast("OCR failed");
  }
}

async function translateToSpanish(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Translation request failed (${response.status})`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error("Unexpected translation response");
  }

  return data[0].map((part) => part[0] || "").join("").trim();
}

async function runTranslate() {
  const sourceText = ocrText.value.trim();

  if (!sourceText) {
    showToast("No source text to translate");
    return;
  }

  result.textContent = "Translating to Spanish...";

  try {
    const translated = await translateToSpanish(sourceText);
    if (!translated) {
      throw new Error("Empty translation result");
    }

    spanishText.value = translated;
    result.textContent = "Translation complete.";
    showToast("Translated to Spanish");
  } catch (error) {
    result.textContent = `Translation failed: ${error.message}`;
    showToast("Translation failed");
  }
}

startCameraBtn.addEventListener("click", startCamera);
captureFrameBtn.addEventListener("click", captureFrame);
retakeBtn.addEventListener("click", clearCapture);
readTextBtn.addEventListener("click", readText);
translateSpanishBtn.addEventListener("click", runTranslate);
uploadImageInput.addEventListener("change", () => {
  const file = uploadImageInput.files && uploadImageInput.files[0];
  loadImageToCanvas(file);
  uploadImageInput.value = "";
});

snapshot.addEventListener("pointerdown", (event) => {
  if (!hasCapture) return;
  snapshot.setPointerCapture(event.pointerId);
  isSelecting = true;
  selectionStart = getCanvasPoint(event);
  selection = { x: selectionStart.x, y: selectionStart.y, w: 1, h: 1 };
  redrawSnapshot();
});

snapshot.addEventListener("pointermove", (event) => {
  if (!isSelecting || !selectionStart) return;
  const point = getCanvasPoint(event);
  selection = normalizeRect(selectionStart, point);
  redrawSnapshot();
});

snapshot.addEventListener("pointerup", (event) => {
  if (!isSelecting) return;
  isSelecting = false;
  snapshot.releasePointerCapture(event.pointerId);
  if (!selection || selection.w < 25 || selection.h < 18) {
    selection = null;
    showToast("Selection too small");
  } else {
    showToast("Text region selected");
  }
  redrawSnapshot();
});
