import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from model.chatbot_model import ChatbotIntentService
from model.image_model import OutfitPredictor


def parse_csv_env(name):
    return [value.strip().rstrip("/") for value in os.getenv(name, "").split(",") if value.strip()]


app = Flask(__name__)
cors_origins = parse_csv_env("AI_SERVICE_CORS_ORIGINS") or parse_csv_env("CLIENT_URL")
CORS(app, origins=cors_origins or [])
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_UPLOAD_MB", "10")) * 1024 * 1024

chatbot_service = ChatbotIntentService()
outfit_predictor = OutfitPredictor()


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
        print("Image received:", file.filename)
        result = outfit_predictor.predict_from_bytes(file.read(), filename=file.filename)
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
