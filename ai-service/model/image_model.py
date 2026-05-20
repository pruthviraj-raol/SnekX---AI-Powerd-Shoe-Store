"""Outfit prediction via CLIP style classification and color detection.

All heavy models (CLIP) are lazy-loaded on first use to keep the Flask
process under Render free-tier 512 MB RAM limit.

Key optimizations:
- CLIP loaded in float16 (~300 MB vs ~600 MB in float32)
- low_cpu_mem_usage=True prevents peak-memory spikes during loading
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
from PIL import Image
from sklearn.cluster import KMeans

# ── Lazy-loaded globals ──
_clip_model = None
_clip_processor = None
_clip_dtype = None
_load_lock = threading.Lock()
MODEL_NAME = "openai/clip-vit-base-patch32"
HF_CACHE_DIR = "/tmp/huggingface"

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

        try:
            import torch
            from transformers import CLIPModel, CLIPProcessor

            torch.set_num_threads(1)
            model_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
            if model_dtype == torch.float32:
                print("[ai-service] CPU environment detected; loading CLIP with float32 to avoid CPU float16 failures.", flush=True)

            _clip_processor = CLIPProcessor.from_pretrained(
                MODEL_NAME,
                cache_dir=HF_CACHE_DIR,
            )
            model = CLIPModel.from_pretrained(
                MODEL_NAME,
                torch_dtype=model_dtype,
                low_cpu_mem_usage=True,
                cache_dir=HF_CACHE_DIR,
            )
            model.eval()
            _clip_model = model
            _clip_dtype = model_dtype

            gc.collect()
            duration_ms = (time.perf_counter() - started_at) * 1000
            print("CLIP LOAD SUCCESS", flush=True)
            print(f"[ai-service] CLIP model load success in {duration_ms:.2f} ms.", flush=True)
        except MemoryError as exc:
            duration_ms = (time.perf_counter() - started_at) * 1000
            print("CLIP LOAD FAILED:", str(exc), flush=True)
            print(f"[ai-service] CLIP model load memory failure after {duration_ms:.2f} ms: {exc}", flush=True)
            traceback.print_exc()
            raise
        except TimeoutError as exc:
            duration_ms = (time.perf_counter() - started_at) * 1000
            print("CLIP LOAD FAILED:", str(exc), flush=True)
            print(f"[ai-service] CLIP model load timeout after {duration_ms:.2f} ms: {exc}", flush=True)
            traceback.print_exc()
            raise
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
            raise

        return _clip_model, _clip_processor


def is_clip_loaded():
    return _clip_model is not None and _clip_processor is not None


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


# -------------------------------
# CLIP STYLE
# -------------------------------
def classify_style(image_pil):
    import torch

    started_at = time.perf_counter()
    print("[ai-service] CLIP inference start.", flush=True)
    model, processor = _get_clip()

    try:
        inputs = processor(
            text=STYLE_LABELS,
            images=image_pil,
            return_tensors="pt",
            padding=True,
        )

        # Cast pixel values to match the model dtype.
        if "pixel_values" in inputs:
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

    if "kurta" in name or "sherwani" in name:
        return "ethnic"

    if "suit" in name or "blazer" in name:
        return "formal"

    if "gym" in name or "sport" in name:
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

    def load_model(self):
        _get_clip()
        return self

    def predict_from_bytes(self, image_bytes, filename=""):
        started_at = time.perf_counter()
        print(f"[ai-service] Outfit prediction start. filename={filename}", flush=True)

        try:
            image = Image.open(BytesIO(image_bytes)).convert("RGB")

            style = classify_style(image)
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
