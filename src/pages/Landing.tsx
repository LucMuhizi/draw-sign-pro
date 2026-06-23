import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  WifiOff, Shield, FileText, Fingerprint, Type, ScanLine,
  ArrowRight, Star, Check, ChevronDown, Zap, Globe, Smartphone
} from "lucide-react";
import { OfflineDemo } from "@/components/OfflineDemo";

const features = [
  {
    icon: WifiOff,
    title: "Works Offline",
    description: "No internet? No problem. All signing happens on your device. Syncs when you reconnect.",
    color: "text-orange-500",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Your documents never leave your device unless you choose cloud sync. End-to-end encrypted.",
    color: "text-green-500",
  },
  {
    icon: Type,
    title: "5 Field Types",
    description: "Signatures, typed names, dates, initials, and checkboxes — all render natively in the final PDF.",
    color: "text-blue-500",
  },
  {
    icon: FileText,
    title: "Word & PDF",
    description: "Sign .docx files directly — converted to HTML with mammoth.js, signed, output as PDF.",
    color: "text-purple-500",
  },
  {
    icon: Fingerprint,
    title: "Biometric Lock",
    description: "Protect your signatures with fingerprint or face ID. Only you can sign.",
    color: "text-red-500",
  },
  {
    icon: Zap,
    title: "Free Forever",
    description: "No subscriptions, no page limits, no watermarks. Full-featured signing at zero cost.",
    color: "text-amber-500",
  },
];

const comparisonData = [
  { feature: "Offline signing", signdocu: true, docusign: false, adobe: false, dropbox: false },
  { feature: "Free for individuals", signdocu: true, docusign: false, adobe: false, dropbox: false },
  { feature: "No account required", signdocu: true, docusign: false, adobe: false, dropbox: false },
  { feature: ".docx support", signdocu: true, docusign: false, adobe: false, dropbox: false },
  { feature: "Biometric lock", signdocu: true, docusign: true, adobe: true, dropbox: false },
  { feature: "5+ field types", signdocu: true, docusign: true, adobe: true, dropbox: true },
  { feature: "Privacy-first (local)", signdocu: true, docusign: false, adobe: false, dropbox: false },
  { feature: "Templates", signdocu: true, docusign: true, adobe: true, dropbox: true },
];

const testimonial = {
  quote: "Finally, a signing app that respects my privacy. No account needed, works offline, and it's actually free. This is what signing should be.",
  author: "A privacy-conscious user",
};

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

export default function Landing() {
  const navigate = useNavigate();
  const [showDemo, setShowDemo] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-lg text-foreground">SignDocu</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="rounded-xl text-sm">
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate("/login")} className="rounded-xl text-sm bg-gradient-to-r from-primary to-secondary text-white">
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-20 pb-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
            <WifiOff className="w-3 h-3" />
            Works completely offline
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight tracking-tight">
            Sign Documents.
            <br />
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Anywhere. Even Offline.
            </span>
          </h1>

          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Free document signing that works without internet. PDF, Word & images.
            Draw or type signatures. Your data stays on your device — no cloud required.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => navigate("/login")}
              size="lg"
              className="bg-gradient-to-r from-primary to-secondary text-white shadow-soft hover:shadow-glow px-10 h-14 text-base font-semibold rounded-2xl w-full sm:w-auto"
            >
              Start Signing Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowDemo(true)}
              className="border-border hover:border-primary/40 px-8 h-14 text-base rounded-2xl w-full sm:w-auto"
            >
              See How It Works
            </Button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Check className="w-3 h-3 text-success" /> No credit card</span>
            <span className="flex items-center gap-1"><Check className="w-3 h-3 text-success" /> No account needed</span>
            <span className="flex items-center gap-1"><Check className="w-3 h-3 text-success" /> Free forever</span>
          </div>
        </motion.div>
      </section>

      {/* ── Feature Grid ── */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            {...fadeUp}
            transition={{ delay: 0.1 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Everything You Need to Sign
            </h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              Built for individuals who value privacy, speed, and simplicity.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07, type: "spring", stiffness: 200 }}
              >
                <Card className="p-6 bg-card/50 backdrop-blur-sm border border-border/50 hover:border-border hover:shadow-soft transition-all h-full rounded-2xl">
                  <div className={`w-10 h-10 rounded-xl ${feat.color.replace("text-", "bg-")}/10 flex items-center justify-center mb-4`}>
                    <feat.icon className={`w-5 h-5 ${feat.color}`} />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{feat.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feat.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison Table ── */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              How We Compare
            </h2>
            <p className="mt-3 text-muted-foreground">
              SignDocu is built for individuals — not enterprise sales teams.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="overflow-x-auto rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-4 font-semibold text-foreground">Feature</th>
                  <th className="p-4 font-semibold text-primary text-center bg-primary/5">SignDocu</th>
                  <th className="p-4 font-semibold text-muted-foreground text-center">DocuSign</th>
                  <th className="p-4 font-semibold text-muted-foreground text-center">Adobe</th>
                  <th className="p-4 font-semibold text-muted-foreground text-center">Dropbox</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row) => (
                  <tr key={row.feature} className="border-b border-border/30 last:border-0">
                    <td className="p-4 text-foreground">{row.feature}</td>
                    {(["signdocu", "docusign", "adobe", "dropbox"] as const).map((col) => (
                      <td key={col} className={`p-4 text-center ${col === "signdocu" ? "bg-primary/5" : ""}`}>
                        {row[col] ? (
                          <Check className="w-4 h-4 inline text-success" />
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Three Steps to Sign
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Upload", desc: "Drag & drop any PDF, Word doc, or image. Works offline." },
              { step: "2", title: "Sign", desc: "Draw, type, or capture your signature. Save it for next time." },
              { step: "3", title: "Done", desc: "Place your signature, adjust, and download the signed PDF." },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="text-center"
              >
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg mb-4">
                  {s.step}
                </div>
                <h3 className="font-semibold text-foreground mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Signals ── */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: "Local-First", desc: "All processing happens on your device" },
              { icon: Globe, title: "No Cloud Required", desc: "Optional sync — your choice" },
              { icon: Smartphone, title: "Mobile Native", desc: "Built for Android with Capacitor" },
            ].map((signal, i) => (
              <motion.div
                key={signal.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="text-center p-6"
              >
                <signal.icon className="w-8 h-8 mx-auto text-primary mb-3" />
                <h4 className="font-semibold text-foreground mb-1">{signal.title}</h4>
                <p className="text-xs text-muted-foreground">{signal.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Testimonial */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12 p-8 bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl text-center max-w-2xl mx-auto"
          >
            <div className="flex justify-center gap-0.5 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-foreground italic leading-relaxed">"{testimonial.quote}"</p>
            <p className="text-sm text-muted-foreground mt-3">— {testimonial.author}</p>
          </motion.div>
        </div>
      </section>

      {/* ── CTA Footer ── */}
      <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="max-w-xl mx-auto text-center"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            Ready to Sign Offline?
          </h2>
          <p className="mt-3 text-muted-foreground">
            No account required. No cloud storage. Just fast, private signing.
          </p>
          <Button
            onClick={() => navigate("/login")}
            size="lg"
            className="mt-6 bg-gradient-to-r from-primary to-secondary text-white shadow-soft hover:shadow-glow px-10 h-14 text-base font-semibold rounded-2xl"
          >
            Start Signing Free
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-4 border-t border-border/50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>SignDocu — Free document signing that respects your privacy</span>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/login")} className="hover:text-foreground transition-colors">Sign In</button>
            <button onClick={() => setShowDemo(true)} className="hover:text-foreground transition-colors">How It Works</button>
          </div>
        </div>
      </footer>

      {/* ── Offline Demo Sheet ── */}
      <OfflineDemo open={showDemo} onDismiss={() => setShowDemo(false)} />
    </div>
  );
}
