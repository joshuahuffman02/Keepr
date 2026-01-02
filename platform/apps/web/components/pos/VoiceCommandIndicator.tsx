"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, HelpCircle, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceCommandIndicatorProps {
  /** Whether voice is currently listening */
  isListening: boolean;
  /** Whether voice commands are supported */
  isSupported: boolean;
  /** Last recognized command */
  lastCommand: string | null;
  /** Last transcript (for debugging) */
  lastTranscript?: string;
  /** Toggle listening callback */
  onToggle: () => void;
  /** Available commands for help display */
  commands?: Array<{ phrase: string; description: string }>;
  /** Position on screen */
  position?: "top-right" | "bottom-right" | "bottom-left" | "top-left";
  /** Optional className */
  className?: string;
}

/**
 * Visual indicator for voice command status in POS.
 * Shows listening state, last command, and available commands help.
 */
export function VoiceCommandIndicator({
  isListening,
  isSupported,
  lastCommand,
  lastTranscript,
  onToggle,
  commands = [],
  position = "bottom-right",
  className,
}: VoiceCommandIndicatorProps) {
  const [showHelp, setShowHelp] = useState(false);

  if (!isSupported) return null;

  const positionClasses = {
    "top-right": "top-4 right-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "top-left": "top-4 left-4",
  };

  return (
    <>
      <div className={cn("fixed z-40 flex items-center gap-2", positionClasses[position], className)}>
        {/* Last command feedback */}
        <AnimatePresence>
          {lastCommand && (
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className="bg-action-primary text-action-primary-foreground px-3 py-1.5 rounded-full text-sm font-medium shadow-lg"
            >
              {lastCommand}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main mic button */}
        <motion.button
          onClick={onToggle}
            className={cn(
              "relative p-3 rounded-full shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
            isListening
              ? "bg-action-primary text-action-primary-foreground focus:ring-action-primary/60"
              : "bg-card text-foreground hover:bg-muted focus:ring-ring/40"
          )}
          whileTap={{ scale: 0.95 }}
          aria-label={isListening ? "Stop voice commands" : "Start voice commands"}
        >
          {isListening ? (
            <>
              <Mic className="h-5 w-5" />
              {/* Pulsing ring animation */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-action-primary/40"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.8, 0, 0.8],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </>
          ) : (
            <MicOff className="h-5 w-5" />
          )}
        </motion.button>

        {/* Help button */}
        {commands.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="bg-card/80 backdrop-blur-sm shadow-lg rounded-full"
            onClick={() => setShowHelp(true)}
            aria-label="Voice command help"
          >
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Help modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-action-primary" />
                <h2 className="font-semibold text-foreground">Voice Commands</h2>
              </div>
                <Button variant="ghost" size="icon" onClick={() => setShowHelp(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
                <p className="text-sm text-muted-foreground">
                  Say any of these phrases to control the POS:
                </p>

                <div className="space-y-2">
                  {commands.map((cmd, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                    >
                      <span className="text-action-primary font-medium text-sm whitespace-nowrap">
                        &quot;{cmd.phrase}&quot;
                      </span>
                      <span className="text-muted-foreground text-sm">{cmd.description}</span>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Tip: Speak clearly and wait for the feedback before the next command.
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debug transcript (dev only) */}
      {process.env.NODE_ENV === "development" && lastTranscript && (
        <div className="fixed bottom-20 right-4 bg-muted text-foreground text-xs px-2 py-1 rounded max-w-xs truncate">
          {lastTranscript}
        </div>
      )}
    </>
  );
}
