"""Outfit prediction via CLIP style classification and color detection.

All heavy models (CLIP) are lazy-loaded on first use to keep the Flask
process under Render free-tier 512 MB RAM limit.

Key optimizations:
- CLIP loaded in float16 on CUDA and float32 on CPU
- Render diagnostics log memory before and after model loading
- YOLO removed; center-crop fallback used for person detection
- Aggressive gc.collect() after inference
"""

import gc
import os
import threading
import time
import traceback
from io import BytesIO

import cv2
import numpy as np
import psutil
from PIL import Image
from sklearn.cluster import KMeans

# ── Lazy-loaded globals ──
_clip_model = None
_clip_processor = None
_clip_dtype = None
_load_lock = threading.Lock()
MODEL_NAME = "openai/clip-vit-base-patch32"
HF_CACHE_DIR = "/tmp/huggingface"
MOCK_STYLE = "casual t shirt jeans outfit"
ENABLE_HEAVY_CLIP = os.getenv("AI_ENABLE_HEAVY_CLIP", "false").lower() == "true"
STYLE_BY_CATEGORY = {
    "formal": "formal business suit outfit",
    "casual": "casual t shirt jeans outfit",
    "sports": "sports gym workout outfit",
    "ethnic": "indian ethnic kurta sherwani outfit",
    "streetwear": "streetwear hoodie outfit",
    "party": "party wear stylish outfit",
}
STYLE_KEYWORDS = {
    "formal": [
        "formal", "business", "office", "suit", "blazer", "shirt", "tie",
        "trouser", "trousers", "pants", "dress-pant", "dresspant",
    ],
    "sports": [
        "sport", "sports", "gym", "workout", "fitness", "running", "run",
        "athletic", "jersey", "track", "training", "yoga",
    ],
    "ethnic": [
        "ethnic", "traditional", "kurta", "sherwani", "saree", "sari",
        "lehenga", "salwar", "wedding", "festive",
    ],
    "streetwear": [
        "street", "streetwear", "hoodie", "cargo", "oversized", "denim",
        "jacket", "skate",
    ],
    "party": [
        "party", "club", "night", "sequin", "gown", "cocktail", "stylish",
    ],
    "casual": [
        "casual", "jeans", "tshirt", "t-shirt", "tee", "polo", "daily",
        "regular",
    ],
}


class MockClipModel:
    is_mock = True

    def eval(self):
        return self

# ── Style labels for CLIP zero-shot classification ──
STYLE_LABELS = [
    "formal business suit outfit",
    "casual t shirt jeans outfit",
    "sports gym workout outfit",
    "indian ethnic kurta sherwani outfit",
    "streetwear hoodie outfit",
    "party wear stylish outfit",
]


def _get_clip():
    """Return (model, processor), loading on first call."""
    global _clip_model, _clip_processor, _clip_dtype

    if _clip_model is not None:
        return _clip_model, _clip_processor

    with _load_lock:
        if _clip_model is not None:
            return _clip_model, _clip_processor

        started_at = time.perf_counter()
        print("STARTING CLIP LOAD", flush=True)
        print("[ai-service] CLIP model load start.", flush=True)
        os.environ["HF_HOME"] = HF_CACHE_DIR
        os.environ["TRANSFORMERS_CACHE"] = HF_CACHE_DIR
        os.makedirs(HF_CACHE_DIR, exist_ok=True)
        print("RAM BEFORE LOAD:", psutil.virtual_memory(), flush=True)

        def enable_mock_clip(exc):
            global _clip_model, _clip_processor, _clip_dtype
            print("[ai-service] Falling back to MOCK CLIP predictor after load failure.", flush=True)
            print("[ai-service] MOCK CLIP root cause:", str(exc), flush=True)
            _clip_model = MockClipModel()
            _clip_processor = None
            _clip_dtype = None
            gc.collect()
            print("RAM AFTER LOAD:", psutil.virtual_memory(), flush=True)
            return _clip_model, _clip_processor

        if not ENABLE_HEAVY_CLIP:
            return enable_mock_clip(RuntimeError("Real CLIP loading is disabled. Set AI_ENABLE_HEAVY_CLIP=true to enable it."))

        try:
            import torch
            from transformers import CLIPModel, CLIPProcessor

            torch.set_num_threads(1)
            model_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
            if model_dtype == torch.float32:
                print("[ai-service] CPU environment detected; loading CLIP with float32 to avoid CPU float16 failures.", flush=True)

            print("DOWNLOADING PROCESSOR...", flush=True)
            _clip_processor = CLIPProcessor.from_pretrained(
                MODEL_NAME,
                cache_dir=HF_CACHE_DIR,
            )
            print("DOWNLOADING MODEL...", flush=True)
            model = CLIPModel.from_pretrained(
                MODEL_NAME,
                torch_dtype=model_dtype,
                cache_dir=HF_CACHE_DIR,
            )
            model.eval()
            _clip_model = model
            _clip_dtype = model_dtype

            gc.collect()
            print("RAM AFTER LOAD:", psutil.virtual_memory(), flush=True)
            duration_ms = (time.perf_counter() - started_at) * 1000
            print("CLIP LOAD SUCCESS", flush=True)
            print(f"[ai-service] CLIP model load success in {duration_ms:.2f} ms.", flush=True)
        except MemoryError as exc:
            duration_ms = (time.perf_counter() - started_at) * 1000
            print("CLIP LOAD FAILED:", str(exc), flush=True)
            print(f"[ai-service] CLIP model load memory failure after {duration_ms:.2f} ms: {exc}", flush=True)
            traceback.print_exc()
            return enable_mock_clip(exc)
        except TimeoutError as exc:
            duration_ms = (time.perf_counter() - started_at) * 1000
            print("CLIP LOAD FAILED:", str(exc), flush=True)
            print(f"[ai-service] CLIP model load timeout after {duration_ms:.2f} ms: {exc}", flush=True)
            traceback.print_exc()
            return enable_mock_clip(exc)
        except Exception as exc:
            duration_ms = (time.perf_counter() - started_at) * 1000
            print("CLIP LOAD FAILED:", str(exc), flush=True)
            message = str(exc).lower()
            if any(term in message for term in ["memory", "out of memory", "oom", "allocation"]):
                print(f"[ai-service] CLIP model load memory-related failure after {duration_ms:.2f} ms: {exc}", flush=True)
            elif any(term in message for term in ["timeout", "timed out", "read timed out"]):
                print(f"[ai-service] CLIP model load timeout-related failure after {duration_ms:.2f} ms: {exc}", flush=True)
            else:
                print(f"[ai-service] CLIP model load failed after {duration_ms:.2f} ms: {exc}", flush=True)
            traceback.print_exc()
            return enable_mock_clip(exc)

        return _clip_model, _clip_processor


def is_clip_loaded():
    return _clip_model is not None


def is_mock_clip_loaded():
    return isinstance(_clip_model, MockClipModel)


def is_real_clip_loaded():
    return _clip_model is not None and _clip_processor is not None and not is_mock_clip_loaded()


# -------------------------------
# PERSON DETECTION (center-crop)
# -------------------------------
def extract_person_region(image_pil):
    """Extract the likely clothing region via center crop.

    Replaces YOLO person detection to avoid ultralytics memory overhead.
    """
    image = np.array(image_pil)
    image_bgr = image[:, :, ::-1]

    h, w = image_bgr.shape[:2]
    return image_bgr[int(h * 0.15):int(h * 0.85), int(w * 0.2):int(w * 0.8)]


def _keyword_style_scores(filename):
    name = filename.lower().replace("_", " ").replace("-", " ")
    scores = {category: 0.0 for category in STYLE_BY_CATEGORY}

    for category, keywords in STYLE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in name:
                scores[category] += 3.0

    return scores


def _image_style_scores(image_pil):
    region = extract_person_region(image_pil)
    region = cv2.resize(region, (160, 160))
    hsv = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)

    saturation = float(np.mean(hsv[:, :, 1]) / 255)
    brightness = float(np.mean(hsv[:, :, 2]) / 255)
    dark_share = float(np.mean(gray < 65))
    light_share = float(np.mean(gray > 190))
    edges = cv2.Canny(gray, 80, 160)
    edge_density = float(np.mean(edges > 0))
    b, g, r = [float(value) / 255 for value in np.mean(region, axis=(0, 1))]

    scores = {category: 0.0 for category in STYLE_BY_CATEGORY}
    scores["casual"] += 0.8

    if dark_share > 0.28 and saturation < 0.35:
        scores["formal"] += 1.6
    if light_share > 0.35 and saturation < 0.28:
        scores["formal"] += 0.7
    if saturation > 0.42 and brightness > 0.45:
        scores["sports"] += 1.0
        scores["ethnic"] += 0.7
    if edge_density > 0.095:
        scores["sports"] += 0.5
        scores["streetwear"] += 0.5
    if dark_share > 0.20 and saturation > 0.35:
        scores["party"] += 0.8
    if b > r + 0.08 and b > g + 0.04:
        scores["streetwear"] += 0.8
        scores["casual"] += 0.5
    if r > 0.38 and g > 0.28 and saturation > 0.35:
        scores["ethnic"] += 0.8
    if brightness > 0.58 and 0.18 < saturation < 0.45:
        scores["casual"] += 0.6

    return scores


def classify_lightweight_style(image_pil, filename=""):
    scores = _keyword_style_scores(filename)
    image_scores = _image_style_scores(image_pil)

    for category, score in image_scores.items():
        scores[category] += score

    best_category, best_score = max(scores.items(), key=lambda item: item[1])
    if best_score < 1.2:
        best_category = "casual"

    print("[ai-service] Lightweight style scores:", scores, flush=True)
    return STYLE_BY_CATEGORY[best_category]


# -------------------------------
# CLIP STYLE
# -------------------------------
def classify_style(image_pil, filename=""):
    started_at = time.perf_counter()
    print("[ai-service] CLIP inference start.", flush=True)
    model, processor = _get_clip()

    try:
        if isinstance(model, MockClipModel):
            print("[ai-service] Lightweight style inference active.", flush=True)
            return classify_lightweight_style(image_pil, filename)

        inputs = processor(
            text=STYLE_LABELS,
            images=image_pil,
            return_tensors="pt",
            padding=True,
        )

        # Cast pixel values to match the model dtype.
        if "pixel_values" in inputs:
            import torch

            inputs["pixel_values"] = inputs["pixel_values"].to(_clip_dtype or torch.float32)

        with torch.inference_mode():
            outputs = model(**inputs)

        probs = outputs.logits_per_image.softmax(dim=1)[0].float().cpu().numpy()
        idx = int(np.argmax(probs))
        style = STYLE_LABELS[idx]

        del inputs, outputs
        gc.collect()

        duration_ms = (time.perf_counter() - started_at) * 1000
        print(f"[ai-service] CLIP inference success in {duration_ms:.2f} ms. style={style}", flush=True)
        return style
    except MemoryError as exc:
        duration_ms = (time.perf_counter() - started_at) * 1000
        print(f"[ai-service] CLIP inference memory failure after {duration_ms:.2f} ms: {exc}", flush=True)
        traceback.print_exc()
        raise
    except TimeoutError as exc:
        duration_ms = (time.perf_counter() - started_at) * 1000
        print(f"[ai-service] CLIP inference timeout after {duration_ms:.2f} ms: {exc}", flush=True)
        traceback.print_exc()
        raise
    except Exception as exc:
        duration_ms = (time.perf_counter() - started_at) * 1000
        message = str(exc).lower()
        if any(term in message for term in ["memory", "out of memory", "oom", "allocation"]):
            print(f"[ai-service] CLIP inference memory-related failure after {duration_ms:.2f} ms: {exc}", flush=True)
        elif any(term in message for term in ["timeout", "timed out", "read timed out"]):
            print(f"[ai-service] CLIP inference timeout-related failure after {duration_ms:.2f} ms: {exc}", flush=True)
        else:
            print(f"[ai-service] CLIP inference failed after {duration_ms:.2f} ms: {exc}", flush=True)
        traceback.print_exc()
        raise


# -------------------------------
# COLOR DETECTION
# -------------------------------
def detect_color(image_pil):
    person = extract_person_region(image_pil)

    region = cv2.resize(person, (100, 100))
    pixels = region.reshape((-1, 3))

    # remove noise
    pixels = pixels[(pixels.mean(axis=1) > 40) & (pixels.mean(axis=1) < 220)]

    if len(pixels) == 0:
        pixels = region.reshape((-1, 3))

    kmeans = KMeans(n_clusters=3, n_init=10)
    kmeans.fit(pixels)

    b, g, r = kmeans.cluster_centers_[0]

    if r > 180 and g > 180 and b > 180:
        return "white"
    elif r < 80 and g < 80 and b < 80:
        return "black"
    elif r > 150 and g < 100:
        return "red"
    elif g > 150:
        return "green"
    elif b > 150:
        return "blue"
    elif r > 120 and g > 80:
        return "brown"
    else:
        return "grey"


# -------------------------------
# CATEGORY MAPPING
# -------------------------------
def map_category(style, filename):
    name = filename.lower()

    if any(term in name for term in ["kurta", "sherwani", "saree", "sari", "lehenga", "ethnic", "traditional"]):
        return "ethnic"

    if any(term in name for term in ["suit", "blazer", "formal", "office", "business"]):
        return "formal"

    if any(term in name for term in ["gym", "sport", "sports", "workout", "running", "athletic", "training"]):
        return "sports"

    if "formal" in style:
        return "formal"
    elif "sports" in style:
        return "sports"
    elif "ethnic" in style:
        return "ethnic"
    else:
        return "casual"


# -------------------------------
# MAIN CLASS
# -------------------------------
class OutfitPredictor:
    @property
    def model(self):
        return _clip_model

    def load_model(self):
        _get_clip()
        return self

    def predict_from_bytes(self, image_bytes, filename=""):
        started_at = time.perf_counter()
        print(f"[ai-service] Outfit prediction start. filename={filename}", flush=True)

        try:
            image = Image.open(BytesIO(image_bytes)).convert("RGB")

            style = classify_style(image, filename)
            print("STYLE:", style, flush=True)

            color = detect_color(image)
            print("COLOR:", color, flush=True)

            category = map_category(style, filename)
            print("CATEGORY:", category, flush=True)

            duration_ms = (time.perf_counter() - started_at) * 1000
            print(f"[ai-service] Outfit prediction success in {duration_ms:.2f} ms.", flush=True)

            return {
                "style": style,
                "color": color,
                "category": category,
                "clothingType": style,
            }
        except Exception:
            duration_ms = (time.perf_counter() - started_at) * 1000
            print(f"[ai-service] Outfit prediction failed after {duration_ms:.2f} ms.", flush=True)
            traceback.print_exc()
            raise
