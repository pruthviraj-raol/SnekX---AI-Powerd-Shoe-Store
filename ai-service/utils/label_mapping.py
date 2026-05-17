CLOTHING_KEYWORDS = {
    "t-shirt": ("t-shirt", "tee shirt", "jersey", "sweatshirt"),
    "jeans": ("jean", "denim", "overall"),
    "dress": ("gown", "dress"),
    "jacket": ("trench coat", "lab coat", "cardigan", "jacket"),
    "shirt": ("apron", "shirt", "polo"),
    "shorts": ("swimming trunks", "maillot"),
    "skirt": ("miniskirt",),
    "shoe": ("running shoe", "loafer", "sandal", "boot", "shoe", "sneaker"),
}


def map_imagenet_predictions_to_clothing_type(predictions):
    for _, label, _ in predictions:
        normalized_label = label.lower().replace("_", " ")

        for clothing_type, keywords in CLOTHING_KEYWORDS.items():
            if any(keyword in normalized_label for keyword in keywords):
                return clothing_type

    return "casual wear"
