import Navbar from "./Navbar";
import Footer from "./Footer";
import ChatbotWidget from "@/components/ChatbotWidget";

const UserLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex flex-col">
    <Navbar />
    <main className="flex-1 pt-16">{children}</main>
    <Footer />
    <ChatbotWidget />
  </div>
);

export default UserLayout;
