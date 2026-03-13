import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="relative w-14 h-7 bg-gray-200 dark:bg-gray-800 rounded-full p-1 transition-colors duration-300 focus:outline-none ring-1 ring-gray-300 dark:ring-gray-700"
      aria-label="Toggle Theme"
    >
      <div className="flex justify-between items-center px-1">
        <Sun className="w-3.5 h-3.5 text-orange-500" />
        <Moon className="w-3.5 h-3.5 text-blue-400" />
      </div>
      <div
        className={`absolute top-1 left-1 w-5 h-5 bg-white dark:bg-gray-300 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
          isDark ? 'translate-x-7' : 'translate-x-0'
        }`}
      />
    </button>
  );
};

export const LanguageToggle = () => {
  const { lang, toggleLang } = useLanguage();

  return (
    <button
      onClick={toggleLang}
      className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-all text-xs font-medium shadow-sm"
      aria-label="Toggle Language"
    >
      {lang === 'en' ? (
        <>
          <span className="text-base">🇬🇧</span>
          <span className="text-gray-700 dark:text-gray-300">EN</span>
        </>
      ) : (
        <>
          <span className="text-base">🇹🇷</span>
          <span className="text-gray-700 dark:text-gray-300">TR</span>
        </>
      )}
    </button>
  );
};
