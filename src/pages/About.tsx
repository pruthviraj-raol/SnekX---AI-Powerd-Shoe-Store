import UserLayout from "@/components/layout/UserLayout";
import { motion } from "framer-motion";
import { Sparkles, Shield, Truck, Heart, Users, Target } from "lucide-react";

const values = [
  { icon: Sparkles, title: "AI-Driven Innovation", desc: "We use cutting-edge AI to match you with your perfect pair of sneakers." },
  { icon: Shield, title: "100% Authentic", desc: "Every shoe is verified authentic — no fakes, no compromises." },
  { icon: Truck, title: "Fast & Free Shipping", desc: "Free standard shipping on all orders, with express options available." },
  { icon: Heart, title: "Customer First", desc: "30-day free returns and dedicated support for every customer." },
];

const team = [
  { name: "Alex Rivera", role: "Founder & CEO", avatar: "A" },
  { name: "Sarah Chen", role: "Head of AI", avatar: "S" },
  { name: "Marcus Johnson", role: "Lead Designer", avatar: "M" },
  { name: "Priya Patel", role: "Head of Operations", avatar: "P" },
];

const stats = [
  { value: "2,500+", label: "Products" },
  { value: "100K+", label: "Customers" },
  { value: "50+", label: "Countries" },
  { value: "4.9★", label: "Rating" },
];

const About = () => {
  return (
    <UserLayout>
      {/* Hero */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto">
            <span className="text-primary font-medium text-sm tracking-widest uppercase">Our Story</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-3">
              Redefining Sneaker Shopping with <span className="gradient-text">AI</span>
            </h1>
            <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
              SnekX was born from a simple idea: finding the perfect sneakers shouldn't be hard. 
              We combine artificial intelligence with a curated collection of premium brands to deliver 
              a shopping experience that's personal, fast, and effortless.
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-14 max-w-3xl mx-auto"
          >
            {stats.map((s, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 text-center">
                <p className="font-heading text-2xl font-bold gradient-text">{s.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 bg-card/50">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10 items-center"
          >
            <div>
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-4">
                <Target className="w-3.5 h-3.5" /> Our Mission
              </div>
              <h2 className="font-heading text-3xl font-bold mb-4">Making Premium Sneakers Accessible to Everyone</h2>
              <p className="text-muted-foreground leading-relaxed">
                We believe everyone deserves to find their perfect sneaker without the hassle. Through AI-powered 
                recommendations, verified authenticity, and competitive pricing, we're making premium footwear 
                accessible to sneaker lovers worldwide.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {values.slice(0, 4).map((v, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <v.icon className="w-6 h-6 text-primary mb-2" />
                  <p className="text-sm font-semibold">{v.title}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold">Why Choose SnekX?</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {values.map((v, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-2xl p-6 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <v.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-heading font-semibold mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-16 bg-card/50">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-4">
              <Users className="w-3.5 h-3.5" /> Our Team
            </div>
            <h2 className="font-heading text-3xl font-bold">Meet the Founders</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {team.map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-2xl p-6 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 text-xl font-bold text-primary-foreground">
                  {t.avatar}
                </div>
                <h3 className="font-heading font-semibold">{t.name}</h3>
                <p className="text-sm text-muted-foreground">{t.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </UserLayout>
  );
};

export default About;
