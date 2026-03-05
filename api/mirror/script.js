import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from '@google/genai';
import { Sparkles, ArrowRight, Flower2, Download } from 'lucide-react';
import { toPng } from 'html-to-image';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function BreathingLoader() {
  const [phaseIndex, setPhaseIndex] = useState(0);
  
  const phases = [
    { text: "Breathe in...", duration: 4, scale: 1.5 },
    { text: "Hold...", duration: 4, scale: 1.5 },
    { text: "Breathe out...", duration: 6, scale: 1 },
    { text: "Hold...", duration: 2, scale: 1 },
  ];

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    
    const runCycle = (index: number) => {
      if (!isMounted) return;
      setPhaseIndex(index);
      timeoutId = setTimeout(() => {
        runCycle((index + 1) % phases.length);
      }, phases[index].duration * 1000);
    };
    
    runCycle(0);
    
    return () => { 
      isMounted = false; 
      clearTimeout(timeoutId);
    };
  }, []);

  const currentPhase = phases[phaseIndex];

  return (
    <motion.div
      key="loading-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center space-y-16 min-h-[50vh]"
    >
      <div className="relative flex items-center justify-center w-32 h-32">
        <motion.div
          animate={{ scale: currentPhase.scale }}
          transition={{ duration: currentPhase.duration, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-sage-800/5 border border-sage-800/10"
        />
        <motion.div
          animate={{ scale: currentPhase.scale * 0.8 }}
          transition={{ duration: currentPhase.duration, ease: "easeInOut" }}
          className="absolute inset-4 rounded-full bg-rose-800/5 border border-rose-800/10"
        />
        <Flower2 className="w-8 h-8 text-rose-800/40 relative z-10" strokeWidth={1} />
      </div>
      
      <div className="h-8 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={currentPhase.text}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.5 }}
            className="font-serif text-2xl text-sage-800/60 italic tracking-wide"
          >
            {currentPhase.text}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

interface FlowerResult {
  flowerName: string;
  botanicalMeaning: string;
  quote: string;
  author: string;
  imagePrompt: string;
  imageUrl?: string;
}

export default function App() {
  const [mood, setMood] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FlowerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleSave = async () => {
    if (!cardRef.current || !result) return;
    setIsSaving(true);
    try {
      const dataUrl = await toPng(cardRef.current, { 
        cacheBust: true, 
        quality: 0.95,
        pixelRatio: 2
      });
      const link = document.createElement('a');
      link.download = `${result.flowerName.replace(/\s+/g, '-').toLowerCase()}-reflection.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to save image', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReveal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mood.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    const startTime = Date.now();
    const MIN_LOAD_TIME = 16000;

    try {
      // 1. Analyze mood and get flower details
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `The user's heart is feeling: "${mood}". Analyze this mood and choose a specific flower that matches it. Provide the flower's name, its botanical meaning, an inspiring quote from a female author related to this feeling or flower, and a detailed visual prompt to generate a beautiful, high-end, aesthetic, soft pastel image of this flower.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              flowerName: { type: Type.STRING, description: 'The name of the flower' },
              botanicalMeaning: { type: Type.STRING, description: 'The botanical meaning or symbolism of the flower' },
              quote: { type: Type.STRING, description: 'An inspiring quote from a female author' },
              author: { type: Type.STRING, description: 'The name of the female author' },
              imagePrompt: { type: Type.STRING, description: 'A detailed visual prompt for an image generation model to create a beautiful, soft pastel, high-end aesthetic image of this flower' },
            },
            required: ['flowerName', 'botanicalMeaning', 'quote', 'author', 'imagePrompt'],
          },
        },
      });

      const text = response.text;
      if (!text) throw new Error('Failed to generate flower details.');
      
      const flowerData: FlowerResult = JSON.parse(text);

      // 2. Generate the flower image
      const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: `A beautiful, high-end, aesthetic, soft pastel image of a flower. ${flowerData.imagePrompt} The image should feel like a high-end wellness or meditation app, elegant, serene, and feminine.`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: '3:4',
            imageSize: '1K',
          },
        },
      });

      let imageUrl = '';
      for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (!imageUrl) throw new Error('Failed to generate flower image.');

      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < MIN_LOAD_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOAD_TIME - elapsedTime));
      }

      setResult({ ...flowerData, imageUrl });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while revealing your flower.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {!result && !isLoading && (
            <motion.div
              key="input-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center text-center space-y-12"
            >
              <div className="space-y-4">
                <h2 className="text-sm uppercase tracking-[0.2em] text-rose-800/60 font-medium">
                  The Floral Mirror
                </h2>
                <h1 className="text-5xl md:text-6xl font-serif font-light text-sage-800 leading-tight">
                  How is your heart <br />
                  <span className="italic text-rose-800/80">feeling today?</span>
                </h1>
              </div>

              <form onSubmit={handleReveal} className="w-full max-w-md space-y-8">
                <div className="relative">
                  <input
                    type="text"
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    placeholder="e.g., A little overwhelmed but hopeful..."
                    className="w-full bg-transparent border-b border-sage-800/20 py-4 px-2 text-center text-lg md:text-xl font-serif focus:outline-none focus:border-rose-800/40 transition-colors placeholder:text-sage-800/30"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={!mood.trim()}
                  className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-sage-800 text-sage-50 rounded-full overflow-hidden transition-all hover:bg-sage-800/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-medium tracking-wide text-sm uppercase">Reveal My Flower</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
              
              {error && (
                <p className="text-rose-800/80 text-sm mt-4">{error}</p>
              )}
            </motion.div>
          )}

          {isLoading && <BreathingLoader />}

          {result && !isLoading && (
            <motion.div
              key="result-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex flex-col items-center"
            >
              {/* The capture area */}
              <div className="flex justify-center w-full">
                <div 
                  ref={cardRef}
                  className="w-full max-w-[420px] aspect-[9/16] relative flex flex-col items-center bg-gradient-to-br from-sage-50 to-rose-50 p-6 sm:p-8 shadow-sm overflow-hidden"
                >
                  {/* Floral Border */}
                  <div className="absolute inset-3 border border-sage-800/20 pointer-events-none" />
                  <div className="absolute inset-4 border border-sage-800/10 pointer-events-none" />
                  
                  {/* Corner Ornaments */}
                  <Flower2 className="absolute top-2 left-2 w-5 h-5 text-sage-800/30" strokeWidth={1} />
                  <Flower2 className="absolute top-2 right-2 w-5 h-5 text-sage-800/30" strokeWidth={1} />
                  <Flower2 className="absolute bottom-2 left-2 w-5 h-5 text-sage-800/30" strokeWidth={1} />
                  <Flower2 className="absolute bottom-2 right-2 w-5 h-5 text-sage-800/30" strokeWidth={1} />

                  {/* Content Container */}
                  <div className="relative z-10 flex flex-col h-full w-full justify-between">
                    
                    {/* Top: Description */}
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6, duration: 0.8 }}
                      className="text-center mt-4 mb-4 h-[120px] flex flex-col justify-center"
                    >
                      <h3 className="font-serif text-3xl text-sage-800 mb-1 line-clamp-1">{result.flowerName}</h3>
                      <p className="text-[10px] uppercase tracking-widest text-rose-800/70 font-medium mb-2">Botanical Meaning</p>
                      <p className="text-sm text-sage-800/80 leading-snug line-clamp-3 px-2">{result.botanicalMeaning}</p>
                    </motion.div>

                    {/* Middle: Image */}
                    <div className="w-full flex-1 relative mb-4">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3, duration: 0.8 }}
                        className="absolute inset-0 rounded-t-full rounded-b-xl overflow-hidden shadow-xl shadow-sage-800/10 border-4 border-white/50"
                      >
                        {result.imageUrl && (
                          <img 
                            src={result.imageUrl} 
                            alt={result.flowerName}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-t-full rounded-b-xl" />
                      </motion.div>
                    </div>

                    {/* Bottom: Quote */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9, duration: 0.8 }}
                      className="text-center h-[140px] flex flex-col justify-center items-center px-2 mb-4"
                    >
                      <Sparkles className="w-4 h-4 text-rose-800/30 mb-3" />
                      <blockquote className="font-serif text-lg text-sage-800 leading-relaxed italic line-clamp-3 mb-2">
                        "{result.quote}"
                      </blockquote>
                      <p className="text-[10px] uppercase tracking-widest text-sage-800/60 font-medium">
                        — {result.author}
                      </p>
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-6 pt-12">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-sage-800 text-sage-50 rounded-full overflow-hidden transition-all hover:bg-sage-800/90 disabled:opacity-50"
                >
                  <span className="font-medium tracking-wide text-sm uppercase">
                    {isSaving ? 'Saving...' : 'Save to Camera Roll'}
                  </span>
                  <Download className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setResult(null);
                    setMood('');
                  }}
                  className="text-sm font-medium text-sage-800/50 hover:text-sage-800 transition-colors uppercase tracking-widest border-b border-transparent hover:border-sage-800/30 pb-1"
                >
                  Reflect Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}