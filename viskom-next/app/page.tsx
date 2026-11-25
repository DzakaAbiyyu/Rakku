import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import AboutSection from "./components/AboutSection";

export default function Home() {
  return (
    <div className="min-h-full flex flex-col">
      <Navbar variant="landing" />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <AboutSection />
      </main>
    </div>
  );
}
