import React from 'react';
import { Check, Circle } from 'lucide-react';

export interface VerificationRequirementItem {
  id: string;
  label: string;
  isCompleted: boolean;
  hint?: string;
  actionTab?: 'profile' | 'photos';
  anchorId?: string;
}

interface VerificationRadialProgressProps {
  completedCount: number;
  totalCount: number;
  items: VerificationRequirementItem[];
  onNavigateTab?: (tab: 'profile' | 'photos', anchorId?: string) => void;
}

export const VerificationRadialProgress: React.FC<VerificationRadialProgressProps> = ({
  completedCount,
  totalCount,
  items,
  onNavigateTab,
}) => {
  const percentage = Math.round((completedCount / totalCount) * 100);

  // SVG Radial circle math
  const size = 140;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const isComplete = percentage >= 100;

  return (
    <div className="bg-slate-50/80 rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs">
      <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
        
        {/* Radial Progress Gauge */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg
              className="w-full h-full transform -rotate-90 drop-shadow-xs"
              viewBox={`0 0 ${size} ${size}`}
            >
              {/* Background circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                className="text-slate-200"
                strokeWidth={strokeWidth}
                stroke="currentColor"
                fill="transparent"
              />
              {/* Progress circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                className={`transition-all duration-700 ease-out ${
                  isComplete ? 'text-emerald-500' : 'text-orange-500'
                }`}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
              />
            </svg>

            {/* Centered Percentage Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
              <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                {percentage}%
              </span>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                completado
              </span>
            </div>
          </div>
        </div>

        {/* Requirements Checklist */}
        <div className="flex-1 w-full space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Progreso de verificación
            </h4>
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
              {completedCount} de {totalCount} requisitos completados
            </span>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex items-start sm:items-center justify-between p-2.5 rounded-2xl transition-colors ${
                  item.isCompleted
                    ? 'bg-emerald-50/70 text-emerald-950 border border-emerald-200/60'
                    : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      item.isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-400 border border-slate-300'
                    }`}
                  >
                    {item.isCompleted ? (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    ) : (
                      <Circle className="w-2.5 h-2.5 fill-current" />
                    )}
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${item.isCompleted ? 'text-emerald-900' : 'text-slate-800'}`}>
                      {item.label}
                    </p>
                    {item.hint && !item.isCompleted && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.hint}</p>
                    )}
                  </div>
                </div>

                {!item.isCompleted && item.actionTab && onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab(item.actionTab!, item.anchorId)}
                    className="ml-2 text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline shrink-0 cursor-pointer"
                  >
                    Completar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
