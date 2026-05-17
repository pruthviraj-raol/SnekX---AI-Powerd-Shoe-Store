from io import BytesIO
import numpy as np
from PIL import Image
import cv2

# ML
from transformers import CLIPProcessor, CLIPModel
import torch
from sklearn.cluster import KMeans
from ultralytics import YOLO

# -------------------------------
# LOAD MODELS
# -------------------------------
device = "cuda" if torch.cuda.is_available() else "cpu"

clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

yolo_model = YOLO("yolov8n.pt")

# -------------------------------
# LABELS (IMPORTANT)
# -------------------------------
STYLE_LABELS = [
    "formal business suit outfit",
    "casual t shirt jeans outfit",
    "sports gym workout outfit",
    "indian ethnic kurta sherwani outfit",
    "streetwear hoodie outfit",
    "party wear stylish outfit"
]

# -------------------------------
# PERSON DETECTION
# -------------------------------
def extract_person_region(image_pil):
    image = np.array(image_pil)
    image_bgr = image[:, :, ::-1]

    try:
        results = yolo_model(image_bgr)

        for r in results:
            for box in r.boxes:
                cls = int(box.cls[0])
                if cls == 0:  # person
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    person = image_bgr[y1:y2, x1:x2]

                    if person.size > 0:
                        return person
    except:
        pass

    # fallback center crop
    h, w, _ = image_bgr.shape
    return image_bgr[int(h*0.3):int(h*0.8), int(w*0.3):int(w*0.7)]

# -------------------------------
# CLIP STYLE
# -------------------------------
def classify_style(image_pil):
    inputs = clip_processor(text=STYLE_LABELS, images=image_pil, return_tensors="pt", padding=True).to(device)

    with torch.no_grad():
        outputs = clip_model(**inputs)

    probs = outputs.logits_per_image.softmax(dim=1)[0].cpu().numpy()
    idx = np.argmax(probs)

    return STYLE_LABELS[idx]

# -------------------------------
# COLOR DETECTION (FIXED)
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

    def predict_from_bytes(self, image_bytes, filename=""):
        image = Image.open(BytesIO(image_bytes)).convert("RGB")

        print("===== NEW REQUEST =====")

        style = classify_style(image)
        print("STYLE:", style)

        color = detect_color(image)
        print("COLOR:", color)

        category = map_category(style, filename)
        print("CATEGORY:", category)

        return {
            "style": style,
            "color": color,
            "category": category,
            "clothingType": style
        }