"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface DemoData {
  id: string;
  title: string;
  artist: string;
  imgUrl: string;
  truthColor: string;
  calcColorPrimary: string;
  calcColorSecondary: string;
  deltaE1: string;
  deltaE2: string;
  bestDeltaE: string;
  pass: boolean;
}

export default function DemoPage() {
  const [data, setData] = useState<DemoData[]>([]);
  const [dataset, setDataset] = useState<'korea' | 'global' | 'japan'>('korea');

  useEffect(() => {
    setData([]); // clear data while loading
    let url = '/demo-data.json';
    if (dataset === 'global') url = '/demo-data-global.json';
    if (dataset === 'japan') url = '/demo-data-japan.json';
    
    fetch(url)
      .then(res => res.json())
      .then(json => setData(json))
      .catch(err => console.error("Could not load demo data:", err));
  }, [dataset]);

  return (
    <div className="min-h-screen bg-[#121212] text-white p-8 font-sans">
      <header className="mb-12 border-b border-gray-800 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Spotify Color Algorithm Demo</h1>
          <p className="text-gray-400">Comparing Spotify Ground Truth vs Our Reverse-Engineered Algorithm</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-[#181818] p-1 rounded-lg flex border border-gray-800">
            <button 
              onClick={() => setDataset('korea')}
              className={`px-4 py-2 rounded-md font-bold text-sm transition-colors ${dataset === 'korea' ? 'bg-[#1DB954] text-black' : 'text-gray-400 hover:text-white'}`}
            >
              South Korea Top 50
            </button>
            <button 
              onClick={() => setDataset('global')}
              className={`px-4 py-2 rounded-md font-bold text-sm transition-colors ${dataset === 'global' ? 'bg-[#1DB954] text-black' : 'text-gray-400 hover:text-white'}`}
            >
              Global Top 50
            </button>
            <button 
              onClick={() => setDataset('japan')}
              className={`px-4 py-2 rounded-md font-bold text-sm transition-colors ${dataset === 'japan' ? 'bg-[#1DB954] text-black' : 'text-gray-400 hover:text-white'}`}
            >
              Japan Top 50
            </button>
          </div>
          <Link href="/" className="px-4 py-2 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform text-sm">
            Back to Extractor
          </Link>
        </div>
      </header>

      {data.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {data.map((item, idx) => (
            <div key={idx} className="bg-[#181818] rounded-xl overflow-hidden hover:bg-[#282828] transition-colors duration-300 group">
              <div className="relative h-48 w-full flex">
                {/* Left Side: Truth */}
                <div 
                  className="w-1/2 h-full flex flex-col justify-end p-4 transition-opacity duration-300"
                  style={{ backgroundColor: item.truthColor }}
                >
                  <span className="text-xs font-bold text-white/70 uppercase tracking-widest drop-shadow-md">Spotify Truth</span>
                  <span className="font-mono text-sm text-white drop-shadow-md">{item.truthColor}</span>
                </div>
                
                {/* Right Side: Calc (Dual Candidates) */}
                <div className="w-1/2 h-full flex flex-col">
                  {/* Candidate 1 */}
                  <div 
                    className="h-1/2 w-full flex flex-col justify-end p-2 transition-opacity duration-300 relative"
                    style={{ backgroundColor: item.calcColorPrimary }}
                  >
                    <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest drop-shadow-md text-right">Primary</span>
                    <span className="font-mono text-xs text-white drop-shadow-md text-right">{item.calcColorPrimary}</span>
                    {Number(item.deltaE1) <= 6.0 && <span className="absolute top-1 right-2 text-green-400 font-bold text-xs">✓ MATCH</span>}
                  </div>
                  {/* Candidate 2 */}
                  <div 
                    className="h-1/2 w-full flex flex-col justify-end p-2 transition-opacity duration-300 relative"
                    style={{ backgroundColor: item.calcColorSecondary }}
                  >
                    <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest drop-shadow-md text-right">Secondary</span>
                    <span className="font-mono text-xs text-white drop-shadow-md text-right">{item.calcColorSecondary}</span>
                    {Number(item.deltaE2) <= 6.0 && <span className="absolute top-1 right-2 text-green-400 font-bold text-xs">✓ MATCH</span>}
                  </div>
                </div>

                {/* Album Art Overlay */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                  <Image 
                    src={item.imgUrl} 
                    alt={item.title} 
                    width={100} 
                    height={100} 
                    className="rounded-md object-cover border border-white/10"
                    unoptimized
                  />
                </div>
              </div>
              
              <div className="p-5">
                <h3 className="font-bold text-lg truncate" title={item.title}>{item.title}</h3>
                <p className="text-gray-400 text-sm truncate" title={item.artist}>{item.artist}</p>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 uppercase">Best Delta E</span>
                    <span className="font-mono text-sm font-bold">{item.bestDeltaE}</span>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-bold ${item.pass ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {item.pass ? 'MATCH (dE < 6)' : 'MISMATCH'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
