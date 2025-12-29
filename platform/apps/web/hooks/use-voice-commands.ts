"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface VoiceCommand {
  /** Command phrases that trigger this action (case-insensitive) */
  phrases: string[];
  /** Action to execute when command is recognized */
  action: () => void;
  /** Optional description for help display */
  description?: string;
}

interface UseVoiceCommandsOptions {
  /** Language for speech recognition (default: "en-US") */
  language?: string;
  /** Commands to register */
  commands?: VoiceCommand[];
  /** Callback when speech is detected but no command matches */
  onUnrecognized?: (transcript: string) => void;
  /** Callback when recognition starts */
  onStart?: () => void;
  /** Callback when recognition ends */
  onEnd?: () => void;
  /** Callback for errors */
  onError?: (error: string) => void;
  /** Auto-restart recognition after command (default: true) */
  continuous?: boolean;
  /** Confidence threshold 0-1 (default: 0.5) */
  confidenceThreshold?: number;
}

interface UseVoiceCommandsReturn {
  /** Whether voice recognition is currently active */
  isListening: boolean;
  /** Start listening for voice commands */
  startListening: () => void;
  /** Stop listening */
  stopListening: () => void;
  /** Toggle listening state */
  toggleListening: () => void;
  /** Whether browser supports speech recognition */
  isSupported: boolean;
  /** Last recognized transcript */
  lastTranscript: string;
  /** Last matched command description */
  lastCommand: string | null;
  /** Register a new command dynamically */
  registerCommand: (command: VoiceCommand) => void;
  /** Unregister a command by its first phrase */
  unregisterCommand: (phrase: string) => void;
  /** Get all registered commands */
  getCommands: () => VoiceCommand[];
}

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

/**
 * Hook for voice command recognition using Web Speech API.
 * Perfect for hands-free POS operation.
 *
 * @example
 * const { isListening, startListening, stopListening, isSupported } = useVoiceCommands({
 *   commands: [
 *     { phrases: ["add item", "add product"], action: () => console.log("Adding item") },
 *     { phrases: ["checkout", "pay now"], action: () => handleCheckout() },
 *     { phrases: ["clear cart", "empty cart"], action: () => clearCart() },
 *   ],
 * });
 */
export function useVoiceCommands(options: UseVoiceCommandsOptions = {}): UseVoiceCommandsReturn {
  const {
    language = "en-US",
    commands: initialCommands = [],
    onUnrecognized,
    onStart,
    onEnd,
    onError,
    continuous = true,
    confidenceThreshold = 0.5,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [commands, setCommands] = useState<VoiceCommand[]>(initialCommands);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);

  // Check browser support
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognitionAPI);
    }
  }, []);

  // Initialize recognition
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = continuous;
    recognition.interimResults = false;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsListening(true);
      onStart?.();
    };

    recognition.onend = () => {
      setIsListening(false);
      onEnd?.();

      // Auto-restart if configured
      if (shouldRestartRef.current && continuous) {
        try {
          recognition.start();
        } catch {
          // Ignore if already started
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "aborted" is normal when stopping
      if (event.error !== "aborted") {
        onError?.(event.error);
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const last = event.results[event.results.length - 1];
      if (!last.isFinal) return;

      const transcript = last[0].transcript.toLowerCase().trim();
      const confidence = last[0].confidence;

      setLastTranscript(transcript);

      if (confidence < confidenceThreshold) {
        onUnrecognized?.(transcript);
        return;
      }

      // Find matching command
      let matched = false;
      for (const command of commands) {
        for (const phrase of command.phrases) {
          if (transcript.includes(phrase.toLowerCase())) {
            setLastCommand(command.description || phrase);
            command.action();
            matched = true;
            break;
          }
        }
        if (matched) break;
      }

      if (!matched) {
        setLastCommand(null);
        onUnrecognized?.(transcript);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [commands, language, continuous, confidenceThreshold, onStart, onEnd, onError, onUnrecognized]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    shouldRestartRef.current = true;
    try {
      recognitionRef.current.start();
    } catch {
      // Already started, ignore
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    shouldRestartRef.current = false;
    recognitionRef.current.stop();
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const registerCommand = useCallback((command: VoiceCommand) => {
    setCommands((prev) => [...prev, command]);
  }, []);

  const unregisterCommand = useCallback((phrase: string) => {
    setCommands((prev) =>
      prev.filter((cmd) => !cmd.phrases.some((p) => p.toLowerCase() === phrase.toLowerCase()))
    );
  }, []);

  const getCommands = useCallback(() => commands, [commands]);

  return {
    isListening,
    startListening,
    stopListening,
    toggleListening,
    isSupported,
    lastTranscript,
    lastCommand,
    registerCommand,
    unregisterCommand,
    getCommands,
  };
}

// Pre-defined POS commands for easy integration
export const POS_VOICE_COMMANDS = {
  ADD_ITEM: ["add item", "add product", "new item"],
  REMOVE_ITEM: ["remove item", "delete item", "remove last"],
  CHECKOUT: ["checkout", "pay now", "process payment", "complete order"],
  CLEAR_CART: ["clear cart", "empty cart", "start over", "clear all"],
  APPLY_DISCOUNT: ["apply discount", "add discount", "discount"],
  CASH_PAYMENT: ["cash payment", "pay cash", "cash"],
  CARD_PAYMENT: ["card payment", "pay card", "credit card", "debit card"],
  SPLIT_PAYMENT: ["split payment", "split bill"],
  VOID_TRANSACTION: ["void transaction", "cancel order", "void order"],
  PRINT_RECEIPT: ["print receipt", "print bill"],
  HELP: ["help", "commands", "what can i say"],
  QUANTITY: ["quantity", "times", "pieces"],
};
