"use client";

import { useState, ChangeEvent } from "react";
import { Upload, Moon, Sun, RefreshCw } from "lucide-react";
import { extractVibrantColor } from "@/lib/colorExtractor";

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState<string>("#121212");
  const [rawColor, setRawColor] = useState<string>("#121212");
  const [contrastMode, setContrastMode] = useState<"vibrant" | "spotify">("vibrant");
  const [loading, setLoading] = useState<boolean>(false);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setImage(imageUrl);
    processImage(imageUrl, contrastMode);
  };

  const processImage = async (imgUrl: string, mode: "vibrant" | "spotify") => {
    setLoading(true);
    try {
      const targetContrast = mode === "vibrant" ? 4.5 : 12.5;
      const { hex, rawHex } = await extractVibrantColor(imgUrl, targetContrast);
      setBgColor(hex);
      setRawColor(rawHex);
    } catch (error) {
      console.error("Failed to extract color", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    const newMode = contrastMode === "vibrant" ? "spotify" : "vibrant";
    setContrastMode(newMode);
    if (image) {
      processImage(image, newMode);
    }
  };

  return (
    <div 
      className="min-h-screen transition-colors duration-1000 ease-in-out text-white p-8 flex flex-col items-center"
      style={{ 
        backgroundImage: `linear-gradient(to bottom, ${bgColor} 0%, #121212 100%)`,
        backgroundColor: "#121212"
      }}
    >
      <header className="w-full max-w-4xl flex justify-between items-center mb-12">
        <h1 className="text-2xl font-bold tracking-tight">Oklab Color Extractor</h1>
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleMode}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all"
          >
            {contrastMode === "vibrant" ? <Sun size={18} /> : <Moon size={18} />}
            <span className="text-sm font-medium">
              {contrastMode === "vibrant" ? "Vibrant Mode (4.5:1)" : "Spotify Mode (12.5:1)"}
            </span>
          </button>
          <a href="/demo" className="px-4 py-2 bg-[#1DB954] text-black font-bold rounded-full hover:scale-105 transition-transform text-sm">
            View Validation Demo
          </a>
        </div>
      </header>

      <main className="w-full max-w-4xl flex flex-col items-center gap-8">
        {!image ? (
          <label className="w-full max-w-md h-64 border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all group">
            <Upload className="w-12 h-12 text-white/50 group-hover:text-white/80 transition-colors mb-4" />
            <span className="text-white/60 font-medium group-hover:text-white/90">Click or drop an album cover</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        ) : (
          <div className="flex flex-col items-center gap-12 w-full">
            <div className="relative group">
              <img 
                src={image} 
                alt="Album Cover" 
                className="w-80 h-80 object-cover rounded-md shadow-2xl transition-transform duration-500 group-hover:scale-105"
              />
              <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-md">
                <RefreshCw className="w-8 h-8 text-white mb-2" />
                <span className="text-white font-medium">Change Image</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>

            <div className="w-full max-w-2xl bg-black/40 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl">
              <h2 className="text-xl font-bold mb-6 border-b border-white/10 pb-4">Color Analysis</h2>
              
              <div className="grid grid-cols-2 gap-8">
                <div className="flex flex-col gap-3">
                  <span className="text-sm text-white/60 uppercase tracking-wider font-bold">Raw Dominant Color</span>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl shadow-inner border border-white/10" style={{ backgroundColor: rawColor }} />
                    <div className="flex flex-col">
                      <span className="font-mono text-lg">{rawColor}</span>
                      <span className="text-xs text-white/40">Pre-contrast adjustment</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <span className="text-sm text-white/60 uppercase tracking-wider font-bold">Final Background Color</span>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl shadow-inner border border-white/10" style={{ backgroundColor: bgColor }} />
                    <div className="flex flex-col">
                      <span className="font-mono text-lg font-bold text-[#1DB954]">{bgColor}</span>
                      <span className="text-xs text-white/40">Adjusted for WCAG AA</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
