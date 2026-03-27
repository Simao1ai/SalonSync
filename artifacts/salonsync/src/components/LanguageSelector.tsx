import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

export function LanguageSelector() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("es") ? "es" : "en";

  return (
    <div className="relative group">
      <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors text-xs">
        <Globe className="w-3.5 h-3.5" />
        <span className="uppercase font-medium">{current}</span>
      </button>
      <div className="absolute right-0 top-full mt-1 bg-[#1A2234] border border-white/10 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 z-50 min-w-[140px]">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
              current === lang.code
                ? "text-primary bg-primary/10"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
