import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  { id: 'upload', label: 'Upload' },
  { id: 'signature', label: 'Sign' },
  { id: 'add-signature', label: 'Fields' },
  { id: 'download', label: 'Done' },
];

interface StepIndicatorProps {
  activeStep: string;
  onStepClick?: (step: string) => void;
}

export function StepIndicator({ activeStep, onStepClick }: StepIndicatorProps) {
  const activeIndex = STEPS.findIndex(s => s.id === activeStep);

  return (
    <div className="flex items-center justify-center gap-0 py-3 px-4">
      {STEPS.map((step, i) => {
        const isCompleted = i < activeIndex;
        const isActive = i === activeIndex;
        const isFuture = i > activeIndex;

        return (
          <div key={step.id} className="flex items-center">
            <motion.button
              type="button"
              onClick={() => onStepClick?.(step.id)}
              disabled={isFuture}
              whileHover={!isFuture ? { scale: 1.1 } : {}}
              whileTap={!isFuture ? { scale: 0.95 } : {}}
              className="flex flex-col items-center gap-1.5 pointer-events-auto"
            >
              <div className="relative">
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-primary/30"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                <motion.div
                  layout
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold relative z-10",
                    isCompleted && "bg-success text-white",
                    isActive && "bg-gradient-to-br from-primary to-secondary text-white shadow-glow",
                    isFuture && "bg-secondary/50 text-muted-foreground",
                  )}
                >
                  <AnimatePresence mode="wait">
                    {isCompleted ? (
                      <motion.span
                        key="check"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        transition={{ type: "spring", stiffness: 500, damping: 15 }}
                      >
                        <Check className="w-4 h-4" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 15 }}
                      >
                        {i + 1}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
              <motion.span
                className={cn(
                  "text-[10px] font-semibold transition-colors",
                  isActive && "text-primary",
                  isCompleted && "text-success",
                  isFuture && "text-muted-foreground",
                )}
                animate={isActive ? { y: [0, -2, 0] } : {}}
                transition={{ duration: 1.5, repeat: isActive ? Infinity : 0 }}
              >
                {step.label}
              </motion.span>
            </motion.button>
            {i < STEPS.length - 1 && (
              <div className="w-10 h-0.5 mx-1 rounded-full bg-secondary/50 relative overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-secondary rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: i < activeIndex ? "100%" : "0%" }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
