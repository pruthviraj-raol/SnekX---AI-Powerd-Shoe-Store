import os
import gc

# ── Suppress heavy library side-effects BEFORE any imports ──
os.environ.setdefault("MPLBACKEND", "Agg")
os.environ.setdefault("MPLCONFIGDIR", "/tmp/mpl")
os.environ.setdefault("YOLO_VERBOSE", "false")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from flask import Flask, jsonify, request
from flask_cors import CORS


def parse_csv_env(name):
    return [value.strip().rstrip("/") for value in os.getenv(name, "").split(",") if value.strip()]


app = Flask(__name__)
cors_origins = parse_csv_env("AI_SERVICE_CORS_ORIGINS") or parse_csv_env("CLIENT_URL")
CORS(app, origins=cors_origins or [])
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_UPLOAD_MB", "10")) * 1024 * 1024

# ── Lightweight chatbot loads immediately (sklearn only, <5 MB) ──
from model.chatbot_model import ChatbotIntentService

chatbot_service = ChatbotIntentService()

# ── Heavy image models are lazy-loaded on first request ──
_outfit_predictor = None


def _get_outfit_predictor():
    global _outfit_predictor
    if _outfit_predictor is None:
        from model.image_model import OutfitPredictor

        _outfit_predictor = OutfitPredictor()
        gc.collect()
    return _outfit_predictor


@app.get("/health")
def health_check():
    return jsonify(
        {
            "status": "ok",
            "service": "snekx-ai-service",
            "endpoints": ["/chat", "/predict-outfit"],
        }
    )


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
    print("===== NEW REQUEST =====")

    if "image" not in request.files:
        return jsonify({"error": "An image file is required in the 'image' field."}), 400

    file = request.files["image"]

    if not file.filename:
        return jsonify({"error": "An image file is required in the 'image' field."}), 400

    try:
        predictor = _get_outfit_predictor()
        print("Image received:", file.filename)
        result = predictor.predict_from_bytes(file.read(), filename=file.filename)
        style = result.get("style", "")
        color = result.get("color", "")
        category = result.get("category", "")

        print("CLIP STYLE:", style)
        print("DETECTED COLOR:", color)
        print("FINAL CATEGORY:", category)

        return jsonify(
            {
                "style": style,
                "color": color,
                "category": category,
            }
        )
    except ValueError as exc:
        print("Prediction error:", exc)
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        print("Prediction error:", exc)
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        print("Prediction error:", exc)
        return jsonify({"error": "Failed to process the request."}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
