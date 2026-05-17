import cv2
import numpy as np
from sklearn.cluster import KMeans

NEUTRAL_COLORS = {"black", "white", "grey"}

def detect_dominant_color(image, clusters=3):
    return analyze_color_profile(image, clusters=clusters)["dominant_color"]


def analyze_color_profile(image, clusters=3):
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    clothing_region = _extract_clothing_region(rgb_image)
    resized = _resize_for_clustering(clothing_region)
    pixels = resized.reshape(-1, 3)
    filtered_pixels = _filter_extreme_pixels(pixels)

    if len(filtered_pixels):
        pixels = filtered_pixels

    unique_pixels = np.unique(pixels, axis=0)
    cluster_count = max(1, min(clusters, len(unique_pixels)))

    if cluster_count == 1:
        dominant_rgb = unique_pixels[0]
        cluster_centers = np.array([dominant_rgb], dtype=np.float32)
        label_counts = np.array([len(pixels)], dtype=np.int32)
    else:
        kmeans = KMeans(n_clusters=cluster_count, n_init=10, random_state=42)
        labels = kmeans.fit_predict(pixels)
        dominant_cluster = np.bincount(labels).argmax()
        dominant_rgb = kmeans.cluster_centers_[dominant_cluster]
        cluster_centers = kmeans.cluster_centers_
        label_counts = np.bincount(labels, minlength=cluster_count)

    color_counts = {}
    total_pixels = max(1, int(label_counts.sum()))

    for index, pixel_count in enumerate(label_counts):
        color_name = _map_rgb_to_color_name(cluster_centers[index])
        color_counts[color_name] = color_counts.get(color_name, 0) + int(pixel_count)

    palette = [
        {
            "color": color_name,
            "share": round(pixel_count / total_pixels, 4),
        }
        for color_name, pixel_count in sorted(color_counts.items(), key=lambda item: item[1], reverse=True)
    ]
    neutral_share = round(
        sum(pixel_count for color_name, pixel_count in color_counts.items() if color_name in NEUTRAL_COLORS)
        / total_pixels,
        4,
    )
    dominant_rgb = np.clip(np.rint(dominant_rgb), 0, 255).astype(int).tolist()

    return {
        "dominant_color": _map_rgb_to_color_name(dominant_rgb),
        "rgb": {
            "r": int(dominant_rgb[0]),
            "g": int(dominant_rgb[1]),
            "b": int(dominant_rgb[2]),
        },
        "palette": palette,
        "neutral_share": neutral_share,
    }


def _resize_for_clustering(rgb_image):
    return cv2.resize(rgb_image, (100, 100), interpolation=cv2.INTER_AREA)


def _extract_clothing_region(rgb_image):
    height, width = rgb_image.shape[:2]
    top = min(height - 1, max(0, int(height * 0.3)))
    bottom = min(height, max(top + 1, int(height * 0.8)))
    left = min(width - 1, max(0, int(width * 0.3)))
    right = min(width, max(left + 1, int(width * 0.7)))
    crop = rgb_image[top:bottom, left:right]

    if crop.size == 0:
        return rgb_image

    return crop


def _filter_extreme_pixels(pixels):
    if len(pixels) == 0:
        return pixels

    brightness = pixels.mean(axis=1)
    filtered_pixels = pixels[(brightness > 30) & (brightness < 220)]
    return filtered_pixels if len(filtered_pixels) else pixels


def _map_rgb_to_color_name(rgb_values):
    rgb_array = np.uint8([[np.clip(rgb_values, 0, 255)]])
    hsv = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2HSV)[0][0]

    hue = int(hsv[0]) * 2
    saturation = int(hsv[1])
    value = int(hsv[2])

    if value < 45:
        return "black"
    if saturation < 30 and value > 210:
        return "white"
    if saturation < 40:
        return "grey"
    if 10 <= hue < 25 and value < 170:
        return "brown"
    if hue < 10 or hue >= 345:
        return "red"
    if hue < 35:
        return "orange"
    if hue < 70:
        return "yellow"
    if hue < 165:
        return "green"
    if hue < 255:
        return "blue"
    if hue < 320:
        return "purple"
    return "pink"
