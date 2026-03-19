/**
 * Theme Toggle Component
 *
 * Supports three modes: Light, Dark, System
 * Features:
 * - Smooth transitions
 * - Accessible (keyboard navigation, ARIA labels)
 * - System preference indicator
 */
import React from 'react';
import { useTheme, Theme, ResolvedTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

// Icons for each theme mode
const ThemeIcon: React.FC<{ theme: Theme | ResolvedTheme; size?: 'sm' | 'md' | 'lg' }> = ({
  theme,
  size = 'md'
}) => {
  const sizeClass = {
    sm: 'text-sm',
    md: 'text-xl',
    lg: 'text-2xl'
  }[size];

  switch (theme) {
    case 'light':
      return <span className={sizeClass}>☀️</span>;
    case 'dark':
      return <span className={sizeClass}>🌙</span>;
    case 'system':
      return <span className={sizeClass}>💻</span>;
    default:
      return <span className={sizeClass}>☀️</span>;
  }
};

/**
 * Simple toggle button (light/dark only)
 */
export const ThemeToggle: React.FC = () => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { t } = useTranslation('settings');

  return (
    <button
      onClick={toggleTheme}
      className="
        relative
        inline-flex
        items-center
        justify-center
        w-14
        h-8
        rounded-full
        bg-gray-200
        dark:bg-gray-700
        transition-all
        duration-300
        focus:outline-none
        focus-visible:ring-2
        focus-visible:ring-sky
        focus-visible:ring-offset-2
        dark:focus-visible:ring-offset-dark-surface
        touch-target
      "
      aria-label={resolvedTheme === 'dark' ? t('theme_light', 'מצב בהיר') : t('theme_dark', 'מצב כהה')}
      title={resolvedTheme === 'dark' ? t('theme_light', 'מצב בהיר') : t('theme_dark', 'מצב כהה')}
    >
      {/* Toggle circle */}
      <span
        className={`
          absolute
          left-1
          top-1
          w-6
          h-6
          rounded-full
          bg-white
          dark:bg-gray-900
          shadow-md
          transform
          transition-transform
          duration-300
          flex
          items-center
          justify-center
          ${resolvedTheme === 'dark' ? 'translate-x-6' : 'translate-x-0'}
        `}
      >
        <ThemeIcon theme={resolvedTheme} size="sm" />
      </span>

      {/* Background icons */}
      <span className="absolute left-1.5 top-1.5 text-yellow-500 text-xs opacity-50">
        ☀️
      </span>
      <span className="absolute right-1.5 top-1.5 text-blue-400 text-xs opacity-50">
        🌙
      </span>
    </button>
  );
};

/**
 * Three-way toggle (Light / System / Dark)
 */
export const ThemeToggleTriple: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation('settings');

  const options: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: t('theme_light', 'בהיר'), icon: '☀️' },
    { value: 'system', label: t('theme_system', 'מערכת'), icon: '💻' },
    { value: 'dark', label: t('theme_dark', 'כהה'), icon: '🌙' },
  ];

  return (
    <div
      className="inline-flex rounded-lg bg-gray-200 dark:bg-dark-surface p-1 gap-1"
      role="radiogroup"
      aria-label={t('theme', 'ערכת נושא')}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => setTheme(option.value)}
          className={`
            px-3 py-2 rounded-md text-sm font-medium
            transition-all duration-200
            focus:outline-none focus-visible:ring-2 focus-visible:ring-sky
            ${theme === option.value
              ? 'bg-white dark:bg-dark-border text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }
          `}
          role="radio"
          aria-checked={theme === option.value}
          title={option.label}
        >
          <span className="flex items-center gap-1.5">
            <span>{option.icon}</span>
            <span className="hidden sm:inline">{option.label}</span>
          </span>
        </button>
      ))}
    </div>
  );
};

/**
 * Theme Toggle with Label (for Settings page)
 */
export const ThemeToggleWithLabel: React.FC = () => {
  const { theme, resolvedTheme, systemTheme } = useTheme();
  const { t } = useTranslation('settings');

  // Get display text based on current theme
  const getThemeDisplayText = () => {
    if (theme === 'system') {
      return `${t('theme_system', 'מערכת')} (${systemTheme === 'dark' ? t('theme_dark', 'כהה') : t('theme_light', 'בהיר')})`;
    }
    return theme === 'dark' ? t('theme_dark', 'כהה') : t('theme_light', 'בהיר');
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-dark-surface rounded-lg shadow-sm border border-gray-200 dark:border-dark-border">
      <div className="flex items-center gap-3">
        <span className="text-2xl">
          <ThemeIcon theme={resolvedTheme} size="lg" />
        </span>
        <div>
          <h3 className="font-medium text-gray-900 dark:text-dark-text">
            {t('theme', 'ערכת נושא')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-300">
            {getThemeDisplayText()}
          </p>
        </div>
      </div>
      <ThemeToggleTriple />
    </div>
  );
};

/**
 * Dropdown Theme Selector
 */
export const ThemeDropdown: React.FC = () => {
  const { theme, setTheme, resolvedTheme, systemTheme } = useTheme();
  const { t } = useTranslation('settings');
  const [isOpen, setIsOpen] = React.useState(false);

  const options: { value: Theme; label: string; icon: string; description: string }[] = [
    {
      value: 'light',
      label: t('theme_light', 'בהיר'),
      icon: '☀️',
      description: t('theme_light_desc', 'מצב בהיר לשעות היום')
    },
    {
      value: 'dark',
      label: t('theme_dark', 'כהה'),
      icon: '🌙',
      description: t('theme_dark_desc', 'מצב כהה לשעות הלילה')
    },
    {
      value: 'system',
      label: t('theme_system', 'מערכת'),
      icon: '💻',
      description: t('theme_system_desc', 'מתאים להגדרות המערכת')
    },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-2 px-4 py-2
          bg-white dark:bg-dark-surface
          border border-gray-200 dark:border-dark-border
          rounded-lg shadow-sm
          hover:bg-gray-50 dark:hover:bg-dark-border
          transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-sky
        "
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <ThemeIcon theme={resolvedTheme} size="md" />
        <span className="text-gray-700 dark:text-dark-text">
          {options.find(o => o.value === theme)?.label}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div
            className="
              absolute right-0 mt-2 w-64 z-20
              bg-white dark:bg-dark-surface
              border border-gray-200 dark:border-dark-border
              rounded-lg shadow-lg
              py-1
              animate-fade-in
            "
            role="listbox"
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setTheme(option.value);
                  setIsOpen(false);
                }}
                className={`
                  w-full px-4 py-3 flex items-start gap-3
                  hover:bg-gray-50 dark:hover:bg-dark-border
                  transition-colors text-start
                  ${theme === option.value ? 'bg-sky/10' : ''}
                `}
                role="option"
                aria-selected={theme === option.value}
              >
                <span className="text-xl">{option.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-dark-text">
                      {option.label}
                    </span>
                    {theme === option.value && (
                      <span className="text-sky">✓</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-300">
                    {option.description}
                  </p>
                  {option.value === 'system' && (
                    <p className="text-xs text-gray-400 dark:text-gray-300 mt-1">
                      כרגע: {systemTheme === 'dark' ? 'כהה' : 'בהיר'}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ThemeToggle;
