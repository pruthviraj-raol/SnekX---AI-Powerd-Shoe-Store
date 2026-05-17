from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline


TRAINING_DATA = {
    "greeting": [
        "hi",
        "hello",
        "hey there",
        "good morning",
        "good evening",
        "how are you",
        "yo",
        "hello snekx",
    ],
    "product_search": [
        "show me running shoes",
        "i need sneakers for the gym",
        "find me black shoes",
        "do you have white sneakers",
        "recommend casual shoes",
        "i want basketball shoes",
        "show me sports footwear",
        "looking for comfortable trainers",
    ],
    "help": [
        "can you help me",
        "i need support",
        "what can you do",
        "help me with the website",
        "how does this work",
        "tell me how to shop here",
        "i need assistance",
        "how can you help",
    ],
    "order_status": [
        "where is my order",
        "track my package",
        "what is my order status",
        "has my order shipped",
        "check delivery status",
        "when will my shoes arrive",
        "i want to track my order",
        "is my order on the way",
    ],
}

DEFAULT_RESPONSES = {
    "greeting": "Hi! I can help you find shoes, answer support questions, and check order-related requests.",
    "product_search": "Here are some running shoes for you.",
    "help": "I can help with product search, outfit recommendations, and order status questions.",
    "order_status": "Please share your order ID so I can help you check the status.",
}


class ChatbotIntentService:
    def __init__(self):
        samples = []
        labels = []

        for intent, examples in TRAINING_DATA.items():
            samples.extend(examples)
            labels.extend([intent] * len(examples))

        self.pipeline = Pipeline(
            [
                ("tfidf", TfidfVectorizer(ngram_range=(1, 2), lowercase=True)),
                ("classifier", LogisticRegression(max_iter=1000)),
            ]
        )
        self.pipeline.fit(samples, labels)

    def predict(self, message):
        normalized_message = message.strip()
        intent = self.pipeline.predict([normalized_message])[0]

        return {
            "intent": intent,
            "response": self._build_response(intent, normalized_message.lower()),
        }

    def _build_response(self, intent, message):
        if intent == "product_search":
            if "running" in message:
                return "Here are some running shoes for you."
            if "basketball" in message:
                return "Here are some basketball shoes you may like."
            if "black" in message:
                return "I found black shoe options that should match your style."
            return "I found some shoe options that match your search."

        return DEFAULT_RESPONSES[intent]
