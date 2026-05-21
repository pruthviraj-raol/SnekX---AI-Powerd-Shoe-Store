import os
import gc
import sys
import time
import traceback

# ── Suppress heavy library side-effects BEFORE any imports ──
os.environ.setdefault("MPLBACKEND", "Agg")
os.environ.setdefault("MPLCONFIGDIR", "/tmp/mpl")
os.environ.setdefault("YOLO_VERBOSE", "false")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

print("PYTHON VERSION:", sys.version, flush=True)
try:
    import torch

    print("TORCH VERSION:", torch.__version__, flush=True)
    print("CUDA AVAILABLE:", torch.cuda.is_available(), flush=True)
except Exception as exc:
    print("TORCH VERSION:", f"unavailable ({exc})", flush=True)
    print("CUDA AVAILABLE:", False, flush=True)
    traceback.print_exc()

from flask import Flask, jsonify, request
from flask_cors import CORS


def parse_csv_env(name):
    return [value.strip().rstrip("/") for value in os.getenv(name, "").split(",") if value.strip()]


app = Flask(__name__)
print("USING FLASK FILE:", __file__, flush=True)
cors_origins = parse_csv_env("AI_SERVICE_CORS_ORIGINS") or parse_csv_env("CLIENT_URL")
CORS(app, origins=cors_origins or [])
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_UPLOAD_MB", "10")) * 1024 * 1024

# ── Lightweight chatbot loads immediately (sklearn only, <5 MB) ──
from model.chatbot_model import ChatbotIntentService

chatbot_service = ChatbotIntentService()

# ── Heavy image models are lazy-loaded on first request ──
_outfit_predictor = None


def get_predictor():
    global _outfit_predictor
    if _outfit_predictor is None:
        started_at = time.perf_counter()
        print("[ai-service] OutfitPredictor load start.", flush=True)
        from model.image_model import OutfitPredictor

        _outfit_predictor = OutfitPredictor()
        gc.collect()
        duration_ms = (time.perf_counter() - started_at) * 1000
        print(f"[ai-service] OutfitPredictor load success in {duration_ms:.2f} ms.", flush=True)
    return _outfit_predictor


def _get_outfit_predictor():
    return get_predictor()


def _is_image_model_loaded():
    try:
        from model.image_model import is_clip_loaded

        return _outfit_predictor is not None and is_clip_loaded()
    except Exception as exc:
        print(f"[ai-service] Failed to inspect AI health: {exc}", flush=True)
        traceback.print_exc()
        return False


def _is_mock_image_model_loaded():
    try:
        from model.image_model import is_mock_clip_loaded

        return _outfit_predictor is not None and is_mock_clip_loaded()
    except Exception as exc:
        print(f"[ai-service] Failed to inspect mock AI health: {exc}", flush=True)
        traceback.print_exc()
        return False


@app.get("/health")
def health_check():
    return jsonify(
        {
            "status": "ok",
            "service": "snekx-ai-service",
            "endpoints": ["/chat", "/predict-outfit"],
        }
    )


@app.route("/routes")
def routes():
    return {
        "routes": sorted(
            [
                str(rule)
                for rule in app.url_map.iter_rules()
            ]
        )
    }


@app.get("/health/ai")
def ai_health_check():
    return jsonify(
        {
            "modelLoaded": _is_image_model_loaded(),
            "fallbackEnabled": True,
            "memoryOptimized": True,
            "mockModelLoaded": _is_mock_image_model_loaded(),
        }
    )


@app.route("/debug/model")
def debug_model():
    try:
        predictor = get_predictor()
        predictor.load_model()
        return jsonify(
            {
                "loaded": predictor.model is not None,
                "mockModelLoaded": _is_mock_image_model_loaded(),
            }
        )
    except Exception as e:
        traceback.print_exc()
        return jsonify(
            {
                "error": str(e),
            }
        ), 500


@app.route("/warmup")
def warmup():
    try:
        predictor = get_predictor()
        predictor.load_model()
        return jsonify(
            {
                "success": True,
                "loaded": predictor.model is not None,
            }
        )
    except Exception as e:
        traceback.print_exc()
        return jsonify(
            {
                "success": False,
                "error": str(e),
            }
        ), 500


@app.post("/chat")
def chat():
    payload = request.get_json(silent=True) or {}
    message = payload.get("message", "")

    if not isinstance(message, str) or not message.strip():
        return jsonify({"error": "A non-empty 'message' field is required."}), 400

    result = chatbot_service.predict(message)
    return jsonify(result)


@app.route("/predict-outfit", methods=["POST"])
def predict_outfit():
    print("===== NEW AI IMAGE REQUEST =====", flush=True)

    if "image" not in request.files:
        return jsonify({"error": "An image file is required in the 'image' field."}), 400

    file = request.files["image"]

    if not file.filename:
        return jsonify({"error": "An image file is required in the 'image' field."}), 400

    started_at = time.perf_counter()

    try:
        predictor = _get_outfit_predictor()
        print("Image received:", file.filename, flush=True)
        print("[ai-service] Image inference request start.", flush=True)
        result = predictor.predict_from_bytes(file.read(), filename=file.filename)
        style = result.get("style", "")
        color = result.get("color", "")
        category = result.get("category", "")

        duration_ms = (time.perf_counter() - started_at) * 1000
        print("CLIP STYLE:", style, flush=True)
        print("DETECTED COLOR:", color, flush=True)
        print("FINAL CATEGORY:", category, flush=True)
        print(f"[ai-service] Image inference request success in {duration_ms:.2f} ms.", flush=True)

        return jsonify(
            {
                "style": style,
                "color": color,
                "category": category,
            }
        )
    except ValueError as exc:
        duration_ms = (time.perf_counter() - started_at) * 1000
        print(f"[ai-service] Image inference validation failure after {duration_ms:.2f} ms: {exc}", flush=True)
        traceback.print_exc()
        return jsonify({"error": str(exc)}), 400
    except MemoryError as exc:
        duration_ms = (time.perf_counter() - started_at) * 1000
        print(f"[ai-service] Image inference memory failure after {duration_ms:.2f} ms: {exc}", flush=True)
        traceback.print_exc()
        return jsonify({"error": "AI image model failed due to memory pressure."}), 503
    except TimeoutError as exc:
        duration_ms = (time.perf_counter() - started_at) * 1000
        print(f"[ai-service] Image inference timeout after {duration_ms:.2f} ms: {exc}", flush=True)
        traceback.print_exc()
        return jsonify({"error": "AI image model timed out."}), 503
    except RuntimeError as exc:
        duration_ms = (time.perf_counter() - started_at) * 1000
        message = str(exc).lower()
        if any(term in message for term in ["memory", "out of memory", "oom", "allocation"]):
            print(f"[ai-service] Image inference runtime memory-related failure after {duration_ms:.2f} ms: {exc}", flush=True)
        elif any(term in message for term in ["timeout", "timed out", "read timed out"]):
            print(f"[ai-service] Image inference runtime timeout-related failure after {duration_ms:.2f} ms: {exc}", flush=True)
        else:
            print(f"[ai-service] Image inference runtime failure after {duration_ms:.2f} ms: {exc}", flush=True)
        traceback.print_exc()
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        duration_ms = (time.perf_counter() - started_at) * 1000
        message = str(exc).lower()
        if any(term in message for term in ["memory", "out of memory", "oom", "allocation"]):
            print(f"[ai-service] Image inference memory-related failure after {duration_ms:.2f} ms: {exc}", flush=True)
        elif any(term in message for term in ["timeout", "timed out", "read timed out"]):
            print(f"[ai-service] Image inference timeout-related failure after {duration_ms:.2f} ms: {exc}", flush=True)
        else:
            print(f"[ai-service] Image inference failure after {duration_ms:.2f} ms: {exc}", flush=True)
        traceback.print_exc()
        return jsonify({"error": "Failed to process the request."}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
