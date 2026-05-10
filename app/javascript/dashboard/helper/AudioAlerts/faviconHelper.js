const getDefaultFavicon = () =>
  window.globalConfig?.LOGO_THUMBNAIL || '/brand-assets/logomfj.png';

export const showBadgeOnFavicon = () => {
  const favicons = document.querySelectorAll('.favicon');

  favicons.forEach(favicon => {
    favicon.href = getDefaultFavicon();
  });
};

export const initFaviconSwitcher = () => {
  const favicons = document.querySelectorAll('.favicon');

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      favicons.forEach(favicon => {
        favicon.href = getDefaultFavicon();
      });
    }
  });
};
