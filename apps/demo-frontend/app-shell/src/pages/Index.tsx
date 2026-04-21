import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { HeroBackdrop } from "@/components/landing/HeroBackdrop";
import { IntroOverlay } from "@/components/landing/IntroOverlay";
import { MotionToggle } from "@/components/landing/MotionToggle";
import { Workflow } from "@/components/landing/Workflow";
import { Capabilities } from "@/components/landing/Capabilities";
import { Difference } from "@/components/landing/Difference";
import { Safety } from "@/components/landing/Safety";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";
import { SectionDivider } from "@/components/landing/SectionDivider";

const Index = () => {
  return (
    <div className="relative isolate min-h-screen bg-background text-foreground">
      <HeroBackdrop />
      <IntroOverlay />

      <div className="relative z-10">
        <Nav />
        <main>
          <Hero />
          <SectionDivider index="01" label="lifecycle" />
          <Workflow />
          <SectionDivider index="02" label="capabilities" />
          <Capabilities />
          <SectionDivider index="03" label="why us" />
          <Difference />
          <SectionDivider index="04" label="safety" />
          <Safety />
          <SectionDivider index="05" label="book" />
          <CTA />
        </main>
        <Footer />
      </div>
      <MotionToggle />
    </div>
  );
};

export default Index;
