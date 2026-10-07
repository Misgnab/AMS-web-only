import React from "react";

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="app-system-footer" className="mt-auto py-2.5 px-4 text-center border-t border-slate-200/60 bg-white/50 backdrop-blur-xs">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="font-semibold text-slate-800 tracking-tight">Nabi Tech PLC</span>
          <span className="text-slate-300">•</span>
          <span>© {currentYear} All rights reserved.</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
          <a 
            href="tel:0911149746" 
            className="hover:text-blue-600 transition-colors"
          >
            0911149746
          </a>
          <span className="text-slate-300">•</span>
          <a 
            href="https://nabitechplc.com" 
            target="_blank" 
            rel="noreferrer" 
            className="hover:text-blue-600 transition-colors"
          >
            nabitechplc.com
          </a>
        </div>
      </div>
    </footer>
  );
};
