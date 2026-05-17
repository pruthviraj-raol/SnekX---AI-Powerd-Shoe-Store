const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const Product = require("./models/Product");
const User = require("./models/User");
const Order = require("./models/Order");
const AIEvent = require("./models/AIEvent");
const Address = require("./models/Address");
const Cart = require("./models/Cart");
const Wishlist = require("./models/Wishlist");
const SearchLog = require("./models/SearchLog");
const ChatQuery = require("./models/ChatQuery");
const ContactQuery = require("./models/ContactQuery");
const { buildAIEventProductSnapshot } = require("./services/aiEventSnapshotService");

dotenv.config({ path: path.join(__dirname, ".env") });

const SEEDED_PASSWORD = "Password123!";
const SEEDED_PASSWORD_HASH = "$2a$10$kTqWnhxkkMx6dD0R/X4Z7.UE/kXBpX4wqG4ci1TIK8GcbI3iQjZzm";

const products = [
  {
    name: "Nike Air Max Pulse",
    brand: "Nike",
    category: "sports",
    type: "running",
    description: "Modern Nike running shoe with soft cushioning, breathable mesh, and dependable everyday support.",
    price: 12999,
    originalPrice: 14999,
    sizes: [7, 8, 9, 10],
    colors: ["black", "white"],
    image: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.5,
    numReviews: 120,
    stock: 20,
    tags: ["Air Max", "Breathable Mesh", "Road Running"],
    isTrending: true,
  },
  {
    name: "Adidas Ultraboost 22",
    brand: "Adidas",
    category: "sports",
    type: "running",
    description: "Responsive Adidas running shoe with plush cushioning and a lightweight knit upper.",
    price: 14999,
    originalPrice: 16999,
    sizes: [7, 8, 9, 10],
    colors: ["white", "blue"],
    image: "https://images.unsplash.com/photo-1528701800489-20be3c1f9c69?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1528701800489-20be3c1f9c69?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.7,
    numReviews: 200,
    stock: 15,
    tags: ["Boost", "Long Distance", "Energy Return"],
    isTrending: true,
  },
  {
    name: "Puma RS-X Lifestyle",
    brand: "Puma",
    category: "casual",
    type: "lifestyle",
    description: "Chunky Puma lifestyle sneaker with retro streetwear styling and all-day comfort.",
    price: 7999,
    originalPrice: 9499,
    sizes: [6, 7, 8, 9, 10],
    colors: ["red", "black"],
    image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.3,
    numReviews: 90,
    stock: 25,
    tags: ["Streetwear", "Retro", "Lifestyle"],
    isNew: true,
  },
  {
    name: "Clarks Formal Derby",
    brand: "Clarks",
    category: "formal",
    type: "lifestyle",
    description: "Classic Clarks derby shoe with polished leather finish for office and occasion wear.",
    price: 6999,
    originalPrice: 8299,
    sizes: [7, 8, 9, 10],
    colors: ["brown", "black"],
    image: "https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.2,
    numReviews: 60,
    stock: 10,
    tags: ["Leather", "Office", "Derby"],
  },
  {
    name: "New Balance 574 Core",
    brand: "New Balance",
    category: "casual",
    type: "lifestyle",
    description: "Timeless New Balance everyday sneaker with suede panels and cushioned underfoot feel.",
    price: 8999,
    originalPrice: 9999,
    sizes: [7, 8, 9, 10],
    colors: ["grey", "blue"],
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1518002171953-a080ee817e1f?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.4,
    numReviews: 145,
    stock: 18,
    tags: ["Suede", "Everyday", "Classic"],
  },
  {
    name: "Reebok Floatride Energy 5",
    brand: "Reebok",
    category: "sports",
    type: "running",
    description: "Versatile Reebok running shoe with lightweight cushioning and smooth heel-to-toe transitions.",
    price: 9999,
    originalPrice: 11999,
    sizes: [7, 8, 9, 10],
    colors: ["blue", "white"],
    image: "https://images.unsplash.com/photo-1519744346365-3e6e7f1d7e2b?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1519744346365-3e6e7f1d7e2b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.4,
    numReviews: 84,
    stock: 16,
    tags: ["Training Run", "Lightweight", "Foam Cushioning"],
  },
  {
    name: "ASICS Gel-Kayano 30",
    brand: "ASICS",
    category: "sports",
    type: "running",
    description: "Premium stability running shoe designed for comfort, support, and long-distance training.",
    price: 15999,
    originalPrice: 17999,
    sizes: [7, 8, 9, 10],
    colors: ["blue", "white"],
    image: "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1519744346365-3e6e7f1d7e2b?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.8,
    numReviews: 215,
    stock: 12,
    tags: ["Stability", "Gel Cushioning", "Marathon"],
    isTrending: true,
  },
  {
    name: "Under Armour HOVR Machina",
    brand: "Under Armour",
    category: "sports",
    type: "running",
    description: "Performance running shoe with a snug fit, responsive ride, and durable outsole grip.",
    price: 11999,
    originalPrice: 13999,
    sizes: [7, 8, 9, 10],
    colors: ["black", "red"],
    image: "https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.4,
    numReviews: 76,
    stock: 14,
    tags: ["HOVR", "Responsive", "Road Running"],
  },
  {
    name: "Nike Metcon 9",
    brand: "Nike",
    category: "sports",
    type: "training",
    description: "Stable Nike training shoe built for lifting, HIIT sessions, and high-grip indoor workouts.",
    price: 10999,
    originalPrice: 12499,
    sizes: [7, 8, 9, 10],
    colors: ["black", "white"],
    image: "https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.6,
    numReviews: 135,
    stock: 19,
    tags: ["Cross Training", "Gym", "Stable Heel"],
    isTrending: true,
  },
  {
    name: "Adidas Dropset Trainer",
    brand: "Adidas",
    category: "sports",
    type: "training",
    description: "Structured Adidas gym trainer with wide base support and durable sidewall grip.",
    price: 8999,
    originalPrice: 10499,
    sizes: [7, 8, 9, 10],
    colors: ["black", "white"],
    image: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.3,
    numReviews: 82,
    stock: 17,
    tags: ["Training", "Wide Base", "HIIT"],
  },
  {
    name: "Puma Fuse 3.0",
    brand: "Puma",
    category: "sports",
    type: "training",
    description: "Low-profile Puma training shoe with flexible forefoot and secure lockdown for intense sessions.",
    price: 8499,
    originalPrice: 9699,
    sizes: [7, 8, 9, 10],
    colors: ["black", "red"],
    image: "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1528701800489-20be3c1f9c69?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.2,
    numReviews: 68,
    stock: 20,
    tags: ["Training", "Flexible", "Grip"],
  },
  {
    name: "Reebok Nano X3",
    brand: "Reebok",
    category: "sports",
    type: "training",
    description: "Multi-purpose Reebok trainer ideal for circuits, strength sessions, and functional fitness.",
    price: 9999,
    originalPrice: 11499,
    sizes: [7, 8, 9, 10],
    colors: ["white", "blue"],
    image: "https://images.unsplash.com/photo-1605348532760-6753d2c43329?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1605348532760-6753d2c43329?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.5,
    numReviews: 101,
    stock: 13,
    tags: ["Training", "Functional Fitness", "Durable"],
  },
  {
    name: "Vans Old Skool",
    brand: "Vans",
    category: "casual",
    type: "lifestyle",
    description: "Iconic low-top Vans sneaker with durable canvas, suede overlays, and classic skate heritage.",
    price: 2999,
    originalPrice: 3999,
    sizes: [6, 7, 8, 9, 10],
    colors: ["black", "white"],
    image: "https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.6,
    numReviews: 260,
    stock: 30,
    tags: ["Skate", "Canvas", "Classic"],
    isTrending: true,
  },
  {
    name: "Converse Chuck Taylor All Star",
    brand: "Converse",
    category: "casual",
    type: "lifestyle",
    description: "Timeless Converse high-top sneaker with canvas upper and versatile everyday style.",
    price: 3499,
    originalPrice: 4499,
    sizes: [6, 7, 8, 9, 10],
    colors: ["white", "red"],
    image: "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1518002171953-a080ee817e1f?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.5,
    numReviews: 320,
    stock: 28,
    tags: ["High Top", "Canvas", "Everyday"],
  },
  {
    name: "New Balance 327",
    brand: "New Balance",
    category: "casual",
    type: "lifestyle",
    description: "Retro-inspired New Balance sneaker with bold paneling and lightweight lifestyle comfort.",
    price: 9499,
    originalPrice: 10999,
    sizes: [7, 8, 9, 10],
    colors: ["green", "white"],
    image: "https://images.unsplash.com/photo-1518002171953-a080ee817e1f?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1518002171953-a080ee817e1f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.4,
    numReviews: 118,
    stock: 16,
    tags: ["Retro", "Lifestyle", "Suede"],
  },
  {
    name: "Skechers Go Walk Flex",
    brand: "Skechers",
    category: "casual",
    type: "lifestyle",
    description: "Slip-on Skechers walking shoe with soft cushioning and lightweight all-day comfort.",
    price: 4999,
    originalPrice: 5999,
    sizes: [6, 7, 8, 9, 10],
    colors: ["grey", "black"],
    image: "https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.3,
    numReviews: 88,
    stock: 22,
    tags: ["Walking", "Comfort", "Slip-On"],
  },
  {
    name: "Nike Court Vision Low",
    brand: "Nike",
    category: "casual",
    type: "lifestyle",
    description: "Basketball-inspired Nike low-top with clean lines, leather overlays, and easy daily wear.",
    price: 6999,
    originalPrice: 7999,
    sizes: [7, 8, 9, 10],
    colors: ["white", "black"],
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.4,
    numReviews: 154,
    stock: 24,
    tags: ["Court Style", "Leather", "Low Top"],
  },
  {
    name: "Adidas Forum Low",
    brand: "Adidas",
    category: "casual",
    type: "lifestyle",
    description: "Heritage Adidas sneaker with classic paneling and premium streetwear-inspired finish.",
    price: 8499,
    originalPrice: 9999,
    sizes: [7, 8, 9, 10],
    colors: ["white", "blue"],
    image: "https://images.unsplash.com/photo-1528701800489-20be3c1f9c69?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1528701800489-20be3c1f9c69?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.4,
    numReviews: 112,
    stock: 21,
    tags: ["Retro", "Streetwear", "Low Top"],
  },
  {
    name: "Bata Office Oxford",
    brand: "Bata",
    category: "formal",
    type: "lifestyle",
    description: "Reliable Bata oxford with polished finish and cushioned footbed for long office days.",
    price: 4999,
    originalPrice: 5999,
    sizes: [7, 8, 9, 10],
    colors: ["black", "brown"],
    image: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.1,
    numReviews: 75,
    stock: 19,
    tags: ["Office", "Oxford", "Formal"],
  },
  {
    name: "Cole Haan Grand Crosscourt",
    brand: "Cole Haan",
    category: "formal",
    type: "lifestyle",
    description: "Refined Cole Haan sneaker-derby hybrid suited for smart casual and business outfits.",
    price: 11999,
    originalPrice: 13999,
    sizes: [7, 8, 9, 10],
    colors: ["tan", "brown"],
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.6,
    numReviews: 98,
    stock: 11,
    tags: ["Smart Casual", "Leather", "Premium"],
  },
  {
    name: "Hush Puppies Expert PT",
    brand: "Hush Puppies",
    category: "formal",
    type: "lifestyle",
    description: "Comfort-focused formal shoe with soft leather upper and flexible outsole for long wear.",
    price: 7499,
    originalPrice: 8999,
    sizes: [7, 8, 9, 10],
    colors: ["brown", "black"],
    image: "https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.3,
    numReviews: 82,
    stock: 13,
    tags: ["Comfort", "Leather", "Formal"],
  },
  {
    name: "Aldo Stessy Derby",
    brand: "Aldo",
    category: "formal",
    type: "lifestyle",
    description: "Sharp Aldo derby for parties, events, and smart evening looks with polished styling.",
    price: 8999,
    originalPrice: 10499,
    sizes: [7, 8, 9, 10],
    colors: ["black", "tan"],
    image: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.2,
    numReviews: 67,
    stock: 12,
    tags: ["Party", "Formal", "Derby"],
  },
  {
    name: "Clarks Tilden Walk",
    brand: "Clarks",
    category: "formal",
    type: "lifestyle",
    description: "Minimal Clarks leather shoe designed for daily office wear with understated premium finish.",
    price: 7999,
    originalPrice: 9299,
    sizes: [7, 8, 9, 10],
    colors: ["tan", "brown"],
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.4,
    numReviews: 73,
    stock: 14,
    tags: ["Office", "Leather", "Classic"],
  },
  {
    name: "Puma Palermo",
    brand: "Puma",
    category: "casual",
    type: "lifestyle",
    description: "Low-profile terrace-inspired Puma sneaker with suede finish and relaxed casual appeal.",
    price: 6499,
    originalPrice: 7499,
    sizes: [6, 7, 8, 9, 10],
    colors: ["white", "green"],
    image: "https://images.unsplash.com/photo-1519744346365-3e6e7f1d7e2b?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1519744346365-3e6e7f1d7e2b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.1,
    numReviews: 58,
    stock: 18,
    tags: ["Low Profile", "Suede", "Casual"],
    isNew: true,
  },
  {
    name: "ASICS Gel-Contend 8",
    brand: "ASICS",
    category: "sports",
    type: "running",
    description: "Comfortable entry-level ASICS runner built for daily training and easy-paced runs.",
    price: 6999,
    originalPrice: 8299,
    sizes: [7, 8, 9, 10],
    colors: ["grey", "blue"],
    image: "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1519744346365-3e6e7f1d7e2b?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.2,
    numReviews: 92,
    stock: 18,
    tags: ["Daily Run", "Gel Cushioning", "Value"],
  },
  {
    name: "Nike Revolution 7",
    brand: "Nike",
    category: "sports",
    type: "running",
    description: "Accessible Nike runner for beginners with soft foam and breathable upper.",
    price: 5999,
    originalPrice: 6999,
    sizes: [7, 8, 9, 10],
    colors: ["black", "grey"],
    image: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=1200&q=80",
    ],
    rating: 4.2,
    numReviews: 110,
    stock: 22,
    tags: ["Beginner Friendly", "Running", "Foam Cushioning"],
  },
].map((product) => ({
  ...product,
  color: product.colors[0],
  reviews: [],
  isNew: Boolean(product.isNew),
  isTrending: Boolean(product.isTrending),
}));

const users = [
  {
    name: "SnekX Admin",
    email: "admin@snekx.test",
    password: SEEDED_PASSWORD_HASH,
    role: "admin",
    status: "active",
  },
  {
    name: "Priya Rao",
    email: "priya@snekx.test",
    password: SEEDED_PASSWORD_HASH,
    role: "user",
    status: "active",
  },
  {
    name: "Arjun Patel",
    email: "arjun@snekx.test",
    password: SEEDED_PASSWORD_HASH,
    role: "user",
    status: "active",
  },
  {
    name: "Neha Sharma",
    email: "neha@snekx.test",
    password: SEEDED_PASSWORD_HASH,
    role: "user",
    status: "active",
  },
  {
    name: "Rahul Mehta",
    email: "rahul@snekx.test",
    password: SEEDED_PASSWORD_HASH,
    role: "user",
    status: "active",
  },
];

const addressSeed = [
  {
    email: "admin@snekx.test",
    fullName: "SnekX Admin",
    phone: "+1-212-555-0100",
    street: "100 Market Street",
    city: "New York",
    state: "New York",
    postalCode: "10001",
    country: "United States",
  },
  {
    email: "priya@snekx.test",
    fullName: "Priya Rao",
    phone: "+1-415-555-0111",
    street: "42 Mission Street",
    city: "San Francisco",
    state: "California",
    postalCode: "94105",
    country: "United States",
  },
  {
    email: "arjun@snekx.test",
    fullName: "Arjun Patel",
    phone: "+1-312-555-0122",
    street: "18 Lake Shore Drive",
    city: "Chicago",
    state: "Illinois",
    postalCode: "60601",
    country: "United States",
  },
  {
    email: "neha@snekx.test",
    fullName: "Neha Sharma",
    phone: "+1-713-555-0133",
    street: "9 River Oaks Lane",
    city: "Houston",
    state: "Texas",
    postalCode: "77019",
    country: "United States",
  },
  {
    email: "rahul@snekx.test",
    fullName: "Rahul Mehta",
    phone: "+1-206-555-0144",
    street: "77 Pine Street",
    city: "Seattle",
    state: "Washington",
    postalCode: "98101",
    country: "United States",
  },
];

const orderSeed = [
  {
    orderNumber: "ORD-SEED-101",
    email: "priya@snekx.test",
    items: [
      { product: "Nike Air Max Pulse", quantity: 1, size: 8, color: "black" },
      { product: "Vans Old Skool", quantity: 1, size: 7, color: "black" },
    ],
    orderStatus: "Completed",
    paymentStatus: "Paid",
    createdAt: "2026-03-01T10:15:00.000Z",
    updatedAt: "2026-03-03T16:20:00.000Z",
  },
  {
    orderNumber: "ORD-SEED-102",
    email: "arjun@snekx.test",
    items: [
      { product: "Adidas Ultraboost 22", quantity: 1, size: 9, color: "white" },
    ],
    orderStatus: "Shipped",
    paymentStatus: "Paid",
    createdAt: "2026-03-05T09:30:00.000Z",
    updatedAt: "2026-03-06T14:10:00.000Z",
  },
  {
    orderNumber: "ORD-SEED-103",
    email: "neha@snekx.test",
    items: [
      { product: "Clarks Formal Derby", quantity: 1, size: 8, color: "brown" },
    ],
    orderStatus: "Processing",
    paymentStatus: "Pending",
    createdAt: "2026-03-10T12:00:00.000Z",
    updatedAt: "2026-03-10T12:00:00.000Z",
  },
  {
    orderNumber: "ORD-SEED-104",
    email: "rahul@snekx.test",
    items: [
      { product: "Puma RS-X Lifestyle", quantity: 1, size: 9, color: "red" },
      { product: "Skechers Go Walk Flex", quantity: 1, size: 9, color: "grey" },
    ],
    orderStatus: "Completed",
    paymentStatus: "Paid",
    createdAt: "2026-03-12T11:20:00.000Z",
    updatedAt: "2026-03-15T13:05:00.000Z",
  },
  {
    orderNumber: "ORD-SEED-105",
    email: "priya@snekx.test",
    items: [
      { product: "Nike Metcon 9", quantity: 1, size: 8, color: "black" },
    ],
    orderStatus: "Cancelled",
    paymentStatus: "Refunded",
    createdAt: "2026-03-18T15:45:00.000Z",
    updatedAt: "2026-03-19T09:15:00.000Z",
  },
];

const aiEventSeed = [
  { email: "priya@snekx.test", product: "Nike Air Max Pulse", eventType: "recommendation", clicked: false, purchased: false, timestamp: "2026-03-01T09:00:00.000Z" },
  { email: "priya@snekx.test", product: "Nike Air Max Pulse", eventType: "purchase", clicked: true, purchased: true, timestamp: "2026-03-01T10:15:00.000Z" },
  { email: "arjun@snekx.test", product: "Adidas Ultraboost 22", eventType: "recommendation", clicked: false, purchased: false, timestamp: "2026-03-05T08:50:00.000Z" },
  { email: "arjun@snekx.test", product: "Adidas Ultraboost 22", eventType: "click", clicked: true, purchased: false, timestamp: "2026-03-05T08:52:00.000Z" },
  { email: "arjun@snekx.test", product: "Adidas Ultraboost 22", eventType: "purchase", clicked: true, purchased: true, timestamp: "2026-03-05T09:30:00.000Z" },
  { email: "neha@snekx.test", product: "Clarks Formal Derby", eventType: "recommendation", clicked: false, purchased: false, timestamp: "2026-03-10T11:40:00.000Z" },
  { email: "rahul@snekx.test", product: "Puma RS-X Lifestyle", eventType: "recommendation", clicked: false, purchased: false, timestamp: "2026-03-12T10:05:00.000Z" },
  { email: "rahul@snekx.test", product: "Puma RS-X Lifestyle", eventType: "click", clicked: true, purchased: false, timestamp: "2026-03-12T10:07:00.000Z" },
  { email: "rahul@snekx.test", product: "Puma RS-X Lifestyle", eventType: "purchase", clicked: true, purchased: true, timestamp: "2026-03-12T11:20:00.000Z" },
  { email: null, product: "Vans Old Skool", eventType: "recommendation", clicked: false, purchased: false, timestamp: "2026-03-20T18:00:00.000Z" },
  { email: null, product: "Converse Chuck Taylor All Star", eventType: "click", clicked: true, purchased: false, timestamp: "2026-03-20T18:02:00.000Z" },
  { email: null, product: "New Balance 574 Core", eventType: "recommendation", clicked: false, purchased: false, timestamp: "2026-03-21T12:30:00.000Z" },
];

const clearCollections = async () => {
  await Promise.all([
    AIEvent.deleteMany({}),
    Order.deleteMany({}),
    Address.deleteMany({}),
    Cart.deleteMany({}),
    Wishlist.deleteMany({}),
    SearchLog.deleteMany({}),
    ChatQuery.deleteMany({}),
    ContactQuery.deleteMany({}),
    User.deleteMany({}),
    Product.deleteMany({}),
  ]);
};

const buildOrderItems = (items, productByName) =>
  items.map((item) => {
    const product = productByName.get(item.product);

    if (!product) {
      throw new Error(`Missing product for order seed: ${item.product}`);
    }

    return {
      productId: product._id,
      name: product.name,
      brand: product.brand,
      image: product.image,
      quantity: item.quantity,
      price: product.price,
      size: item.size,
      color: item.color,
    };
  });

const seedDatabase = async () => {
  try {
    await connectDB();
    await clearCollections();

    const createdProducts = await Product.insertMany(products);
    const createdUsers = await User.insertMany(users);

    const userByEmail = new Map(createdUsers.map((user) => [user.email, user]));
    const productByName = new Map(createdProducts.map((product) => [product.name, product]));

    const createdAddresses = await Address.insertMany(
      addressSeed.map((address) => ({
        userId: userByEmail.get(address.email)._id,
        fullName: address.fullName,
        phone: address.phone,
        street: address.street,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      }))
    );

    const addressByEmail = new Map(
      createdAddresses.map((address, index) => [addressSeed[index].email, address])
    );

    const createdOrders = await Order.insertMany(
      orderSeed.map((order) => {
        const orderItems = buildOrderItems(order.items, productByName);

        return {
          userId: userByEmail.get(order.email)._id,
          orderNumber: order.orderNumber,
          products: orderItems,
          totalAmount: orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          addressId: addressByEmail.get(order.email)._id,
          createdAt: new Date(order.createdAt),
          updatedAt: new Date(order.updatedAt),
        };
      })
    );

    const createdAIEvents = await AIEvent.insertMany(
      aiEventSeed.map((event) => {
        const product = productByName.get(event.product);
        const user = event.email ? userByEmail.get(event.email) : null;

        if (!product) {
          throw new Error(`Missing product for AI event seed: ${event.product}`);
        }

        return {
          userId: user?._id || null,
          productId: product._id,
          eventType: event.eventType,
          category: product.category,
          productSnapshot: buildAIEventProductSnapshot(product),
          clicked: event.clicked,
          purchased: event.purchased,
          revenue: event.eventType === "purchase" ? product.price : 0,
          timestamp: new Date(event.timestamp),
        };
      })
    );

    console.log("Seed completed successfully.");
    console.log(`Products: ${createdProducts.length}`);
    console.log(`Users: ${createdUsers.length}`);
    console.log(`Orders: ${createdOrders.length}`);
    console.log(`AI Events: ${createdAIEvents.length}`);
    console.log(`Addresses: ${createdAddresses.length}`);
    console.log(`Seed user password: ${SEEDED_PASSWORD}`);
    console.log(`Admin email: admin@snekx.test`);
  } catch (error) {
    console.error(`Seed failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedDatabase();

