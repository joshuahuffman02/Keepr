"use client";

import { motion, AnimatePresence } from "framer-motion";

interface DancingSmoreProps {
  visible: boolean;
  onClose: () => void;
}

export function DancingSmore({ visible, onClose }: DancingSmoreProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative flex flex-col items-center"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{ type: "spring", bounce: 0.5 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dancing S'more */}
            <motion.div
              className="relative"
              animate={{
                y: [0, -15, 0, -10, 0],
                rotate: [0, -10, 0, 10, 0],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {/* S'more SVG */}
              <svg
                viewBox="0 0 120 100"
                className="w-32 h-28 drop-shadow-2xl"
              >
                {/* Bottom graham cracker */}
                <rect
                  x="10"
                  y="70"
                  width="100"
                  height="20"
                  rx="4"
                  fill="#C4A574"
                  stroke="#8B6914"
                  strokeWidth="2"
                />
                {/* Graham cracker texture lines */}
                <line x1="30" y1="75" x2="30" y2="85" stroke="#8B6914" strokeWidth="1" opacity="0.5" />
                <line x1="60" y1="75" x2="60" y2="85" stroke="#8B6914" strokeWidth="1" opacity="0.5" />
                <line x1="90" y1="75" x2="90" y2="85" stroke="#8B6914" strokeWidth="1" opacity="0.5" />

                {/* Chocolate layer */}
                <rect
                  x="15"
                  y="55"
                  width="90"
                  height="18"
                  rx="2"
                  fill="#5C4033"
                  stroke="#3D2817"
                  strokeWidth="1"
                />
                {/* Chocolate squares */}
                <line x1="45" y1="55" x2="45" y2="73" stroke="#3D2817" strokeWidth="1" opacity="0.5" />
                <line x1="75" y1="55" x2="75" y2="73" stroke="#3D2817" strokeWidth="1" opacity="0.5" />

                {/* Marshmallow (toasted) */}
                <ellipse
                  cx="60"
                  cy="42"
                  rx="38"
                  ry="20"
                  fill="#F5E6D3"
                  stroke="#D4C4A8"
                  strokeWidth="2"
                />
                {/* Toasted spots */}
                <ellipse cx="45" cy="38" rx="8" ry="6" fill="#C8A87A" opacity="0.6" />
                <ellipse cx="72" cy="45" rx="10" ry="5" fill="#B89860" opacity="0.5" />
                <ellipse cx="55" cy="50" rx="6" ry="4" fill="#C8A87A" opacity="0.4" />

                {/* Top graham cracker */}
                <rect
                  x="10"
                  y="15"
                  width="100"
                  height="20"
                  rx="4"
                  fill="#C4A574"
                  stroke="#8B6914"
                  strokeWidth="2"
                />
                {/* Graham cracker texture lines */}
                <line x1="30" y1="20" x2="30" y2="30" stroke="#8B6914" strokeWidth="1" opacity="0.5" />
                <line x1="60" y1="20" x2="60" y2="30" stroke="#8B6914" strokeWidth="1" opacity="0.5" />
                <line x1="90" y1="20" x2="90" y2="30" stroke="#8B6914" strokeWidth="1" opacity="0.5" />

                {/* Little arms */}
                <motion.g
                  animate={{
                    rotate: [-15, 15, -15],
                  }}
                  transition={{
                    duration: 0.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{ transformOrigin: "10px 50px" }}
                >
                  <line x1="10" y1="50" x2="-5" y2="35" stroke="#C4A574" strokeWidth="6" strokeLinecap="round" />
                </motion.g>
                <motion.g
                  animate={{
                    rotate: [15, -15, 15],
                  }}
                  transition={{
                    duration: 0.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{ transformOrigin: "110px 50px" }}
                >
                  <line x1="110" y1="50" x2="125" y2="35" stroke="#C4A574" strokeWidth="6" strokeLinecap="round" />
                </motion.g>

                {/* Cute face on marshmallow */}
                {/* Eyes */}
                <circle cx="50" cy="40" r="3" fill="#3D2817" />
                <circle cx="70" cy="40" r="3" fill="#3D2817" />
                {/* Eye shine */}
                <circle cx="51" cy="39" r="1" fill="white" />
                <circle cx="71" cy="39" r="1" fill="white" />
                {/* Happy mouth */}
                <path
                  d="M55 48 Q60 54 65 48"
                  fill="none"
                  stroke="#3D2817"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </motion.div>

            {/* Sparkles around the s'more */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2"
                style={{
                  left: `${50 + Math.cos((i * Math.PI * 2) / 8) * 80}px`,
                  top: `${50 + Math.sin((i * Math.PI * 2) / 8) * 60}px`,
                }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              >
                <svg viewBox="0 0 24 24" fill="#fbbf24" className="w-full h-full">
                  <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10L12 2Z" />
                </svg>
              </motion.div>
            ))}

            {/* Message */}
            <motion.p
              className="mt-6 text-xl font-bold text-white text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Konami Code Activated!
            </motion.p>
            <motion.p
              className="mt-2 text-sm text-white/80 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              You found a secret! Have a s'more.
            </motion.p>
            <motion.button
              className="mt-4 px-4 py-2 bg-card text-foreground rounded-full font-medium hover:bg-card/90 transition-colors"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              onClick={onClose}
            >
              Yum, thanks!
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
