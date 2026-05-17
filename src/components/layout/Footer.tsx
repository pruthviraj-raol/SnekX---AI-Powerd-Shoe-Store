import { Link } from "react-router-dom";
import { Instagram, Twitter, Youtube } from "lucide-react";

const Footer = () => (
  <footer className="border-t border-border bg-card/50 mt-20">
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="font-heading text-xl font-bold gradient-text mb-4">SNEKX</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            AI-powered sneaker marketplace. Discover your perfect pair with intelligent recommendations.
          </p>
        </div>
        <div>
          <h4 className="font-heading font-semibold mb-3">Shop</h4>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <Link to="/products" className="hover:text-primary transition-colors">All Shoes</Link>
            <Link to="/products?category=sports" className="hover:text-primary transition-colors">Sports</Link>
            <Link to="/products?category=casual" className="hover:text-primary transition-colors">Casual</Link>
            <Link to="/products" className="hover:text-primary transition-colors">New Arrivals</Link>
          </div>
        </div>
          <div>
            <h4 className="font-heading font-semibold mb-3">Company</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/about" className="hover:text-primary transition-colors">About Us</Link>
              <Link to="/contact" className="hover:text-primary transition-colors">Contact Us</Link>
              <Link to="/outfit-recommendation" className="hover:text-primary transition-colors">AI Stylist</Link>
              <span className="hover:text-primary transition-colors cursor-pointer">Returns</span>
            </div>
          </div>
        <div>
          <h4 className="font-heading font-semibold mb-3">Follow Us</h4>
          <div className="flex gap-3">
            <span className="p-2 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
              <Instagram className="w-4 h-4" />
            </span>
            <span className="p-2 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
              <Twitter className="w-4 h-4" />
            </span>
            <span className="p-2 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
              <Youtube className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>
      <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
        © 2026 SnekX. All rights reserved. Powered by AI.
      </div>
    </div>
  </footer>
);

export default Footer;
